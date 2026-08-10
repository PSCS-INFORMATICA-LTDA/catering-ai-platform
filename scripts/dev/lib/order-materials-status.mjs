/**
 * Espelho de Lib/orders/orderMaterials.ts — deriveMaterialStatus (QA DEV).
 */

export function parseNonNegativeQuantity(raw) {
  const n = typeof raw === 'number' ? raw : Number(raw)
  if (!Number.isFinite(n)) {
    return { ok: false, error: 'Quantidade inválida.' }
  }
  if (n < 0) {
    return { ok: false, error: 'Quantidade não pode ser negativa.' }
  }
  return { ok: true, value: n }
}

export function deriveMaterialStatus(input) {
  if (input.currentStatus === 'cancelled') return 'cancelled'

  const { required, separated, checked, hasChecked } = input

  if (hasChecked) {
    if (checked !== separated || (required > 0 && checked !== required)) {
      return 'divergence'
    }
    return 'checked'
  }

  if (separated <= 0) return 'pending'
  if (separated < required) return 'partial'
  return 'separated'
}
