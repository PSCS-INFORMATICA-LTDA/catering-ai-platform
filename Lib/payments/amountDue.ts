import type { PaymentPurpose } from './types'
import { isInvoiceFullyPaid } from './invoiceStatus.ts'

/** Status the ledger already treats as financially captured. Do not invent others. */
export function isCompletedPaymentStatus(
  status: string | null | undefined,
): boolean {
  return status === 'completed'
}

/** Refunds only reduce purpose-paid totals when the refund itself is completed. */
export function isCompletedRefundStatus(
  status: string | null | undefined,
): boolean {
  return status === 'completed'
}

export type PaidByPurpose = {
  deposit: number
  balance: number
  full: number
}

export type AmountDueInput = {
  total: number
  depositAmount: number
  balanceAmount?: number
  paidTotal: number
  purpose: PaymentPurpose
  paidByPurpose?: PaidByPurpose | null
}

export type PurposeAmounts = {
  remaining: number
  depositDue: number
  balanceDue: number
  fullDue: number
  paidByPurpose: PaidByPurpose
}

export type AmountDueResult = {
  purpose: PaymentPurpose
  amount: number
  currencySafe: true
  reason:
    | 'deposit'
    | 'balance'
    | 'full'
    | 'already_paid'
    | 'deposit_already_paid'
    | 'nothing_due'
}

function roundMoney(value: number) {
  return Math.round(Math.max(0, Number(value) || 0) * 100) / 100
}

function emptyPaidByPurpose(): PaidByPurpose {
  return { deposit: 0, balance: 0, full: 0 }
}

function asPurpose(value: string | null | undefined): PaymentPurpose | null {
  return value === 'deposit' || value === 'balance' || value === 'full'
    ? value
    : null
}

/**
 * Sum completed ledger rows by invoice_payments.purpose.
 * Completed refunds reduce the purpose of their source payment_id.
 * Duplicate ids (retry/idempotency) count once.
 */
export function paidByPurposeFromLedger(
  payments: Array<{
    id?: string | null
    purpose?: string | null
    amount?: number | null
    status?: string | null
  }>,
  refunds: Array<{
    payment_id?: string | null
    amount?: number | null
    status?: string | null
  }> = [],
): PaidByPurpose {
  const unique = new Map<string, { purpose: PaymentPurpose; amount: number }>()
  const anonymous: Array<{ purpose: PaymentPurpose; amount: number }> = []

  for (const payment of payments) {
    if (!isCompletedPaymentStatus(payment.status)) continue
    const purpose = asPurpose(payment.purpose)
    if (!purpose) continue
    const amount = roundMoney(Number(payment.amount) || 0)
    const id = String(payment.id || '').trim()
    if (id) {
      if (unique.has(id)) continue
      unique.set(id, { purpose, amount })
      continue
    }
    anonymous.push({ purpose, amount })
  }

  const paid = emptyPaidByPurpose()
  for (const row of [...unique.values(), ...anonymous]) {
    paid[row.purpose] = roundMoney(paid[row.purpose] + row.amount)
  }

  const refundedByPayment = new Map<string, number>()
  for (const refund of refunds) {
    if (!isCompletedRefundStatus(refund.status)) continue
    const paymentId = String(refund.payment_id || '').trim()
    if (!paymentId) continue
    refundedByPayment.set(
      paymentId,
      roundMoney((refundedByPayment.get(paymentId) || 0) + (Number(refund.amount) || 0)),
    )
  }

  for (const [paymentId, refunded] of refundedByPayment) {
    const source = unique.get(paymentId)
    if (!source) continue
    paid[source.purpose] = roundMoney(Math.max(0, paid[source.purpose] - refunded))
  }

  return paid
}

/** Fallback only when the ledger is unavailable. paid_total fills deposit, then balance. */
export function waterfallPaidByPurpose(input: {
  depositAmount: number
  balanceAmount: number
  paidTotal: number
}): PaidByPurpose {
  const deposit = roundMoney(input.depositAmount)
  const balance = roundMoney(input.balanceAmount)
  const paid = roundMoney(input.paidTotal)
  return {
    deposit: roundMoney(Math.min(paid, deposit)),
    balance: roundMoney(Math.min(Math.max(0, paid - deposit), balance)),
    full: 0,
  }
}

export function resolvePurposeAmounts(input: {
  total: number
  depositAmount: number
  balanceAmount?: number
  paidTotal: number
  paidByPurpose?: PaidByPurpose | null
}): PurposeAmounts {
  const total = roundMoney(input.total)
  const deposit = roundMoney(input.depositAmount)
  const balance = roundMoney(
    input.balanceAmount == null ? Math.max(0, total - deposit) : input.balanceAmount,
  )
  const paidTotal = roundMoney(input.paidTotal)
  const remaining = roundMoney(Math.max(0, total - paidTotal))
  const paidByPurpose = input.paidByPurpose
    ? {
        deposit: roundMoney(input.paidByPurpose.deposit),
        balance: roundMoney(input.paidByPurpose.balance),
        full: roundMoney(input.paidByPurpose.full),
      }
    : waterfallPaidByPurpose({
        depositAmount: deposit,
        balanceAmount: balance,
        paidTotal,
      })

  return {
    remaining,
    depositDue: Math.min(roundMoney(Math.max(0, deposit - paidByPurpose.deposit)), remaining),
    balanceDue: Math.min(roundMoney(Math.max(0, balance - paidByPurpose.balance)), remaining),
    fullDue: remaining,
    paidByPurpose,
  }
}

export function invoiceDueApiFields(input: {
  total: number
  depositAmount: number
  balanceAmount?: number
  paidTotal: number
  paidByPurpose?: PaidByPurpose | null
}) {
  const amounts = resolvePurposeAmounts(input)
  return {
    deposit_due: amounts.depositDue,
    balance_due: amounts.balanceDue,
    full_due: amounts.fullDue,
  }
}

/** Server-side only. Browser-supplied amounts must be discarded. */
export function resolveAmountDue(input: AmountDueInput): AmountDueResult {
  const amounts = resolvePurposeAmounts(input)
  if (isInvoiceFullyPaid({ total: input.total, paidTotal: input.paidTotal }) || amounts.remaining <= 0) {
    return {
      purpose: input.purpose,
      amount: 0,
      currencySafe: true,
      reason: 'already_paid',
    }
  }

  if (input.purpose === 'deposit') {
    if (amounts.depositDue <= 0) {
      return {
        purpose: 'deposit',
        amount: 0,
        currencySafe: true,
        reason: 'deposit_already_paid',
      }
    }
    return {
      purpose: 'deposit',
      amount: amounts.depositDue,
      currencySafe: true,
      reason: 'deposit',
    }
  }

  if (input.purpose === 'balance') {
    return {
      purpose: 'balance',
      amount: amounts.balanceDue,
      currencySafe: true,
      reason: amounts.balanceDue > 0 ? 'balance' : 'nothing_due',
    }
  }

  return {
    purpose: 'full',
    amount: amounts.fullDue,
    currencySafe: true,
    reason: amounts.fullDue > 0 ? 'full' : 'nothing_due',
  }
}

export function defaultPaymentPurpose(input: {
  depositAmount: number
  paidTotal: number
  total: number
  balanceAmount?: number
  paidByPurpose?: PaidByPurpose | null
}): PaymentPurpose {
  const amounts = resolvePurposeAmounts(input)
  if (amounts.fullDue <= 0 || isInvoiceFullyPaid(input)) return 'full'
  if (amounts.depositDue > 0) return 'deposit'
  if (amounts.balanceDue > 0) return 'balance'
  return 'full'
}

/** Anything the browser sends as amount is ignored. */
export function ignoreClientAmount(clientAmount: unknown): null {
  void clientAmount
  return null
}
