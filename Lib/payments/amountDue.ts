import type { PaymentPurpose } from './types'
import { isInvoiceFullyPaid } from './invoiceStatus'

export type AmountDueInput = {
  total: number
  depositAmount: number
  paidTotal: number
  purpose: PaymentPurpose
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

/** Server-side only. Browser-supplied amounts must be discarded. */
export function resolveAmountDue(input: AmountDueInput): AmountDueResult {
  const total = roundMoney(input.total)
  const deposit = roundMoney(input.depositAmount)
  const paid = roundMoney(input.paidTotal)
  const remaining = roundMoney(total - paid)

  if (isInvoiceFullyPaid({ total, paidTotal: paid }) || remaining <= 0) {
    return {
      purpose: input.purpose,
      amount: 0,
      currencySafe: true,
      reason: 'already_paid',
    }
  }

  if (input.purpose === 'deposit') {
    const depositRemaining = roundMoney(deposit - paid)
    if (depositRemaining <= 0) {
      return {
        purpose: 'deposit',
        amount: 0,
        currencySafe: true,
        reason: 'deposit_already_paid',
      }
    }
    return {
      purpose: 'deposit',
      amount: Math.min(depositRemaining, remaining),
      currencySafe: true,
      reason: 'deposit',
    }
  }

  if (input.purpose === 'balance') {
    return {
      purpose: 'balance',
      amount: remaining,
      currencySafe: true,
      reason: remaining > 0 ? 'balance' : 'nothing_due',
    }
  }

  return {
    purpose: 'full',
    amount: remaining,
    currencySafe: true,
    reason: remaining > 0 ? 'full' : 'nothing_due',
  }
}

export function defaultPaymentPurpose(input: {
  depositAmount: number
  paidTotal: number
  total: number
}): PaymentPurpose {
  if (isInvoiceFullyPaid(input)) return 'full'
  if (roundMoney(input.paidTotal) + 0.009 >= roundMoney(input.depositAmount)) {
    return 'balance'
  }
  return 'deposit'
}

/** Anything the browser sends as amount is ignored. */
export function ignoreClientAmount(clientAmount: unknown): null {
  void clientAmount
  return null
}
