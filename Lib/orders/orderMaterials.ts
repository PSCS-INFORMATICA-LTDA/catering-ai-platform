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
  'cancelled',
] as const

export type MaterialStatus = (typeof MATERIAL_STATUSES)[number]

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
  status: MaterialStatus
  notes: string | null
  separated_by_user_id: string | null
  separated_at: string | null
  checked_by_user_id: string | null
  checked_at: string | null
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

/**
 * Recalcula status operacional a partir das quantidades.
 * cancelled permanece cancelled até reativação explícita.
 */
export function deriveMaterialStatus(input: {
  required: number
  separated: number
  checked: number
  hasChecked: boolean
  currentStatus?: MaterialStatus | null
}): MaterialStatus {
  if (input.currentStatus === 'cancelled') return 'cancelled'

  const required = input.required
  const separated = input.separated
  const checked = input.checked

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
