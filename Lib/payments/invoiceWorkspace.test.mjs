import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  buildInvoiceWorkspaceCsv,
  compareInvoiceWorkspaceRows,
  computeInvoiceMovementTotals,
  countInvoiceWorkspaceViews,
  csvEscapeCell,
  defaultInvoiceWorkspaceColumnPrefs,
  intersectIds,
  invoiceWorkspaceCsvHasForbiddenContent,
  invoiceWorkspaceStorageKey,
  matchesInvoiceWorkspaceAmountFilters,
  matchesInvoiceWorkspaceView,
  parseInvoiceWorkspaceColumnPrefs,
  parseInvoiceWorkspaceDirection,
  parseInvoiceWorkspaceSort,
  parseInvoiceWorkspaceView,
  reorderInvoiceWorkspaceColumn,
  visibleInvoiceWorkspaceColumns,
} from './invoiceWorkspace.ts'
import { MONEY_DIVERGENCE_THRESHOLD } from './financeObservabilityTypes.ts'

describe('invoice workspace v3', () => {
  it('computes gross, refunded, net and outstanding from movements', () => {
    const totals = computeInvoiceMovementTotals({
      invoiceTotal: 100,
      paidTotal: 70,
      completedPaymentsTotal: 100,
      refundedTotal: 25,
    })
    assert.equal(totals.grossReceived, 100)
    assert.equal(totals.refunded, 25)
    assert.equal(totals.netReceived, 75)
    assert.equal(totals.outstanding, 25)
    assert.equal(totals.divergence, true)
    assert.ok(totals.paidDelta > MONEY_DIVERGENCE_THRESHOLD)
  })

  it('does not flag divergence at the 0.01 threshold', () => {
    const totals = computeInvoiceMovementTotals({
      invoiceTotal: 100,
      paidTotal: 70,
      completedPaymentsTotal: 70.01,
      refundedTotal: 0,
    })
    assert.equal(totals.divergence, false)
    assert.equal(totals.outstanding, 29.99)
  })

  it('maps operational views without creating another source of truth', () => {
    assert.equal(
      matchesInvoiceWorkspaceView({
        view: 'receivable',
        status: 'partially_paid',
        invoiceKind: 'original',
        outstanding: 20,
        hasFailedPayment: false,
      }),
      true,
    )
    assert.equal(
      matchesInvoiceWorkspaceView({
        view: 'receivable',
        status: 'paid',
        invoiceKind: 'original',
        outstanding: 0,
        hasFailedPayment: false,
      }),
      false,
    )
    assert.equal(
      matchesInvoiceWorkspaceView({
        view: 'adjustments',
        status: 'ready',
        invoiceKind: 'post_event_adjustment',
        outstanding: 10,
        hasFailedPayment: false,
      }),
      true,
    )
    assert.equal(
      matchesInvoiceWorkspaceView({
        view: 'failed',
        status: 'awaiting_deposit',
        invoiceKind: 'original',
        outstanding: 30,
        hasFailedPayment: true,
      }),
      true,
    )
  })

  it('counts views from the same filtered working set', () => {
    const counts = countInvoiceWorkspaceViews([
      { status: 'paid', invoice_kind: 'original', outstanding_amount: 0, has_failed_payment: false },
      { status: 'partially_paid', invoice_kind: 'original', outstanding_amount: 40, has_failed_payment: true },
      { status: 'canceled', invoice_kind: 'post_event_adjustment', outstanding_amount: 10, has_failed_payment: false },
    ])
    assert.equal(counts.all, 3)
    assert.equal(counts.paid, 1)
    assert.equal(counts.partially_paid, 1)
    assert.equal(counts.receivable, 1)
    assert.equal(counts.failed, 1)
    assert.equal(counts.adjustments, 1)
    assert.equal(counts.canceled, 1)
  })

  it('sorts invoice number, customer, money and dates', () => {
    const a = {
      invoice_number: 'INV-2026-000002',
      customer_name: 'Beta',
      event_date: '2026-05-01',
      created_at: '2026-01-02T00:00:00.000Z',
      total: 80,
      net_received: 80,
      outstanding_amount: 0,
      status: 'paid',
    }
    const b = {
      invoice_number: 'INV-2026-000010',
      customer_name: 'Alpha',
      event_date: '2026-04-01',
      created_at: '2026-01-01T00:00:00.000Z',
      total: 120,
      net_received: 20,
      outstanding_amount: 100,
      status: 'partially_paid',
    }
    assert.ok(compareInvoiceWorkspaceRows(a, b, 'invoice_number', 'asc') < 0)
    assert.ok(compareInvoiceWorkspaceRows(a, b, 'customer', 'asc') > 0)
    assert.ok(compareInvoiceWorkspaceRows(a, b, 'outstanding', 'desc') > 0)
    assert.ok(compareInvoiceWorkspaceRows(a, b, 'created_at', 'desc') < 0)
  })

  it('applies amount filters after movement math', () => {
    assert.equal(
      matchesInvoiceWorkspaceAmountFilters(
        { total: 100, outstanding_amount: 25 },
        { minTotal: 80, maxTotal: 120, minOutstanding: 10, maxOutstanding: 30 },
      ),
      true,
    )
    assert.equal(
      matchesInvoiceWorkspaceAmountFilters(
        { total: 100, outstanding_amount: 25 },
        { minTotal: null, maxTotal: null, minOutstanding: 40, maxOutstanding: null },
      ),
      false,
    )
  })

  it('intersects search constraints without dropping an unconstrained side', () => {
    assert.deepEqual(intersectIds(null, ['a', 'b']), ['a', 'b'])
    assert.deepEqual(intersectIds(['a', 'c'], ['a', 'b']), ['a'])
    assert.deepEqual(intersectIds(['x'], ['y']), [])
  })

  it('exports numeric money and never includes secrets', () => {
    const csv = buildInvoiceWorkspaceCsv([
      {
        id: 'i1',
        invoice_number: 'INV-2026-000001',
        invoice_kind: 'original',
        parent_invoice_id: null,
        parent_invoice_number: null,
        quote_id: 'q1',
        quote_number: 'Q-000002',
        service_order_id: 'o1',
        service_order_number: 'SO-1',
        closeout_id: null,
        customer_name: 'Maria, CDL',
        customer_email: 'maria@example.com',
        customer_phone: null,
        event_name: 'Aniversário',
        event_date: '2026-09-01',
        status: 'partially_paid',
        currency_code: 'USD',
        total: 100,
        deposit_amount: 30,
        balance_amount: 70,
        paid_total: 30,
        gross_received: 30,
        refunded_total: 0,
        net_received: 30,
        outstanding_amount: 70,
        divergence: false,
        last_provider: 'paypal',
        last_payment_status: 'completed',
        last_payment_at: '2026-09-01T12:00:00.000Z',
        payment_link_state: 'active',
        recent_payments: [],
        created_at: '2026-09-01T00:00:00.000Z',
        updated_at: '2026-09-01T00:00:00.000Z',
      },
    ])
    assert.match(csv, /invoice_number,invoice_kind/)
    assert.match(csv, /100.00,30.00,0.00,30.00,70.00/)
    assert.match(csv, /"Maria, CDL"/)
    assert.equal(invoiceWorkspaceCsvHasForbiddenContent(csv), false)
    assert.doesNotMatch(csv, /token_hash|webhook_route_key|client_secret|provider_payload/)
    assert.equal(csvEscapeCell('=cmd'), "'=cmd")
  })

  it('parses sort, view and column prefs and keeps invoice/actions visible', () => {
    assert.equal(parseInvoiceWorkspaceView('receivable'), 'receivable')
    assert.equal(parseInvoiceWorkspaceView('nope'), 'all')
    assert.equal(parseInvoiceWorkspaceSort('outstanding'), 'outstanding')
    assert.equal(parseInvoiceWorkspaceDirection('asc'), 'asc')
    const prefs = parseInvoiceWorkspaceColumnPrefs({
      order: ['customer', 'invoice', 'actions', 'total'],
      hidden: ['invoice', 'customer_email'],
      widths: { customer: 240 },
      density: 'compact',
    })
    const visible = visibleInvoiceWorkspaceColumns(prefs)
    assert.equal(visible[0], 'invoice')
    assert.equal(visible.at(-1), 'actions')
    assert.ok(!visible.includes('customer_email'))
    assert.ok(visible.includes('invoice'))
    const reordered = reorderInvoiceWorkspaceColumn(defaultInvoiceWorkspaceColumnPrefs(), 'quote', 'os')
    assert.ok(reordered.order.indexOf('quote') >= 0)
    assert.equal(invoiceWorkspaceStorageKey('user-1', 'co-1'), 'invoice-workspace-v3:user-1:co-1')
  })
})
