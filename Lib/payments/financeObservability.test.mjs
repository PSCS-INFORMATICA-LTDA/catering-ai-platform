import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  computeEventFinalTotal,
  computeFinancialCheck,
  computeInvoiceControlKpis,
  detectIdempotencyIssues,
  detectOutboxHighlights,
  detectReconciliationAlerts,
  classifyScheduleHold,
  paymentLinkObservabilityState,
} from './financeObservability.ts'
import {
  collectSensitiveFinanceLeaks,
  sanitizePaymentMetadataForBackoffice,
  sanitizePaypalProviderForObservability,
  sanitizeJsonForObservability,
} from './sanitizeFinanceObservability.ts'

describe('finance observability v1', () => {
  it('computes invoice KPIs without mixing canceled totals into billed', () => {
    const kpis = computeInvoiceControlKpis({
      invoices: [
        { status: 'paid', invoice_kind: 'original', total: 100, paid_total: 100, currency_code: 'USD' },
        { status: 'canceled', invoice_kind: 'original', total: 80, paid_total: 0, currency_code: 'USD' },
        { status: 'partially_paid', invoice_kind: 'post_event_adjustment', total: 20, paid_total: 5, currency_code: 'USD' },
      ],
      payments: [{ status: 'completed' }, { status: 'failed' }, { status: 'created' }],
    })
    assert.equal(kpis.billed_total, 120)
    assert.equal(kpis.received_total, 105)
    assert.equal(kpis.outstanding_total, 15)
    assert.equal(kpis.canceled_total, 80)
    assert.equal(kpis.original_count, 2)
    assert.equal(kpis.adjustment_count, 1)
    assert.equal(kpis.payments_completed, 1)
    assert.equal(kpis.payments_failed, 1)
  })

  it('keeps original and adjustment totals separate and sums the event total', () => {
    const totals = computeEventFinalTotal(1000, 150)
    assert.equal(totals.original_total, 1000)
    assert.equal(totals.adjustment_total, 150)
    assert.equal(totals.final_event_total, 1150)
  })

  it('signals financial check attention when paid_total diverges more than 0.01', () => {
    const ok = computeFinancialCheck({
      invoiceTotal: 100,
      invoicePaidTotal: 100,
      invoiceStatus: 'paid',
      depositAmount: 30,
      completedPaymentsTotal: 100,
      refundedTotal: 0,
    })
    assert.equal(ok.signal, 'ok')
    const bad = computeFinancialCheck({
      invoiceTotal: 100,
      invoicePaidTotal: 70,
      invoiceStatus: 'partially_paid',
      depositAmount: 30,
      completedPaymentsTotal: 100,
      refundedTotal: 0,
    })
    assert.equal(bad.signal, 'attention')
    assert.equal(bad.ok, false)
  })

  it('detects duplicate PayPal ids without mutating input', () => {
    const payments = [
      { id: 'p1', invoice_id: 'i1', provider_order_id: 'ORDER-1', provider_capture_id: 'CAP-1', idempotency_key: 'k1', status: 'completed', amount: 30 },
      { id: 'p2', invoice_id: 'i2', provider_order_id: 'ORDER-1', provider_capture_id: 'CAP-2', idempotency_key: 'k2', status: 'completed', amount: 70 },
    ]
    const frozen = JSON.stringify(payments)
    const alerts = detectIdempotencyIssues(payments)
    assert.equal(JSON.stringify(payments), frozen)
    assert.ok(alerts.some((alert) => alert.code === 'duplicate_provider_order_id'))
  })

  it('flags supplemental invoices without parent and post-event holds', () => {
    const alerts = detectReconciliationAlerts({
      invoices: [
        {
          id: 'adj-1',
          invoice_number: 'INV-ADJ',
          invoice_kind: 'post_event_adjustment',
          parent_invoice_id: null,
          status: 'ready',
          total: 20,
          paid_total: 0,
          deposit_amount: 0,
          currency_code: 'USD',
        },
      ],
      payments: [],
      holds: [{ invoice_id: 'adj-1', status: 'active', expires_at: new Date(Date.now() + 60_000).toISOString() }],
    })
    assert.ok(alerts.some((alert) => alert.code === 'supplemental_missing_parent'))
    assert.ok(alerts.some((alert) => alert.code === 'post_event_active_hold'))
  })

  it('classifies schedule hold badges and post-event as error', () => {
    const held = classifyScheduleHold({
      status: 'active',
      expires_at: new Date(Date.now() + 60_000).toISOString(),
      invoice_kind: 'original',
    })
    assert.equal(held.status, 'held')
    const errorHold = classifyScheduleHold({
      status: 'active',
      expires_at: new Date(Date.now() + 60_000).toISOString(),
      invoice_kind: 'post_event_adjustment',
    })
    assert.equal(errorHold.severity, 'error')
  })

  it('never returns token_hash, secrets, or webhook route keys from sanitizers', () => {
    const metadata = sanitizePaymentMetadataForBackoffice({
      eventType: 'PAYMENT.CAPTURE.COMPLETED',
      client_secret: 'super-secret',
      token_hash: 'hash-should-die',
      webhook_route_key: 'route-key-full',
      access_token: 'paypal-access',
      Authorization: 'Bearer abc',
      buyer_password: 'buyer-pass',
      source: 'webhook',
    })
    assert.deepEqual(metadata, { eventType: 'PAYMENT.CAPTURE.COMPLETED', source: 'webhook' })
    const leaks = collectSensitiveFinanceLeaks(metadata)
    assert.deepEqual(leaks, [])

    const provider = sanitizePaypalProviderForObservability({
      enabled: true,
      environment: 'sandbox',
      publicClientId: 'AYID-PUBLIC',
      webhookRouteKey: 'full-webhook-route-key-value',
      metadata: {
        webhook_id: 'WH-1',
        client_secret_vault_id: 'vault-123',
        last_tested_at: '2026-09-01T00:00:00.000Z',
      },
      secretConfigured: true,
    })
    const serialized = JSON.stringify(provider)
    assert.equal(serialized.includes('full-webhook-route-key-value'), false)
    assert.equal(serialized.includes('AYID-PUBLIC'), false)
    assert.equal(serialized.includes('vault-123'), false)
    assert.equal(provider.public_client_id_state, 'configured')
    assert.equal(provider.webhook_configured, true)
    assert.equal(provider.sandbox, true)
  })

  it('fail-closed helper marks non-sandbox environments', () => {
    const live = sanitizePaypalProviderForObservability({
      enabled: true,
      environment: 'live',
      publicClientId: 'x',
      webhookRouteKey: 'abc',
      metadata: {},
      secretConfigured: true,
    })
    assert.equal(live.sandbox, false)
    assert.equal(live.environment, 'live')
  })

  it('redacts secret-looking audit values', () => {
    const sanitized = sanitizeJsonForObservability({
      token_hash: 'abc',
      note: 'ok',
      header: 'Bearer eyJabc.def',
    })
    assert.equal(Object.prototype.hasOwnProperty.call(sanitized, 'token_hash'), false)
    assert.equal(sanitized.note, 'ok')
    assert.equal(sanitized.header, '[redacted]')
  })

  it('payment link states never need token_hash', () => {
    assert.equal(paymentLinkObservabilityState({ revoked_at: '2026-01-01', expires_at: null }), 'revoked')
    assert.equal(
      paymentLinkObservabilityState({
        revoked_at: null,
        expires_at: '2020-01-01T00:00:00.000Z',
      }),
      'expired',
    )
    assert.equal(paymentLinkObservabilityState({ revoked_at: null, expires_at: null }), 'active')
  })

  it('highlights stale or incomplete outbox rows', () => {
    const highlights = detectOutboxHighlights({
      status: 'pending',
      attempts: 2,
      created_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
      invoice_kind: 'post_event_adjustment',
      parent_invoice_id: null,
    })
    assert.ok(highlights.includes('pending_stale'))
    assert.ok(highlights.includes('attempts'))
    assert.ok(highlights.includes('missing_parent_invoice_id'))
  })
})
