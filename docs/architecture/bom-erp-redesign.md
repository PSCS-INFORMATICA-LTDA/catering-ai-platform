# BOM ERP — redesenho conceitual

**Ambiente:** DEV only (`yasprgtlqclwsjcshtls`)  
**Status:** arquitetura para decisão — **não implementar nesta rodada**  
**Baseline atual:** `operational_material_rules` (Fase 1.5) + snapshot em `service_order_materials`

---

## 1. Estado atual

Hoje a BOM operacional é uma **regra plana por origem comercial**:

| Campo | Papel |
|-------|--------|
| `operational_material_rules.company_id` | Tenant |
| `source_type` | `package` \| `additional` \| `rule` |
| `source_id` | UUID do pacote/adicional |
| `material_catalog_item_id` | Componente (opcional) |
| `calculation_type` | `fixed` \| `per_guest` \| `tier` |
| `guest_basis` | `billable_guests` \| `adults` \| `children` \| `total_guests` |
| `tier_json` | Faixas `{ min_guests, max_guests, quantity }` |
| `rounding_rule` | `none` \| `ceil` \| `floor` \| `round` |

Explosão na conversão Quote→OS (`generateOrderMaterialsFromBom`):

1. Lê regras ativas da empresa para o pacote e adicionais da cotação.
2. Calcula quantidade.
3. Insere `service_order_materials` (**snapshot histórico**, 1 linha por regra).
4. OS já existente **não regenera**. Alterar a regra depois **não** muda OS antiga.

Separação preservada (não confundir):

| Conceito | O que é |
|----------|---------|
| Itens vendidos | Pacote / adicional / serviço que o cliente comprou |
| BOM | Como montar/executar aquilo |
| Materiais da OS | Explosão/snapshot operacional |
| Estoque | Saldo físico + movimentos |
| Checklist | Tarefas |

---

## 2. Problemas de `operational_material_rules`

1. **Não é estrutura de item.** A regra aponta para pacote/adicional, não para um item-pai versionado.
2. **Não há kit/evento mestre.** Não dá para cadastrar “Evento até 12 pessoas” como item e associar carne, cooler, pegador, pratos…
3. **Sem versionamento / effective dates.** Qualquer edição altera o futuro sem histórico de BOM.
4. **Sem quantidade por unidade do pai.** Só fixo, por pessoa ou faixa de convidados.
5. **Pacote ≠ item mestre.** `packages` e `catalog_items` são cadastros paralelos; a BOM não unifica.
6. **Componente opcionalmente sem catálogo** (`material_catalog_item_id` nullable) — dificulta estoque e Cardex.
7. **Não há BOM multinível** (kit → subkit → componente).
8. Empresa A não herda CDL (correto), mas também **não há template PSCS** futuro.

O que **pode e deve ser reutilizado**:

- `company_id` obrigatório (sem herança automática).
- `fixed` / `per_guest` / `tier` + `guest_basis` + `rounding_rule`.
- Snapshot na OS (`service_order_materials` + `bom_rule_id` hoje).
- Tipos `consumable` \| `returnable` \| `equipment` \| `disposable`.
- Idempotência da explosão (não reprocessar OS existente).

---

## 3. Item mestre (catalog_items)

**Recomendação:** um cadastro mestre (`catalog_items`) por empresa, com atributos/flags — **não** criar tabelas paralelas por “produto vs material vs equipamento”.

Flags/atributos já existentes (reusar):

- `item_type` (`PRODUCT`, `EQUIPMENT`, `SUPPLY`, …)
- `operational_item`
- `can_be_package_item` / `can_be_side_item` / `can_be_additional` / `can_be_option_choice`
- `inventory_enabled`
- `customer_visible`
- `unit` / `stock_unit`

Papéis conceituais no **mesmo** item:

| Papel | Como representar |
|-------|------------------|
| Produto vendido | `customer_visible` + preço |
| Material / consumível | `operational_item` + `material_type` futuro no item ou só na BOM |
| Equipamento | `item_type=EQUIPMENT` |
| Descartável | `item_type=SUPPLY` / tipo operacional `disposable` |
| Pacote/kit/evento | novo `item_type=KIT` (ou `EVENT_KIT`) **com BOM** |
| Adicional | flag `can_be_additional` |
| Serviço | `item_type=SERVICE` quando aplicável (sem estoque) |

`packages` permanece o **veículo comercial** (preço, mídia, opções). Evolução: pacote aponta para `catalog_item_id` kit (opcional na migração). Não copiar JDE literalmente (F4101/F3002) — só o conceito: item mestre + estrutura.

---

## 4. BOM header / components (proposta — não criar agora)

### `item_bom_headers` (conceitual)

| Campo | Notas |
|-------|--------|
| id | PK |
| company_id | **obrigatório** — Empresa A ≠ Empresa B |
| parent_item_id | FK `catalog_items` (kit/evento/pacote-item) |
| version | inteiro / semver interno |
| status | `draft` \| `active` \| `obsolete` |
| effective_from / effective_to | vigência |
| description | |
| created_at / created_by | auditoria |

Uma BOM ativa por `(company_id, parent_item_id)` no recorte de data (unique parcial).

### `item_bom_components` (conceitual)

| Campo | Notas |
|-------|--------|
| id | PK |
| company_id | denormalizado p/ RLS |
| bom_id | FK header |
| component_item_id | FK `catalog_items` — preferir **obrigatório** |
| line_number / sort_order | |
| quantity | |
| unit | sem conversão automática (igual estoque v1) |
| calculation_basis | ver §5 |
| rounding_rule | reusar atual |
| min_qty / max_qty | clamp |
| guest_basis | se basis = per_person / tier |
| tier_json | reusar formato atual |
| effective_from / effective_to | override de linha (opcional) |
| notes | |

**Não criar estas tabelas nesta rodada.**

---

## 5. Regras de quantidade

| Basis | Exemplo | Estado |
|-------|---------|--------|
| `fixed` | 1 cooler por evento | **já existe** |
| `per_person` | 1 prato por convidado | **já existe** (`per_guest`) |
| `tier` | 1 cooler 1–20; 2 de 21–40 | **já existe** |
| `per_parent_qty` | 1 kit vendido → X componentes | **preparar, não implementar** |
| fórmula arbitrária | engine livre | **fora de escopo** |

Preparar coluna/extensão `calculation_basis` incluindo `per_parent_qty`. Não criar motor de fórmulas agora.

---

## 6. Item de evento / kit

Cadastro alvo: **“Evento até 12 pessoas”** como item mestre (`KIT`) da empresa, com BOM:

Carne, cooler, pegador, facas, tábuas, pratos, talheres, guardanapos, demais operacionais.

Uso futuro: Pacote comercial referencia o kit; na conversão Quote→OS a BOM **ativa na data do evento** explode para `service_order_materials`.

---

## 7. Multiempresa

- Toda estrutura com `company_id`.
- Empresa A pode ter BOM diferente da B para o “mesmo” kit conceitual.
- **Nunca** herdar estrutura CDL automaticamente.
- Template PSCS: só preparar gancho futuro (`source_template_id` nullable) — **não implementar herança**.

---

## 8. Snapshot da OS

Contrato que **não quebra**:

```
BOM vigente na conversão
  → explode componentes
  → service_order_materials (histórico)
```

Depois: alteração da BOM **não** altera OS antiga.  
OS já convertida: não regenerar silenciosamente.

Rastreio futuro: gravar `bom_header_id` + `bom_version` no snapshot (hoje: `bom_rule_id`).

---

## 9. Estratégia de migração (quando Philippe aprovar)

1. Manter `operational_material_rules` **somente leitura** até cutover.
2. Para cada regra: criar/obter item pai (pacote→kit ou item sintético da empresa) + header v1 + componente.
3. `source_type=package|additional` vira `parent_item_id` (kit do pacote / item do adicional).
4. Dual-run: explosão nova = explosão antiga em QA (quantidades).
5. Novas OS usam BOM ERP; OS antigas intactas.
6. Deprecar regras planas só após paridade.

**Não quebrar** `operational_material_rules` nesta rodada.

---

## 10. Fora de escopo agora

- Migrar todo o BOM
- Quebrar regras atuais
- Engine de fórmulas
- Herança CDL→franquia
- Reservation de estoque na explosão
- Production / main
