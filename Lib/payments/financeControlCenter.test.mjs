import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  buildAttentionItems,
  buildDocumentaryLineage,
  buildFinanceTrend,
  computeCaptureSuccessRate,
  computeInvoiceMoneyFlow,
  groupFinanceTotalsByCurrency,
  groupReconciliationRows,
  maskBankAccount,
  parseFinanceControlPeriod,
  summarizeProviders,
} from './financeControlCenter.ts'
import { collectSensitiveFinanceLeaks } from './sanitizeFinanceObservability.ts'
import { resolveFinancePeriodRange } from './financeObservability.ts'

describe('finance control center v2', () => {
  it('never mixes currencies into a single billed total', () => {
    const rows = groupFinanceTotalsByCurrency({
      invoices: [
        { status: 'paid', invoice_kind: 'original', currency_code: 'USD', total: 100, paid_total: 100 },
        { status: 'ready', invoice_kind: 'original', currency_code: 'BRL', total: 200, paid_total: 0 },
        { status: 'canceled', invoice_kind: 'original', currency_code: 'USD', total: 50, paid_total: 0 },
      ],
      payments: [{ status: 'failed', currency_code: 'USD' }],
      refunds: [{ status: 'completed', amount: 10, currency_code: 'USD' }],
    })
    const usd = rows.find((row) => row.currency_code === 'USD')
    const brl = rows.find((row) => row.currency_code === 'BRL')
    assert.equal(usd?.billed_total, 100)
    assert.equal(brl?.billed_total, 200)
    assert.equal(usd?.refunded_total, 10)
    assert.equal(usd?.failed_payment_count, 1)
    assert.notEqual(usd?.billed_total + brl?.billed_total, usd?.billed_total)
  })

  it('builds trend buckets without summing currencies', () => {
    const now = new Date('2026-09-12T12:00:00.000Z')
    const series = buildFinanceTrend({
      invoices: [
        { created_at: '2026-09-11T10:00:00.000Z', status: 'paid', currency_code: 'USD', total: 40 },
        { created_at: '2026-09-11T10:00:00.000Z', status: 'paid', currency_code: 'BRL', total: 80 },
      ],
      payments: [
        { created_at: '2026-09-11T11:00:00.000Z', status: 'completed', currency_code: 'USD', amount: 40 },
      ],
      from: '2026-09-10T00:00:00.000Z',
      to: '2026-09-12T12:00:00.000Z',
      now,
    })
    assert.ok(series.some((item) => item.currency_code === 'USD'))
    assert.ok(series.some((item) => item.currency_code === 'BRL'))
    const usd = series.find((item) => item.currency_code === 'USD')
    const brl = series.find((item) => item.currency_code === 'BRL')
    assert.notEqual(usd?.points.reduce((sum, point) => sum + point.billed_total, 0), brl?.points.reduce((sum, point) => sum + point.billed_total, 0))
  })

  it('computes capture success rate from valid attempts only', () => {
    assert.equal(computeCaptureSuccessRate(8, 2), 80)
    assert.equal(computeCaptureSuccessRate(0, 0), null)
  })

  it('maps attention items with severity and no auto-fix action', () => {
    const items = buildAttentionItems({
      alerts: [
        { severity: 'error', code: 'duplicate_provider_capture_id', invoice_id: 'i1', invoice_number: 'INV-1', payment_ids: ['p1'] },
      ],
      failedPayments: [{ id: 'p2', invoice_id: 'i2', invoice_number: 'INV-2', customer_name: 'Ana', amount: 30, currency_code: 'USD' }],
      pendingRefunds: [{ id: 'r1', invoice_id: 'i3', invoice_number: 'INV-3', amount: 12, currency_code: 'USD' }],
      outbox: [{ id: 'o1', status: 'failed', highlights: ['failed'], invoice_id: 'i4', invoice_number: 'INV-4' }],
    })
    assert.ok(items.some((item) => item.code === 'payment_failed' && item.severity === 'error'))
    assert.ok(items.some((item) => item.code === 'refund_pending' && item.href === '/finance/refunds'))
    assert.ok(items.some((item) => item.code === 'failed_pscs_one_outbox' && item.href === '/finance/pscs-one'))
    assert.ok(items.every((item) => item.href.startsWith('/')))
  })

  it('keeps documentary lineage on real ids only', () => {
    const nodes = buildDocumentaryLineage({
      quote_id: 'q1',
      quote_number: 'Q-1',
      original_invoice_id: 'i1',
      original_invoice_number: 'INV-1',
    })
    assert.equal(nodes.find((node) => node.key === 'quote')?.present, true)
    assert.equal(nodes.find((node) => node.key === 'supplemental_invoice')?.present, false)
    assert.equal(nodes.find((node) => node.key === 'quote')?.href, '/quotes/q1')
  })

  it('computes money flow without mixing refunds into billed', () => {
    const flow = computeInvoiceMoneyFlow({
      total: 100,
      completedPaymentsTotal: 100,
      refundedTotal: 20,
      paidTotal: 80,
      currency_code: 'USD',
    })
    assert.equal(flow.net_paid, 80)
    assert.equal(flow.outstanding, 20)
  })

  it('groups reconciliation into ok/warning/error in business terms', () => {
    const rows = groupReconciliationRows({
      invoices: [
        { id: 'ok', invoice_number: 'INV-OK', status: 'paid', invoice_kind: 'original', total: 100, paid_total: 100, deposit_amount: 0, currency_code: 'USD' },
        { id: 'bad', invoice_number: 'INV-BAD', status: 'paid', invoice_kind: 'original', total: 100, paid_total: 90, deposit_amount: 0, currency_code: 'USD' },
      ],
      payments: [
        { invoice_id: 'ok', status: 'completed', amount: 100, currency_code: 'USD' },
        { invoice_id: 'bad', status: 'completed', amount: 100, currency_code: 'USD' },
      ],
      refunds: [],
    })
    assert.equal(rows.find((row) => row.invoice_id === 'ok')?.group, 'ok')
    assert.equal(rows.find((row) => row.invoice_id === 'bad')?.group, 'error')
    assert.equal(rows.find((row) => row.invoice_id === 'bad')?.delta, 10)
  })

  it('summarizes providers without bank account numbers', () => {
    const rows = summarizeProviders({
      configured: [{ provider: 'paypal', enabled: true, environment: 'sandbox' }],
      payments: [{ provider: 'paypal', status: 'completed', amount: 40, currency_code: 'USD' }],
    })
    const serialized = JSON.stringify(rows)
    assert.equal(serialized.includes('routing'), false)
    assert.equal(serialized.includes('account_number'), false)
    assert.equal(rows.find((row) => row.provider === 'paypal')?.received_total, 40)
    assert.equal(maskBankAccount('123456789'), '••••6789')
    assert.deepEqual(collectSensitiveFinanceLeaks(rows), [])
  })

  it('supports 90d period without defaulting to 30d', () => {
    assert.equal(parseFinanceControlPeriod('90d'), '90d')
    const range = resolveFinancePeriodRange({
      period: '90d',
      now: new Date('2026-09-12T00:00:00.000Z'),
    })
    assert.equal(range.period, '90d')
    const days = (new Date(range.to).getTime() - new Date(range.from).getTime()) / 86400000
    assert.ok(days >= 89 && days <= 91)
  })
})
