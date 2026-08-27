import { recordPaymentAttempt } from '@/Lib/payments/recordPayment'
import { getSupabaseServerClient } from '@/Lib/supabaseServer'
import {
  readPaypalWebhookHeaders,
  verifyPaypalWebhookSignature,
  webhookEventId,
} from '@/Lib/payments/paypal/webhook'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const rawBody = await request.text()
  const headers = readPaypalWebhookHeaders(request.headers)
  const verified = await verifyPaypalWebhookSignature({
    headers,
    rawBody,
  })
  if (!verified.ok) {
    return Response.json({ error: verified.reason }, { status: 400 })
  }

  let payload: Record<string, unknown> = {}
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 })
  }

  const eventType = String(payload.event_type || '')
  const eventId = webhookEventId(payload)
  if (!eventId) return Response.json({ error: 'event_id_missing' }, { status: 400 })
  if (eventType !== 'PAYMENT.CAPTURE.COMPLETED' && eventType !== 'CHECKOUT.ORDER.APPROVED') {
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

  const { data: matches } = await getSupabaseServerClient()
    .from('invoice_payments')
    .select('*')
    .eq('provider', 'paypal')
    .eq('provider_order_id', orderId)
    .limit(2)
  if ((matches ?? []).length > 1) {
    return Response.json({ error: 'order_ambiguous' }, { status: 409 })
  }
  const payment = matches?.[0] ?? null

  if (!payment) {
    return Response.json({ error: 'order_not_found' }, { status: 404 })
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
