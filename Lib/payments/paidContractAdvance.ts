import { isDepositSatisfied, isInvoiceFullyPaid } from './invoiceStatus.ts'

export type PaidContractSource =
  | 'paypal_capture'
  | 'paypal_webhook'
  | 'manual_payment'
  | 'record_payment'

export type PaidContractAdvanceDecision = {
  advance: boolean
  reason:
    | 'post_event_adjustment'
    | 'deposit_unpaid'
    | 'advance'
}

export type ContractFinancialStatus =
  | 'none'
  | 'awaiting_payment'
  | 'partially_paid'
  | 'paid'
  | 'canceled'

export type ContractLifecycle = {
  proposalAccepted: boolean
  depositPaid: boolean
  reservationConfirmed: boolean
  serviceOrderPresent: boolean
  serviceOrderId: string | null
  serviceOrderNumber: string | null
  paidInFull: boolean
  awaitingDeposit: boolean
  financialStatus: ContractFinancialStatus
}

/**
 * Provider-neutral gate: only a satisfied deposit on a contractual invoice
 * may confirm reservation and ensure the canonical service order.
 */
export function shouldAdvancePaidContract(input: {
  invoiceKind?: string | null
  depositAmount: number
  paidTotal: number
}): PaidContractAdvanceDecision {
  if (input.invoiceKind === 'post_event_adjustment') {
    return { advance: false, reason: 'post_event_adjustment' }
  }
  if (
    !isDepositSatisfied({
      depositAmount: input.depositAmount,
      paidTotal: input.paidTotal,
    })
  ) {
    return { advance: false, reason: 'deposit_unpaid' }
  }
  return { advance: true, reason: 'advance' }
}

/**
 * Operator-facing lifecycle. Reservation is never shown as confirmed before
 * the canonical financial deposit is satisfied.
 */
export function readContractLifecycle(input: {
  proposalAccepted: boolean
  invoiceStatus?: string | null
  paidTotal?: number | null
  depositAmount?: number | null
  total?: number | null
  reservationConfirmedAt?: string | null
  serviceOrderId?: string | null
  serviceOrderNumber?: string | null
}): ContractLifecycle {
  const paidTotal = Number(input.paidTotal || 0)
  const depositAmount = Number(input.depositAmount || 0)
  const total = Number(input.total || 0)
  const depositPaid = isDepositSatisfied({ depositAmount, paidTotal })
  const paidInFull = isInvoiceFullyPaid({ total, paidTotal })
  const canceled = input.invoiceStatus === 'canceled'
  const serviceOrderId = input.serviceOrderId || null
  const reservationConfirmed = Boolean(input.reservationConfirmedAt) && depositPaid && !canceled

  let financialStatus: ContractFinancialStatus = 'none'
  if (canceled) financialStatus = 'canceled'
  else if (paidInFull && total > 0) financialStatus = 'paid'
  else if (depositPaid) financialStatus = 'partially_paid'
  else if (input.proposalAccepted) financialStatus = 'awaiting_payment'

  return {
    proposalAccepted: Boolean(input.proposalAccepted),
    depositPaid,
    reservationConfirmed,
    serviceOrderPresent: Boolean(serviceOrderId),
    serviceOrderId,
    serviceOrderNumber: input.serviceOrderNumber || null,
    paidInFull: paidInFull && !canceled,
    awaitingDeposit: Boolean(input.proposalAccepted) && !depositPaid && !canceled,
    financialStatus,
  }
}
