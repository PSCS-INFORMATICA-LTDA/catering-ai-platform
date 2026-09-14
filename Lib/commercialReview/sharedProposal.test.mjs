import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  applySharedVersionToQuoteDetail,
  publicProposalQuoteFromFacts,
  readFrozenCommercialFacts,
  requireShareableQuoteVersion,
  SHARE_VERSION_REQUIRED,
  stripInternalNotesFromPublicPayload,
} from './sharedProposal.ts'

const version = {
  id: 'version-v1',
  quote_total: 2720,
  reservation_amount: 846,
  balance_due: 1874,
  discount_amount: 100,
  package_total: 2500,
  additional_total: 200,
  mileage_fee: 20,
  commercial_snapshot: {
    language: 'en',
    currency_code: 'USD',
    quote_total: 2720,
    discount_amount: 100,
    package: { id: 'pkg-1', price_per_person: 62.5, total: 2500 },
    guest_counts: {
      adult_count: 40,
      children_under_3_count: 0,
      children_4_to_12_count: 0,
      physical_guest_count: 40,
      billable_guest_count: 40,
    },
    reservation: { percentage: 30, amount: 846 },
    balance_due: 1874,
    mileage: { fee: 20, distance: 10, free_limit: 20, rate: 2 },
    event: { event_date: '2026-10-18', start_time: '12:00', end_time: '16:00' },
    additional_items: [
      { additional_item_id: 'add-1', quantity: 1, unit_price: 200, total_price: 200 },
    ],
    pricing_breakdown: {
      total: 2720,
      deposit: 846,
      balance: 1874,
      coupon: {
        code: 'WELCOME',
        approval_status: 'applied',
        applied_discount_amount: 100,
      },
    },
  },
}

describe('shared proposal pin', () => {
  it('fails closed when mark_sent cannot obtain a quote_version', () => {
    const missing = requireShareableQuoteVersion({ data: null, error: null })
    assert.equal(missing.ok, false)
    if (!missing.ok) {
      assert.equal(missing.code, SHARE_VERSION_REQUIRED)
    }
    const errored = requireShareableQuoteVersion({
      data: null,
      error: { message: 'snapshot failed' },
    })
    assert.equal(errored.ok, false)
    const ok = requireShareableQuoteVersion({ data: { id: 'version-v1' } })
    assert.equal(ok.ok, true)
    if (ok.ok) assert.equal(ok.versionId, 'version-v1')
  })

  it('rebuilds commercial facts from the pinned version, not live quote columns', () => {
    const facts = readFrozenCommercialFacts(version)
    const live = {
      id: 'quote-1',
      quote_total: 9999,
      reservation_amount: 1,
      balance_due: 2,
      discount_amount: 1,
      adult_count: 99,
      package_id: 'pkg-live',
      package_name_pt: 'LIVE PACKAGE',
      internal_notes: 'secret note',
      pricing_breakdown: {
        total: 9999,
        coupon: { code: 'LIVEFAKE', applied_discount_amount: 1 },
      },
    }
    const frozen = applySharedVersionToQuoteDetail(live, version, {
      package_name_pt: 'Frozen Package',
    })
    assert.equal(frozen.quote_total, 2720)
    assert.equal(frozen.reservation_amount, 846)
    assert.equal(frozen.balance_due, 1874)
    assert.equal(frozen.discount_amount, 100)
    assert.equal(frozen.adult_count, 40)
    assert.equal(frozen.package_id, 'pkg-1')
    assert.equal(frozen.package_name_pt, 'Frozen Package')
    assert.equal(frozen.pricing_breakdown?.coupon?.code, 'WELCOME')
    assert.equal('internal_notes' in frozen, false)
    assert.equal(facts.coupon?.code, 'WELCOME')
    assert.equal(facts.coupon?.applied_discount_amount, 100)

    const publicQuote = publicProposalQuoteFromFacts({
      quoteId: 'quote-1',
      quoteNumber: 'Q-1',
      quoteStatus: 'sent',
      packageLabel: 'Frozen Package',
      customerName: 'QA',
      customerPhone: null,
      customerEmail: null,
      eventName: 'QA event',
      facts,
    })
    assert.equal(publicQuote.quote_total, 2720)
    assert.equal(publicQuote.coupon?.code, 'WELCOME')
    assert.notEqual(publicQuote.quote_total, live.quote_total)
  })

  it('reads the public-intake snapshot shape used on DEV quotes', () => {
    const facts = readFrozenCommercialFacts({
      id: 'version-intake',
      quote_total: 2720,
      reservation_amount: 846,
      balance_due: 1874,
      discount_amount: 100,
      commercial_snapshot: {
        coupon: { code: 'WELCOME', approval_status: 'applied', applied_discount_amount: 100 },
        totals: {
          quoteTotal: 2720,
          reservationAmount: 846,
          balanceDue: 1874,
          packageUnitPrice: 68,
          physicalGuestCount: 40,
          billableGuestCount: 40,
        },
        event: {
          eventDate: '2026-10-18',
          startTime: '12:00',
          endTime: '16:00',
          eventName: 'QA event',
          adultCount: 40,
        },
        selection: { packageId: 'pkg-public' },
        pricing_breakdown: {
          total: 2720,
          deposit: 846,
          balance: 1874,
          guest_counts: { adultCount: 40, billable_guest_count: 40, physical_guest_count: 40 },
          coupon: { code: 'WELCOME', approval_status: 'applied', applied_discount_amount: 100 },
        },
      },
    })
    assert.equal(facts.adult_count, 40)
    assert.equal(facts.package_id, 'pkg-public')
    assert.equal(facts.event_date, '2026-10-18')
    assert.equal(facts.event_name, 'QA event')
    assert.equal(facts.coupon?.code, 'WELCOME')
  })

  it('strips internal_notes from any public payload tree', () => {
    const payload = stripInternalNotesFromPublicPayload({
      found: true,
      quote: { quote_total: 2720, internal_notes: 'secret' },
      nested: { internal_notes: 'also secret' },
    })
    assert.equal('internal_notes' in payload.quote, false)
    assert.equal('internal_notes' in payload.nested, false)
  })
})
