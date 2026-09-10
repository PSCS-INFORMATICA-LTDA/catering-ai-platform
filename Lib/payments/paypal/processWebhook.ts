import 'server-only'

import { confirmPaidDepositReservation } from '@/Lib/payments/confirmPaidDeposit'
import { recordPaymentAttempt } from '@/Lib/payments/recordPayment'
import { getSupabaseServerClient } from '@/Lib/supabaseServer'
import { webhookEventId } from './webhook'

function cents(value: unknown) {
  return Math.round((Number(value) || 0) * 100)
}

export async function processVerifiedPaypalCapture(input: {
  rawBody: string
  expectedCompanyId?: string
}) {
  let payload: Record<string, unknown> = {}
  try {
    payload = JSON.parse(input.rawBody) as Record<string, unknown>
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 })
  }

  const eventType = String(payload.event_type || '')
  const eventId = webhookEventId(payload)
  if (!eventId) return Response.json({ error: 'event_id_missing' }, { status: 400 })
  if (eventType !== 'PAYMENT.CAPTURE.COMPLETED') {
    return Response.json({ data: { ignored: true, eventType } })
  }

  const resource = (payload.resource || {}) as Record<string, unknown>
  const captureId = typeof resource.id === 'string' ? resource.id : null
  const supplementary = resource.supplementary_data as
    | { related_ids?: { order_id?: string } }
    | undefined
  const orderId = supplementary?.related_ids?.order_id || null
  if (!orderId || !captureId) {
    return Response.json({ data: { ignored: true, reason: 'payment_identity_missing' } })
  }

  let query = getSupabaseServerClient()
    .from('invoice_payments')
    .select('*')
    .eq('provider', 'paypal')
    .eq('provider_order_id', orderId)
  if (input.expectedCompanyId) query = query.eq('company_id', input.expectedCompanyId)
  const { data: matches } = await query.limit(2)
  if ((matches ?? []).length > 1) {
    return Response.json({ error: 'order_ambiguous' }, { status: 409 })
  }
  const payment = matches?.[0] ?? null
  if (!payment) return Response.json({ error: 'order_not_found' }, { status: 404 })
  if (input.expectedCompanyId && payment.company_id !== input.expectedCompanyId) {
    return Response.json({ error: 'company_mismatch' }, { status: 403 })
  }

  const amount = resource.amount as { value?: string; currency_code?: string } | undefined
  if (
    cents(amount?.value) !== cents(payment.amount) ||
    String(amount?.currency_code || '').toUpperCase() !== String(payment.currency_code).toUpperCase()
  ) {
    return Response.json({ error: 'paypal_webhook_amount_mismatch' }, { status: 409 })
  }

  if (payment.status === 'completed') {
    const reservation = await confirmPaidDepositReservation({
      companyId: String(payment.company_id),
      invoiceId: String(payment.invoice_id),
      source: 'paypal_webhook',
      providerOrderId: orderId,
      providerCaptureId: captureId,
    })
    return Response.json({ data: { duplicate: true, eventId, reservation } })
  }

  const recorded = await recordPaymentAttempt({
    companyId: String(payment.company_id),
    invoiceId: String(payment.invoice_id),
    provider: 'paypal',
    purpose: payment.purpose,
    amount: Number(amount?.value),
    currency: String(amount?.currency_code),
    status: 'completed',
    providerOrderId: orderId,
    providerCaptureId: captureId,
    idempotencyKey: `webhook:${eventId}`,
    metadata: { eventType, eventId, verifiedAmount: true, verifiedCurrency: true },
  })
  if (!recorded.ok) {
    return Response.json({ error: recorded.error }, { status: recorded.status })
  }

  const reservation = await confirmPaidDepositReservation({
    companyId: String(payment.company_id),
    invoiceId: String(payment.invoice_id),
    source: 'paypal_webhook',
    providerOrderId: orderId,
    providerCaptureId: captureId,
  })

  return Response.json({
    data: {
      duplicate: recorded.duplicate,
      invoiceStatus: recorded.invoice.status,
      eventId,
      reservation,
    },
  })
}
