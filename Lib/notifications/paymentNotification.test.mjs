import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { currentInvoiceOutstanding, invoicePaidStatusLabel } from './outstanding.ts'
import { buildPaymentNotificationPayload, paymentNotificationEventKey } from './mapPaymentNotification.ts'
import { deliveryStatusPatch, mapMetaWhatsAppStatus, parseMetaStatusWebhook } from './mapMetaStatus.ts'
import { maskPhone } from './maskPhone.ts'
import { templateKeyForEvent, whatsAppTemplateBody } from './templates.ts'
import { notificationIdempotencyKey } from './e164.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8')

test('outstanding ignores balance_amount and uses total - paid_total', () => {
  assert.equal(currentInvoiceOutstanding({ total: 1000, paidTotal: 300 }), 700)
  assert.equal(
    currentInvoiceOutstanding({ total: 1000, paidTotal: 1000 }),
    0,
  )
  const fullPaidWithStaleBalance = buildPaymentNotificationPayload({
    companyId: 'co',
    paymentId: 'pay-1',
    purpose: 'full',
    amount: 700,
    currency: 'USD',
    invoiceId: 'inv-1',
    invoiceNumber: 'INV-1',
    invoiceTotal: 1000,
    invoicePaidTotal: 1000,
    invoiceStatus: 'paid',
    source: 'test',
  })
  assert.equal(fullPaidWithStaleBalance?.payload.outstanding, 0)
  assert.equal(fullPaidWithStaleBalance?.payload.invoiceFullyPaid, true)
  assert.notEqual(fullPaidWithStaleBalance?.payload.outstanding, 700)
})

test('purpose mapping is provider-agnostic', () => {
  assert.equal(
    paymentNotificationEventKey({
      purpose: 'deposit',
      status: 'completed',
      invoiceTotal: 100,
      invoicePaidTotal: 30,
    }),
    'payment.deposit_received',
  )
  assert.equal(
    paymentNotificationEventKey({
      purpose: 'full',
      status: 'completed',
      invoiceTotal: 100,
      invoicePaidTotal: 100,
      invoiceStatus: 'paid',
    }),
    'payment.full_received',
  )
  assert.equal(
    paymentNotificationEventKey({
      purpose: 'deposit',
      status: 'created',
      invoiceTotal: 100,
      invoicePaidTotal: 0,
    }),
    null,
  )
  assert.equal(
    paymentNotificationEventKey({
      purpose: 'balance',
      status: 'completed',
      invoiceTotal: 100,
      invoicePaidTotal: 100,
      invoiceStatus: 'paid',
    }),
    'payment.full_received',
  )
})

test('full received copy is not Paid when invoice is not fully paid', () => {
  const mapped = buildPaymentNotificationPayload({
    companyId: 'co',
    paymentId: 'pay-2',
    purpose: 'full',
    amount: 50,
    currency: 'USD',
    invoiceId: 'inv-2',
    invoiceTotal: 100,
    invoicePaidTotal: 50,
    invoiceStatus: 'partially_paid',
    source: 'test',
  })
  assert.equal(mapped?.eventKey, 'payment.full_received')
  assert.equal(mapped?.payload.invoiceFullyPaid, false)
  assert.equal(invoicePaidStatusLabel('pt', { total: 100, paidTotal: 50 }), 'Parcialmente pago')
  assert.equal(invoicePaidStatusLabel('en', { total: 100, paidTotal: 100, status: 'paid' }), 'Paid')
  assert.equal(invoicePaidStatusLabel('es', { total: 100, paidTotal: 100 }), 'Pagado')
})

test('templates and deep links stay internal', () => {
  assert.equal(templateKeyForEvent('quote.created'), 'new_quote_internal')
  assert.equal(templateKeyForEvent('payment.deposit_received'), 'payment_deposit_received_internal')
  assert.equal(templateKeyForEvent('payment.full_received'), 'payment_full_received_internal')
  const deposit = buildPaymentNotificationPayload({
    companyId: 'co',
    paymentId: 'pay-3',
    purpose: 'deposit',
    amount: 30,
    currency: 'USD',
    invoiceId: 'inv-3',
    invoiceTotal: 100,
    invoicePaidTotal: 30,
    source: 'test',
  })
  assert.equal(deposit?.payload.deepLinkPath, '/invoices/inv-3')
  const body = whatsAppTemplateBody({
    templateKey: 'payment_deposit_received_internal',
    locale: 'pt',
    payload: deposit.payload,
  })
  assert.equal(body.length, 6)
})

test('idempotency is company+event+entity+recipient+channel', () => {
  assert.equal(
    notificationIdempotencyKey({
      companyId: 'co',
      eventKey: 'payment.deposit_received',
      entityId: 'pay-1',
      recipientId: 'r-1',
      channel: 'whatsapp',
    }),
    'co:payment.deposit_received:pay-1:r-1:whatsapp',
  )
})

test('Meta status webhook contract maps sent/delivered/read/failed', () => {
  assert.equal(mapMetaWhatsAppStatus('delivered'), 'delivered')
  const updates = parseMetaStatusWebhook({
    entry: [
      {
        changes: [
          {
            value: {
              statuses: [
                { id: 'wamid.1', status: 'delivered', timestamp: 1700000000 },
                { id: 'wamid.2', status: 'failed', errors: [{ message: 'x' }] },
              ],
            },
          },
        ],
      },
    ],
  })
  assert.equal(updates.length, 2)
  assert.equal(updates[0].status, 'delivered')
  assert.equal(deliveryStatusPatch(updates[1]).status, 'failed')
})

test('phone is masked in history helpers', () => {
  assert.match(maskPhone('+14079152242'), /••••2242/)
})

test('payment hooks are post-commit and not PayPal-only', () => {
  const record = read('Lib/payments/recordPayment.ts')
  const manual = read('Lib/payments/manualFinance.ts')
  const webhook = read('Lib/payments/paypal/processWebhook.ts')
  assert.match(record, /void enqueuePaymentReceivedNotificationSafe/)
  assert.match(manual, /void enqueuePaymentReceivedNotificationSafe/)
  assert.doesNotMatch(webhook, /enqueuePaymentReceivedNotificationSafe/)
  assert.doesNotMatch(record, /await enqueuePaymentReceivedNotificationSafe/)
})

test('subscriptions are separate from recipients', () => {
  const sql = read('supabase/migrations/20260917190000_notification_center_v1.sql')
  assert.match(sql, /notification_subscriptions/)
  assert.match(sql, /notification_event_definitions/)
  assert.match(sql, /company_notification_providers/)
  assert.match(sql, /private.notification_provider_secrets/)
  assert.doesNotMatch(sql, /event_key in \('quote.created'\)/)
  assert.match(sql, /payment.deposit_received/)
  assert.match(sql, /inventory.low_stock/)
})
