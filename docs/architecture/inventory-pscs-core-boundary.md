# Inventory — boundary Catering AI ↔ PSCS Core

**Ambiente:** DEV only  
**Status:** Fase B — decisão arquitetural documentada  
**Referência:** `inventory-jde-foundation-v1.md`

---

## Objetivo

Delimitar o que permanece no **Catering AI Platform** versus o que é **candidato ao PSCS Core** compartilhado (Logistics AI, futuros produtos), evitando masters duplicados e permitindo migração futura sem troca massiva de IDs.

---

## O que fica no Catering (operacional por produto)

| Domínio | Objetos | Motivo |
|---------|---------|--------|
| Ledger de estoque | `inventory_movements`, `inventory_balances` | Acoplado ao fluxo OS/evento/catering |
| Reservas | `inventory_commitments` | Vinculado a `service_order_materials` |
| Documentos | `inventory_documents`, `inventory_document_lines` | Event dispatch/return específico catering |
| Locais de estoque | `inventory_locations` | Semântica operacional (MAIN, STAGING, RETURN…) |
| Lotes operacionais | `inventory_lots` | Controle por evento/OS neste produto |
| Disponibilidade | view `inventory_availability` | Projeção do ledger catering |
| Movement types (tenant) | `inventory_movement_types` | Extensões por empresa no catering |
| Posting / RPCs | `post_inventory_*`, `commit_inventory_*` | Integração OS + agenda + materiais |

---

## Candidatos fortes ao PSCS Core (reutilizar, não duplicar)

| Domínio | Objeto Catering atual | Estratégia |
|---------|----------------------|------------|
| Identity | F1 `app_users`, memberships | Já compartilhável |
| Company | `companies` | UUID estável; Core futuro |
| Branch | `public.branches` | **Reutilizado** — não criar `company_branches` |
| Party / Customer | `customers` (se existir) | FK direta; migrar master depois |
| Item Master | `catalog_items` | Fonte única; flags `inventory_enabled`, `lot_control_enabled` no Catering até Core |
| UOM | texto em colunas `unit` | Não criar tabela UOM nesta fase |
| Currency | fora escopo estoque V1 | — |
| Audit foundations | padrão `created_by`, timestamps | Alinhar com Core quando existir |

---

## FKs atuais (estável para migração)

```
inventory_locations.company_id     → companies.id
inventory_locations.branch_id      → branches.id
inventory_lots.company_id          → companies.id
inventory_lots.catalog_item_id     → catalog_items.id
inventory_commitments.service_order_material_id → service_order_materials.id
inventory_movements.catalog_item_id → catalog_items.id
inventory_documents.service_order_id → service_orders.id
```

**Regra:** manter UUIDs gerados no Catering; Core futuro absorve masters por **referência estável**, não por re-key.

---

## Estratégia de migração futura

1. **Extrair masters:** companies, branches, catalog_items → serviços Core com mesmos UUIDs
2. **Manter ledger no Catering** ou sync assíncrono para Core Analytics (decisão posterior)
3. **API boundary:** domain services Catering chamam Core read APIs para item/branch; writes operacionais locais
4. **Evitar:** segundo item master (`inventory_items`), segundo branch table, IDs sequenciais expostos na UI

---

## O que NÃO fazer nesta branch

- Construir PSCS Core completo
- Duplicar `catalog_items` ou `branches`
- Acoplar estoque a Logistics AI
- Expor custo/preço/margem nas APIs de disponibilidade

---

## Checklist Fase B

- [x] Reutiliza `branches` existente
- [x] Reutiliza `catalog_items` como item master
- [x] Não cria `company_branches` paralelo
- [x] Documenta FKs e estratégia UUID
- [ ] Integração Core runtime (futuro)
