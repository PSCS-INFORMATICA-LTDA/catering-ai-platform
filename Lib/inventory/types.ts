/**
 * Inventory v1 — tipos e convenções.
 *
 * Convenção de quantidade: SIGNED
 *   + entrada (initial_balance, event_return, event_leftover_return, adjustment_in)
 *   - saída (event_dispatch, adjustment_out)
 *
 * Fonte de verdade: inventory_movements
 * inventory_balances = materialização (SUM(movements))
 * current_stock_qty NÃO é fonte de verdade.
 *
 * Negative stock (v1): BLOCK em event_dispatch e adjustment_out.
 */

export const INVENTORY_MOVEMENT_TYPES = [
  'initial_balance',
  'event_dispatch',
  'event_return',
  'event_leftover_return',
  'adjustment_in',
  'adjustment_out',
] as const

export type InventoryMovementType = (typeof INVENTORY_MOVEMENT_TYPES)[number]

export type InventoryLocation = {
  id: string
  company_id: string
  name: string
  code: string | null
  is_default: boolean
  active: boolean
}

export type InventoryBalanceRow = {
  id: string
  company_id: string
  location_id: string
  catalog_item_id: string
  quantity_on_hand: number
  unit: string
  last_movement_at: string | null
  updated_at: string
}

export type InventoryMovementRow = {
  id: string
  company_id: string
  location_id: string
  catalog_item_id: string
  movement_type: InventoryMovementType
  quantity: number
  unit: string
  source_type: string | null
  source_id: string | null
  service_order_id: string | null
  service_order_material_id: string | null
  idempotency_key: string
  occurred_at: string
  notes: string | null
  created_by: string | null
  created_at: string
}

export type PostInventoryResult = {
  ok: boolean
  idempotent?: boolean
  movement_id?: string
  quantity_on_hand?: number | null
  error?: string
  expected_unit?: string
  got_unit?: string
}

export function normalizeInventoryUnit(unit: string | null | undefined): string {
  return (unit || '').trim().toLowerCase()
}

export function isInventoryMovementType(v: string): v is InventoryMovementType {
  return (INVENTORY_MOVEMENT_TYPES as readonly string[]).includes(v)
}
