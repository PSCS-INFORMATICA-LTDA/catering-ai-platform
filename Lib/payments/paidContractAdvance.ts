import { isDepositSatisfied, isInvoiceFullyPaid } from './invoiceStatus.ts'

export type PaidContractSource =
  | 'paypal_capture'
  | 'paypal_webhook'
  | 'manual_payment'
  | 'record_payment'
  | 'commercial_review'

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
  serviceOrderPending: boolean
  serviceOrderId: string | null
  serviceOrderNumber: string | null
  paidInFull: boolean
  awaitingDeposit: boolean
  financialStatus: ContractFinancialStatus
}

export type PaidContractEnsureOutcome = {
  ok: boolean
  error: string | null
  failedStep: 'service_order' | 'agenda' | null
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

  const serviceOrderPresent = Boolean(serviceOrderId)
  const serviceOrderPending = depositPaid && !serviceOrderPresent && !canceled

  return {
    proposalAccepted: Boolean(input.proposalAccepted),
    depositPaid,
    reservationConfirmed,
    serviceOrderPresent,
    serviceOrderPending,
    serviceOrderId,
    serviceOrderNumber: input.serviceOrderNumber || null,
    paidInFull: paidInFull && !canceled,
    awaitingDeposit: Boolean(input.proposalAccepted) && !depositPaid && !canceled,
    financialStatus,
  }
}

/**
 * Paid + no OS (or failed OS/agenda) must not be reported as a successful
 * operational close. Payment itself stays completed.
 */
export function resolvePaidContractEnsureOutcome(input: {
  serviceOrderId?: string | null
  convertError?: string | null
  agendaOk: boolean
  agendaError?: string | null
}): PaidContractEnsureOutcome {
  if (!input.serviceOrderId) {
    return {
      ok: false,
      error: input.convertError || 'service_order_ensure_failed',
      failedStep: 'service_order',
    }
  }
  if (!input.agendaOk) {
    return {
      ok: false,
      error: input.agendaError || 'agenda_ensure_failed',
      failedStep: 'agenda',
    }
  }
  return { ok: true, error: null, failedStep: null }
}

/** Next capture/webhook/Zelle/Commercial Review must try again. */
export function shouldRetryPaidContractEnsure(lifecycle: ContractLifecycle): boolean {
  return lifecycle.serviceOrderPending
}

export type RecordedPaymentClose = {
  financialCompleted: boolean
  operationalAdvanceCompleted: boolean
  operationalError: string | null
}

/**
 * Money can be completed while the OS/agenda still failed.
 * Callers must not treat that as a full operational close.
 */
export function readRecordedPaymentClose(input: {
  paymentStatus: string
  depositSatisfied: boolean
  operational?: { ok: boolean; error?: string | null } | null
}): RecordedPaymentClose {
  const financialCompleted = input.paymentStatus === 'completed'
  if (!financialCompleted) {
    return {
      financialCompleted: false,
      operationalAdvanceCompleted: true,
      operationalError: null,
    }
  }
  if (!input.depositSatisfied) {
    return {
      financialCompleted: true,
      operationalAdvanceCompleted: true,
      operationalError: null,
    }
  }
  if (!input.operational) {
    return {
      financialCompleted: true,
      operationalAdvanceCompleted: false,
      operationalError: 'paid_contract_ensure_failed',
    }
  }
  if (input.operational.ok === false) {
    return {
      financialCompleted: true,
      operationalAdvanceCompleted: false,
      operationalError: input.operational.error || 'paid_contract_ensure_failed',
    }
  }
  return {
    financialCompleted: true,
    operationalAdvanceCompleted: true,
    operationalError: null,
  }
}

export function isRetryableOperationalFailure(recorded: {
  ok: boolean
  operationalAdvanceCompleted?: boolean
}): boolean {
  return recorded.ok === true && recorded.operationalAdvanceCompleted === false
}

export function paidContractEnsureFailedBody(input: {
  operationalError?: string | null
  reservation?: unknown
  financialCompleted?: boolean
}) {
  return {
    error: input.operationalError || 'paid_contract_ensure_failed',
    financialCompleted: input.financialCompleted !== false,
    operationalAdvanceCompleted: false as const,
    reservation: input.reservation ?? null,
  }
}
