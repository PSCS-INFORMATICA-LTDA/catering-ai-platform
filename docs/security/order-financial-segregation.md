# Segregação financeira da OS

**Permissão:** `orders.financial.view`  
**Ambiente:** DEV `yasprgtlqclwsjcshtls`  
**Branch:** `feat/order-materials-operations-dev`

## Roles

| Autorizadas | Bloqueadas (sem grant automático) |
|-------------|-------------------------------------|
| owner, admin, sales, finance | manager, operator, kitchen, viewer |

Platform admin bypassa via sessão.

## Server-side

- `sanitizeServiceOrderDetailForActor` / `sanitizeServiceOrderListRowForActor`
- `fetchServiceOrderDetail(..., { includeFinancial })`
- `fetchServiceOrderList(..., { includeFinancial })`
- APIs: `GET/PATCH /api/orders`, `GET /api/orders/[id]`, convert

Operacional **não recebe** no JSON: totais, unit_price, commercial_snapshot financeiro.

## UI

- Itens vendidos: nome / tipo / qty (sempre sem preço)
- Financeiro: só com `orders.financial.view`
- Lista de OS: coluna Total só com permissão

## Público

Confirmação equipe / garnish / designação: sem preços.  
Proposta pública: mantém totais (cliente).

## Banco

Snapshot comercial permanece completo. Restrição é de acesso.
