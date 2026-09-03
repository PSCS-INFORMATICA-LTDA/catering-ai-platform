import { requireApiPermission, resolveAuthorizedCompanyId } from '@/Lib/auth/requireApi'
import { assertCompanyPaypalEligible } from '@/Lib/payments/companyProviders'
import { loadCompanyPaypalCredentials } from '@/Lib/payments/companyPaypal'
import { createPaypalAdapter } from '@/Lib/payments/paypal/adapter'
import { readPaypalRuntimeConfig } from '@/Lib/payments/paypal/config'
import {
  findPaymentByProviderOrder,
  recordPaymentAttempt,
} from '@/Lib/payments/recordPayment'
import { resolvePaymentLink } from '@/Lib/payments/resolvePaymentLink'
import { randomUUID } from 'node:crypto'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    token?: string
    invoiceId?: string
    orderId?: string
  } | null
  if (!body?.orderId) {
    return Response.json({ error: 'order_required' }, { status: 400 })
  }

  const runtime = readPaypalRuntimeConfig()
  if (runtime.liveBlocked) {
    return Response.json({ error: 'paypal_live_blocked' }, { status: 403 })
  }

  let companyId = ''
  let invoiceId = ''

  if (body.token) {
    if (!runtime.publicCheckout) {
      return Response.json({ error: 'paypal_public_checkout_off' }, { status: 403 })
    }
    const resolved = await resolvePaymentLink(body.token)
    if (!resolved.ok) {
      return Response.json({ error: resolved.error }, { status: resolved.status })
    }
    companyId = resolved.invoice.company_id
    invoiceId = resolved.invoice.id
  } else {
    const auth = await requireApiPermission('quotes.manage')
    if (!auth.ok) return auth.response
    companyId = resolveAuthorizedCompanyId(auth.session)
    invoiceId = body.invoiceId || ''
  }

  const eligible = await assertCompanyPaypalEligible(companyId)
  if (!eligible.ok) {
    return Response.json({ error: eligible.error }, { status: 403 })
  }

  const existing = await findPaymentByProviderOrder(companyId, 'paypal', body.orderId)
  if (!existing) {
    return Response.json({ error: 'order_not_found' }, { status: 404 })
  }
  if (invoiceId && existing.invoice_id !== invoiceId) {
    return Response.json({ error: 'order_invoice_mismatch' }, { status: 403 })
  }
  if (existing.status === 'completed') {
    return Response.json({
      data: { duplicate: true, captureId: existing.provider_capture_id, paymentId: existing.id },
    })
  }
  invoiceId = existing.invoice_id

  const companyPaypal = await loadCompanyPaypalCredentials(companyId)
  if (!companyPaypal.clientId || !companyPaypal.clientSecret) {
    return Response.json({ error: 'paypal_not_configured' }, { status: 409 })
  }
  const adapter = createPaypalAdapter(runtime, {
    clientId: companyPaypal.clientId,
    clientSecret: companyPaypal.clientSecret,
  })
  const captured = await adapter.captureOrder({
    orderId: body.orderId,
    requestId: randomUUID(),
  })

  const recorded = await recordPaymentAttempt({
    companyId,
    invoiceId,
    provider: 'paypal',
    purpose: existing?.purpose ?? 'deposit',
    amount: captured.amount,
    currency: captured.currency,
    status: 'completed',
    providerOrderId: captured.orderId,
    providerCaptureId: captured.captureId,
    idempotencyKey: `capture:${captured.orderId}`,
    metadata: { mock: captured.mock },
  })

  if (!recorded.ok) {
    return Response.json({ error: recorded.error }, { status: recorded.status })
  }

  return Response.json({
    data: {
      captureId: captured.captureId,
      duplicate: recorded.duplicate,
      invoiceStatus: recorded.invoice.status,
      paidTotal: recorded.invoice.paid_total,
      mock: captured.mock,
    },
  })
}
