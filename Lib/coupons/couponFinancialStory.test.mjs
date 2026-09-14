import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readCouponFinancialStory, quoteShareBlockedByCoupon } from './couponFinancialStory.ts'

describe('readCouponFinancialStory', () => {
  it('keeps the payable total unchanged for a pending coupon', () => {
    const story = readCouponFinancialStory({
      total: 2820,
      coupon: {
        code: 'MANUAL',
        campaign_name: 'Manual',
        approval_status: 'pending',
        potential_discount_amount: 141,
        applied_discount_amount: 0,
      },
    })
    assert.deepEqual(story, {
      kind: 'pending',
      code: 'MANUAL',
      campaignName: 'Manual',
      currentPayable: 2820,
      requestedDiscount: 141,
      projectedTotal: 2679,
    })
  })

  it('shows the saved amount for an applied coupon', () => {
    const story = readCouponFinancialStory({
      total: 2720,
      coupon: {
        code: 'AUTO',
        campaign_name: 'Auto',
        approval_status: 'applied',
        potential_discount_amount: 100,
        applied_discount_amount: 100,
      },
    })
    assert.equal(story?.kind, 'applied')
    if (story?.kind === 'applied') {
      assert.equal(story.saved, 100)
      assert.equal(story.total, 2720)
    }
  })

  it('does not invent a discount for rejected or missing coupons', () => {
    assert.equal(
      readCouponFinancialStory({
        total: 2820,
        coupon: {
          code: 'MANUAL',
          approval_status: 'rejected',
          potential_discount_amount: 141,
          applied_discount_amount: 0,
        },
      })?.kind,
      'rejected',
    )
    assert.equal(readCouponFinancialStory({ total: 2820, coupon: null }), null)
    assert.equal(
      readCouponFinancialStory({
        total: 2820,
        coupon: { approval_status: 'pending', applied_discount_amount: 0 },
      }),
      null,
    )
    const rejected = readCouponFinancialStory({
      total: 2820,
      coupon: {
        code: 'CDL10',
        approval_status: 'rejected',
        potential_discount_amount: 141,
        applied_discount_amount: 0,
      },
    })
    assert.equal(rejected?.kind, 'rejected')
    if (rejected?.kind === 'rejected') {
      assert.equal(rejected.currentPayable, 2820)
      assert.equal('requestedDiscount' in rejected, false)
      assert.equal('projectedTotal' in rejected, false)
    }
  })

  it('blocks share only while a manual coupon is pending', () => {
    assert.equal(
      quoteShareBlockedByCoupon({
        total: 2820,
        coupon: {
          code: 'CDL10',
          campaign_name: 'Manual',
          approval_status: 'pending',
          potential_discount_amount: 141,
          applied_discount_amount: 0,
        },
      }),
      true,
    )
    assert.equal(
      quoteShareBlockedByCoupon({
        total: 2720,
        coupon: {
          code: 'WELCOME',
          approval_status: 'applied',
          applied_discount_amount: 100,
        },
      }),
      false,
    )
    assert.equal(
      quoteShareBlockedByCoupon({
        total: 2820,
        coupon: {
          code: 'CDL10',
          approval_status: 'rejected',
          potential_discount_amount: 141,
          applied_discount_amount: 0,
        },
      }),
      false,
    )
  })
})
