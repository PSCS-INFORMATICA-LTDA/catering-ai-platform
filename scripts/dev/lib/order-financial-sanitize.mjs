/** Espelho leve de Lib/orders/sanitizeServiceOrderFinancial.ts para QA. */

const FINANCIAL_HEADER_KEYS = [
  'currency_code',
  'package_total',
  'additional_total',
  'mileage_fee',
  'discount_amount',
  'reservation_amount',
  'balance_due',
  'service_order_total',
]

export function sanitizeServiceOrderDetailForActor(detail, { includeFinancial }) {
  if (includeFinancial) return detail
  const next = { ...detail }
  for (const key of FINANCIAL_HEADER_KEYS) delete next[key]
  if (next.commercial_snapshot && typeof next.commercial_snapshot === 'object') {
    const snap = { ...next.commercial_snapshot }
    if (snap.package && typeof snap.package === 'object') {
      const p = snap.package
      snap.package = {
        id: p.id ?? null,
        label_pt: p.label_pt ?? p.label ?? p.package_name ?? p.name ?? null,
      }
    }
    if (Array.isArray(snap.additional_items)) {
      snap.additional_items = snap.additional_items.map((a) => ({
        additional_item_id: a.additional_item_id ?? null,
        quantity: a.quantity ?? null,
        selected: a.selected,
        label_pt: a.label_pt ?? a.item_name ?? null,
      }))
    }
    delete snap.quote_total
    delete snap.package_total
    delete snap.additional_total
    delete snap.discount_amount
    delete snap.balance_due
    delete snap.reservation
    delete snap.mileage
    delete snap.currency_code
    next.commercial_snapshot = snap
  }
  if (Array.isArray(next.items)) {
    next.items = next.items.map((item) => {
      const row = { ...item }
      delete row.unit_price
      delete row.total_price
      return row
    })
  }
  return next
}

export function findFinancialKeysInPayload(value, path = '') {
  const hits = []
  const re =
    /^(unit_price|total_price|package_total|additional_total|mileage_fee|discount_amount|reservation_amount|balance_due|service_order_total|quote_total|price|subtotal|cost|margin|markup|deposit)$/i
  if (value == null) return hits
  if (Array.isArray(value)) {
    value.forEach((v, i) => hits.push(...findFinancialKeysInPayload(v, `${path}[${i}]`)))
    return hits
  }
  if (typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      const p = path ? `${path}.${k}` : k
      if (re.test(k)) hits.push(p)
      else hits.push(...findFinancialKeysInPayload(v, p))
    }
  }
  return hits
}
