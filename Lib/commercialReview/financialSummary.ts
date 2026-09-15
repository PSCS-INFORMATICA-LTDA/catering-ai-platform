import { money } from '../coupons/couponMath.ts'
import { readCouponFinancialStory } from '../coupons/couponFinancialStory.ts'
import {
  isPricingBreakdown,
  type PricingBreakdown,
} from '../pricing/pricingBreakdownTypes.ts'

export type CommercialFinancialSummary = {
  source: 'pricing_breakdown' | 'quote_columns'
  currency: string
  subtotal: number
  additionals: number
  mileage: number
  other: number
  discount: number
  total: number
  deposit: number
  balance: number
  couponKind: 'none' | 'pending' | 'applied' | 'rejected'
}

type QuoteFinancialFields = {
  currency_code?: string | null
  package_total?: number | null
  additional_total?: number | null
  mileage_fee?: number | null
  holiday_surcharge_amount?: number | null
  grill_rental_total?: number | null
  discount_amount?: number | null
  discount?: number | null
  quote_total?: number | null
  reservation_amount?: number | null
  balance_due?: number | null
  pricing_breakdown?: PricingBreakdown | Record<string, unknown> | null
}

function amount(value: unknown) {
  const next = money(Number(value ?? 0))
  return Number.isFinite(next) ? next : 0
}

function lineSum(breakdown: PricingBreakdown, keys: string[]) {
  const wanted = new Set(keys)
  let total = 0
  for (const line of [...breakdown.lines, ...breakdown.adjustments]) {
    if (wanted.has(String(line.line_key))) total += amount(line.amount)
  }
  return money(total)
}

/**
 * Read-only commercial numbers for the workspace.
 * Never recomputes a new payable total. The snapshot / breakdown owns money.
 */
export function readCommercialFinancialSummary(
  quote: QuoteFinancialFields,
): CommercialFinancialSummary {
  const currency = String(quote.currency_code ?? 'USD')
  const breakdown = isPricingBreakdown(quote.pricing_breakdown)
    ? quote.pricing_breakdown
    : null
  const story = readCouponFinancialStory(breakdown)
  const couponKind = story?.kind ?? 'none'

  if (breakdown) {
    return {
      source: 'pricing_breakdown',
      currency,
      subtotal: amount(breakdown.subtotal),
      additionals: lineSum(breakdown, ['additional_item']),
      mileage: lineSum(breakdown, ['mileage']),
      other: lineSum(breakdown, [
        'grill_rental',
        'holiday_surcharge',
        'minimum_order',
      ]),
      discount:
        couponKind === 'applied'
          ? amount(story && 'saved' in story ? story.saved : 0)
          : amount(Math.abs(lineSum(breakdown, ['discount']))),
      total: amount(breakdown.total),
      deposit: amount(breakdown.deposit),
      balance: amount(breakdown.balance),
      couponKind,
    }
  }

  return {
    source: 'quote_columns',
    currency,
    subtotal: amount(quote.package_total),
    additionals: amount(quote.additional_total),
    mileage: amount(quote.mileage_fee),
    other:
      amount(quote.holiday_surcharge_amount) + amount(quote.grill_rental_total),
    discount: amount(quote.discount_amount ?? quote.discount),
    total: amount(quote.quote_total),
    deposit: amount(quote.reservation_amount),
    balance: amount(quote.balance_due),
    couponKind,
  }
}
