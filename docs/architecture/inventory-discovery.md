# Discovery — Estoque (Inventory)

**Produto:** Catering AI Platform / BBQ At Home / CDL  
**Responsável funcional:** Philippe Santana  
**Data:** 2026-08-10  
**Branch de referência:** `feat/order-materials-operations-dev`  
**Baseline de Materiais:** `MATERIALS_BASELINE_HEAD=e9a213597a6fb685ffa7568eb1f6a03ef62b377f`  
**Ambiente analisado:** DEV `yasprgtlqclwsjcshtls`  
**Escopo desta rodada:** **somente discovery**. Sem migration, tabela, API, UI, saldo ou movimento de estoque.

---

## 1. Objetivo

Mapear como o futuro **Estoque** deve se integrar ao fluxo já existente, sem criar um módulo desconectado:

```
OS
 → Materiais (service_order_materials)
 → Separação
 → Conferência
 → Saída (dispatch / líder)
 → Retorno
 → Sobra
 → FUTURO: movimento de estoque (posting)
```

**Princípio:** Materiais da OS = execução operacional. Estoque = controle patrimonial/físico de saldo. **Não** transformar `service_order_materials` em tabela de estoque.

---

## 2. Integração com Materiais (gancho existente)

| Campo / objeto | Papel hoje | Papel futuro de estoque |
|----------------|------------|-------------------------|
| `service_order_materials` | Quantidades do evento | Fonte operacional dos eventos a postar |
| `stock_posting_status` | `pending \| posted \| not_applicable` (sem postar) | Gate: só postar quando `pending` → `posted` |
| `dispatched_quantity` | Saída confirmada | Candidato a `event_dispatch` / consumo |
| `returned_quantity` | Retorno físico | Candidato a `event_return` |
| `leftover_quantity` | Sobra | Candidato a `event_leftover_return` (se inventariável) |
| `material_type` | consumable / returnable / equipment / disposable | Define natureza do movimento |
| `catalog_item_id` | Snapshot opcional do catálogo | SKU inventariável (quando presente) |
| `company_id` | Tenant | Isolamento obrigatório |

**Disposable** já nasce com `stock_posting_status = not_applicable` — típico sem ledger.

---

## 3. `catalog_items` — o que é inventariável?

### Campos relevantes (schema / app)

| Campo | Uso atual |
|-------|-----------|
| `inventory_enabled` | Flag UI/backoffice — “inventário em breve”; **sem módulo** |
| `operational_item` | Item operacional (não só comercial) |
| `unit` / `unit_label` | Texto livre |
| `stock_unit` / `purchase_unit` / `conversion_factor` | Presentes no dump PROD; pouco usados no app |
| `min_stock_qty` / `current_stock_qty` | Colunas de saldo no dump — **não há ledger**; risco de saldo fantasma |
| `cost_price` / `sale_price` | Financeiro — **fora** da v1 de estoque físico |
| `item_type` | PRODUCT / PACKAGE_ITEM / SIDE / EQUIPMENT / SUPPLY |
| `category_*` | Taxonomia comercial/i18n |
| `branch_id` | Existe no schema — **sem warehouse module** |

### Respostas

| Pergunta | Resposta |
|----------|----------|
| Qual item pode ser controlado? | Preferência: `inventory_enabled = true` **e** vínculo a `catalog_item_id` na linha de material |
| Como identificar inventariável? | Flag `inventory_enabled`; complementar com `operational_item` / `item_type` SUPPLY\|EQUIPMENT |
| Consumível / retornável / equipamento? | **Não** no catálogo de forma canônica — vive em `material_type` da OS / regra BOM |
| Gaps | (1) flag sem enforcement; (2) `current_stock_qty` sem movements; (3) tipo operacional não no catálogo; (4) unidade livre; (5) sem warehouse |

**Recomendação discovery:** na v1 de estoque, **não** confiar em `current_stock_qty` como fonte da verdade; tratar como legado/placeholder até haver ledger.

---

## 4. `service_order_materials` — eventos futuros de movimento

| Quantidade / evento | Quando ocorre | Movimento futuro candidato |
|---------------------|---------------|----------------------------|
| `required_quantity` | BOM / manual | Reserva opcional (`reservation`) — **fase posterior** |
| `separated_quantity` | Preparação | Geralmente **sem** movimento (ainda no depósito) |
| `checked_quantity` | Conferência pré-saída | Sem movimento |
| `dispatched_quantity` | Líder confirma retirada | `event_dispatch` (e/ou em trânsito) |
| Consumo implícito (consumable) | Pós-evento / fechamento | `event_consumption` = dispatched − leftover (− returned se aplicável) |
| `returned_quantity` | Retorno | `event_return` (recompõe disponível / encerra trânsito) |
| `leftover_quantity` | Sobra registrada | `event_leftover_return` se volta ao estoque |
| Divergência / perda | Ajuste manual futuro | `loss` / `adjustment_out` |
| Cancelamento OS | Material cancelled | Estorno / não postar |

**Não implementar** nesta rodada — apenas contrato conceitual via `stock_posting_status`.

---

## 5. Tipos de movimento (proposta conceitual)

Avaliar necessidade real; **não** assumir todos obrigatórios na v1.

| Tipo | Necessário na v1? | Notas |
|------|-------------------|--------|
| `initial_balance` | Provável | Abertura / migração de saldo |
| `purchase_receipt` | Desejável cedo | Entrada de compra (sem AP) |
| `adjustment_in` / `adjustment_out` | Sim | Correções operacionais |
| `event_dispatch` | Sim | Ligado à saída da OS |
| `event_return` | Sim | Retornável / equipment |
| `event_consumption` | Sim | Consumíveis |
| `event_leftover_return` | Opcional v1 | Pode fundir com return/adjustment |
| `loss` | Opcional | Pode ser adjustment_out tipado |
| `transfer` | Adiar | Exige multi-localização |

---

## 6. Warehouse / localização

| Conceito | Existe? | Evidência |
|----------|---------|-----------|
| `warehouse` | **GAP** | Sem tabela de módulo |
| `location` / `storage` | **GAP** | Sem locations de estoque |
| `branch` / `branch_id` | Parcial | Coluna em `catalog_items`; sem modelo de depósito |
| `company` location | Event venue ≠ estoque | Endereço de evento não é warehouse |

**Conclusão:** v1 provavelmente **um local implícito por company** (“Depósito padrão”) até existir `inventory_locations`. Marcar GAP multi-depósito.

---

## 7. Modelo de saldo — decisão conceitual

| Opção | Prós | Contras no projeto atual |
|-------|------|---------------------------|
| A. Saldo só calculado por movimentos | Auditoria forte | Relatórios pesados sem agregação |
| B. Só tabela de saldo | Simples | Sem trilha; `current_stock_qty` já mostrou o risco |
| C. Híbrido: ledger + saldo materializado | Relatório rápido + audit | Mais tabelas; precisa posting atômico |

**Recomendação:** **C — ledger + saldo materializado** (`inventory_movements` + `inventory_balances`), atualizados na mesma transação/RPC.  
Motivo: o produto já tem auditoria operacional e multi-tenant; saldo sem ledger (colunas no catálogo) é insuficiente e perigoso.

---

## 8. Unidade (UOM)

- Hoje: **texto livre** (`unit`, e no dump `stock_unit` / `purchase_unit`).
- Riscos: `lb` vs `kg`, `bag` vs `box` vs `unit`, conversões inconsistentes, saldo por string diferente.
- **Não** criar UOM nesta rodada.
- **Endurecimento futuro recomendado:** enum/tabela UOM por company + `conversion_factor` confiável antes de multi-unidade no ledger; v1 pode exigir **uma unidade de estoque por item** (`stock_unit`) e rejeitar postagens com unidade divergente do snapshot.

---

## 9. Consumível vs retornável vs equipment vs disposable

| `material_type` | Saída | Retorno | Sobra | Posting típico |
|-----------------|-------|---------|-------|----------------|
| `consumable` | Diminui disponível | Raro | Pode repor parcial | dispatch + consumption (+ leftover return) |
| `returnable` | Em trânsito / sai disponível | Recompõe | — | dispatch + return |
| `equipment` | Em trânsito | Recompõe | — | dispatch + return |
| `disposable` | Operacional | — | — | `not_applicable` (sem ledger) |

Estados conceituais futuros (não criar agora): `on_hand`, `in_transit_event`, `reserved`.

---

## 10. Não duplicar com Materiais

| Camada | Tabela | Responsabilidade |
|--------|--------|------------------|
| Operação do evento | `service_order_materials` | O que foi separado/conferido/enviado/retornado **nesta OS** |
| Patrimônio / saldo | Futuro `inventory_*` | Quanto há no depósito / trânsito / reservas |
| Comercial | `service_order_items` | Preço/qty vendida |
| Checklist | `service_order_checklist_items` | Atividades, não qty |

Posting lê a OS material e **escreve** no ledger; não move a verdade do saldo para a OS.

---

## 11. Matriz de reuso

| Necessidade | Existe? | Objeto atual | Reusar | Alterar | Criar |
|-------------|---------|--------------|--------|---------|-------|
| Catalog item | Sim | `catalog_items` | Sim | Endurecer flags/unidade | — |
| Inventory flag | Sim | `inventory_enabled` | Sim | Enforcement na postagem | — |
| Unit | Parcial | `unit` / `stock_unit` texto | Sim (v1) | Futuro UOM | UOM depois |
| Material type | Sim | OS / BOM `material_type` | Sim | Opcional espelhar no catálogo | — |
| OS material | Sim | `service_order_materials` | Sim | Hook posting | — |
| Dispatch | Sim | confirmação + qty | Sim | Emitir movimento | — |
| Return | Sim | `returned_quantity` | Sim | Emitir movimento | — |
| Leftover | Sim | `leftover_quantity` | Sim | Regra de reposição | — |
| Warehouse | Não | — | — | — | `inventory_locations` (ou default company) |
| Stock ledger | Não | — | — | — | `inventory_movements` |
| Stock balance | Placeholder | `current_stock_qty` | **Não** como verdade | Deprecar uso | `inventory_balances` |
| Reservation | Doc futuro | — | — | — | Depois da v1 |
| Purchase receipt | Não | — | — | — | Movimento + UI mínima |
| Adjustment | Não | — | — | — | Movimento tipado |
| Audit | Sim | `audit_logs` / writeOperationalAudit | Sim | Actions tipadas | — |
| RBAC | Parcial | perms materials | Sim | `inventory.*` | Novas permissões |
| RLS | Padrão tenant | company_memberships | Sim | Policies novas tabelas | Policies |

---

## 12. Arquitetura recomendada (UMA)

### Escolha: **B/C — ledger + saldo materializado**

Justificativa alinhada ao projeto:

1. Já existe gancho `stock_posting_status` e fluxo OS completo.  
2. Colunas de qty no catálogo **não** são ledger.  
3. Multiempresa exige trilha auditável por `company_id`.  
4. Relatórios de “quanto tem agora” precisam de saldo materializado.

### Tabelas conceituais (NÃO criar agora)

```
inventory_locations
  id, company_id, name, is_default, active, …

inventory_movements
  id, company_id, location_id, catalog_item_id,
  movement_type, quantity, unit,
  service_order_id?, service_order_material_id?,
  stock_posting_batch_id?, notes,
  created_by, created_at

inventory_balances
  company_id, location_id, catalog_item_id, unit,
  on_hand, in_transit, reserved, updated_at
  PK / unique (company, location, item, unit)
```

Posting atômico (RPC futura): ler materiais `pending` elegíveis → inserir movements → atualizar balances → marcar `stock_posting_status = posted`.

### Alternativa rejeitada para v1

- **Ledger puro sem saldo:** possível, mas ruim para UI operacional diária.  
- **Só atualizar `current_stock_qty`:** proibido como desenho — sem auditoria.

---

## 13. Estoque ≠ financeiro

Na primeira versão de estoque:

| Incluir | Excluir |
|---------|---------|
| Quantidade física | Custo médio / FIFO / LIFO |
| Movimentos tipados | Valuation / contabilidade |
| Localização simples | AP / contas a pagar |
| RBAC/RLS de qty | Exposição de `cost_price` em telas de estoque ops |

Custo permanece no catálogo comercial/financeiro sob `orders.financial.view` / regras futuras — **não** misturar na UI operacional de saldo.

---

## 14. Multiempresa / RLS / RBAC / audit

- Toda tabela futura: `company_id NOT NULL` + RLS membership.  
- Nenhum estoque compartilhado entre tenants.  
- Service role só em jobs/scripts DEV controlados.  
- RBAC sugerido (futuro): `inventory.view`, `inventory.adjust`, `inventory.receive`, `inventory.post_event` (nomes a decidir).  
- Audit: reutilizar `audit_logs` com actions tipadas (`inventory_posted`, `inventory_adjusted`, …).

---

## 15. Gaps consolidados

1. Sem `warehouse` / locations.  
2. Sem ledger / movements.  
3. `current_stock_qty` sem fonte confiável.  
4. Unidade texto livre.  
5. `material_type` só na OS/BOM, não no catálogo.  
6. Sem reserva de estoque na conversão Quote→OS.  
7. Sem purchase receipt.  
8. Valuation deliberadamente fora de escopo da v1.

---

## 16. Próximo passo proposto (decisão Philippe)

1. Congelar Materiais (baseline já registrada no doc de fechamento).  
2. Decidir escopo v1 de Estoque:  
   - **Mínimo:** locations default + movements + balances + posting a partir de OS fechada/retornada.  
   - **Adiar:** transfer, reservation, multi-UOM, valuation.  
3. Abrir branch nova **somente após** aprovação explícita (ex.: `feat/inventory-v1-dev`).  
4. Não misturar Logistics nem Production nesta fase.

**Status discovery:** concluído — **PRONTO PARA DECISÃO DE PHILIPPE**.  
**Implementação:** bloqueada até decisão.
