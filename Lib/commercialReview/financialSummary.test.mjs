import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readCommercialFinancialSummary } from './financialSummary.ts'

describe('readCommercialFinancialSummary', () => {
  it('reads payable numbers from the pricing breakdown and does not recompute total', () => {
    const summary = readCommercialFinancialSummary({
      currency_code: 'USD',
      quote_total: 9999,
      reservation_amount: 1,
      balance_due: 1,
      pricing_breakdown: {
        schema_version: 1,
        engine_version: '1.0.0',
        computed_at: '2026-09-14T00:00:00.000Z',
        lines: [
          { line_key: 'package', source_type: 'package', description: 'pkg', quantity: 1, unit: 'event', unit_price: 2500, amount: 2500 },
          { line_key: 'additional_item', source_type: 'catalog_item', description: 'cut', quantity: 1, unit: 'item', unit_price: 200, amount: 200 },
          { line_key: 'mileage', source_type: 'mileage', description: 'mi', quantity: 10, unit: 'mi', unit_price: 2, amount: 20 },
        ],
        adjustments: [],
        subtotal: 2720,
        total: 2679,
        deposit: 846,
        balance: 1833,
        rules_applied: {},
        guest_counts: {
          adult_count: 40,
          children_under_3_count: 0,
          children_4_to_12_count: 0,
          billable_guest_count: 40,
          physical_guest_count: 40,
        },
        coupon: {
          code: 'WELCOME',
          campaign_name: 'Welcome',
          approval_status: 'applied',
          applied_discount_amount: 41,
        },
      },
    })
    assert.equal(summary.source, 'pricing_breakdown')
    assert.equal(summary.total, 2679)
    assert.equal(summary.deposit, 846)
    assert.equal(summary.balance, 1833)
    assert.equal(summary.additionals, 200)
    assert.equal(summary.mileage, 20)
    assert.equal(summary.discount, 41)
    assert.equal(summary.couponKind, 'applied')
  })

  it('keeps payable total unchanged for a pending coupon', () => {
    const summary = readCommercialFinancialSummary({
      pricing_breakdown: {
        schema_version: 1,
        engine_version: '1.0.0',
        computed_at: '2026-09-14T00:00:00.000Z',
        lines: [],
        adjustments: [],
        subtotal: 2820,
        total: 2820,
        deposit: 846,
        balance: 1974,
        rules_applied: {},
        guest_counts: {
          adult_count: 40,
          children_under_3_count: 0,
          children_4_to_12_count: 0,
          billable_guest_count: 40,
          physical_guest_count: 40,
        },
        coupon: {
          code: 'CDL10',
          campaign_name: 'Manual',
          approval_status: 'pending',
          potential_discount_amount: 141,
          applied_discount_amount: 0,
        },
      },
    })
    assert.equal(summary.total, 2820)
    assert.equal(summary.discount, 0)
    assert.equal(summary.couponKind, 'pending')
  })

  it('does not treat a rejected coupon as a discount', () => {
    const summary = readCommercialFinancialSummary({
      pricing_breakdown: {
        schema_version: 1,
        engine_version: '1.0.0',
        computed_at: '2026-09-14T00:00:00.000Z',
        lines: [],
        adjustments: [],
        subtotal: 2820,
        total: 2820,
        deposit: 846,
        balance: 1974,
        rules_applied: {},
        guest_counts: {
          adult_count: 40,
          children_under_3_count: 0,
          children_4_to_12_count: 0,
          billable_guest_count: 40,
          physical_guest_count: 40,
        },
        coupon: {
          code: 'CDL10',
          approval_status: 'rejected',
          potential_discount_amount: 141,
          applied_discount_amount: 0,
        },
      },
    })
    assert.equal(summary.couponKind, 'rejected')
    assert.equal(summary.total, 2820)
    assert.equal(summary.discount, 0)
  })
})
