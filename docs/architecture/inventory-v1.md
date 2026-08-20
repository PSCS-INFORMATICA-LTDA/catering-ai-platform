# Estoque v1 — Location default + Ledger + Saldo materializado + Posting OS

**Branch:** `feat/inventory-v1-dev`  
**Baseline Materiais:** `MATERIALS_BASELINE_HEAD=e9a213597a6fb685ffa7568eb1f6a03ef62b377f`  
**Ambiente:** DEV `yasprgtlqclwsjcshtls`  
**Discovery:** `docs/architecture/inventory-discovery.md`

## Arquitetura

| Camada | Papel |
|--------|--------|
| `inventory_movements` | **Fonte de verdade** (ledger imutável) |
| `inventory_balances` | Materialização reconciliável `SUM(movements)` |
| `inventory_locations` | Local (v1: 1 default / company) |
| `current_stock_qty` | **Não** é fonte de verdade |

### Convenção de sinal

`quantity` **SIGNED**: `+` entrada · `-` saída.  
Tipos v1: `initial_balance`, `event_dispatch`, `event_return`, `event_leftover_return`, `adjustment_in`, `adjustment_out`.

### Negative stock (v1)

**BLOCK** para `event_dispatch` e `adjustment_out` que deixariam saldo &lt; 0 (`negative_stock_blocked`).

### Idempotência

Unique `(company_id, idempotency_key)`.  
Exemplos: `event_dispatch:<material_id>`, `event_return:<material_id>:to:<qty>`.

### Posting OS

- Dispatch: dentro de `confirm_public_material_dispatch` (mesma transação; falha → rollback).
- Return/leftover: `post_inventory_for_material_return` (delta vs SUM já postado).
- Só se `catalog_item_id` + `inventory_enabled=true`.
- Manual / disabled → `stock_posting_status=not_applicable`.

### Unidades

Sem conversão. Mismatch unit material vs saldo/catálogo → `unit_mismatch`.

## RBAC

`inventory.view` · `inventory.manage` · `inventory.adjust`

## Fora de escopo

Purchase / AP / valuation / FIFO / LIFO / transfer / multi-warehouse / reservation / physical inventory / financeiro.

## Scripts

```
npm.cmd run seed:dev:inventory-v1
npm.cmd run test:dev:inventory-core
npm.cmd run test:dev:inventory-order-posting
npm.cmd run test:dev:inventory-reconciliation
npm.cmd run rebuild:dev:inventory-balances
```

## Migrations

- `20260810210000_inventory_v1.sql`
- `20260810211000_inventory_v1_dispatch_hook.sql`
