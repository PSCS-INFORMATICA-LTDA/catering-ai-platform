import type { PaymentPurpose } from './types'

export type PublicPaymentChoice = {
  purpose: PaymentPurpose
  amount: number
  payable: boolean
  percent: number
}

export type PublicPaymentSnapshot = {
  available: boolean
  reason?: string
  currency_code: string
  total: number
  paid_total: number
  invoice_number?: string
  deposit_percent: number
  balance_percent: number
  choices: PublicPaymentChoice[]
}

export type PurposeDueAmounts = {
  depositDue: number
  balanceDue: number
  fullDue: number
}

function roundMoney(value: number) {
  return Math.round(Math.max(0, Number(value) || 0) * 100) / 100
}

export function invoicePercents(input: {
  depositAmount: number
  balanceAmount: number
  total: number
}): { deposit_percent: number; balance_percent: number } {
  const total = roundMoney(input.total)
  if (total <= 0) return { deposit_percent: 0, balance_percent: 0 }
  return {
    deposit_percent: Math.round((roundMoney(input.depositAmount) / total) * 100),
    balance_percent: Math.round((roundMoney(input.balanceAmount) / total) * 100),
  }
}

export function paymentLinkBlockReason(
  purpose: PaymentPurpose,
  amounts: PurposeDueAmounts,
): 'deposit_already_paid' | 'balance_already_paid' | 'already_paid' | null {
  const due =
    purpose === 'deposit'
      ? amounts.depositDue
      : purpose === 'balance'
        ? amounts.balanceDue
        : amounts.fullDue
  if (due > 0) return null
  if (purpose === 'deposit') return 'deposit_already_paid'
  if (purpose === 'balance') return 'balance_already_paid'
  return 'already_paid'
}

export function emptyPublicPaymentSnapshot(
  reason: string,
  currency = 'USD',
): PublicPaymentSnapshot {
  return {
    available: false,
    reason,
    currency_code: currency,
    total: 0,
    paid_total: 0,
    deposit_percent: 0,
    balance_percent: 0,
    choices: [],
  }
}

export function buildPublicPaymentSnapshot(input: {
  available: boolean
  reason?: string
  currency_code?: string
  total: number
  paid_total: number
  deposit_amount: number
  balance_amount: number
  invoice_number?: string | null
  depositDue: number
  balanceDue: number
  fullDue: number
}): PublicPaymentSnapshot {
  if (!input.available) {
    return emptyPublicPaymentSnapshot(input.reason || 'unavailable', input.currency_code)
  }

  const percents = invoicePercents({
    depositAmount: input.deposit_amount,
    balanceAmount: input.balance_amount,
    total: input.total,
  })
  const depositDue = roundMoney(input.depositDue)
  const balanceDue = roundMoney(input.balanceDue)
  const fullDue = roundMoney(input.fullDue)

  return {
    available: true,
    currency_code: (input.currency_code || 'USD').toUpperCase(),
    total: roundMoney(input.total),
    paid_total: roundMoney(input.paid_total),
    invoice_number: input.invoice_number || undefined,
    deposit_percent: percents.deposit_percent,
    balance_percent: percents.balance_percent,
    choices: [
      {
        purpose: 'deposit',
        amount: depositDue,
        payable: depositDue > 0,
        percent: percents.deposit_percent,
      },
      {
        purpose: 'balance',
        amount: balanceDue,
        payable: balanceDue > 0,
        percent: percents.balance_percent,
      },
      {
        purpose: 'full',
        amount: fullDue,
        payable: fullDue > 0,
        percent: 100,
      },
    ],
  }
}

export function publicPaymentSnapshotHasSecrets(snapshot: PublicPaymentSnapshot) {
  const json = JSON.stringify(snapshot)
  return (
    /"invoice_id"/.test(json) ||
    /"company_id"/.test(json) ||
    /"customer_id"/.test(json) ||
    /"paid_total_client"/.test(json)
  )
}

export function publicPaymentGate(input: {
  found?: boolean
  proposalSentAt?: string | null
  proposalResponse?: string | null
  quoteStatus?: string | null
}): { ok: true } | { ok: false; status: number; error: string } {
  if (!input.found) return { ok: false, status: 404, error: 'not_found' }
  if (!input.proposalSentAt) return { ok: false, status: 409, error: 'proposal_not_sent' }
  if (input.proposalResponse === 'rejected') {
    return { ok: false, status: 409, error: 'proposal_rejected' }
  }
  const status = String(input.quoteStatus || '')
    .trim()
    .toLowerCase()
  if (status === 'cancelled' || status === 'canceled' || status === 'archived') {
    return { ok: false, status: 409, error: 'quote_canceled' }
  }
  if (input.proposalResponse !== 'accepted') {
    return { ok: false, status: 409, error: 'proposal_not_accepted' }
  }
  return { ok: true }
}
