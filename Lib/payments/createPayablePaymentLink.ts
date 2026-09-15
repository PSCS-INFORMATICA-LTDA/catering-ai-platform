import 'server-only'

import { loadCompanyInvoice } from './createInvoiceFromQuote'
import { invoiceAmountContext, resolveServerPurposeAmounts } from './loadInvoiceAmountDue'
import {
  createPaymentLinkToken,
  defaultPaymentLinkExpiry,
  hashPaymentLinkToken,
} from './paymentLinks'
import { loadCompanyTimezone } from './loadCompanyTimezone'
import { isPurposeAvailable, availabilityFromInvoiceSnapshot } from './paymentPurposeAvailability'
import { paymentLinkBlockReason } from './publicPaymentSnapshot'
import { createInvoicePaymentLink } from './resolvePaymentLink'
import type { PaymentPurpose } from './types'

export type PayablePaymentLinkResult =
  | {
      ok: true
      id: string
      purpose: PaymentPurpose
      url: string
      token: string
      amount: number
      currency: string
      deposit_due: number
      balance_due: number
      full_due: number
    }
  | {
      ok: false
      status: number
      error: string
      deposit_due?: number
      balance_due?: number
      full_due?: number
      available_at?: string | null
    }

export async function createPayablePaymentLink(input: {
  companyId: string
  invoiceId: string
  purpose: PaymentPurpose
  origin: string
  actorUserId?: string | null
  expires?: boolean
}): Promise<PayablePaymentLinkResult> {
  const invoice = await loadCompanyInvoice(input.companyId, input.invoiceId)
  if (!invoice) return { ok: false, status: 404, error: 'not_found' }
  if (invoice.status === 'canceled') {
    return { ok: false, status: 409, error: 'invoice_canceled' }
  }

  const amounts = await resolveServerPurposeAmounts(invoiceAmountContext(invoice))
  const blocked = paymentLinkBlockReason(input.purpose, amounts)
  if (blocked) {
    return {
      ok: false,
      status: 409,
      error: blocked,
      deposit_due: amounts.depositDue,
      balance_due: amounts.balanceDue,
      full_due: amounts.fullDue,
    }
  }

  const timezone = await loadCompanyTimezone(input.companyId)
  const availability = availabilityFromInvoiceSnapshot({
    snapshot: invoice.snapshot,
    invoiceKind: invoice.invoice_kind,
    invoiceStatus: invoice.status,
    depositDue: amounts.depositDue,
    balanceDue: amounts.balanceDue,
    fullDue: amounts.fullDue,
    companyTimezone: timezone,
  })
  if (!isPurposeAvailable(availability, input.purpose)) {
    return {
      ok: false,
      status: 409,
      error: availability.reason || 'balance_not_available_yet',
      deposit_due: amounts.depositDue,
      balance_due: amounts.balanceDue,
      full_due: amounts.fullDue,
      available_at: availability.balanceAvailableAt,
    }
  }

  const rawToken = createPaymentLinkToken()
  const created = await createInvoicePaymentLink({
    companyId: input.companyId,
    invoiceId: invoice.id,
    purpose: input.purpose,
    rawToken,
    tokenHash: hashPaymentLinkToken(rawToken),
    expiresAt: input.expires === false ? null : defaultPaymentLinkExpiry(),
    actorUserId: input.actorUserId ?? null,
  })
  if (!created.ok) {
    return { ok: false, status: 500, error: created.error }
  }

  const amount =
    input.purpose === 'deposit'
      ? amounts.depositDue
      : input.purpose === 'balance'
        ? amounts.balanceDue
        : amounts.fullDue

  return {
    ok: true,
    id: created.id,
    purpose: input.purpose,
    url: `${input.origin.replace(/\/$/, '')}/pay/${rawToken}`,
    token: rawToken,
    amount,
    currency: invoice.currency_code,
    deposit_due: amounts.depositDue,
    balance_due: amounts.balanceDue,
    full_due: amounts.fullDue,
  }
}
