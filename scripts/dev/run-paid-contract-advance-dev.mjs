/**
 * DEV evidence: payment completed → reservation confirmed → ensure OS.
 * Reuses the canonical confirmPaidDepositReservation. No new PayPal capture.
 * Never touches PROD. Never deletes Q-2026-000319 / INV-2026-000053.
 *
 *   node --experimental-strip-types --import ./scripts/dev/register-next-aliases.mjs \
 *     scripts/dev/run-paid-contract-advance-dev.mjs
 *
 * Optional HTTP fallback (duplicate capture only):
 *   PAID_CONTRACT_BASE_URL=https://... node scripts/dev/run-paid-contract-advance-dev.mjs --http
 */
import assert from 'node:assert/strict'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { assertDevUrl, loadDevEnv } from './loadDevEnv.mjs'
import {
  readContractLifecycle,
  shouldAdvancePaidContract,
} from '../../Lib/payments/paidContractAdvance.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const COMPANY = '65fd576f-8d97-49ba-bf38-61bc1e94e94a'
const QUOTE_NUMBER = process.env.PAID_CONTRACT_QUOTE_NUMBER || 'Q-2026-000319'
const INVOICE_NUMBER = process.env.PAID_CONTRACT_INVOICE_NUMBER || 'INV-2026-000053'
const APPLY = process.argv.includes('--apply') || process.env.PAID_CONTRACT_APPLY === '1'
const HTTP = process.argv.includes('--http')
const BASE = (process.env.PAID_CONTRACT_BASE_URL || process.env.COMMERCIAL_REVIEW_BASE_URL || '')
  .replace(/\/$/, '')

const env = loadDevEnv(root)
assertDevUrl(env.url)
if (!env.service) {
  console.error('BLOQUEADO — SUPABASE_SERVICE_ROLE_KEY ausente')
  process.exit(2)
}

const db = createClient(env.url, env.service, {
  auth: { persistSession: false, autoRefreshToken: false },
})

function money(value) {
  return Math.round((Number(value) || 0) * 100) / 100
}

async function snapshot(label) {
  const { data: invoice, error: invoiceError } = await db
    .from('invoices')
    .select(
      'id, company_id, quote_id, invoice_number, invoice_kind, status, total, deposit_amount, paid_total, currency_code',
    )
    .eq('company_id', COMPANY)
    .eq('invoice_number', INVOICE_NUMBER)
    .maybeSingle()
  if (invoiceError || !invoice) {
    throw new Error(`invoice_not_found:${invoiceError?.message || INVOICE_NUMBER}`)
  }

  const { data: quote, error: quoteError } = await db
    .from('quotes')
    .select(
      'id, company_id, quote_number, quote_status, proposal_response, accepted_version_id, converted_service_order_id, reservation_confirmed_at, event_id, customer_id, reservation_amount, quote_total, active',
    )
    .eq('company_id', COMPANY)
    .eq('id', invoice.quote_id)
    .maybeSingle()
  if (quoteError || !quote) {
    throw new Error(`quote_not_found:${quoteError?.message || invoice.quote_id}`)
  }

  const [payments, orders, agenda, coupons, foreignOrders] = await Promise.all([
    db
      .from('invoice_payments')
      .select(
        'id, provider, purpose, amount, status, provider_order_id, provider_capture_id, idempotency_key',
      )
      .eq('company_id', COMPANY)
      .eq('invoice_id', invoice.id)
      .order('created_at', { ascending: true }),
    db
      .from('service_orders')
      .select('id, service_order_number, quote_id, quote_version_id, company_id, status')
      .eq('company_id', COMPANY)
      .eq('quote_id', quote.id),
    db
      .from('agenda_events')
      .select('id, code, status, quote_id, service_order_id, event_date, start_time, end_time')
      .eq('company_id', COMPANY)
      .eq('quote_id', quote.id)
      .neq('status', 'cancelled'),
    db
      .from('quote_coupon_applications')
      .select('id, approval_status')
      .eq('company_id', COMPANY)
      .eq('quote_id', quote.id),
    db
      .from('service_orders')
      .select('id')
      .neq('company_id', COMPANY)
      .eq('quote_id', quote.id),
  ])

  const lifecycle = readContractLifecycle({
    proposalAccepted: quote.proposal_response === 'accepted',
    invoiceStatus: invoice.status,
    paidTotal: invoice.paid_total,
    depositAmount: invoice.deposit_amount,
    total: invoice.total,
    reservationConfirmedAt: quote.reservation_confirmed_at,
    serviceOrderId: orders.data?.[0]?.id ?? quote.converted_service_order_id,
    serviceOrderNumber: orders.data?.[0]?.service_order_number ?? null,
  })

  const view = {
    label,
    quoteNumber: quote.quote_number,
    quoteId: quote.id,
    quoteStatus: quote.quote_status,
    proposalResponse: quote.proposal_response,
    acceptedVersionId: quote.accepted_version_id,
    reservationConfirmedAt: quote.reservation_confirmed_at,
    convertedServiceOrderId: quote.converted_service_order_id,
    invoiceNumber: invoice.invoice_number,
    invoiceId: invoice.id,
    invoiceKind: invoice.invoice_kind,
    invoiceStatus: invoice.status,
    total: money(invoice.total),
    depositAmount: money(invoice.deposit_amount),
    paidTotal: money(invoice.paid_total),
    payments: (payments.data ?? []).map((row) => ({
      id: row.id,
      provider: row.provider,
      purpose: row.purpose,
      amount: money(row.amount),
      status: row.status,
      orderId: row.provider_order_id,
      captureId: row.provider_capture_id,
    })),
    serviceOrders: (orders.data ?? []).map((row) => ({
      id: row.id,
      number: row.service_order_number,
      quoteVersionId: row.quote_version_id,
      status: row.status,
    })),
    agenda: (agenda.data ?? []).map((row) => ({
      id: row.id,
      code: row.code,
      status: row.status,
      serviceOrderId: row.service_order_id,
      eventDate: row.event_date,
    })),
    quoteActive: quote.active !== false,
    pendingCoupons: (coupons.data ?? []).filter((row) => row.approval_status === 'pending').length,
    foreignOrders: (foreignOrders.data ?? []).length,
    lifecycle,
    advance: shouldAdvancePaidContract({
      invoiceKind: invoice.invoice_kind,
      depositAmount: money(invoice.deposit_amount),
      paidTotal: money(invoice.paid_total),
    }),
  }

  console.log(`\n=== ${label} ===`)
  console.log(JSON.stringify(view, null, 2))
  return { invoice, quote, view }
}

async function restorePaidEvidenceQuote(quote) {
  if (quote.active !== false) return false
  console.log(
    'RESTORE_ACTIVE  Q-2026-000319 was deactivated after the validated PayPal capture; restoring so the paid contract can ensure OS. Invoice and payment rows are not rewritten.',
  )
  const { error } = await db
    .from('quotes')
    .update({ active: true, updated_at: new Date().toISOString() })
    .eq('id', quote.id)
    .eq('company_id', COMPANY)
    .eq('active', false)
  if (error) throw new Error(`restore_active_failed:${error.message}`)
  return true
}

async function applyCanonical(invoice) {
  const { confirmPaidDepositReservation } = await import(
    '../../Lib/payments/confirmPaidDeposit.ts'
  )
  const first = await confirmPaidDepositReservation({
    companyId: COMPANY,
    invoiceId: invoice.id,
    source: 'paypal_capture',
    actorUserId: null,
  })
  const second = await confirmPaidDepositReservation({
    companyId: COMPANY,
    invoiceId: invoice.id,
    source: 'paypal_webhook',
    actorUserId: null,
  })
  const concurrent = await Promise.all([
    confirmPaidDepositReservation({
      companyId: COMPANY,
      invoiceId: invoice.id,
      source: 'record_payment',
      actorUserId: null,
    }),
    confirmPaidDepositReservation({
      companyId: COMPANY,
      invoiceId: invoice.id,
      source: 'manual_payment',
      actorUserId: null,
    }),
  ])
  return { first, second, concurrent }
}

async function applyHttp(view) {
  const payment = view.payments.find((row) => row.status === 'completed' && row.orderId)
  if (!payment?.orderId) throw new Error('completed_paypal_order_missing')
  const { data: link } = await db
    .from('payment_links')
    .select('token, status')
    .eq('company_id', COMPANY)
    .eq('invoice_id', view.invoiceId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!link?.token) throw new Error('payment_link_missing')

  const post = async () => {
    const response = await fetch(`${BASE}/api/payments/paypal/capture`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: link.token, orderId: payment.orderId }),
    })
    const data = await response.json().catch(() => null)
    return { status: response.status, data }
  }

  const first = await post()
  const second = await post()
  const concurrent = await Promise.all([post(), post()])
  return { first, second, concurrent }
}

const before = await snapshot('BEFORE')
assert.equal(before.quote.quote_number, QUOTE_NUMBER)
assert.equal(before.invoice.invoice_number, INVOICE_NUMBER)
assert.equal(before.invoice.company_id, COMPANY)
assert.notEqual(before.invoice.invoice_kind, 'post_event_adjustment')

let applied = null
if (APPLY && HTTP) {
  if (!BASE) throw new Error('PAID_CONTRACT_BASE_URL required for --http')
  applied = await applyHttp(before.view)
} else if (APPLY) {
  await restorePaidEvidenceQuote(before.quote)
  applied = await applyCanonical(before.invoice)
}

if (applied) {
  console.log('\n=== APPLY ===')
  console.log(JSON.stringify(applied, null, 2))
}

const after = await snapshot('AFTER')

assert.equal(after.view.total, before.view.total)
assert.equal(after.view.depositAmount, before.view.depositAmount)
assert.equal(after.view.paidTotal, before.view.paidTotal)
assert.equal(after.view.invoiceStatus, before.view.invoiceStatus)
assert.equal(after.view.foreignOrders, 0)
assert.ok(after.view.advance.advance, 'deposit should allow reservation+OS')

if (APPLY) {
  assert.equal(after.view.serviceOrders.length, 1, 'exactly one OS')
  assert.ok(after.view.convertedServiceOrderId, 'quote linked to OS')
  assert.equal(after.view.convertedServiceOrderId, after.view.serviceOrders[0].id)
  assert.ok(after.view.reservationConfirmedAt, 'reservation confirmed')
  assert.equal(after.view.agenda.length, 1, 'exactly one agenda event')
  assert.equal(after.view.lifecycle.reservationConfirmed, true)
  assert.equal(after.view.lifecycle.serviceOrderPresent, true)
  assert.equal(after.view.lifecycle.financialStatus, 'partially_paid')
  if (applied?.first?.serviceOrderId && applied?.second?.serviceOrderId) {
    assert.equal(applied.first.serviceOrderId, applied.second.serviceOrderId)
  }
  if (applied?.concurrent?.[0]?.serviceOrderId && applied?.concurrent?.[1]?.serviceOrderId) {
    assert.equal(applied.concurrent[0].serviceOrderId, applied.concurrent[1].serviceOrderId)
  }
}

console.log('\nPAID_CONTRACT_ADVANCE_DEV=PASS')
console.log(
  JSON.stringify(
    {
      quote: after.view.quoteNumber,
      invoice: after.view.invoiceNumber,
      paidTotal: after.view.paidTotal,
      reservationConfirmed: Boolean(after.view.reservationConfirmedAt),
      serviceOrder: after.view.serviceOrders[0]?.number ?? null,
      agenda: after.view.agenda[0]?.code ?? null,
      applied: Boolean(APPLY),
      paypalLiveUsed: false,
      prodTouched: false,
    },
    null,
    2,
  ),
)
