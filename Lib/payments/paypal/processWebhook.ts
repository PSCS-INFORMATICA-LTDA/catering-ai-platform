import 'server-only'

import { recordPaymentAttempt } from '@/Lib/payments/recordPayment'
import { getSupabaseServerClient } from '@/Lib/supabaseServer'
import { webhookEventId } from './webhook'

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
  if (!orderId) {
    return Response.json({ data: { ignored: true, reason: 'order_id_missing' } })
  }

  let query = getSupabaseServerClient()
    .from('invoice_payments')
    .select('*')
    .eq('provider', 'paypal')
    .eq('provider_order_id', orderId)
  if (input.expectedCompanyId) {
    query = query.eq('company_id', input.expectedCompanyId)
  }
  const { data: matches } = await query.limit(2)
  if ((matches ?? []).length > 1) {
    return Response.json({ error: 'order_ambiguous' }, { status: 409 })
  }
  const payment = matches?.[0] ?? null
  if (!payment) return Response.json({ error: 'order_not_found' }, { status: 404 })
  if (input.expectedCompanyId && payment.company_id !== input.expectedCompanyId) {
    return Response.json({ error: 'company_mismatch' }, { status: 403 })
  }
  if (payment.status === 'completed') {
    return Response.json({ data: { duplicate: true, eventId } })
  }

  const recorded = await recordPaymentAttempt({
    companyId: String(payment.company_id),
    invoiceId: String(payment.invoice_id),
    provider: 'paypal',
    purpose: payment.purpose,
    amount: Number(payment.amount),
    currency: String(payment.currency_code),
    status: 'completed',
    providerOrderId: orderId,
    providerCaptureId: captureId,
    idempotencyKey: `webhook:${eventId}`,
    metadata: { eventType, eventId },
  })
  if (!recorded.ok) {
    return Response.json({ error: recorded.error }, { status: recorded.status })
  }
  return Response.json({
    data: {
      duplicate: recorded.duplicate,
      invoiceStatus: recorded.invoice.status,
      eventId,
    },
  })
}
