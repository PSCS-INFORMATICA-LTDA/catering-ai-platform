# Discovery — Materiais da Ordem de Serviço

**Produto:** Catering AI Platform / BBQ At Home / CDL  
**Responsável funcional:** Philippe Santana  
**Data:** 2026-08-10  
**Branch:** `feat/order-materials-operations-dev`  
**Baseline:** `8d07575` (`feat/agenda-team-confirmation-dev`)  
**Ambiente:** Supabase DEV `yasprgtlqclwsjcshtls`  
**Escopo desta rodada:** somente mapeamento + proposta. **Sem migration, API, UI, seed ou QA de materiais.**

---

## 1. Estado atual

### Git / baseline

| Item | Valor |
|------|--------|
| Branch origem | `feat/agenda-team-confirmation-dev` |
| HEAD / origem remota | `8d07575c87e98e55e2f3181595f2ff9437512478` |
| Working tree na criação | limpa (após restaurar `Lib/buildInfo.generated.ts` gerado pelo build) |
| Branch nova | `feat/order-materials-operations-dev` (sem push) |
| Ahead/behind vs origin Agenda | 0 / 0 |

### QA baseline (antes da nova branch)

| Suite | Resultado |
|-------|-----------|
| `qa:dev:schedule-conflict-matrix` | **PASS** (12/12) |
| `verify:dev:team-scale` | **PASS** |
| `verify:dev:functional` | **PASS** |
| `npm run build` | **PASS** |

### Migrations linked (leitura)

Lista remota alinhada até `20260807164500`. Arquivo local `20260807180000_fix_customers_ab_number_text.sql` aparece como **local sem registro remote** na listagem (DDL de `ab_number` text já foi aplicado no DEV via SQL Editor/query em rodada anterior). Não é objeto desta fase.

---

## 2. Estruturas existentes

### Ordem de Serviço

| Objeto | Papel |
|--------|--------|
| `service_orders` | Documento operacional (status, totais, venue, guests, garnish token) |
| `service_order_items` | Linhas do **snapshot comercial** |
| `service_order_status_history` | Histórico da máquina de status |
| `service_order_checklist_items` | Checklist de **atividades** |
| `quote_versions` + conversão | Origem comercial → OS |
| `agenda_events.service_order_id` | Vínculo agenda |
| Garnish columns em `service_orders` | Supplier garnish independente |

**Migration principal:** `supabase/migrations/20260805120000_quote_versions_service_orders.sql`

### Respostas — itens da OS

1. **Onde ficam?** `service_order_items` (+ JSON snapshot no convert).  
2. **Comerciais ou operacionais?** **Comerciais** (`package`, `additional`, `option`, `mileage`, `discount`, `other`).  
3. **Snapshot?** Sim — materializado na conversão; não recalcula catálogo.  
4. **Quantidades?** `quantity` numeric (comercial).  
5. **Unidades?** Não há coluna `unit` em `service_order_items` — só labels/preços.  
6. **Categoria?** Labels i18n (`category_pt/en/es`), não taxonomy operacional.  
7. **Status por item?** **Não.**  
8. **Origem package/additional/manual?** `item_type` cobre package/additional/option/… — **não** há `manual` operacional nem `source_id` de material.

### Catálogo / item mestre

| Pergunta | Resposta |
|----------|----------|
| Tabela mestre | `catalog_items` |
| Multiempresa | Sim (`company_id`) |
| Unidade | `unit`, `unit_label` (texto); schema PROD também tem `stock_unit`, `purchase_unit`, `conversion_factor` |
| Tipo/categoria | `item_type` (`PRODUCT\|PACKAGE_ITEM\|SIDE\|EQUIPMENT\|SUPPLY`), `category_key` + labels |
| Ativo | `active` |
| Custo/preço | `cost_price`, preços de venda |
| Estoque | Flags `inventory_enabled`, `operational_item`; qty em schema dump (`current_stock_qty`, `min_stock_qty`) — **sem módulo de movimento** |
| App TS | `Lib/catalogItemsTableSchema.ts` / `Lib/itemCatalog.ts` — flags operacionais expostas; colunas de saldo pouco usadas |

### Checklist

- Tabela: `service_order_checklist_items`
- Status: `pending` \| `done` \| `skipped`
- Responsável: `completed_by` → `auth.users`
- Categorias: inclui `equipamentos`, `alimentos`, `preparacao`, etc. (ação, não quantidade)
- API: `/api/orders/[id]/checklist`
- **CHECKLIST ≠ MATERIAL:** checklist = atividade (“Conferir cooler”); material = quantidade física (“Cooler — 2 UN”). Podem se relacionar semanticamente, mas **não devem ser a mesma tabela**.

### Supplier Garnish

- Colunas em `service_orders` + RPCs públicas + UI `SupplierGarnishSharePanel`
- Token **plaintext** (padrão garnish/designação)
- Packing kits HC–HK via regra comercial — **fora do escopo de alteração**
- Pode **inspirar** itens operacionais (guarnições como consumíveis), mas o fluxo de confirmação do fornecedor **permanece independente**

### Pessoas / equipe

| Necessidade futura | Fonte atual |
|--------------------|-------------|
| `person_id` | `customers` + `customer_operational_roles` + `operational_team_members` |
| Líder / preparação | `role_key`: `team_leader`, `preparation`, `grill_master`, `assistant` |
| Usuário logado | `auth.users` via sessão / `requireApiPermission` |
| Confirmações de escala | `agenda_event_member_confirmations.person_id` |

Não duplicar cadastro de Pessoas.

### Auditoria

- Preferir `Lib/orders/writeOperationalAudit.ts` → `audit_logs`
- Complemento: `service_order_status_history` (só status da OS)
- Estender actions tipadas (ex.: `material_separated`, `material_dispatched`) sem nova infra

### RBAC (hoje)

| Key | Uso |
|-----|-----|
| `orders.view` | Ver OS |
| `orders.manage` | Alterar status, checklist, garnish, team confirmations |
| `quotes.convert` | Converter cotação → OS |

**Recomendação (não criar nesta rodada):**  
`orders.materials.view|prepare|check|dispatch|return` — granularidade pedida por Philippe; mapear operator/admin como na OS.

### RLS

Padrão tenant-owned (ver `20260803210000_harden_multitenant_rls.sql` + policies OS):

- `company_id NOT NULL` + FK
- RLS enabled
- Policies membership via `company_memberships`
- Grants `authenticated` + `service_role`
- Server-side: `requireApiPermission` + `resolveAuthorizedCompanyId` (nunca confiar no body)

### Estoque

| Busca | Resultado |
|-------|-----------|
| Tabelas `stock/inventory/warehouse/movement/materials` | **Não encontradas** como módulo |
| Colunas em `catalog_items` | Flags + qty/unidade no dump PROD |
| Maturidade V2 | Estoque = **NÃO TEM / Pós-Order** |

Conclusão: **conceito futuro / flags de catálogo**, sem movimentos. Materiais da OS devem preparar `stock_posting_status` sem postar.

### Unidades

- Predominante: **texto livre** (`unit`, `unit_label`, `stock_unit`)
- Sem tabela UOM / enum global
- Não criar UOM nesta fase; preservar unidade do item no snapshot operacional

### Classificação operacional (consumable/returnable/…)

- **GAP:** não existe enum `consumable|returnable|equipment|disposable` no schema ativo
- Existe `item_type=EQUIPMENT|SUPPLY` e flag `operational_item` — insuficientes sozinhos

### Quantidades

| Onde | Campos |
|------|--------|
| `service_order_items` | `quantity` (comercial) |
| Catálogo | `quantity`, stock qtys (dump) |
| Garnish/kits | packing calculado em Lib |
| Materiais (separado/conferido/enviado/retorno/sobra) | **GAP — não existe** |

### UI da OS (`OrderDetailView`)

Ordem atual das seções:

1. Header / status  
2. Evento + equipe  
3. Financeiro  
4. Supplier Garnish (condicional)  
5. Equipe / Escala (`OrderTeamConfirmationsPanel`)  
6. Alterar status  
7. Checklist  
8. Histórico de status  

**`service_order_items` são buscados mas não renderizados.**

**Posição recomendada para MATERIAIS:** após Equipe/Escala e antes de Checklist (fluxo físico: gente → materiais → atividades).

### Mobile / token público

Padrões reutilizáveis:

| Fluxo | Token | Rota |
|-------|-------|------|
| Confirmação integrante | **SHA-256 hash** | `/confirmacao-equipe/[token]` |
| Garnish | plaintext | `/confirmacao-guarnicao/[token]` |
| Designação | plaintext | `/designacao-equipe/[token]` |

**Recomendação para `/conferencia-saida/[token]`:** reutilizar padrão **hash** (mais seguro), mobile-first como confirmação de equipe.

### i18n

- Dicionário único: `Lib/i18n/quotesOrders.ts` (`pt`/`en`/`es`)
- Hook: `useAuthLocaleFromMe`
- Novos termos devem entrar nesse dict — sem sistema paralelo

---

## 3. Matriz de reuso

| Necessidade | Existe hoje? | Objeto atual | Reusar? | Alterar? | Criar? |
|-------------|--------------|--------------|---------|----------|--------|
| Item mestre | Sim | `catalog_items` | Sim | Opcional flags/kind | Não outro cadastro |
| Item da OS (comercial) | Sim | `service_order_items` | Sim (origem) | Não misturar | Não |
| Item operacional OS | Não | — | — | — | **Sim** (`service_order_materials`) |
| Quantidade operacional | Parcial | só comercial | Não suficiente | — | Sim (campos separated/checked/…) |
| Unidade | Sim (texto) | `unit`/`unit_label` | Sim (snapshot) | Não UOM nova | Não |
| Categoria | Sim | labels / `category_key` | Sim | — | Opcional snapshot |
| Checklist | Sim | `service_order_checklist_items` | Sim (separado) | Não virar material | Não |
| Supplier garnish | Sim | OS + RPCs | Sim (independente) | Não quebrar | Não |
| Pessoa | Sim | `customers` + roles | Sim | — | Não |
| Equipe | Sim | `operational_teams` / members | Sim | — | Não |
| Auditoria | Sim | `writeOperationalAudit` | Sim | Estender actions | Não nova tabela |
| RBAC | Parcial | `orders.view/manage` | Base | — | Keys materials.* (fase seguinte) |
| RLS | Sim | membership patterns | Sim | Policies novas tabelas | Sim policies |
| Token público | Sim | hash equipe / plaintext garnish | **Hash** | — | Tabela/RPC dispatch |
| Estoque | Não (módulo) | flags catálogo | Preparar status | — | Não movimento |
| Movimento estoque | Não | — | — | — | Não nesta fase |
| Retorno / sobra | Não | — | — | — | Campos na nova tabela |
| Kind consumable/… | Não | — | — | — | Coluna `material_type` |

---

## 4. Gaps

1. Tabela de materiais operacionais por OS.  
2. Status por linha material + quantidades separated/checked/dispatched/returned/leftover.  
3. Classificação `consumable|returnable|equipment|disposable`.  
4. Token/RPC de conferência de saída do líder.  
5. Permissões granulares materials.*.  
6. UI Materiais + rota pública mobile.  
7. BOM automático comercial→operacional (regra inexistente — **não inventar**).  
8. Postagem em estoque (módulo inexistente).

---

## 5. Riscos

| Risco | Mitigação |
|-------|-----------|
| Misturar snapshot comercial com materiais | Tabelas e UI separadas; não alterar `service_order_items` |
| Duplicar checklist | Manter checklist como ação; materiais como quantidade |
| Quebrar garnish / agenda | Não alterar fluxos aprovados; só ler |
| Inventar conversão pacote→materiais | V1: manual + seed + catálogo operacional sem auto-qty |
| Token inseguro | Preferir hash + expiry + revoke + idempotência |
| Escopo estoque | `stock_posting_status=pending|not_applicable` apenas |

---

## 6. Arquitetura recomendada

### Opção escolhida: **B — Criar `service_order_materials` (+ confirmação de saída)**

**Por quê (baseado no schema real):**

- `service_order_items` é comercial (preço/tipo package/additional) e **não** cabe nas quantidades operacionais.  
- Checklist é ação, não quantidade.  
- Catálogo serve como **mestre opcional** (`item_id`), não como linha da OS.  
- Não há tabela de estoque/movimento para estender.

**Híbrido parcial (C):** reutilizar `catalog_items` como FK opcional + snapshot de descrição/unidade — isso faz parte da opção B.

**Rejeitada A (só estender):** poluiria snapshot financeiro e quebraria o ADR cotação/OS.

---

## 7. Modelo proposto (ainda não criar)

### `service_order_materials`

Campos conceituais:

- `id`, `company_id`, `service_order_id`
- `source_type` ∈ `package|additional|supplier|manual|rule`
- `source_id` nullable, `item_id` nullable → `catalog_items`
- `description_snapshot`, `category`, `unit`
- `material_type` ∈ `consumable|returnable|equipment|disposable`
- `required_quantity`, `separated_quantity`, `checked_quantity`, `dispatched_quantity`, `returned_quantity`, `leftover_quantity`
- `status` ∈ `pending|partial|separated|checked|divergence|dispatched|returned|closed`
- `separated_by/at`, `checked_by/at`, `dispatched_by/at`, `returned_by/at`
- `divergence_notes`, `notes`
- `stock_posting_status` ∈ `pending|posted|not_applicable` (nesta fase: nunca `posted`)
- `created_at/by`, `updated_at/by`

### `service_order_dispatch_confirmations`

Token de saída do líder (padrão hash como `agenda_event_member_confirmations`).

### Fluxo proposto

```text
OS → Materiais (manual/seed/catálogo)
  → Separar (partial/completo)
  → Conferir (divergência se checked ≠ separated)
  → Token líder → /conferencia-saida/[token]
  → Dispatched
  → Retorno / Sobras
  → stock_posting_status = pending (futuro estoque)
```

---

## 8. O que NÃO deve ser duplicado

- Cadastro de Pessoas / Equipes  
- Snapshot comercial / `service_order_items`  
- Checklist como substituto de materiais  
- Supplier Garnish  
- Agenda / turnaround / multi-churrasqueiro  
- Auth / RBAC framework  
- Motor de auditoria (`audit_logs`)  
- Dicionário i18n paralelo  
- Módulo de estoque completo  

---

## 9. Próximo passo recomendado

Após validação de Philippe deste discovery:

1. Migration DEV `service_order_materials` + `service_order_dispatch_confirmations` + RLS + RBAC keys.  
2. Lib + APIs + painel na OS + rota pública.  
3. Seed `TEST-DEV-OS-MAT-*` + matriz T01–T14.  
4. Regressão Agenda (12 PASS) + build.  
5. Preview DEV (sem `--prod`).

**Status desta rodada:**  
**DISCOVERY DE MATERIAIS DA OS CONCLUÍDO — PRONTO PARA DECISÃO DE PHILIPPE**
