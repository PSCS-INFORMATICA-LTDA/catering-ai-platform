import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildQuoteOperationalSummary,
  shouldOfferManualServiceOrderConversion,
} from './quoteOperationalSummary.ts'

const quote = {
  quoteTotal: 1851,
  reservationAmount: 555.3,
  balanceDue: 1295.7,
  convertedServiceOrderId: null,
}

test('awaiting deposit when the contractual invoice has no real money', () => {
  const summary = buildQuoteOperationalSummary({
    ...quote,
    invoice: {
      id: 'inv',
      quote_id: 'q',
      status: 'awaiting_deposit',
      total: 1851,
      deposit_amount: 555.3,
      paid_total: 0,
      created_at: '2026-09-24T00:00:00Z',
    },
    payments: [],
    serviceOrderId: null,
    agendaReserved: false,
  })
  assert.equal(summary.finance_status, 'awaiting_deposit')
  assert.equal(summary.paid_total, 0)
  assert.equal(summary.balance, 1851)
  assert.equal(summary.service_order, 'pending')
})

test('sandbox completed money is not paid and does not create an OS requirement', () => {
  const summary = buildQuoteOperationalSummary({
    ...quote,
    invoice: {
      id: 'inv',
      quote_id: 'q',
      status: 'partially_paid',
      total: 1851,
      deposit_amount: 555.3,
      paid_total: 555.3,
      created_at: '2026-09-24T00:00:00Z',
    },
    payments: [
      {
        invoice_id: 'inv',
        provider: 'paypal',
        status: 'completed',
        amount: 555.3,
        metadata: {},
      },
    ],
    serviceOrderId: null,
    agendaReserved: false,
  })
  assert.equal(summary.paid_total, 0)
  assert.equal(summary.finance_status, 'awaiting_deposit')
  assert.equal(summary.service_order, 'pending')
})

test('canonical deposit paid with one OS is deposit_paid, not a new conversion', () => {
  const summary = buildQuoteOperationalSummary({
    ...quote,
    convertedServiceOrderId: 'so-1',
    invoice: {
      id: 'inv',
      quote_id: 'q',
      status: 'partially_paid',
      total: 1851,
      deposit_amount: 555.3,
      paid_total: 555.3,
      created_at: '2026-09-24T00:00:00Z',
    },
    payments: [
      {
        invoice_id: 'inv',
        provider: 'zelle',
        status: 'completed',
        amount: 555.3,
        metadata: {},
      },
    ],
    serviceOrderId: 'so-1',
    agendaReserved: true,
  })
  assert.equal(summary.finance_status, 'deposit_paid')
  assert.equal(summary.paid_total, 555.3)
  assert.equal(summary.balance, 1295.7)
  assert.equal(summary.service_order, 'created')
  assert.equal(
    shouldOfferManualServiceOrderConversion({
      proposalAccepted: true,
      serviceOrderId: summary.service_order_id,
    }),
    false,
  )
})

test('paid money without OS or agenda is an operational error', () => {
  const summary = buildQuoteOperationalSummary({
    ...quote,
    invoice: {
      id: 'inv',
      quote_id: 'q',
      status: 'paid',
      total: 1851,
      deposit_amount: 555.3,
      paid_total: 1851,
      created_at: '2026-09-24T00:00:00Z',
    },
    payments: [
      {
        invoice_id: 'inv',
        provider: 'zelle',
        status: 'completed',
        amount: 1851,
        metadata: {},
      },
    ],
    serviceOrderId: null,
    agendaReserved: false,
  })
  assert.equal(summary.finance_status, 'operational_error')
  assert.equal(summary.paid_total, 1851)
  assert.equal(summary.service_order, 'pending')
})

test('quote status alone never marks a quote paid', () => {
  const summary = buildQuoteOperationalSummary({
    ...quote,
    invoice: null,
    payments: [],
    serviceOrderId: null,
    agendaReserved: false,
  })
  assert.equal(summary.paid_total, 0)
  assert.equal(summary.finance_status, 'awaiting_deposit')
})
