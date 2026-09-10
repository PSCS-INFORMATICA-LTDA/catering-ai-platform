import { requireApiPermission, resolveAuthorizedCompanyId } from '@/Lib/auth/requireApi'
import { assertCompanyPaypalEligible } from '@/Lib/payments/companyProviders'
import { loadCompanyPaypalCredentials } from '@/Lib/payments/companyPaypal'
import { confirmPaidDepositReservation } from '@/Lib/payments/confirmPaidDeposit'
import { createPaypalAdapter } from '@/Lib/payments/paypal/adapter'
import { resolvePublicPaypalCheckoutReadiness } from '@/Lib/payments/paypal/publicCheckout'
import { findPaymentByProviderOrder, recordPaymentAttempt } from '@/Lib/payments/recordPayment'
import { resolvePaymentLink } from '@/Lib/payments/resolvePaymentLink'
import { createHash } from 'node:crypto'

export const dynamic = 'force-dynamic'

function cents(value: number) {
  return Math.round((Number(value) || 0) * 100)
}

function paypalRequestId(parts: string[]) {
  return createHash('sha256').update(parts.join('|')).digest('hex')
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    token?: string
    invoiceId?: string
    orderId?: string
  } | null
  if (!body?.orderId) {
    return Response.json({ error: 'order_required' }, { status: 400 })
  }

  let companyId = ''
  let invoiceId = ''
  if (body.token) {
    const resolved = await resolvePaymentLink(body.token)
    if (!resolved.ok) {
      return Response.json({ error: resolved.error }, { status: resolved.status })
    }
    const readiness = await resolvePublicPaypalCheckoutReadiness(resolved.invoice.company_id)
    if (!readiness.ready) {
      return Response.json({ error: readiness.reason }, { status: 403 })
    }
    companyId = resolved.invoice.company_id
    invoiceId = resolved.invoice.id
  } else {
    const auth = await requireApiPermission('quotes.manage')
    if (!auth.ok) return auth.response
    companyId = resolveAuthorizedCompanyId(auth.session)
    invoiceId = body.invoiceId || ''
    const eligible = await assertCompanyPaypalEligible(companyId)
    if (!eligible.ok) return Response.json({ error: eligible.error }, { status: 403 })
  }

  const existing = await findPaymentByProviderOrder(companyId, 'paypal', body.orderId)
  if (!existing) {
    return Response.json({ error: 'order_not_found' }, { status: 404 })
  }
  if (invoiceId && existing.invoice_id !== invoiceId) {
    return Response.json({ error: 'order_invoice_mismatch' }, { status: 403 })
  }
  invoiceId = existing.invoice_id

  if (existing.status === 'completed') {
    const reservation = await confirmPaidDepositReservation({
      companyId,
      invoiceId,
      source: 'paypal_capture',
      providerOrderId: existing.provider_order_id,
      providerCaptureId: existing.provider_capture_id,
    })
    return Response.json({
      data: {
        duplicate: true,
        captureId: existing.provider_capture_id,
        paymentId: existing.id,
        reservation,
      },
    })
  }

  const companyPaypal = await loadCompanyPaypalCredentials(companyId)
  if (!companyPaypal.clientId || !companyPaypal.clientSecret) {
    return Response.json({ error: 'paypal_not_configured' }, { status: 409 })
  }
  const adapter = createPaypalAdapter(undefined, {
    clientId: companyPaypal.clientId,
    clientSecret: companyPaypal.clientSecret,
  })
  const captured = await adapter.captureOrder({
    orderId: body.orderId,
    requestId: paypalRequestId(['capture', companyId, invoiceId, body.orderId]),
  })

  if (captured.status !== 'COMPLETED') {
    return Response.json({ error: 'paypal_capture_not_completed' }, { status: 409 })
  }
  if (
    cents(captured.amount) !== cents(existing.amount) ||
    captured.currency.toUpperCase() !== existing.currency_code.toUpperCase()
  ) {
    return Response.json({ error: 'paypal_capture_amount_mismatch' }, { status: 409 })
  }

  const recorded = await recordPaymentAttempt({
    companyId,
    invoiceId,
    provider: 'paypal',
    purpose: existing.purpose ?? 'deposit',
    amount: captured.amount,
    currency: captured.currency,
    status: 'completed',
    providerOrderId: captured.orderId,
    providerCaptureId: captured.captureId,
    idempotencyKey: `capture:${captured.orderId}`,
    metadata: { mock: captured.mock, verifiedAmount: true, verifiedCurrency: true },
  })
  if (!recorded.ok) {
    return Response.json({ error: recorded.error }, { status: recorded.status })
  }

  const reservation = await confirmPaidDepositReservation({
    companyId,
    invoiceId,
    source: 'paypal_capture',
    providerOrderId: captured.orderId,
    providerCaptureId: captured.captureId,
  })

  return Response.json({
    data: {
      captureId: captured.captureId,
      duplicate: recorded.duplicate,
      invoiceStatus: recorded.invoice.status,
      paidTotal: recorded.invoice.paid_total,
      reservation,
      mock: captured.mock,
    },
  })
}
