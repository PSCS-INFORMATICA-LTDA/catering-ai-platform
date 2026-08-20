/**
 * Espelho de Lib/orders/operationalMaterialBom.ts para QA DEV.
 */

export function resolveGuestBasisCount(basis, guests) {
  const adults = Number(guests.adult_count ?? 0)
  const c3 = Number(guests.children_under_3_count ?? 0)
  const c412 = Number(guests.children_4_to_12_count ?? 0)
  const physical = Number(guests.physical_guest_count ?? adults + c3 + c412)
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

export function applyRounding(value, rule) {
  if (!Number.isFinite(value) || value < 0) return 0
  if (rule === 'ceil') return Math.ceil(value)
  if (rule === 'floor') return Math.floor(value)
  if (rule === 'round') return Math.round(value)
  return value
}

export function parseTierJson(raw) {
  if (!Array.isArray(raw)) return []
  return raw
    .map((r) => ({
      min_guests: Number(r.min_guests),
      max_guests: r.max_guests == null ? null : Number(r.max_guests),
      quantity: Number(r.quantity),
    }))
    .filter(
      (b) =>
        Number.isFinite(b.min_guests) &&
        Number.isFinite(b.quantity) &&
        (b.max_guests == null || Number.isFinite(b.max_guests)),
    )
    .sort((a, b) => a.min_guests - b.min_guests)
}

export function calculateBomRequiredQuantity({
  rule,
  guests,
  sourceMultiplier = 1,
}) {
  const multiplier = Math.max(0, Number(sourceMultiplier ?? 1))
  if (multiplier <= 0) return null
  const guestCount = resolveGuestBasisCount(
    rule.guest_basis ?? 'billable_guests',
    guests,
  )
  if (rule.min_guests != null && guestCount < Number(rule.min_guests)) return null
  if (rule.max_guests != null && guestCount > Number(rule.max_guests)) return null

  let raw = null
  if (rule.calculation_type === 'fixed') {
    raw = Number(rule.fixed_quantity ?? 0) * multiplier
  } else if (rule.calculation_type === 'per_guest') {
    raw = Number(rule.quantity_per_guest ?? 0) * guestCount * multiplier
  } else if (rule.calculation_type === 'tier') {
    const bands = parseTierJson(rule.tier_json)
    const hit = bands.find((b) => {
      if (guestCount < b.min_guests) return false
      if (b.max_guests != null && guestCount > b.max_guests) return false
      return true
    })
    if (!hit) return null
    raw = hit.quantity * multiplier
  }
  if (raw == null || !Number.isFinite(raw)) return null
  return applyRounding(raw, rule.rounding_rule || 'none')
}
