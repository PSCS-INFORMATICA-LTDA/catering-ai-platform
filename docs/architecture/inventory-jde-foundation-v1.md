# Inventory JDE Foundation V1 — Schema e regras

**Ambiente:** DEV only (`yasprgtlqclwsjcshtls`)  
**Branch:** `feat/inventory-jde-foundation-dev`  
**Base:** `feat/data-dictionary-i18n-foundation-dev` @ `5e3331d`  
**Status:** Fases B–F concluídas — **foundation pronta para validação Philippe**  
**QA:** ver `inventory-jde-foundation-phase-f-results.md`  
**Inventory v1 anterior:** `docs/architecture/inventory-v1.md`

---

## 1. Arquitetura

Hierarquia operacional:

```
Company (companies)
  └── Branch (branches) — reutilizado; is_default por tenant
        └── Inventory Location (inventory_locations) — branch_id obrigatório
              └── Item (catalog_items) — inventory_enabled, lot_control_enabled
                    └── Lot opcional (inventory_lots)
```

Camadas transacionais:

| Camada | Tabela / view | Papel |
|--------|---------------|--------|
| Reserva | `inventory_commitments` | Committed; não posta Kardex |
| Operação | `inventory_documents` + `inventory_document_lines` | Cabeçalho + linhas |
| Ledger | `inventory_movements` | Kardex imutável (INSERT only) |
| Cache | `inventory_balances` | On Hand + buckets; reconstruível |
| Projeção | `inventory_availability` (view) | On Hand, Committed, Available |

**Branch ≠ Location.** Filial é contexto organizacional; local é endereço físico de estoque.

---

## 2. ERD textual

```
branches ──< inventory_locations ──< inventory_balances
    │              │                        │
    │              └──< inventory_movements >── catalog_items
    │              │         │                  │
    └──< inventory_lots ─────┘                  │
    │                                            │
    └──< inventory_commitments >── service_order_materials
    │              │
    └──< inventory_documents >── inventory_document_lines
                      │
                      └──< inventory_movements (document_id)

inventory_movement_types (global + tenant)
service_orders ──< service_order_materials (fluxo operacional existente)
```

---

## 3. Fonte da verdade

| Conceito | Fonte | Não usar como verdade |
|----------|--------|------------------------|
| On Hand | `SUM(inventory_movements.quantity)` por dimensão | `catalog_items.current_stock_qty` |
| Committed | `inventory_commitments` status `active` | campo editável manual |
| Available | `on_hand - committed` (view) | coluna persistida |
| Reserva OS | `inventory_commitments` | qty na linha de material |
| Saída / retorno | `inventory_documents` + movements | editar documento postado |

Ledger: **INSERT only**. Correção futura = movimento/documento compensatório.

---

## 4. Definição dos saldos

| Bucket | Definição | Persistido |
|--------|-----------|------------|
| **On Hand** | Quantidade física contabilizada por movimentos postados | `inventory_balances.quantity_on_hand` (cache) |
| **Committed** | Reservada para OS/material; não reduz On Hand | `quantity_committed` + commitments |
| **Available** | On Hand − Committed | **Não** — view `inventory_availability` |
| **In Event** | Despachada e ainda não retornada (quando inferível) | `quantity_in_event` (foundation; cálculo futuro) |
| **On Receipt** | Recebimentos futuros (procurement) | `quantity_on_receipt` = 0 nesta fase |

Evitar dupla contagem: commitment não gera movement; dispatch gera document + movement e consome/libera commitment conforme regra de integração (Fase D).

---

## 5. Commitment lifecycle

Status: `active` → `released` | `consumed` | `cancelled`

- **active:** entra no Committed; índice único por `service_order_material_id` quando active
- **released:** OS cancelada ou qty reduzida antes do dispatch
- **consumed:** qty reservada foi despachada/postada
- **cancelled:** reserva anulada

RPCs (schema): `commit_inventory_for_material`, `release_inventory_commitment` — idempotência via unique index + keys.

---

## 6. Document lifecycle

Status típicos: `draft` → `posted` → (`cancelled` se aplicável)

Tipos conceituais: `EVENT_DISPATCH`, `EVENT_RETURN`, `LEFTOVER_RETURN`, `INITIAL_BALANCE`, etc.

Regra: **saída e retorno são documentos diferentes** — nunca mutar o documento de dispatch para representar retorno.

`document_number` human-readable por company; `movement_code` referencia `inventory_movement_types`.

---

## 7. Movement lifecycle

- Tipos seed globais (PROVISIONAL): IB, ED, ER, LR, AI, AO, TR — ver `inventory-movement-codes-pending-jde-validation.md`
- Cada movement: company, branch, location, item, lot opcional, document, signed quantity, idempotency_key
- v1 types (`event_dispatch`, etc.) coexistem; bridge v1→JDE na Fase D

---

## 8. Integração OS / materials (Fase D — implementado)

Gate de **commitment:** conferência interna (`action=check`) quando `status=checked` e item com `inventory_enabled`.

| Momento | Implementação |
|---------|----------------|
| **A** Criar commitment | `syncInventoryCommitmentAfterMaterialCheck` → RPC `create_inventory_commitment` |
| **B** Release | cancel → `cancelled`; divergência → `released`; qty check=0 → `released` |
| **C** Post físico dispatch | `confirm_public_material_dispatch` → `post_inventory_for_order_dispatch` (documento ED) |
| **D** In event | bucket `quantity_in_event` no RPC movement |
| **E** Retorno | PATCH `action=return` → `postEventReturnDocuments` (ER/LR separados) |
| **F** Leftover | mesmo RPC return (documento LR independente) |
| **G** Divergência/perda | fora escopo posting final |

`stock_posting_status` na criação de material: `not_applicable` se item sem `inventory_enabled` ou descartável.

Código: `Lib/inventory/inventoryOsIntegration.ts` + hooks em `app/api/orders/[id]/materials/[materialId]/route.ts`.

---

## 9. RLS

Todas as tabelas novas/alteradas: `ENABLE ROW LEVEL SECURITY` + `private.is_company_member(company_id)`.

Validações cross-entity feitas em RPCs `SECURITY DEFINER` (branch pertence à company, location à branch, etc.).

Sem policy permissiva cross-tenant.

---

## 10. RBAC

Existente (v1): `inventory.view`, `inventory.manage`, `inventory.adjust`.

Fase C+: avaliar `inventory.post` para posting de documentos sem duplicar permissões.

Dados financeiros: fora das APIs de estoque operacional.

---

## 11. Idempotência

- Movements: `idempotency_key` unique (v1 mantido)
- Commitments: unique partial index `(company_id, service_order_material_id) WHERE status = 'active'`
- Documents: numbering + status posted; retries não duplicam via keys nas RPCs

---

## 12. PSCS Core boundary

Ver `inventory-pscs-core-boundary.md`.

---

## 13. BOM — migração futura

BOM operacional atual: `operational_material_rules`.  
Evolução documentada em `inventory-jde-model.md` (header/revision/components) — **fora desta branch**.

---

## 14. JDE adotado (conceitual)

- Hierarquia Branch / Location
- Kardex ledger (F4111-like)
- Disponibilidade On Hand / Committed / Available (P41202-like)
- Documentos de estoque com linhas
- Lotes opcionais
- Movement codes (provisórios)

---

## 15. JDE deliberadamente não adotado (V1)

- Cost accounting / GL
- FIFO / LIFO / average cost
- Procurement / PO / receipts completos
- Serial number completo
- Secondary UOM completo
- Transfer / physical inventory / adjustments finais (códigos pendentes)

---

## 16. Pendências — aguardando Philippe

- Prints JDE F4111 / P41202 para validar campos e códigos
- Aprovação final IB/ED/ER/LR/AI/AO/TR
- Gate exato de criação de commitment no fluxo de materiais

---

## Migrations desta foundation (Fase B)

| Migration | Conteúdo |
|-----------|----------|
| `20260812100000` | branches + `branch_id` em locations |
| `20260812110000` | lots, balances estendidos, view availability |
| `20260812120000` | commitments + RPCs commit/release |
| `20260812130000` | documents, lines, movement types, Kardex estendido |
| `20260812140000` | fix `rebuild_inventory_balances` (DELETE com WHERE) |

## Fase F — QA (concluída)

Scripts: `test:dev:inventory-jde-foundation` (T01–T32), `test:dev:inventory-all`, reconciliação corrigida.  
Relatório: `inventory-jde-foundation-phase-f-results.md`

---

## Fase E — UI (`/estoque`)

Layout com auth + RBAC (`inventory.view`) em `app/estoque/layout.tsx` e subnav JDE em `components/inventory/InventorySubnav.tsx`.

| Rota | View | API principal |
|------|------|---------------|
| `/estoque` | `InventoryDashboard` (visão geral v1 + posting manual) | balances, movements, post |
| `/estoque/disponibilidade` | `InventoryAvailabilityView` (P41202-like + drill-down reservas) | `/api/inventory/availability` |
| `/estoque/reservas` | `InventoryCommitmentsView` | `/api/inventory/commitments` |
| `/estoque/kardex` | `InventoryKardexView` | `/api/inventory/movements` |
| `/estoque/documentos` | `InventoryDocumentsView` (modal detalhe) | `/api/inventory/documents` |
| `/estoque/locais` | `InventoryLocationsView` (`canManage` via server page) | `/api/inventory/locations` |
| `/estoque/lotes` | `InventoryLotsView` (read-only) | `/api/inventory/lots`, `/api/inventory/branches` |

Shell comum: `InventoryPageShell`. i18n: `Lib/i18n/inventoryUi.ts` (nav, colunas, filtros).
