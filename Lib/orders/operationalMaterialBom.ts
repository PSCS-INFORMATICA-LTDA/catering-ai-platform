import type { MaterialType } from '@/Lib/orders/orderMaterials'

export const BOM_SOURCE_TYPES = ['package', 'additional', 'rule'] as const
export type BomSourceType = (typeof BOM_SOURCE_TYPES)[number]

export const BOM_CALCULATION_TYPES = ['fixed', 'per_guest', 'tier'] as const
export type BomCalculationType = (typeof BOM_CALCULATION_TYPES)[number]

export const BOM_GUEST_BASES = [
  'billable_guests',
  'adults',
  'children',
  'total_guests',
] as const
export type BomGuestBasis = (typeof BOM_GUEST_BASES)[number]

export const BOM_ROUNDING_RULES = ['none', 'ceil', 'floor', 'round'] as const
export type BomRoundingRule = (typeof BOM_ROUNDING_RULES)[number]

export type BomTierBand = {
  min_guests: number
  max_guests: number | null
  quantity: number
}

export type OperationalMaterialRuleRow = {
  id: string
  company_id: string
  source_type: BomSourceType
  source_id: string
  material_catalog_item_id: string | null
  material_description_snapshot: string
  material_type: MaterialType
  unit: string
  calculation_type: BomCalculationType
  fixed_quantity: number | null
  quantity_per_guest: number | null
  guest_basis: BomGuestBasis | null
  min_guests: number | null
  max_guests: number | null
  tier_json: BomTierBand[] | null
  rounding_rule: BomRoundingRule
  enabled: boolean
  sort_order: number
  notes: string | null
}

export type GuestCountsForBom = {
  adult_count?: number | null
  children_under_3_count?: number | null
  children_4_to_12_count?: number | null
  physical_guest_count?: number | null
  billable_guest_count?: number | null
}

export function isBomSourceType(v: string): v is BomSourceType {
  return (BOM_SOURCE_TYPES as readonly string[]).includes(v)
}

export function isBomCalculationType(v: string): v is BomCalculationType {
  return (BOM_CALCULATION_TYPES as readonly string[]).includes(v)
}

export function isBomGuestBasis(v: string): v is BomGuestBasis {
  return (BOM_GUEST_BASES as readonly string[]).includes(v)
}

export function isBomRoundingRule(v: string): v is BomRoundingRule {
  return (BOM_ROUNDING_RULES as readonly string[]).includes(v)
}

export function resolveGuestBasisCount(
  basis: BomGuestBasis | null | undefined,
  guests: GuestCountsForBom,
): number {
  const adults = Number(guests.adult_count ?? 0)
  const c3 = Number(guests.children_under_3_count ?? 0)
  const c412 = Number(guests.children_4_to_12_count ?? 0)
  const physical = Number(
    guests.physical_guest_count ?? adults + c3 + c412,
  )
  const billable = Number(guests.billable_guest_count ?? 0)

  switch (basis) {
    case 'adults':
      return Math.max(0, adults)
    case 'children':
      return Math.max(0, c3 + c412)
    case 'total_guests':
      return Math.max(0, physical)
    case 'billable_guests':
    default:
      return Math.max(0, billable > 0 ? billable : physical)
  }
}

export function applyRounding(value: number, rule: BomRoundingRule): number {
  if (!Number.isFinite(value) || value < 0) return 0
  switch (rule) {
    case 'ceil':
      return Math.ceil(value)
    case 'floor':
      return Math.floor(value)
    case 'round':
      return Math.round(value)
    case 'none':
    default:
      return value
  }
}

export function parseTierJson(raw: unknown): BomTierBand[] {
  if (!Array.isArray(raw)) return []
  const bands: BomTierBand[] = []
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue
    const r = row as Record<string, unknown>
    const min = Number(r.min_guests)
    const qty = Number(r.quantity)
    if (!Number.isFinite(min) || min < 0 || !Number.isFinite(qty) || qty < 0) {
      continue
    }
    const maxRaw = r.max_guests
    const max =
      maxRaw === null || maxRaw === undefined || maxRaw === ''
        ? null
        : Number(maxRaw)
    if (max !== null && (!Number.isFinite(max) || max < min)) continue
    bands.push({ min_guests: min, max_guests: max, quantity: qty })
  }
  return bands.sort((a, b) => a.min_guests - b.min_guests)
}

/**
 * Calcula required_quantity de uma regra BOM.
 * Retorna null quando a regra não se aplica (fora de faixa / dados incompletos).
 */
export function calculateBomRequiredQuantity(input: {
  rule: Pick<
    OperationalMaterialRuleRow,
    | 'calculation_type'
    | 'fixed_quantity'
    | 'quantity_per_guest'
    | 'guest_basis'
    | 'min_guests'
    | 'max_guests'
    | 'tier_json'
    | 'rounding_rule'
  >
  guests: GuestCountsForBom
  /** Multiplicador comercial do adicional (qty vendida). Pacote = 1. */
  sourceMultiplier?: number
}): number | null {
  const multiplier = Math.max(0, Number(input.sourceMultiplier ?? 1))
  if (multiplier <= 0) return null

  const guestCount = resolveGuestBasisCount(
    input.rule.guest_basis ?? 'billable_guests',
    input.guests,
  )

  if (
    input.rule.min_guests != null &&
    guestCount < Number(input.rule.min_guests)
  ) {
    return null
  }
  if (
    input.rule.max_guests != null &&
    guestCount > Number(input.rule.max_guests)
  ) {
    return null
  }

  let raw: number | null = null

  if (input.rule.calculation_type === 'fixed') {
    const fixed = Number(input.rule.fixed_quantity ?? 0)
    if (!Number.isFinite(fixed) || fixed < 0) return null
    raw = fixed * multiplier
  } else if (input.rule.calculation_type === 'per_guest') {
    const per = Number(input.rule.quantity_per_guest ?? 0)
    if (!Number.isFinite(per) || per < 0) return null
    raw = per * guestCount * multiplier
  } else if (input.rule.calculation_type === 'tier') {
    const bands = parseTierJson(input.rule.tier_json)
    const hit = bands.find((b) => {
      if (guestCount < b.min_guests) return false
      if (b.max_guests != null && guestCount > b.max_guests) return false
      return true
    })
    if (!hit) return null
    raw = hit.quantity * multiplier
  }

  if (raw == null || !Number.isFinite(raw)) return null
  return applyRounding(raw, input.rule.rounding_rule || 'none')
}

/**
 * Estratégia de consolidação (Fase 1.5):
 * **linhas separadas por regra BOM** (1 row por bom_rule_id).
 * Mesmo material de pacote + adicional → duas linhas com origens distintas.
 * Rastreabilidade completa; UI mostra origem por linha.
 */
export const BOM_CONSOLIDATION_STRATEGY =
  'separate_rows_per_rule' as const
