import { requireApiPermission, resolveAuthorizedCompanyId } from '@/Lib/auth/requireApi'
import { ignoreClientAmount } from '@/Lib/payments/amountDue'
import { resolveServerAmountDue, resolveServerPurposeAmounts } from '@/Lib/payments/loadInvoiceAmountDue'
import { loadCompanyTimezone } from '@/Lib/payments/loadCompanyTimezone'
import {
  availabilityFromInvoiceSnapshot,
  isPurposeAvailable,
} from '@/Lib/payments/paymentPurposeAvailability'
import type { InvoiceSnapshot } from '@/Lib/payments/types'
import { assertCompanyPaypalEligible } from '@/Lib/payments/companyProviders'
import { loadCompanyPaypalCredentials } from '@/Lib/payments/companyPaypal'
import { assertInvoiceAcceptsPayment } from '@/Lib/payments/invoiceCancellation'
import { createPaypalAdapter } from '@/Lib/payments/paypal/adapter'
import { resolvePublicPaypalCheckoutReadiness } from '@/Lib/payments/paypal/publicCheckout'
import { isPaypalSandboxRequestError } from '@/Lib/payments/paypal/sandboxError'
import { logPaypalSandbox } from '@/Lib/payments/paypal/sandboxLog'
import { isPaymentPurpose } from '@/Lib/payments/paymentLinks'
import { recordPaymentAttempt } from '@/Lib/payments/recordPayment'
import { resolvePaymentLink } from '@/Lib/payments/resolvePaymentLink'
import {
  acquirePaymentScheduleHold,
  releasePaymentScheduleHold,
} from '@/Lib/payments/scheduleHold'
import type { InvoiceKind } from '@/Lib/payments/types'
import { createHash } from 'node:crypto'

export const dynamic = 'force-dynamic'

function paypalRequestId(parts: Array<string | number>) {
  return createHash('sha256').update(parts.join('|')).digest('hex')
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    token?: string
    invoiceId?: string
    purpose?: string
    amount?: unknown
  } | null

  ignoreClientAmount(body?.amount)

  let companyId = ''
  let invoiceId = ''
  let invoiceKind: InvoiceKind = 'original'
  let invoiceStatus = ''
  let invoiceSnapshot: InvoiceSnapshot | null = null
  let purpose = isPaymentPurpose(body?.purpose) ? body.purpose : 'deposit'
  let invoiceNumber = ''
  let currency = 'USD'
  let total = 0
  let depositAmount = 0
  let balanceAmount = 0
  let paidTotal = 0
  let paymentLinkId = 'operator'

  if (body?.token) {
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
    invoiceKind = resolved.invoice.invoice_kind
    invoiceStatus = resolved.invoice.status
    invoiceSnapshot = resolved.invoice.snapshot
    purpose = resolved.link.purpose
    invoiceNumber = resolved.invoice.invoice_number
    currency = resolved.invoice.currency_code
    total = resolved.invoice.total
    depositAmount = resolved.invoice.deposit_amount
    balanceAmount = resolved.invoice.balance_amount
    paidTotal = resolved.invoice.paid_total
    paymentLinkId = resolved.link.id
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
    if (invoice.status === 'paid' || invoice.status === 'canceled') {
      return Response.json({ error: 'invoice_not_payable' }, { status: 409 })
    }
    invoiceId = invoice.id
    invoiceKind = invoice.invoice_kind
    invoiceStatus = invoice.status
    invoiceSnapshot = invoice.snapshot
    invoiceNumber = invoice.invoice_number
    currency = invoice.currency_code
    total = invoice.total
    depositAmount = invoice.deposit_amount
    balanceAmount = invoice.balance_amount
    paidTotal = invoice.paid_total
    const eligible = await assertCompanyPaypalEligible(companyId)
    if (!eligible.ok) return Response.json({ error: eligible.error }, { status: 403 })
  }

  const acceptsPayment = await assertInvoiceAcceptsPayment(companyId, invoiceId)
  if (!acceptsPayment.ok) {
    return Response.json({ error: acceptsPayment.error }, { status: 409 })
  }

  if (!/^[A-Z]{3}$/.test(currency)) {
    return Response.json({ error: 'invalid_currency' }, { status: 409 })
  }

  const due = await resolveServerAmountDue(
    {
      companyId,
      invoiceId,
      total,
      depositAmount,
      balanceAmount,
      paidTotal,
    },
    purpose,
  )
  if (due.amount <= 0) {
    return Response.json({ error: due.reason }, { status: 409 })
  }

  const timezone = await loadCompanyTimezone(companyId)
  const purposeAmounts = await resolveServerPurposeAmounts({
    companyId,
    invoiceId,
    total,
    depositAmount,
    balanceAmount,
    paidTotal,
  })
  const availability = availabilityFromInvoiceSnapshot({
    snapshot: invoiceSnapshot,
    invoiceKind,
    invoiceStatus,
    depositDue: purposeAmounts.depositDue,
    balanceDue: purposeAmounts.balanceDue,
    fullDue: purposeAmounts.fullDue,
    companyTimezone: timezone,
  })
  if (!isPurposeAvailable(availability, purpose)) {
    return Response.json(
      {
        error: availability.reason || 'balance_not_available_yet',
        available_at: availability.balanceAvailableAt,
      },
      { status: 409 },
    )
  }

  const companyPaypal = await loadCompanyPaypalCredentials(companyId)
  if (!companyPaypal.clientId || !companyPaypal.clientSecret) {
    return Response.json({ error: 'paypal_not_configured' }, { status: 409 })
  }

  // Initial-event checkout revalidates operational capacity. A post-event
  // supplemental invoice is purely financial and must never reserve the agenda again.
  const postEventPayment = invoiceKind === 'post_event_adjustment'
  const hold = postEventPayment
    ? { ok: true as const, status: 'already_reserved' as const, holdId: null, expiresAt: null }
    : await acquirePaymentScheduleHold({
        companyId,
        invoiceId,
        paymentLinkId: paymentLinkId === 'operator' ? null : paymentLinkId,
        holdSeconds: 900,
      })
  if (!hold.ok) {
    return Response.json(
      { error: hold.status === 'unavailable' ? 'schedule_unavailable_for_payment' : 'schedule_hold_failed' },
      { status: hold.status === 'unavailable' ? 409 : 503 },
    )
  }

  const requestId = paypalRequestId([
    'create',
    companyId,
    invoiceId,
    paymentLinkId,
    purpose,
    due.amount.toFixed(2),
    paidTotal.toFixed(2),
  ])
  const adapter = createPaypalAdapter(undefined, {
    clientId: companyPaypal.clientId,
    clientSecret: companyPaypal.clientSecret,
  })

  try {
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
        paymentLinkId,
        invoiceKind,
        scheduleHoldId: hold.holdId ?? null,
        scheduleHoldExpiresAt: hold.expiresAt ?? null,
        scheduleHoldStatus: postEventPayment ? 'not_required_post_event' : hold.status,
        clientFingerprint: createHash('sha256')
          .update(request.headers.get('user-agent') || 'unknown')
          .digest('hex')
          .slice(0, 16),
      },
    })
    if (!recorded.ok) {
      if (!postEventPayment) {
        await releasePaymentScheduleHold({
          companyId,
          invoiceId,
          reason: 'payment_attempt_record_failed',
        })
      }
      return Response.json({ error: recorded.error }, { status: recorded.status })
    }

    logPaypalSandbox({
      action: 'create_order',
      requestId,
      invoiceId,
      purpose,
      orderId: order.orderId,
      environment: 'sandbox',
      httpStatus: 201,
      result: recorded.duplicate ? 'duplicate' : 'created',
    })

    return Response.json({
      data: {
        orderId: order.orderId,
        amount: due.amount,
        currency,
        purpose,
        duplicate: recorded.duplicate,
        mock: order.mock,
        publicCheckout: Boolean(body?.token),
        scheduleHoldExpiresAt: hold.expiresAt ?? null,
        scheduleHoldRequired: !postEventPayment,
        requestId,
      },
    })
  } catch (error) {
    const issue = isPaypalSandboxRequestError(error) ? error.issue : null
    logPaypalSandbox({
      action: 'create_order',
      requestId,
      invoiceId,
      purpose,
      orderId: issue?.orderId,
      environment: 'sandbox',
      httpStatus: issue?.httpStatus,
      paypalName: issue?.paypalName,
      debugId: issue?.debugId,
      issue: issue?.issue,
      result: 'failed',
    })
    if (!postEventPayment) {
      await releasePaymentScheduleHold({
        companyId,
        invoiceId,
        reason: 'paypal_order_create_failed',
      })
    }
    return Response.json({ error: 'paypal_create_order_failed', requestId }, { status: 502 })
  }
}
