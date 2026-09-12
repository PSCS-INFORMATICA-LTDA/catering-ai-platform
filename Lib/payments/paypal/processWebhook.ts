import 'server-only'

import { writeOperationalAudit } from '@/Lib/orders/writeOperationalAudit'
import { confirmPaidDepositReservation } from '@/Lib/payments/confirmPaidDeposit'
import { recordPaymentAttempt } from '@/Lib/payments/recordPayment'
import { getSupabaseServerClient } from '@/Lib/supabaseServer'
import { webhookEventId } from './webhook'

function cents(value: unknown) {
  return Math.round((Number(value) || 0) * 100)
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function relatedIds(resource: Record<string, unknown>) {
  const supplementary = objectValue(resource.supplementary_data)
  return objectValue(supplementary.related_ids)
}

function knownRefundRpcError(message: string) {
  const known = [
    'paypal_capture_required',
    'paypal_capture_not_found',
    'refund_reference_required',
    'refund_amount_invalid',
    'refund_currency_invalid',
    'refund_currency_mismatch',
    'refund_payment_mismatch',
    'refund_amount_mismatch',
    'refund_match_ambiguous',
    'paypal_event_id_required',
    'invoice_not_found',
  ]
  return known.find((code) => message.includes(code)) || 'paypal_refund_reconciliation_failed'
}

async function processVerifiedPaypalRefund(input: {
  resource: Record<string, unknown>
  eventId: string
  expectedCompanyId?: string
}) {
  const providerRefundId = typeof input.resource.id === 'string' ? input.resource.id : null
  const amount = objectValue(input.resource.amount)
  const amountValue = Number(amount.value || 0)
  const currency = typeof amount.currency_code === 'string' ? amount.currency_code : ''
  const related = relatedIds(input.resource)
  const captureId = typeof related.capture_id === 'string' ? related.capture_id : null

  if (!providerRefundId || !captureId || cents(amountValue) <= 0 || !/^[A-Z]{3}$/i.test(currency)) {
    return Response.json(
      { data: { ignored: true, reason: 'refund_identity_or_amount_missing' } },
      { status: 200 },
    )
  }

  const db = getSupabaseServerClient()
  let paymentQuery = db
    .from('invoice_payments')
    .select('id, company_id, invoice_id, provider, provider_capture_id, status')
    .eq('provider', 'paypal')
    .eq('provider_capture_id', captureId)
    .eq('status', 'completed')
  if (input.expectedCompanyId) paymentQuery = paymentQuery.eq('company_id', input.expectedCompanyId)

  const { data: payments, error: paymentError } = await paymentQuery.limit(2)
  if (paymentError) {
    return Response.json({ error: 'paypal_refund_payment_lookup_failed' }, { status: 500 })
  }
  if ((payments ?? []).length > 1) {
    return Response.json({ error: 'paypal_capture_ambiguous' }, { status: 409 })
  }
  const payment = payments?.[0]
  if (!payment) return Response.json({ error: 'paypal_capture_not_found' }, { status: 404 })
  if (input.expectedCompanyId && String(payment.company_id) !== input.expectedCompanyId) {
    return Response.json({ error: 'company_mismatch' }, { status: 403 })
  }

  const { data, error } = await db.rpc('record_verified_paypal_refund', {
    p_company_id: String(payment.company_id),
    p_capture_id: captureId,
    p_provider_refund_id: providerRefundId,
    p_amount: amountValue,
    p_currency: currency.toUpperCase(),
    p_event_id: input.eventId,
  })
  if (error) {
    const code = knownRefundRpcError(error.message)
    const status = code === 'paypal_capture_not_found' || code === 'invoice_not_found'
      ? 404
      : code === 'refund_match_ambiguous' || code.includes('mismatch')
        ? 409
        : 500
    return Response.json({ error: code }, { status })
  }

  const result = objectValue(data)
  const refundId = typeof result.refund_id === 'string' ? result.refund_id : providerRefundId
  await writeOperationalAudit({
    companyId: String(payment.company_id),
    actorUserId: null,
    entityType: 'invoice_refund',
    entityId: refundId,
    action: 'refund_completed',
    newData: {
      source: 'paypal_verified_webhook',
      paypal_event_id: input.eventId,
      provider_refund_id: providerRefundId,
      capture_id: captureId,
      amount: amountValue,
      currency_code: currency.toUpperCase(),
      duplicate: result.duplicate === true,
      invoice_id: result.invoice_id ?? payment.invoice_id,
      paid_total: result.paid_total,
      invoice_status: result.invoice_status,
      cancellation_completed: result.cancellation_completed === true,
    },
  })

  return Response.json({
    data: {
      eventId: input.eventId,
      refundId,
      providerRefundId,
      duplicate: result.duplicate === true,
      invoiceStatus: result.invoice_status,
      paidTotal: result.paid_total,
      cancellationCompleted: result.cancellation_completed === true,
    },
  })
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

  const resource = objectValue(payload.resource)
  if (eventType === 'PAYMENT.CAPTURE.REFUNDED') {
    return processVerifiedPaypalRefund({
      resource,
      eventId,
      expectedCompanyId: input.expectedCompanyId,
    })
  }
  if (eventType !== 'PAYMENT.CAPTURE.COMPLETED') {
    return Response.json({ data: { ignored: true, eventType } })
  }

  const captureId = typeof resource.id === 'string' ? resource.id : null
  const related = relatedIds(resource)
  const orderId = typeof related.order_id === 'string' ? related.order_id : null
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

  const amount = objectValue(resource.amount)
  if (
    cents(amount.value) !== cents(payment.amount) ||
    String(amount.currency_code || '').toUpperCase() !== String(payment.currency_code).toUpperCase()
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
    amount: Number(amount.value),
    currency: String(amount.currency_code),
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
