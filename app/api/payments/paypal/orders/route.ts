import { requireApiPermission, resolveAuthorizedCompanyId } from '@/Lib/auth/requireApi'
import { ignoreClientAmount, resolveAmountDue } from '@/Lib/payments/amountDue'
import { assertCompanyPaypalEligible } from '@/Lib/payments/companyProviders'
import { loadCompanyPaypalCredentials } from '@/Lib/payments/companyPaypal'
import { createPaypalAdapter } from '@/Lib/payments/paypal/adapter'
import { readPaypalRuntimeConfig } from '@/Lib/payments/paypal/config'
import { isPaymentPurpose } from '@/Lib/payments/paymentLinks'
import { recordPaymentAttempt } from '@/Lib/payments/recordPayment'
import { resolvePaymentLink } from '@/Lib/payments/resolvePaymentLink'
import { createHash, randomUUID } from 'node:crypto'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    token?: string
    invoiceId?: string
    purpose?: string
    amount?: unknown
  } | null

  ignoreClientAmount(body?.amount)

  const runtime = readPaypalRuntimeConfig()
  if (runtime.liveBlocked) {
    return Response.json({ error: 'paypal_live_blocked' }, { status: 403 })
  }

  let companyId = ''
  let invoiceId = ''
  let purpose = isPaymentPurpose(body?.purpose) ? body.purpose : 'deposit'
  let invoiceNumber = ''
  let currency = 'USD'
  let total = 0
  let depositAmount = 0
  let paidTotal = 0

  if (body?.token) {
    if (!runtime.publicCheckout) {
      return Response.json({ error: 'paypal_public_checkout_off' }, { status: 403 })
    }
    const resolved = await resolvePaymentLink(body.token)
    if (!resolved.ok) {
      return Response.json({ error: resolved.error }, { status: resolved.status })
    }
    companyId = resolved.invoice.company_id
    invoiceId = resolved.invoice.id
    purpose = resolved.link.purpose
    invoiceNumber = resolved.invoice.invoice_number
    currency = resolved.invoice.currency_code
    total = resolved.invoice.total
    depositAmount = resolved.invoice.deposit_amount
    paidTotal = resolved.invoice.paid_total
  } else {
    const auth = await requireApiPermission('quotes.manage')
    if (!auth.ok) return auth.response
    if (!body?.invoiceId) {
      return Response.json({ error: 'invoice_required' }, { status: 400 })
    }
    companyId = resolveAuthorizedCompanyId(auth.session)
    const { loadCompanyInvoice } = await import('@/Lib/payments/createInvoiceFromQuote')
    const invoice = await loadCompanyInvoice(companyId, body.invoiceId)
    if (!invoice) return Response.json({ error: 'not_found' }, { status: 404 })
    invoiceId = invoice.id
    invoiceNumber = invoice.invoice_number
    currency = invoice.currency_code
    total = invoice.total
    depositAmount = invoice.deposit_amount
    paidTotal = invoice.paid_total
  }

  const eligible = await assertCompanyPaypalEligible(companyId)
  if (!eligible.ok) {
    return Response.json({ error: eligible.error }, { status: 403 })
  }

  const due = resolveAmountDue({
    total,
    depositAmount,
    paidTotal,
    purpose,
  })
  if (due.amount <= 0) {
    return Response.json({ error: due.reason }, { status: 409 })
  }

  const requestId = randomUUID()
  const companyPaypal = await loadCompanyPaypalCredentials(companyId)
  const adapter = createPaypalAdapter(runtime, {
    clientId: companyPaypal.clientId,
    clientSecret: companyPaypal.clientSecret,
  })
  const order = await adapter.createOrder({
    companyId,
    invoiceId,
    invoiceNumber,
    amount: due.amount,
    currency,
    purpose,
    requestId,
  })

  const recorded = await recordPaymentAttempt({
    companyId,
    invoiceId,
    provider: 'paypal',
    purpose,
    amount: due.amount,
    currency,
    status: 'created',
    providerOrderId: order.orderId,
    idempotencyKey: `create:${order.orderId}`,
    metadata: {
      requestId,
      mock: order.mock,
      clientFingerprint: createHash('sha256')
        .update(request.headers.get('user-agent') || 'unknown')
        .digest('hex')
        .slice(0, 16),
    },
  })

  if (!recorded.ok) {
    return Response.json({ error: recorded.error }, { status: recorded.status })
  }

  return Response.json({
    data: {
      orderId: order.orderId,
      amount: due.amount,
      currency,
      purpose,
      mock: order.mock,
      publicCheckout: runtime.publicCheckout,
    },
  })
}
