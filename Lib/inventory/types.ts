/**
 * Inventory JDE Foundation V1 — tipos e convenções.
 *
 * Convenção de quantidade: SIGNED
 *   + entrada (initial_balance, event_return, event_leftover_return, adjustment_in)
 *   - saída (event_dispatch, adjustment_out)
 *
 * Fonte de verdade: inventory_movements (Kardex)
 * inventory_balances = materialização (SUM(movements) + buckets)
 * AVAILABLE = quantity_on_hand - quantity_committed (calculado; NÃO persistido)
 * Commitment NÃO reduz On Hand e NÃO gera Kardex.
 *
 * Códigos de movimento PROVISÓRIOS — PENDING PHILIPPE VALIDATION:
 *   IB / ED / ER / LR / AI / AO / TR
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

/** Provisório — PENDING PHILIPPE VALIDATION */
export const INVENTORY_MOVEMENT_CODES = [
  'IB',
  'ED',
  'ER',
  'LR',
  'AI',
  'AO',
  'TR',
] as const

export type InventoryMovementCode = (typeof INVENTORY_MOVEMENT_CODES)[number]

export const INVENTORY_DOCUMENT_TYPES = [
  'INITIAL_BALANCE',
  'EVENT_DISPATCH',
  'EVENT_RETURN',
  'LEFTOVER_RETURN',
  'ADJUSTMENT_IN',
  'ADJUSTMENT_OUT',
  'TRANSFER',
] as const

export type InventoryDocumentType = (typeof INVENTORY_DOCUMENT_TYPES)[number]

export const INVENTORY_DOCUMENT_STATUSES = [
  'draft',
  'posted',
  'cancelled',
] as const

export type InventoryDocumentStatus = (typeof INVENTORY_DOCUMENT_STATUSES)[number]

export const INVENTORY_COMMITMENT_STATUSES = [
  'active',
  'released',
  'consumed',
  'cancelled',
] as const

export type InventoryCommitmentStatus =
  (typeof INVENTORY_COMMITMENT_STATUSES)[number]

export const INVENTORY_LOT_STATUSES = [
  'active',
  'blocked',
  'expired',
  'quarantine',
] as const

export type InventoryLotStatus = (typeof INVENTORY_LOT_STATUSES)[number]

export type InventoryRpcResult = {
  ok: boolean
  idempotent?: boolean
  error?: string
  [key: string]: unknown
}

export type InventoryBranch = {
  id: string
  company_id: string
  name: string
  branch_code: string | null
  is_default: boolean
  active: boolean
}

export type InventoryLocation = {
  id: string
  company_id: string
  branch_id: string
  name: string
  code: string | null
  location_type: string | null
  is_default: boolean
  active: boolean
}

export type InventoryLot = {
  id: string
  company_id: string
  branch_id: string
  catalog_item_id: string
  lot_number: string
  status: InventoryLotStatus
  manufacture_date: string | null
  expiration_date: string | null
  notes: string | null
  active: boolean
}

export type InventoryBalanceRow = {
  id: string
  company_id: string
  branch_id: string
  location_id: string
  catalog_item_id: string
  lot_id: string | null
  quantity_on_hand: number
  quantity_committed: number
  quantity_in_event: number
  /** FUTURE PROCUREMENT — sem compras nesta fase; permanece 0 */
  quantity_on_receipt: number
  unit: string
  last_movement_at: string | null
  updated_at: string
}

/** Espelha public.inventory_availability (Available calculado). */
export type InventoryAvailabilityRow = InventoryBalanceRow & {
  balance_id: string
  quantity_available: number
}

export type InventoryCommitmentRow = {
  id: string
  company_id: string
  branch_id: string
  location_id: string
  catalog_item_id: string
  lot_id: string | null
  service_order_id: string
  service_order_material_id: string
  quantity: number
  unit: string
  status: InventoryCommitmentStatus
  committed_at: string
  released_at: string | null
  consumed_at: string | null
  created_by: string | null
  created_at: string
}

export type InventoryDocumentRow = {
  id: string
  company_id: string
  branch_id: string
  document_number: string
  document_type: InventoryDocumentType | string
  movement_code: string
  document_date: string
  service_order_id: string | null
  event_id: string | null
  from_location_id: string | null
  to_location_id: string | null
  status: InventoryDocumentStatus | string
  notes: string | null
  idempotency_key: string
  created_by: string | null
  created_at: string
  posted_at?: string | null
}

export type InventoryDocumentLineRow = {
  id: string
  company_id: string
  document_id: string
  line_number: number
  catalog_item_id: string
  location_id: string
  lot_id: string | null
  quantity: number
  unit: string
  service_order_material_id: string | null
  notes: string | null
  created_at: string
}

export type InventoryMovementRow = {
  id: string
  company_id: string
  branch_id: string
  location_id: string
  catalog_item_id: string
  lot_id: string | null
  movement_type: InventoryMovementType | string
  movement_code: string | null
  document_type: string | null
  document_number: string | null
  inventory_document_id: string | null
  line_number: number | null
  direction: 'in' | 'out' | null
  quantity: number
  unit: string
  source_type: string | null
  source_id: string | null
  service_order_id: string | null
  service_order_material_id: string | null
  event_id: string | null
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
  inventory_document_id?: string | null
  quantity_on_hand?: number | null
  quantity_in_event?: number | null
  error?: string
  expected_unit?: string
  got_unit?: string
}

export type InventoryAvailabilityFilters = {
  branchId?: string | null
  locationId?: string | null
  catalogItemId?: string | null
  lotId?: string | null
  query?: string | null
  onlyWithStock?: boolean
  onlyCommitted?: boolean
  limit?: number
}

export type InventoryCommitmentFilters = {
  branchId?: string | null
  locationId?: string | null
  catalogItemId?: string | null
  lotId?: string | null
  serviceOrderId?: string | null
  status?: InventoryCommitmentStatus | null
  limit?: number
}

export type InventoryDocumentFilters = {
  branchId?: string | null
  documentType?: string | null
  movementCode?: string | null
  serviceOrderId?: string | null
  status?: string | null
  from?: string | null
  to?: string | null
  limit?: number
}

export type InventoryMovementFilters = {
  branchId?: string | null
  locationId?: string | null
  catalogItemId?: string | null
  lotId?: string | null
  movementType?: string | null
  movementCode?: string | null
  documentId?: string | null
  serviceOrderId?: string | null
  from?: string | null
  to?: string | null
  limit?: number
}

export type InventoryReconciliationMismatch = {
  branch_id: string | null
  location_id: string
  catalog_item_id: string
  lot_id: string | null
  ledger_sum: number
  balance_on_hand: number
  delta: number
}

export function normalizeInventoryUnit(unit: string | null | undefined): string {
  return (unit || '').trim().toLowerCase()
}

export function isInventoryMovementType(v: string): v is InventoryMovementType {
  return (INVENTORY_MOVEMENT_TYPES as readonly string[]).includes(v)
}

export function computeQuantityAvailable(
  onHand: number,
  committed: number,
): number {
  return Number(onHand) - Number(committed)
}
