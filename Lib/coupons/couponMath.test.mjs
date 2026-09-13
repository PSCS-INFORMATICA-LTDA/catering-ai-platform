import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  allocateApprovedCoupon,
  allocateCouponDiscount,
  applyCouponToBreakdown,
  assertFinancialInvariant,
  evaluateCouponForPricing,
  money,
  normalizeCouponCode,
} from './couponMath.ts'

function coupon(overrides = {}) {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    company_id: '22222222-2222-4222-8222-222222222222',
    code: 'QA10',
    campaign_name: 'QA coupon',
    description: 'DEV/QA fixture',
    status: 'active',
    discount_type: 'percent',
    discount_value: 10,
    max_discount_amount: null,
    min_eligible_amount: 0,
    valid_from: '2026-01-01',
    valid_to: '2026-12-31',
    eligible_weekdays: [0, 1, 2, 3, 4, 5, 6],
    all_packages: true,
    eligible_package_ids: [],
    include_additionals: true,
    include_grill: false,
    include_additional_cuts: false,
    include_mileage: false,
    new_customer_only: false,
    max_uses_per_customer: null,
    max_uses_per_quote: 1,
    stackable: false,
    apply_to_deposit: false,
    apply_to_balance: true,
    allow_post_event_adjustment: false,
    manual_approval_required: false,
    distribution_channel: 'QA',
    minimum_final_mon_thu: null,
    minimum_final_fri_sun: null,
    metadata: { qa: true },
    ...overrides,
  }
}

function breakdown(overrides = {}) {
  return {
    lines: [
      { line_key: 'package', amount: 800, source_id: 'pkg-1' },
      { line_key: 'additional_item', amount: 200, source_id: 'add-1' },
      { line_key: 'grill_rental', amount: 150, source_id: 'grill-1' },
      { line_key: 'mileage', amount: 50, source_id: null },
    ],
    adjustments: [],
    subtotal: 1200,
    total: 1200,
    deposit: 360,
    balance: 840,
    ...overrides,
  }
}

function evaluate(overrides = {}, context = {}) {
  return evaluateCouponForPricing({
    coupon: coupon(overrides),
    nowDate: '2026-09-13',
    eventDate: '2026-09-16',
    packageId: 'pkg-1',
    breakdown: breakdown(context.breakdown),
    catalog: context.catalog ?? new Map([['add-1', { category_pt: 'Bebidas' }]]),
    customerUsage: context.customerUsage ?? {
      phoneNormalized: true,
      customerExists: false,
      uses: 0,
    },
  })
}

describe('normalizeCouponCode', () => {
  it('trims, uppercases and accepts the canonical charset', () => {
    assert.equal(normalizeCouponCode('  cdl250  '), 'CDL250')
    assert.equal(normalizeCouponCode('cdl-10_a'), 'CDL-10_A')
  })

  it('rejects empty, lowercase-only invalid and oversized codes', () => {
    assert.equal(normalizeCouponCode(''), null)
    assert.equal(normalizeCouponCode('A'), null)
    assert.equal(normalizeCouponCode('BAD CODE'), null)
    assert.equal(normalizeCouponCode('X'.repeat(33)), null)
    assert.equal(normalizeCouponCode(12), null)
  })
})

describe('coupon rules', () => {
  it('applies a fixed discount', () => {
    const result = evaluate({ discount_type: 'fixed', discount_value: 100 })
    assert.equal(result.valid, true)
    assert.equal(result.appliedDiscountAmount, 100)
    assert.equal(result.totalAfterCoupon, 1100)
  })

  it('applies a percentage discount', () => {
    const result = evaluate({ discount_type: 'percent', discount_value: 10 })
    assert.equal(result.valid, true)
    assert.equal(result.appliedDiscountAmount, 100)
  })

  it('rejects expired coupons', () => {
    const result = evaluate({ valid_to: '2026-09-01' })
    assert.equal(result.valid, false)
    assert.equal(result.reason, 'expired')
    assert.equal(result.appliedDiscountAmount, 0)
    assert.equal(result.totalAfterCoupon, 1200)
  })

  it('rejects a future start date', () => {
    const result = evaluate({ valid_from: '2026-10-01' })
    assert.equal(result.valid, false)
    assert.equal(result.reason, 'not_started')
  })

  it('rejects paused coupons with a dedicated reason', () => {
    const result = evaluate({ status: 'paused' })
    assert.equal(result.valid, false)
    assert.equal(result.reason, 'paused')
  })

  it('rejects inactive draft or archived coupons', () => {
    assert.equal(evaluate({ status: 'draft' }).reason, 'inactive')
    assert.equal(evaluate({ status: 'archived' }).reason, 'inactive')
  })

  it('rejects an invalid code before evaluation via normalizeCouponCode', () => {
    assert.equal(normalizeCouponCode('??'), null)
  })

  it('rejects below the minimum eligible amount', () => {
    const result = evaluate({ min_eligible_amount: 2000 })
    assert.equal(result.valid, false)
    assert.equal(result.reason, 'minimum_not_reached')
    assert.equal(result.eligibleAmount, 1000)
  })

  it('rejects when the customer usage limit is reached', () => {
    const result = evaluate(
      { max_uses_per_customer: 1 },
      { customerUsage: { phoneNormalized: true, customerExists: true, uses: 1 } },
    )
    assert.equal(result.valid, false)
    assert.equal(result.reason, 'usage_limit_reached')
  })

  it('rejects weekday restrictions', () => {
    const result = evaluateCouponForPricing({
      coupon: coupon({ eligible_weekdays: [1, 2, 3, 4] }),
      nowDate: '2026-09-13',
      eventDate: '2026-09-13',
      packageId: 'pkg-1',
      breakdown: breakdown(),
    })
    assert.equal(result.valid, false)
    assert.equal(result.reason, 'weekday_not_allowed')
  })

  it('rejects package eligibility misses', () => {
    const result = evaluate({
      all_packages: false,
      eligible_package_ids: ['other-package'],
    })
    assert.equal(result.valid, false)
    assert.equal(result.reason, 'package_not_allowed')
  })

  it('excludes additional items when the coupon does not include them', () => {
    const result = evaluate({
      include_additionals: false,
      discount_type: 'percent',
      discount_value: 10,
    })
    assert.equal(result.valid, true)
    assert.equal(result.eligibleAmount, 800)
    assert.equal(result.appliedDiscountAmount, 80)
  })

  it('excludes additional cuts unless explicitly allowed', () => {
    const result = evaluate(
      { include_additionals: true, include_additional_cuts: false, discount_type: 'fixed', discount_value: 50 },
      { catalog: new Map([['add-1', { category_pt: 'Bovino nobre' }]]) },
    )
    assert.equal(result.valid, true)
    assert.equal(result.eligibleAmount, 800)
  })

  it('includes grill only when flagged', () => {
    const withGrill = evaluate({
      include_grill: true,
      discount_type: 'percent',
      discount_value: 10,
    })
    const withoutGrill = evaluate({
      include_grill: false,
      discount_type: 'percent',
      discount_value: 10,
    })
    assert.equal(withGrill.eligibleAmount, 1150)
    assert.equal(withoutGrill.eligibleAmount, 1000)
  })

  it('includes mileage only when flagged', () => {
    const result = evaluate({
      include_mileage: true,
      include_additionals: false,
      discount_type: 'percent',
      discount_value: 10,
    })
    assert.equal(result.eligibleAmount, 850)
  })

  it('rejects new-customer coupons without a canonical phone', () => {
    const result = evaluate(
      { new_customer_only: true },
      { customerUsage: { phoneNormalized: false, customerExists: false, uses: 0 } },
    )
    assert.equal(result.valid, false)
    assert.equal(result.reason, 'customer_not_eligible')
  })

  it('rejects new-customer coupons for an existing customer identity', () => {
    const result = evaluate(
      { new_customer_only: true },
      { customerUsage: { phoneNormalized: true, customerExists: true, uses: 0 } },
    )
    assert.equal(result.valid, false)
    assert.equal(result.reason, 'customer_not_eligible')
  })

  it('accepts new-customer coupons for a normalized unknown phone', () => {
    const result = evaluate(
      { new_customer_only: true },
      { customerUsage: { phoneNormalized: true, customerExists: false, uses: 0 } },
    )
    assert.equal(result.valid, true)
  })

  it('keeps manual approval pending without applying the benefit', () => {
    const result = evaluate({ manual_approval_required: true, discount_type: 'fixed', discount_value: 80 })
    assert.equal(result.valid, true)
    assert.equal(result.approvalStatus, 'pending')
    assert.equal(result.appliedDiscountAmount, 0)
    assert.equal(result.potentialDiscountAmount, 80)
    assert.equal(result.totalAfterCoupon, 1200)
    assert.equal(result.projectedTotalAfterApproval, 1120)
  })

  it('caps percentage coupons by max_discount_amount', () => {
    const result = evaluate({
      discount_type: 'percent',
      discount_value: 50,
      max_discount_amount: 40,
    })
    assert.equal(result.appliedDiscountAmount, 40)
  })
})

describe('financial allocation', () => {
  it('reduces balance only when apply_to_deposit is false', () => {
    const allocation = allocateCouponDiscount({
      total: 1000,
      deposit: 300,
      authorizedDiscount: 200,
      applyToDeposit: false,
      applyToBalance: true,
    })
    assert.equal(allocation.fromDeposit, 0)
    assert.equal(allocation.fromBalance, 200)
    assert.equal(allocation.depositDue, 300)
    assert.equal(allocation.balanceDue, 500)
    assert.equal(allocation.finalTotal, 800)
    assert.equal(allocation.depositDue + allocation.balanceDue, allocation.finalTotal)
  })

  it('reduces deposit only when apply_to_balance is false', () => {
    const allocation = allocateCouponDiscount({
      total: 1000,
      deposit: 300,
      authorizedDiscount: 120,
      applyToDeposit: true,
      applyToBalance: false,
    })
    assert.equal(allocation.fromDeposit, 120)
    assert.equal(allocation.fromBalance, 0)
    assert.equal(allocation.depositDue, 180)
    assert.equal(allocation.balanceDue, 700)
    assert.equal(allocation.finalTotal, 880)
  })

  it('uses balance first and overflow to deposit when both flags are true', () => {
    const allocation = allocateCouponDiscount({
      total: 1000,
      deposit: 300,
      authorizedDiscount: 800,
      applyToDeposit: true,
      applyToBalance: true,
    })
    assert.equal(allocation.fromBalance, 700)
    assert.equal(allocation.fromDeposit, 100)
    assert.equal(allocation.depositDue, 200)
    assert.equal(allocation.balanceDue, 0)
    assert.equal(allocation.finalTotal, 200)
  })

  it('rejects a coupon with no allocation target', () => {
    const allocation = allocateCouponDiscount({
      total: 1000,
      deposit: 300,
      authorizedDiscount: 50,
      applyToDeposit: false,
      applyToBalance: false,
    })
    assert.equal(allocation.error, 'invalid_configuration')
    assert.equal(evaluate({ apply_to_deposit: false, apply_to_balance: false }).reason, 'invalid_configuration')
  })

  it('caps a discount greater than the eligible amount', () => {
    const result = evaluate({
      discount_type: 'fixed',
      discount_value: 5000,
      include_additionals: false,
    })
    assert.equal(result.valid, true)
    assert.equal(result.eligibleAmount, 800)
    assert.equal(result.appliedDiscountAmount, 800)
    assert.ok(result.appliedDiscountAmount <= result.eligibleAmount)
  })

  it('caps a balance-only discount so the deposit is never negative', () => {
    const result = evaluate({
      discount_type: 'fixed',
      discount_value: 5000,
      apply_to_deposit: false,
      apply_to_balance: true,
    })
    assert.equal(result.allocation.depositDue, 360)
    assert.equal(result.allocation.balanceDue, 0)
    assert.equal(result.totalAfterCoupon, 360)
    assert.ok(
      assertFinancialInvariant({
        discount: result.appliedDiscountAmount,
        eligibleSubtotal: result.eligibleAmount,
        finalTotal: result.totalAfterCoupon,
        canonicalTotal: result.totalBeforeCoupon,
        depositDue: result.allocation.depositDue,
        balanceDue: result.allocation.balanceDue,
      }),
    )
  })

  it('rounds percentage money to cents', () => {
    const result = evaluateCouponForPricing({
      coupon: coupon({ discount_type: 'percent', discount_value: 10 }),
      nowDate: '2026-09-13',
      eventDate: '2026-09-16',
      packageId: 'pkg-1',
      breakdown: breakdown({
        lines: [{ line_key: 'package', amount: 33.33 }],
        total: 33.33,
        deposit: 10,
        balance: 23.33,
      }),
    })
    assert.equal(result.appliedDiscountAmount, money(3.33))
    assert.equal(result.totalAfterCoupon, money(30))
  })

  it('keeps currency as a server constant in the snapshot', () => {
    const result = evaluate()
    const priced = applyCouponToBreakdown(breakdown(), result)
    assert.equal(priced.coupon.currency, 'USD')
  })

  it('ignores client-forged discount and approval fields', () => {
    const result = evaluateCouponForPricing({
      coupon: coupon({ discount_value: 10 }),
      nowDate: '2026-09-13',
      eventDate: '2026-09-16',
      packageId: 'pkg-1',
      breakdown: breakdown(),
      clientDiscountAmount: 1,
      clientApprovalStatus: 'applied',
      clientFinalTotal: 1,
    })
    assert.equal(result.appliedDiscountAmount, 100)
    assert.notEqual(result.totalAfterCoupon, 1)
    assert.equal(result.approvalStatus, 'applied')
  })

  it('does not let a pending coupon change commercial totals', () => {
    const pending = evaluate({ manual_approval_required: true, discount_type: 'fixed', discount_value: 90 })
    const priced = applyCouponToBreakdown(breakdown(), pending)
    assert.equal(priced.total, 1200)
    assert.equal(priced.deposit, 360)
    assert.equal(priced.balance, 840)
    assert.equal(priced.coupon.approval_status, 'pending')
    assert.equal(priced.coupon.applied_discount_amount, 0)
  })

  it('preserves the snapshot when the live coupon value later changes', () => {
    const first = evaluate({ discount_type: 'percent', discount_value: 10, code: 'WELCOME10' })
    const snapshot = applyCouponToBreakdown(breakdown(), first).coupon
    const later = evaluate({ discount_type: 'percent', discount_value: 5, code: 'WELCOME10' })
    assert.equal(snapshot.discount_value, 10)
    assert.equal(snapshot.applied_discount_amount, 100)
    assert.equal(later.coupon.discount_value, 5)
    assert.notEqual(later.appliedDiscountAmount, snapshot.applied_discount_amount)
  })

  it('approves a frozen potential without rereading a cheaper live coupon', () => {
    const allocation = allocateApprovedCoupon({
      total: 1200,
      deposit: 360,
      authorizedDiscount: 100,
      applyToDeposit: false,
      applyToBalance: true,
    })
    assert.equal(allocation.authorizedDiscount, 100)
    assert.equal(allocation.finalTotal, 1100)
  })
})

describe('remove and reapply', () => {
  it('clears the benefit when the evaluation is invalid', () => {
    const applied = applyCouponToBreakdown(
      breakdown(),
      evaluate({ discount_type: 'fixed', discount_value: 80 }),
    )
    assert.equal(applied.total, 1120)
    const removed = evaluate({ status: 'paused' })
    const cleared = applyCouponToBreakdown(breakdown(), removed)
    assert.equal(applied.total, 1120)
    assert.equal(cleared.total, 1200)
    assert.equal(cleared.coupon, null)
  })

  it('can replace a previous coupon with a newly evaluated one', () => {
    const first = applyCouponToBreakdown(
      breakdown(),
      evaluate({ code: 'QA10', discount_type: 'fixed', discount_value: 50 }),
    )
    const second = applyCouponToBreakdown(
      breakdown(),
      evaluate({ code: 'QA20', discount_type: 'fixed', discount_value: 80 }),
    )
    assert.equal(first.coupon.code, 'QA10')
    assert.equal(second.coupon.code, 'QA20')
    assert.equal(second.total, 1120)
  })
})
