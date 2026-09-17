/**
 * DEV-only replay of a completed invoice_payment into Notification Center.
 * Does not call PayPal, mutate invoice/payment/reservation.
 *
 *   node scripts/dev/replay-payment-notification.mjs --payment-id=<uuid> --dry-run
 *   node scripts/dev/replay-payment-notification.mjs --payment-id=<uuid>
 */
import { createClient } from '@supabase/supabase-js'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { assertDevUrl, DEV_REF, loadDevEnv, PROD_REF } from './loadDevEnv.mjs'
import { buildPaymentNotificationPayload } from '../../Lib/notifications/mapPaymentNotification.ts'
import { notificationIdempotencyKey } from '../../Lib/notifications/e164.ts'
import { templateKeyForEvent } from '../../Lib/notifications/templates.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

function arg(name) {
  const prefix = `--${name}=`
  return process.argv.find((item) => item.startsWith(prefix))?.slice(prefix.length) || ''
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`)
}

async function main() {
  const env = loadDevEnv(root)
  assertDevUrl(env.url)
  if (String(env.url).includes(PROD_REF)) throw new Error('Refused: Catering PROD')
  const paymentId = arg('payment-id')
  if (!/^[0-9a-f-]{36}$/i.test(paymentId)) {
    throw new Error('payment_id_required')
  }
  const dryRun = hasFlag('dry-run')
  const db = createClient(env.url, env.service, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: payment, error } = await db
    .from('invoice_payments')
    .select('id, company_id, invoice_id, purpose, amount, currency_code, status')
    .eq('id', paymentId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!payment) throw new Error('payment_not_found')
  if (payment.status !== 'completed') throw new Error('payment_not_completed')

  const { data: invoice } = await db
    .from('invoices')
    .select('id, invoice_number, quote_id, status, total, paid_total, locale, snapshot, currency_code')
    .eq('id', payment.invoice_id)
    .eq('company_id', payment.company_id)
    .maybeSingle()
  if (!invoice) throw new Error('invoice_not_found')

  const snapshot = invoice.snapshot || {}
  const mapped = buildPaymentNotificationPayload({
    companyId: payment.company_id,
    paymentId: payment.id,
    purpose: payment.purpose,
    amount: Number(payment.amount),
    currency: payment.currency_code || invoice.currency_code,
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoice_number,
    invoiceTotal: Number(invoice.total),
    invoicePaidTotal: Number(invoice.paid_total),
    invoiceStatus: invoice.status,
    quoteId: invoice.quote_id,
    quoteNumber: snapshot.quote?.number ?? null,
    customerName: snapshot.customer?.name ?? null,
    eventName: snapshot.event?.name ?? null,
    eventDate: snapshot.event?.date ?? null,
    eventTime: [snapshot.event?.startTime, snapshot.event?.endTime].filter(Boolean).join(' – ') || null,
    locale: invoice.locale === 'en' || invoice.locale === 'es' ? invoice.locale : 'pt',
    source: 'replay',
  })

  const report = {
    target_project_ref: DEV_REF,
    dry_run: dryRun,
    payment_id: payment.id,
    invoice_id: invoice.id,
    purpose: payment.purpose,
    event_key: mapped?.eventKey ?? null,
    outstanding: mapped?.payload.outstanding ?? null,
    invoice_status: invoice.status,
    invoice_fully_paid: mapped?.payload.invoiceFullyPaid ?? null,
    mutated_payment: false,
    mutated_invoice: false,
    mutated_reservation: false,
    paypal_called: false,
    prod_untouched: true,
  }
  if (!mapped) {
    console.log(JSON.stringify({ ...report, skipped: 'no_v1_event_for_purpose' }, null, 2))
    return
  }
  if (dryRun) {
    console.log(JSON.stringify({ ...report, would_enqueue: true, payload: mapped.payload }, null, 2))
    return
  }

  const inserted = await db
    .from('notification_events')
    .insert({
      company_id: payment.company_id,
      event_key: mapped.eventKey,
      entity_type: 'invoice_payment',
      entity_id: payment.id,
      payload: mapped.payload,
      actor_source: 'replay',
    })
    .select('id')
    .maybeSingle()
  let eventId = inserted.data?.id
  if (!eventId) {
    const existing = await db
      .from('notification_events')
      .select('id')
      .eq('company_id', payment.company_id)
      .eq('event_key', mapped.eventKey)
      .eq('entity_id', payment.id)
      .maybeSingle()
    eventId = existing.data?.id
  }
  const { data: subscriptions } = await db
    .from('notification_subscriptions')
    .select('recipient_id, notification_recipients(id, channel, enabled)')
    .eq('company_id', payment.company_id)
    .eq('event_key', mapped.eventKey)
    .eq('enabled', true)

  let deliveryCount = 0
  for (const row of subscriptions ?? []) {
    const recipient = Array.isArray(row.notification_recipients)
      ? row.notification_recipients[0]
      : row.notification_recipients
    if (!recipient || recipient.enabled === false) continue
    const key = notificationIdempotencyKey({
      companyId: payment.company_id,
      eventKey: mapped.eventKey,
      entityId: payment.id,
      recipientId: recipient.id,
      channel: recipient.channel,
    })
    await db.from('notification_deliveries').upsert(
      {
        company_id: payment.company_id,
        event_id: eventId,
        recipient_id: recipient.id,
        channel: recipient.channel,
        provider: 'meta_whatsapp',
        template_key: templateKeyForEvent(mapped.eventKey),
        status: 'pending',
        idempotency_key: key,
      },
      { onConflict: 'idempotency_key', ignoreDuplicates: true },
    )
    deliveryCount += 1
  }

  console.log(
    JSON.stringify(
      {
        ...report,
        event_id: eventId ?? null,
        delivery_count: deliveryCount,
        applied: Boolean(eventId),
      },
      null,
      2,
    ),
  )
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
