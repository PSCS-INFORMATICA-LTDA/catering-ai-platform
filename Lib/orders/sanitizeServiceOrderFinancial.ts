/**
 * Segregação financeira da OS — remove campos comerciais do payload
 * quando o ator não tem `orders.financial.view`.
 *
 * Banco / histórico comercial permanecem intactos.
 */

const FINANCIAL_HEADER_KEYS = [
  'currency_code',
  'package_total',
  'additional_total',
  'mileage_fee',
  'discount_amount',
  'reservation_amount',
  'balance_due',
  'service_order_total',
] as const

const FINANCIAL_ITEM_KEYS = ['unit_price', 'total_price'] as const

const SNAPSHOT_FINANCIAL_KEYS = [
  'package_total',
  'additional_total',
  'mileage',
  'discount_amount',
  'reservation',
  'balance_due',
  'quote_total',
  'currency_code',
  'unit_price',
  'total_price',
  'price',
  'total',
  'subtotal',
  'cost',
  'margin',
  'markup',
  'deposit',
] as const

function stripSnapshotFinancial(
  snapshot: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  if (!snapshot || typeof snapshot !== 'object') return {}

  const out: Record<string, unknown> = {}

  if (snapshot.package && typeof snapshot.package === 'object') {
    const pkg = snapshot.package as Record<string, unknown>
    out.package = {
      id: pkg.id ?? null,
      label_pt: pkg.label_pt ?? pkg.label ?? pkg.package_name ?? pkg.name ?? null,
      name: pkg.name ?? pkg.package_name ?? null,
      package_name: pkg.package_name ?? null,
      // sem total / price
    }
  }

  if (snapshot.guest_counts && typeof snapshot.guest_counts === 'object') {
    out.guest_counts = snapshot.guest_counts
  }

  if (snapshot.event && typeof snapshot.event === 'object') {
    out.event = snapshot.event
  }

  if (Array.isArray(snapshot.additional_items)) {
    out.additional_items = snapshot.additional_items.map((raw) => {
      if (!raw || typeof raw !== 'object') return {}
      const a = raw as Record<string, unknown>
      return {
        additional_item_id: a.additional_item_id ?? null,
        quantity: a.quantity ?? null,
        selected: a.selected,
        label_pt: a.label_pt ?? a.item_name ?? null,
        item_name: a.item_name ?? null,
      }
    })
  }

  // Copiar chaves não financeiras restantes com cuidado
  for (const [key, value] of Object.entries(snapshot)) {
    if (
      key === 'package' ||
      key === 'guest_counts' ||
      key === 'event' ||
      key === 'additional_items'
    ) {
      continue
    }
    if (
      (SNAPSHOT_FINANCIAL_KEYS as readonly string[]).includes(key) ||
      /price|total|discount|cost|margin|markup|deposit|balance|fee|amount/i.test(
        key,
      )
    ) {
      continue
    }
    out[key] = value
  }

  return out
}

export type ServiceOrderFinancialSanitizeOptions = {
  includeFinancial: boolean
}

/**
 * Remove campos financeiros de um detalhe/listagem de OS.
 * Quando includeFinancial=true, devolve o objeto intacto.
 */
export function sanitizeServiceOrderDetailForActor<T extends Record<string, unknown>>(
  detail: T,
  options: ServiceOrderFinancialSanitizeOptions,
): T {
  if (options.includeFinancial) return detail

  const next = { ...detail } as Record<string, unknown>

  for (const key of FINANCIAL_HEADER_KEYS) {
    delete next[key]
  }

  if (next.commercial_snapshot && typeof next.commercial_snapshot === 'object') {
    next.commercial_snapshot = stripSnapshotFinancial(
      next.commercial_snapshot as Record<string, unknown>,
    )
  }

  if (Array.isArray(next.items)) {
    next.items = next.items.map((item) => {
      if (!item || typeof item !== 'object') return item
      const row = { ...(item as Record<string, unknown>) }
      for (const key of FINANCIAL_ITEM_KEYS) {
        delete row[key]
      }
      return row
    })
  }

  return next as T
}

export function sanitizeServiceOrderListRowForActor<T extends Record<string, unknown>>(
  row: T,
  options: ServiceOrderFinancialSanitizeOptions,
): T {
  if (options.includeFinancial) return row
  const next = { ...row } as Record<string, unknown>
  delete next.service_order_total
  delete next.currency_code
  delete next.package_total
  delete next.additional_total
  delete next.mileage_fee
  delete next.discount_amount
  delete next.reservation_amount
  delete next.balance_due
  return next as T
}

/** Detecta chaves financeiras em JSON (QA). */
export function findFinancialKeysInPayload(
  value: unknown,
  path = '',
): string[] {
  const hits: string[] = []
  const financialName =
    /^(unit_price|total_price|package_total|additional_total|mileage_fee|discount_amount|reservation_amount|balance_due|service_order_total|quote_total|price|subtotal|cost|margin|markup|deposit)$/i

  if (value == null) return hits
  if (Array.isArray(value)) {
    value.forEach((v, i) => {
      hits.push(...findFinancialKeysInPayload(v, `${path}[${i}]`))
    })
    return hits
  }
  if (typeof value === 'object') {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const p = path ? `${path}.${k}` : k
      if (financialName.test(k)) hits.push(p)
      else hits.push(...findFinancialKeysInPayload(v, p))
    }
  }
  return hits
}
