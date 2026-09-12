import { createHash } from 'node:crypto'
import {
  requireApiPermission,
  resolveAuthorizedCompanyId,
} from '@/Lib/auth/requireApi'
import { assertCompanyPaypalEligible } from '@/Lib/payments/companyProviders'
import { loadCompanyPaypalCredentials } from '@/Lib/payments/companyPaypal'
import { completeInvoiceRefund } from '@/Lib/payments/manualFinance'
import { createPaypalAdapter } from '@/Lib/payments/paypal/adapter'
import { getSupabaseServerClient } from '@/Lib/supabaseServer'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type Params = { params: Promise<{ id: string; refundId: string }> }

function cents(value: unknown) {
  return Math.round((Number(value) || 0) * 100)
}

function refundRequestId(companyId: string, invoiceId: string, refundId: string) {
  return createHash('sha256')
    .update(`refund|${companyId}|${invoiceId}|${refundId}`)
    .digest('hex')
}

export async function POST(_request: Request, { params }: Params) {
  const auth = await requireApiPermission('finance.refunds.manage')
  if (!auth.ok) return auth.response

  const { id: invoiceId, refundId } = await params
  const companyId = resolveAuthorizedCompanyId(auth.session)
  const eligible = await assertCompanyPaypalEligible(companyId)
  if (!eligible.ok) return Response.json({ error: eligible.error }, { status: 403 })

  const db = getSupabaseServerClient()
  const { data: refund, error: refundError } = await db
    .from('invoice_refunds')
    .select('id, invoice_id, payment_id, amount, currency_code, status, reason, provider_refund_id')
    .eq('company_id', companyId)
    .eq('invoice_id', invoiceId)
    .eq('id', refundId)
    .maybeSingle()

  if (refundError) return Response.json({ error: refundError.message }, { status: 500 })
  if (!refund) return Response.json({ error: 'refund_not_found' }, { status: 404 })
  if (refund.status === 'completed') {
    return Response.json({
      data: {
        duplicate: true,
        refundId: refund.provider_refund_id,
        status: 'COMPLETED',
      },
    })
  }
  if (refund.status === 'canceled') {
    return Response.json({ error: 'refund_canceled' }, { status: 409 })
  }

  const { data: payment, error: paymentError } = await db
    .from('invoice_payments')
    .select('id, provider, provider_capture_id, status, amount, currency_code')
    .eq('company_id', companyId)
    .eq('invoice_id', invoiceId)
    .eq('id', refund.payment_id)
    .maybeSingle()

  if (paymentError) return Response.json({ error: paymentError.message }, { status: 500 })
  if (!payment) return Response.json({ error: 'payment_not_found' }, { status: 404 })
  if (payment.provider !== 'paypal') {
    return Response.json({ error: 'refund_provider_not_paypal' }, { status: 409 })
  }
  if (payment.status !== 'completed' || !payment.provider_capture_id) {
    return Response.json({ error: 'paypal_capture_not_refundable' }, { status: 409 })
  }
  if (
    String(refund.currency_code).toUpperCase() !== String(payment.currency_code).toUpperCase() ||
    cents(refund.amount) <= 0 ||
    cents(refund.amount) > cents(payment.amount)
  ) {
    return Response.json({ error: 'refund_amount_or_currency_invalid' }, { status: 409 })
  }

  const credentials = await loadCompanyPaypalCredentials(companyId)
  if (!credentials.clientId || !credentials.clientSecret) {
    return Response.json({ error: 'paypal_not_configured' }, { status: 409 })
  }

  // Processing is intentionally retryable. PayPal-Request-Id below is stable,
  // so a network retry cannot create a second provider refund.
  if (refund.status === 'requested' || refund.status === 'failed') {
    const { error: processingError } = await db
      .from('invoice_refunds')
      .update({ status: 'processing', updated_at: new Date().toISOString() })
      .eq('company_id', companyId)
      .eq('invoice_id', invoiceId)
      .eq('id', refundId)
      .in('status', ['requested', 'failed'])
    if (processingError) {
      return Response.json({ error: processingError.message }, { status: 500 })
    }
  }

  const adapter = createPaypalAdapter(undefined, {
    clientId: credentials.clientId,
    clientSecret: credentials.clientSecret,
  })

  let providerRefund
  try {
    providerRefund = await adapter.refundCapture({
      captureId: String(payment.provider_capture_id),
      amount: Number(refund.amount),
      currency: String(refund.currency_code),
      requestId: refundRequestId(companyId, invoiceId, refundId),
      note: refund.reason,
    })
  } catch {
    await db
      .from('invoice_refunds')
      .update({ status: 'failed', updated_at: new Date().toISOString() })
      .eq('company_id', companyId)
      .eq('invoice_id', invoiceId)
      .eq('id', refundId)
      .eq('status', 'processing')
    return Response.json({ error: 'paypal_refund_failed' }, { status: 502 })
  }

  if (
    cents(providerRefund.amount) !== cents(refund.amount) ||
    providerRefund.currency.toUpperCase() !== String(refund.currency_code).toUpperCase()
  ) {
    await db
      .from('invoice_refunds')
      .update({ status: 'failed', updated_at: new Date().toISOString() })
      .eq('company_id', companyId)
      .eq('invoice_id', invoiceId)
      .eq('id', refundId)
    return Response.json({ error: 'paypal_refund_amount_mismatch' }, { status: 409 })
  }

  if (providerRefund.status !== 'COMPLETED') {
    // A pending provider refund remains processing. A later retry or verified
    // refund webhook can complete the local ledger without duplicating money.
    return Response.json(
      {
        data: {
          refundId: providerRefund.refundId,
          status: providerRefund.status,
          pending: true,
        },
      },
      { status: 202 },
    )
  }

  const completed = await completeInvoiceRefund({
    companyId,
    invoiceId,
    refundId,
    providerRefundId: providerRefund.refundId,
    actorUserId: auth.session.userId,
  })
  if (!completed.ok) {
    // The provider already returned the money. Keep the local row processing so
    // operators cannot accidentally send another refund; deterministic provider
    // idempotency allows safe recovery on a retry.
    return Response.json(
      { error: completed.error, providerRefundId: providerRefund.refundId },
      { status: 500 },
    )
  }

  return Response.json({
    data: {
      ...completed,
      provider: 'paypal',
      environment: 'sandbox',
      providerRefundId: providerRefund.refundId,
      providerStatus: providerRefund.status,
      mock: providerRefund.mock,
    },
  })
}
