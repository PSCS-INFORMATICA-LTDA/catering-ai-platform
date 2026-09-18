import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { canAdvanceDeliveryStatus } from './deliveryStatusRank.ts'
import { paymentNotificationEventKey, buildPaymentNotificationPayload } from './mapPaymentNotification.ts'
import { templateKeyForEvent, whatsAppTemplateBody } from './templates.ts'
import { computeMetaSignatureHex, verifyMetaHubSignature } from './verifyMetaSignature.ts'
import { eventHeadline, environmentBanner } from './whatsappCopy.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8')

test('purpose=full is not quitação unless the invoice is actually settled', () => {
  assert.equal(
    paymentNotificationEventKey({
      purpose: 'full',
      status: 'completed',
      invoiceTotal: 100,
      invoicePaidTotal: 50,
      invoiceStatus: 'partially_paid',
    }),
    null,
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
      purpose: 'balance',
      status: 'completed',
      invoiceTotal: 100,
      invoicePaidTotal: 100,
    }),
    'payment.full_received',
  )
  assert.equal(
    paymentNotificationEventKey({
      purpose: 'deposit',
      status: 'completed',
      invoiceTotal: 100,
      invoicePaidTotal: 30,
    }),
    'payment.deposit_received',
  )
})

test('pending or failed payments never become receipt events', () => {
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
      purpose: 'full',
      status: 'failed',
      invoiceTotal: 100,
      invoicePaidTotal: 0,
    }),
    null,
  )
})

test('DEV banner and accepted template stay explicit', () => {
  assert.match(environmentBanner('pt'), /TESTE DEV/)
  assert.match(eventHeadline('quote.accepted', 'pt'), /Cliente aceitou/)
  assert.equal(templateKeyForEvent('quote.accepted'), 'quote_accepted_internal')
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
  const body = whatsAppTemplateBody({
    templateKey: 'payment_deposit_received_internal',
    locale: 'pt',
    payload: deposit.payload,
  })
  assert.match(body[0], /TESTE DEV/)
  assert.equal(body.length, 7)
})

test('Meta signature uses raw body and rejects missing/invalid', () => {
  const raw = '{"object":"whatsapp_business_account"}'
  const hex = computeMetaSignatureHex(raw, 'app-secret')
  assert.equal(verifyMetaHubSignature({ rawBody: raw, signatureHeader: `sha256=${hex}`, appSecret: 'app-secret' }).ok, true)
  assert.equal(verifyMetaHubSignature({ rawBody: raw, signatureHeader: null, appSecret: 'app-secret' }).ok, false)
  assert.equal(verifyMetaHubSignature({ rawBody: raw, signatureHeader: `sha256=${hex}`, appSecret: 'other' }).ok, false)
  assert.equal(verifyMetaHubSignature({ rawBody: raw, signatureHeader: `sha256=${hex}` , appSecret: '' }).ok, false)
})

test('delivery status never regresses read to sent', () => {
  assert.equal(canAdvanceDeliveryStatus('read', 'sent'), false)
  assert.equal(canAdvanceDeliveryStatus('delivered', 'sent'), false)
  assert.equal(canAdvanceDeliveryStatus('sent', 'delivered'), true)
  assert.equal(canAdvanceDeliveryStatus('delivered', 'read'), true)
})

test('provider status never claims templates are approved', () => {
  const resolve = read('Lib/notifications/resolveProvider.ts')
  assert.match(resolve, /unverified/)
  assert.doesNotMatch(resolve, /approved/)
  assert.match(resolve, /shared_sender_not_linked|companyMayUseSharedWhatsAppSender/)
  assert.doesNotMatch(resolve, /env_fallback/)
})

test('diagnosis lists the missing field without leaking secrets', () => {
  const diagnosis = read('Lib/notifications/diagnosis.ts')
  assert.match(diagnosis, /consent_not_confirmed/)
  assert.match(diagnosis, /company_notification_providers/)
  assert.doesNotMatch(diagnosis, /accessToken/)
})

test('worker backoff grows and enqueue is persist-only', () => {
  const dispatch = read('Lib/notifications/dispatch.ts')
  assert.match(dispatch, /nextBackoffIso/)
  assert.match(dispatch, /uncertain/)
  const enqueue = read('Lib/notifications/enqueueEvent.ts')
  assert.match(enqueue, /scheduleNotificationWorker/)
  assert.doesNotMatch(enqueue, /dispatchNotificationDelivery/)
  const record = read('Lib/payments/recordPayment.ts')
  assert.match(record, /void enqueuePaymentReceivedNotificationSafe/)
  assert.doesNotMatch(record, /graph\.facebook\.com/)
})

test('quote.accepted is hooked after persist and not on already_accepted', () => {
  const route = read('app/api/public/proposta/[token]/route.ts')
  assert.match(route, /enqueueQuoteAcceptedNotificationSafe/)
  assert.match(route, /void enqueueQuoteAcceptedNotificationSafe/)
  const already = route.slice(route.indexOf('already_accepted'), route.indexOf('Proposta já respondida'))
  assert.doesNotMatch(already, /enqueueQuoteAcceptedNotificationSafe/)
})

test('webhook is signature-scoped and public route is narrow', () => {
  const status = read('app/api/notifications/whatsapp/status/route.ts')
  const routes = read('Lib/publicRoutes.ts')
  assert.match(status, /verifyMetaHubSignature/)
  assert.match(status, /x-hub-signature-256/)
  assert.match(status, /phone_number_id/)
  assert.doesNotMatch(status, /from\('invoices'\)|paid_total|invoice_payments/)
  assert.match(routes, /\/api\/notifications\/whatsapp\/status/)
  assert.match(routes, /\/api\/notifications\/worker/)
  assert.doesNotMatch(routes, /\/api\/notifications\/recipients/)
})

test('migrations and source never embed the pilot phone', () => {
  const v12 = read('supabase/migrations/20260918183219_notification_center_v12_auto.sql')
  assert.match(v12, /quote.accepted/)
  assert.match(v12, /consent_status/)
  assert.match(v12, /auto_dispatch_from/)
  assert.doesNotMatch(v12, /2242|Caio|407915/)
  assert.doesNotMatch(read('Lib/notifications/enqueueEvent.ts'), /2242|Caio Rodrigues/)
})

test('one payment stays one transaction even with three deliveries', () => {
  const loader = read('Lib/notifications/loadActivityCenter.ts')
  assert.match(loader, /deliveriesByPayment/)
  assert.match(loader, /invoice_payments/)
  assert.doesNotMatch(loader, /balance_amount/)
})
