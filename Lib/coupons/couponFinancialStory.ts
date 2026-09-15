import { money } from './couponMath.ts'
import type { PricingBreakdown } from '@/Lib/pricing/pricingBreakdownTypes'

export type CouponFinancialStory =
  | {
      kind: 'pending'
      code: string
      campaignName: string
      currentPayable: number
      requestedDiscount: number
      projectedTotal: number
    }
  | {
      kind: 'applied'
      code: string
      campaignName: string
      saved: number
      total: number
    }
  | {
      kind: 'rejected'
      code: string
      campaignName: string
      currentPayable: number
    }

function readText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function readAmount(value: unknown) {
  const amount = money(Number(value ?? 0))
  return Number.isFinite(amount) ? amount : 0
}

export function readCouponFinancialStory(
  breakdown: Pick<PricingBreakdown, 'total' | 'coupon'> | null | undefined,
): CouponFinancialStory | null {
  const coupon = breakdown?.coupon
  if (!breakdown || !coupon || typeof coupon !== 'object') return null

  const status = readText(coupon.approval_status).toLowerCase()
  const code = readText(coupon.code)
  const campaignName = readText(coupon.campaign_name)
  const potential = readAmount(coupon.potential_discount_amount)
  const applied = readAmount(coupon.applied_discount_amount)
  const payable = money(Number(breakdown.total ?? 0))

  if (status === 'rejected' || status === 'revoked') {
    if (!code && applied <= 0 && potential <= 0) return null
    return {
      kind: 'rejected',
      code,
      campaignName,
      currentPayable: payable,
    }
  }

  if (status === 'pending' && potential > 0 && applied <= 0) {
    return {
      kind: 'pending',
      code,
      campaignName,
      currentPayable: payable,
      requestedDiscount: potential,
      projectedTotal: money(Math.max(0, payable - potential)),
    }
  }

  if ((status === 'applied' || applied > 0) && applied > 0) {
    return {
      kind: 'applied',
      code,
      campaignName,
      saved: applied,
      total: payable,
    }
  }

  return null
}

export function quoteShareBlockedByCoupon(
  breakdown: Pick<PricingBreakdown, 'total' | 'coupon'> | null | undefined,
) {
  return readCouponFinancialStory(breakdown)?.kind === 'pending'
}
