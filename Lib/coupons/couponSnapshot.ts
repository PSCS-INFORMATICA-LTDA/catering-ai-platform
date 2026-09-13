import { money } from './couponMath.ts'

type QuoteLike = {
  pricing_breakdown?: unknown
  coupon_snapshot?: unknown
  quote_total?: unknown
  total_amount?: unknown
  reservation_amount?: unknown
  deposit_amount?: unknown
  balance_due?: unknown
}

export type CouponQuotePatch = {
  discount: number
  discount_amount: number
  reservation_amount: number
  deposit_amount: number
  balance_due: number
  total_amount: number
  quote_total: number
  pricing_breakdown: Record<string, unknown>
  coupon_snapshot: Record<string, unknown>
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {}
}

/** Stamp a rejection on the frozen quote snapshot without changing payable money. */
export function buildRejectedCouponQuotePatch(
  quote: QuoteLike,
  now: string,
): CouponQuotePatch | null {
  const breakdown = asRecord(quote.pricing_breakdown)
  if (!Object.keys(breakdown).length) return null
  const currentCoupon = asRecord(breakdown.coupon ?? quote.coupon_snapshot)
  const couponSnapshot = {
    ...currentCoupon,
    approval_status: 'rejected',
    applied_discount_amount: 0,
    rejected_at: now,
  }
  const adjustments = Array.isArray(breakdown.adjustments)
    ? (breakdown.adjustments as Array<Record<string, unknown>>).filter(
        (line) => line.line_key !== 'discount',
      )
    : []
  const total = money(Number(breakdown.total ?? quote.quote_total ?? quote.total_amount ?? 0))
  const deposit = money(
    Number(breakdown.deposit ?? quote.reservation_amount ?? quote.deposit_amount ?? 0),
  )
  const balance = money(Number(breakdown.balance ?? quote.balance_due ?? Math.max(0, total - deposit)))
  return {
    discount: 0,
    discount_amount: 0,
    reservation_amount: deposit,
    deposit_amount: deposit,
    balance_due: balance,
    total_amount: total,
    quote_total: total,
    pricing_breakdown: {
      ...breakdown,
      adjustments,
      coupon: couponSnapshot,
    },
    coupon_snapshot: couponSnapshot,
  }
}
