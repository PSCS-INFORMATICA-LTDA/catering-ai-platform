import assert from 'node:assert/strict'
import test from 'node:test'
import { calculateQuoteTotals } from '../calculateQuoteTotals.ts'
import { evaluateCouponForPricing } from '../coupons/couponMath.ts'

const RULES = {
  minOrderWeekday: 800,
  minOrderWeekend: 1000,
  minOrderDecJan: 900,
  holidaySurchargePercent: 100,
  holidayMinOrder: 2000,
}

function quote({
  date,
  perPerson,
  guests = 10,
  grill = false,
  waiters = 0,
}) {
  return calculateQuoteTotals({
    guestCounts: {
      adultCount: guests,
      childrenUnder3Count: 0,
      children4To12Count: 0,
    },
    packagePricePerPerson: perPerson,
    additionals:
      waiters > 0
        ? [
            {
              quantity: waiters,
              unitPrice: 250,
              perPerson: false,
              countsTowardMinimum: false,
            },
          ]
        : [],
    grillRentalRequired: grill,
    eventDate: date,
    commercialMinimums: RULES,
    mileageDistance: 0,
  })
}

test('A Monday eligible 750 + grill 100 => 900', () => {
  const totals = quote({ date: '2026-09-28', perPerson: 75, grill: true })
  assert.equal(totals.minimumEligibleSubtotal, 750)
  assert.equal(totals.excludedFromMinimumTotal, 100)
  assert.equal(totals.minimumOrderAdjustment, 50)
  assert.equal(totals.quoteTotal, 900)
})

test('B Monday eligible 750 + grill 100 + waiter 250 => 1150', () => {
  const totals = quote({
    date: '2026-09-28',
    perPerson: 75,
    grill: true,
    waiters: 1,
  })
  assert.equal(totals.minimumEligibleSubtotal, 750)
  assert.equal(totals.excludedFromMinimumTotal, 350)
  assert.equal(totals.quoteTotal, 1150)
})

test('C Friday eligible 900 + grill 100 => 1100', () => {
  const totals = quote({ date: '2026-09-25', perPerson: 90, grill: true })
  assert.equal(totals.minimumOrderAmount, 1000)
  assert.equal(totals.minimumOrderAdjustment, 100)
  assert.equal(totals.quoteTotal, 1100)
})

test('D eligible at or above the minimum has no artificial uplift', () => {
  const exact = quote({ date: '2026-09-28', perPerson: 80 })
  assert.equal(exact.minimumEligibleSubtotal, 800)
  assert.equal(exact.minimumOrderApplied, false)
  assert.equal(exact.quoteTotal, 800)
  const above = quote({ date: '2026-09-28', perPerson: 85, grill: true })
  assert.equal(above.minimumOrderAdjustment, 0)
  assert.equal(above.quoteTotal, 950)
})

test('E multiple waiters stay outside the floor', () => {
  const totals = quote({
    date: '2026-09-28',
    perPerson: 75,
    grill: true,
    waiters: 3,
  })
  assert.equal(totals.excludedFromMinimumTotal, 850)
  assert.equal(totals.quoteTotal, 1650)
})

test('F edit recalculates from the new eligible amount', () => {
  const before = quote({ date: '2026-09-28', perPerson: 75, grill: true })
  const after = quote({ date: '2026-09-28', perPerson: 90, grill: true, waiters: 2 })
  assert.equal(before.quoteTotal, 900)
  assert.equal(after.minimumEligibleSubtotal, 900)
  assert.equal(after.minimumOrderAdjustment, 0)
  assert.equal(after.quoteTotal, 1500)
})

function coupon(overrides) {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    company_id: '22222222-2222-4222-8222-222222222222',
    code: 'WELCOME',
    campaign_name: 'Welcome',
    description: null,
    status: 'active',
    discount_type: 'fixed',
    discount_value: 100,
    max_discount_amount: 100,
    min_eligible_amount: 1100,
    valid_from: '2026-09-01',
    valid_to: '2026-09-30',
    eligible_weekdays: [0, 1, 2, 3, 4, 5, 6],
    all_packages: true,
    eligible_package_ids: [],
    include_additionals: true,
    include_grill: false,
    include_additional_cuts: false,
    include_mileage: false,
    new_customer_only: false,
    max_uses_per_customer: 1,
    max_uses_per_quote: 1,
    stackable: false,
    apply_to_deposit: false,
    apply_to_balance: true,
    allow_post_event_adjustment: false,
    manual_approval_required: false,
    distribution_channel: 'Instagram',
    minimum_final_mon_thu: null,
    minimum_final_fri_sun: null,
    metadata: {},
    ...overrides,
  }
}

test('WELCOME ignores grill; CDL10 still counts grill and keeps the final floor', () => {
  const lines = [
    { line_key: 'package', amount: 1000, source_id: 'pkg' },
    { line_key: 'grill_rental', amount: 100, source_id: 'grill' },
  ]
  const welcome = evaluateCouponForPricing({
    coupon: coupon({}),
    nowDate: '2026-09-10',
    eventDate: '2026-09-14',
    packageId: 'pkg',
    breakdown: { lines, adjustments: [], subtotal: 1100, total: 1100, deposit: 330, balance: 770 },
    catalog: new Map(),
    customerUsage: { phoneNormalized: true, customerExists: false, uses: 0 },
  })
  assert.equal(welcome.valid, false)
  assert.equal(welcome.reason, 'minimum_not_reached')

  const welcomeEligible = evaluateCouponForPricing({
    coupon: coupon({}),
    nowDate: '2026-09-10',
    eventDate: '2026-09-14',
    packageId: 'pkg',
    breakdown: {
      lines: [{ line_key: 'package', amount: 1100, source_id: 'pkg' }, lines[1]],
      adjustments: [],
      subtotal: 1200,
      total: 1200,
      deposit: 360,
      balance: 840,
    },
    catalog: new Map(),
    customerUsage: { phoneNormalized: true, customerExists: false, uses: 0 },
  })
  assert.equal(welcomeEligible.valid, true)
  assert.equal(welcomeEligible.eligibleAmount, 1100)
  assert.equal(welcomeEligible.potentialDiscountAmount, 100)

  const cdl10 = evaluateCouponForPricing({
    coupon: coupon({
      code: 'CDL10',
      discount_type: 'percent',
      discount_value: 5,
      max_discount_amount: null,
      min_eligible_amount: 0,
      valid_to: '2026-11-30',
      include_grill: true,
      include_additional_cuts: true,
      max_uses_per_customer: null,
      allow_post_event_adjustment: true,
      manual_approval_required: true,
      minimum_final_mon_thu: 800,
      minimum_final_fri_sun: 1000,
    }),
    nowDate: '2026-09-10',
    eventDate: '2026-09-14',
    packageId: 'pkg',
    breakdown: {
      lines: [
        { line_key: 'package', amount: 742.11, source_id: 'pkg' },
        { line_key: 'grill_rental', amount: 100, source_id: 'grill' },
      ],
      adjustments: [],
      subtotal: 842.11,
      total: 842.11,
      deposit: 252.63,
      balance: 589.48,
    },
    catalog: new Map(),
    customerUsage: { phoneNormalized: true, customerExists: true, uses: 0 },
  })
  assert.equal(cdl10.valid, true)
  assert.equal(cdl10.eligibleAmount, 842.11)
  assert.equal(cdl10.manualApprovalRequired, true)
  assert.equal(cdl10.appliedDiscountAmount, 0)
  assert.ok(cdl10.projectedTotalAfterApproval >= 800)
})
