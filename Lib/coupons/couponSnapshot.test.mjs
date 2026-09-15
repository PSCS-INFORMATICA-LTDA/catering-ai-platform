import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { buildRejectedCouponQuotePatch } from './couponSnapshot.ts'
import { readCouponFinancialStory } from './couponFinancialStory.ts'

describe('buildRejectedCouponQuotePatch', () => {
  it('keeps the original payable total and removes the pending projection', () => {
    const patch = buildRejectedCouponQuotePatch(
      {
        quote_total: 2820,
        reservation_amount: 846,
        balance_due: 1974,
        pricing_breakdown: {
          total: 2820,
          deposit: 846,
          balance: 1974,
          adjustments: [
            { line_key: 'discount', amount: -141 },
            { line_key: 'minimum_order', amount: 0 },
          ],
          coupon: {
            code: 'CDL10',
            approval_status: 'pending',
            potential_discount_amount: 141,
            applied_discount_amount: 0,
          },
        },
      },
      '2026-09-13T21:00:00.000Z',
    )
    assert.ok(patch)
    assert.equal(patch.quote_total, 2820)
    assert.equal(patch.discount_amount, 0)
    assert.equal(patch.coupon_snapshot.approval_status, 'rejected')
    assert.equal(patch.coupon_snapshot.applied_discount_amount, 0)
    const adjustments = Array.isArray(patch.pricing_breakdown.adjustments)
      ? patch.pricing_breakdown.adjustments
      : []
    assert.equal(
      adjustments.some((line) => line?.line_key === 'discount'),
      false,
    )
    assert.equal(
      readCouponFinancialStory({
        total: patch.quote_total,
        coupon: patch.pricing_breakdown.coupon,
      })?.kind,
      'rejected',
    )
  })
})
