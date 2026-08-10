export const MATERIAL_SOURCE_TYPES = [
  'package',
  'additional',
  'supplier',
  'manual',
  'rule',
] as const

export type MaterialSourceType = (typeof MATERIAL_SOURCE_TYPES)[number]

export const MATERIAL_TYPES = [
  'consumable',
  'returnable',
  'equipment',
  'disposable',
] as const

export type MaterialType = (typeof MATERIAL_TYPES)[number]

export const MATERIAL_STATUSES = [
  'pending',
  'partial',
  'separated',
  'checked',
  'divergence',
  'dispatched',
  'returned',
  'closed',
  'cancelled',
] as const

export type MaterialStatus = (typeof MATERIAL_STATUSES)[number]

export const STOCK_POSTING_STATUSES = [
  'pending',
  'posted',
  'not_applicable',
] as const

export type StockPostingStatus = (typeof STOCK_POSTING_STATUSES)[number]

export type ServiceOrderMaterialRow = {
  id: string
  company_id: string
  service_order_id: string
  catalog_item_id: string | null
  bom_rule_id?: string | null
  source_type: MaterialSourceType
  source_id: string | null
  source_label_snapshot?: string | null
  description_snapshot: string
  material_type: MaterialType
  unit: string
  required_quantity: number
  separated_quantity: number
  checked_quantity: number
  dispatched_quantity: number
  returned_quantity: number
  leftover_quantity: number
  status: MaterialStatus
  notes: string | null
  return_notes?: string | null
  stock_posting_status?: StockPostingStatus | null
  separated_by_user_id: string | null
  separated_at: string | null
  checked_by_user_id: string | null
  checked_at: string | null
  dispatched_by_user_id?: string | null
  dispatched_at?: string | null
  returned_by_user_id?: string | null
  returned_at?: string | null
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
}

export function isMaterialSourceType(value: string): value is MaterialSourceType {
  return (MATERIAL_SOURCE_TYPES as readonly string[]).includes(value)
}

export function isMaterialType(value: string): value is MaterialType {
  return (MATERIAL_TYPES as readonly string[]).includes(value)
}

export function isMaterialStatus(value: string): value is MaterialStatus {
  return (MATERIAL_STATUSES as readonly string[]).includes(value)
}

/** Quantidade finita e não negativa. */
export function parseNonNegativeQuantity(
  raw: unknown,
): { ok: true; value: number } | { ok: false; error: string } {
  const n = typeof raw === 'number' ? raw : Number(raw)
  if (!Number.isFinite(n)) {
    return { ok: false, error: 'Quantidade inválida.' }
  }
  if (n < 0) {
    return { ok: false, error: 'Quantidade não pode ser negativa.' }
  }
  return { ok: true, value: n }
}

export function defaultStockPostingStatus(
  materialType: MaterialType,
): StockPostingStatus {
  if (materialType === 'disposable') return 'not_applicable'
  return 'pending'
}

/**
 * Recalcula status operacional a partir das quantidades.
 * cancelled / closed permanecem até mudança explícita.
 */
export function deriveMaterialStatus(input: {
  required: number
  separated: number
  checked: number
  hasChecked: boolean
  dispatched?: number
  hasDispatched?: boolean
  returned?: number
  hasReturned?: boolean
  leftover?: number
  materialType?: MaterialType
  currentStatus?: MaterialStatus | null
}): MaterialStatus {
  if (input.currentStatus === 'cancelled') return 'cancelled'
  if (input.currentStatus === 'closed') return 'closed'

  const required = input.required
  const separated = input.separated
  const checked = input.checked
  const dispatched = input.dispatched ?? 0
  const returned = input.returned ?? 0
  const materialType = input.materialType ?? 'consumable'

  if (input.hasReturned) {
    if (
      (materialType === 'returnable' || materialType === 'equipment') &&
      returned < dispatched
    ) {
      return 'divergence'
    }
    if (returned > dispatched) {
      return 'divergence'
    }
    return 'returned'
  }

  if (input.hasDispatched) {
    return 'dispatched'
  }

  if (input.hasChecked) {
    if (checked !== separated || (required > 0 && checked !== required)) {
      return 'divergence'
    }
    return 'checked'
  }

  if (separated <= 0) return 'pending'
  if (separated < required) return 'partial'
  return 'separated'
}

/** Pode fechar materiais: sem divergence e (dispatched+retorno tratado ou descartável). */
export function canCloseMaterial(row: {
  status: MaterialStatus
  material_type: MaterialType
  dispatched_quantity: number
  returned_quantity: number
  returned_at?: string | null
}): boolean {
  if (row.status === 'cancelled' || row.status === 'closed') return true
  if (row.status === 'divergence') return false
  if (row.material_type === 'disposable' || row.material_type === 'consumable') {
    return (
      row.status === 'dispatched' ||
      row.status === 'returned' ||
      Boolean(row.returned_at)
    )
  }
  // returnable / equipment: precisa retorno registrado sem divergência
  return Boolean(row.returned_at)
}

export function inferMaterialTypeFromCatalog(item: {
  item_type?: string | null
  operational_item?: boolean | null
}): MaterialType {
  const t = (item.item_type || '').toUpperCase()
  if (t === 'EQUIPMENT') return 'equipment'
  if (t === 'SUPPLY') return 'disposable'
  if (item.operational_item) return 'consumable'
  return 'consumable'
}
