import type { InvoiceStatus } from './types'

const ALLOWED: Record<InvoiceStatus, InvoiceStatus[]> = {
  draft: ['ready', 'awaiting_deposit', 'canceled'],
  ready: ['awaiting_deposit', 'canceled'],
  awaiting_deposit: ['partially_paid', 'paid', 'canceled'],
  partially_paid: ['paid', 'canceled'],
  paid: [],
  canceled: [],
}

export function isInvoiceStatus(value: string | null | undefined): value is InvoiceStatus {
  return (
    value === 'draft' ||
    value === 'ready' ||
    value === 'awaiting_deposit' ||
    value === 'partially_paid' ||
    value === 'paid' ||
    value === 'canceled'
  )
}

export function canTransitionInvoiceStatus(
  from: InvoiceStatus,
  to: InvoiceStatus,
): boolean {
  if (from === to) return true
  return ALLOWED[from]?.includes(to) ?? false
}

export function deriveInvoiceStatus(input: {
  current?: InvoiceStatus | null
  total: number
  depositAmount: number
  paidTotal: number
  canceled?: boolean
}): InvoiceStatus {
  if (input.canceled) return 'canceled'
  const paid = roundMoney(input.paidTotal)
  const total = roundMoney(input.total)
  if (paid <= 0) return input.current === 'ready' ? 'ready' : 'awaiting_deposit'
  if (paid + 0.009 >= total) return 'paid'
  return 'partially_paid'
}

export function isDepositSatisfied(input: {
  depositAmount: number
  paidTotal: number
}): boolean {
  return roundMoney(input.paidTotal) + 0.009 >= roundMoney(input.depositAmount)
}

export function isInvoiceFullyPaid(input: {
  total: number
  paidTotal: number
}): boolean {
  return roundMoney(input.paidTotal) + 0.009 >= roundMoney(input.total)
}

function roundMoney(value: number) {
  return Math.round((Number(value) || 0) * 100) / 100
}
