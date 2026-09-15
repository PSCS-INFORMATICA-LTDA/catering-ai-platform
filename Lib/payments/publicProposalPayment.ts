import 'server-only'

import { quoteHasPendingCoupon } from '@/Lib/coupons/resolveCoupon'
import { normalizeQuoteStatus } from '@/Lib/quotes/statusMachine'
import { createInvoiceFromQuote } from './createInvoiceFromQuote'
import { invoiceAmountContext, resolveServerPurposeAmounts } from './loadInvoiceAmountDue'
import { loadCompanyTimezone } from './loadCompanyTimezone'
import { availabilityFromInvoiceSnapshot } from './paymentPurposeAvailability'
import {
  buildPublicPaymentSnapshot,
  emptyPublicPaymentSnapshot,
  type PublicPaymentSnapshot,
} from './publicPaymentSnapshot'

export async function loadPublicProposalPaymentSnapshot(input: {
  companyId: string
  quoteId: string
  proposalResponse?: string | null
  quoteStatus?: string | null
  actorUserId?: string | null
}): Promise<PublicPaymentSnapshot> {
  const status = normalizeQuoteStatus(input.quoteStatus)
  if (status === 'cancelled' || status === 'archived') {
    return emptyPublicPaymentSnapshot('quote_canceled')
  }
  if (input.proposalResponse === 'rejected') {
    return emptyPublicPaymentSnapshot('proposal_rejected')
  }
  if (input.proposalResponse !== 'accepted') {
    return emptyPublicPaymentSnapshot('awaiting_acceptance')
  }

  const pendingCoupon = await quoteHasPendingCoupon(input.companyId, input.quoteId)
  if (!pendingCoupon.ok) {
    return emptyPublicPaymentSnapshot('coupon_approval_check_failed')
  }
  if (pendingCoupon.pending) {
    return emptyPublicPaymentSnapshot('coupon_approval_pending')
  }

  const created = await createInvoiceFromQuote({
    companyId: input.companyId,
    quoteId: input.quoteId,
    actorUserId: input.actorUserId ?? null,
  })
  if (!created.ok) {
    return emptyPublicPaymentSnapshot(created.error)
  }

  const amounts = await resolveServerPurposeAmounts(invoiceAmountContext(created.invoice))
  const timezone = await loadCompanyTimezone(input.companyId)
  const availability = availabilityFromInvoiceSnapshot({
    snapshot: created.invoice.snapshot,
    invoiceKind: created.invoice.invoice_kind,
    invoiceStatus: created.invoice.status,
    depositDue: amounts.depositDue,
    balanceDue: amounts.balanceDue,
    fullDue: amounts.fullDue,
    companyTimezone: timezone,
  })
  return buildPublicPaymentSnapshot({
    available: true,
    currency_code: created.invoice.currency_code,
    total: created.invoice.total,
    paid_total: created.invoice.paid_total,
    deposit_amount: created.invoice.deposit_amount,
    balance_amount: created.invoice.balance_amount,
    invoice_number: created.invoice.invoice_number,
    depositDue: amounts.depositDue,
    balanceDue: amounts.balanceDue,
    fullDue: amounts.fullDue,
    depositAvailable: availability.depositAvailable,
    balanceAvailable: availability.balanceAvailable,
    fullAvailable: availability.fullAvailable,
    balanceAvailableAt: availability.balanceAvailableAt,
    balanceLockReason: availability.reason,
  })
}

export async function ensureAcceptedProposalInvoice(input: {
  companyId: string
  quoteId: string
  actorUserId?: string | null
}) {
  const pendingCoupon = await quoteHasPendingCoupon(input.companyId, input.quoteId)
  if (!pendingCoupon.ok) {
    return { ok: false as const, status: 500, error: 'coupon_approval_check_failed' }
  }
  if (pendingCoupon.pending) {
    return { ok: false as const, status: 409, error: 'coupon_approval_pending' }
  }
  return createInvoiceFromQuote(input)
}
