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
    if (returned > dispatched) return 'divergence'
    return 'returned'
  }

  if (input.hasDispatched) return 'dispatched'

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

export function canCloseMaterial(row) {
  if (row.status === 'cancelled' || row.status === 'closed') return true
  if (row.status === 'divergence') return false
  if (row.material_type === 'disposable' || row.material_type === 'consumable') {
    return (
      row.status === 'dispatched' ||
      row.status === 'returned' ||
      Boolean(row.returned_at)
    )
  }
  return Boolean(row.returned_at) && row.status !== 'divergence'
}
