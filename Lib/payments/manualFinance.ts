import 'server-only'

import { createHash, randomUUID } from 'node:crypto'
import { writeOperationalAudit } from '@/Lib/orders/writeOperationalAudit'
import { confirmQuoteDepositAndReserveSchedule } from '@/Lib/quotes/confirmQuoteDepositAndReserveSchedule'
import { getSupabaseServerClient } from '@/Lib/supabaseServer'
import type { PaymentPurpose } from './types'

export type ManualPaymentProvider = 'zelle' | 'bank_transfer'

type RpcJson = Record<string, unknown>

function money(value: unknown) {
  const number = Number(value ?? 0)
  return Number.isFinite(number) ? Math.round(number * 100) / 100 : 0
}

function normalizePurpose(value: unknown): PaymentPurpose | null {
  return value === 'deposit' || value === 'balance' || value === 'full'
    ? value
    : null
}

function rpcJson(value: unknown): RpcJson {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as RpcJson)
    : {}
}

const KNOWN_RPC_ERRORS = [
  'invalid_manual_provider',
  'invalid_purpose',
  'confirmation_reference_required',
  'actor_required',
  'idempotency_key_required',
  'invoice_not_found',
  'invoice_canceled',
  'invoice_cancellation_pending',
  'already_paid',
  'deposit_already_paid',
  'refund_reason_required',
  'refund_requires_completed_payment',
  'refund_amount_exceeds_available',
  'refund_reference_required',
  'refund_not_found',
  'refund_canceled',
  'cancellation_reason_required',
  'service_order_cancellation_required',
] as const

function rpcErrorCode(message: string | null | undefined) {
  const raw = message || 'finance_rpc_failed'
  return KNOWN_RPC_ERRORS.find((code) => raw.includes(code)) || raw
}

function rpcErrorStatus(code: string) {
  if (code === 'invoice_not_found' || code === 'refund_not_found') return 404
  if (
    code === 'invalid_manual_provider' ||
    code === 'invalid_purpose' ||
    code === 'confirmation_reference_required' ||
    code === 'actor_required' ||
    code === 'idempotency_key_required' ||
    code === 'refund_reason_required' ||
    code === 'refund_reference_required' ||
    code === 'cancellation_reason_required'
  ) {
    return 400
  }
  if (
    code === 'invoice_canceled' ||
    code === 'invoice_cancellation_pending' ||
    code === 'already_paid' ||
    code === 'deposit_already_paid' ||
    code === 'refund_requires_completed_payment' ||
    code === 'refund_amount_exceeds_available' ||
    code === 'refund_canceled' ||
    code === 'service_order_cancellation_required'
  ) {
    return 409
  }
  return 500
}

export async function reconcileInvoiceLedger(companyId: string, invoiceId: string) {
  const db = getSupabaseServerClient()
  const { error } = await db.rpc('reconcile_invoice_ledger', {
    p_company_id: companyId,
    p_invoice_id: invoiceId,
  })
  if (error) return { ok: false as const, error: rpcErrorCode(error.message) }

  const { data: invoice, error: invoiceError } = await db
    .from('invoices')
    .select('id, quote_id, status, total, deposit_amount, paid_total, currency_code')
    .eq('company_id', companyId)
    .eq('id', invoiceId)
    .maybeSingle()

  if (invoiceError || !invoice) {
    return {
      ok: false as const,
      error: invoiceError?.message || 'invoice_not_found',
    }
  }

  return { ok: true as const, invoice }
}

/**
 * Confirms an externally verified Zelle/bank receipt.
 * Amount and ledger mutation are server-owned and committed atomically in Postgres.
 * Reservation sync runs afterwards and is idempotent; a scheduling failure never
 * rolls back evidence that money was already received.
 */
export async function recordManualPayment(input: {
  companyId: string
  invoiceId: string
  provider: ManualPaymentProvider
  purpose: PaymentPurpose
  confirmationReference: string
  confirmationNote?: string | null
  actorUserId: string
}) {
  const reference = input.confirmationReference.trim()
  if (reference.length < 3) {
    return { ok: false as const, status: 400, error: 'confirmation_reference_required' }
  }
  const purpose = normalizePurpose(input.purpose)
  if (!purpose) return { ok: false as const, status: 400, error: 'invalid_purpose' }

  const referenceHash = createHash('sha256')
    .update(`${input.provider}|${reference.toLowerCase()}`)
    .digest('hex')
    .slice(0, 32)
  const idempotencyKey = `manual:${input.invoiceId}:${referenceHash}`
  const db = getSupabaseServerClient()

  const { data, error } = await db.rpc('record_manual_invoice_payment', {
    p_company_id: input.companyId,
    p_invoice_id: input.invoiceId,
    p_provider: input.provider,
    p_purpose: purpose,
    p_confirmation_reference: reference,
    p_confirmation_note: input.confirmationNote?.trim() || null,
    p_actor_user_id: input.actorUserId,
    p_idempotency_key: idempotencyKey,
  })

  if (error) {
    const code = rpcErrorCode(error.message)
    return { ok: false as const, status: rpcErrorStatus(code), error: code }
  }

  const result = rpcJson(data)
  const paymentId = typeof result.payment_id === 'string' ? result.payment_id : input.invoiceId
  const quoteId = typeof result.quote_id === 'string' ? result.quote_id : null
  const paidTotal = money(result.paid_total)
  const depositAmount = money(result.deposit_amount)
  const duplicate = result.duplicate === true

  let reservation: unknown = null
  if (quoteId && depositAmount > 0 && paidTotal + 0.009 >= depositAmount) {
    reservation = await confirmQuoteDepositAndReserveSchedule({
      companyId: input.companyId,
      quoteId,
      actorUserId: input.actorUserId,
    }).catch((err) => ({
      ok: false,
      error: err instanceof Error ? err.message : 'reservation_sync_failed',
    }))
  }

  await writeOperationalAudit({
    companyId: input.companyId,
    actorUserId: input.actorUserId,
    entityType: 'invoice_payment',
    entityId: paymentId,
    action: 'manual_payment_reconciled',
    newData: {
      invoice_id: input.invoiceId,
      provider: input.provider,
      purpose,
      amount: money(result.amount),
      confirmation_reference: reference,
      duplicate,
      reservation,
    },
  })

  return {
    ok: true as const,
    duplicate,
    paymentId,
    amount: money(result.amount),
    invoice: {
      id: input.invoiceId,
      quote_id: quoteId,
      status: String(result.invoice_status || ''),
      paid_total: paidTotal,
      deposit_amount: depositAmount,
    },
    reservation,
  }
}

/** Reserve a refund amount atomically against the captured payment. */
export async function requestInvoiceRefund(input: {
  companyId: string
  invoiceId: string
  paymentId: string
  amount?: number | null
  reason: string
  actorUserId: string
  idempotencyKey?: string | null
}) {
  const reason = input.reason.trim()
  if (reason.length < 3) {
    return { ok: false as const, status: 400, error: 'refund_reason_required' }
  }

  const requestKey = (input.idempotencyKey || randomUUID()).trim()
  const idempotencyKey = `refund:${input.invoiceId}:${input.paymentId}:${requestKey}`
  const db = getSupabaseServerClient()
  const requestedAmount = input.amount == null ? null : money(input.amount)

  const { data, error } = await db.rpc('request_invoice_refund_transaction', {
    p_company_id: input.companyId,
    p_invoice_id: input.invoiceId,
    p_payment_id: input.paymentId,
    p_amount: requestedAmount,
    p_reason: reason,
    p_actor_user_id: input.actorUserId,
    p_idempotency_key: idempotencyKey,
  })

  if (error) {
    const code = rpcErrorCode(error.message)
    return { ok: false as const, status: rpcErrorStatus(code), error: code }
  }

  const result = rpcJson(data)
  const refundId = typeof result.refund_id === 'string' ? result.refund_id : input.paymentId
  const duplicate = result.duplicate === true

  await writeOperationalAudit({
    companyId: input.companyId,
    actorUserId: input.actorUserId,
    entityType: 'invoice_refund',
    entityId: refundId,
    action: 'refund_requested',
    newData: {
      invoice_id: input.invoiceId,
      payment_id: input.paymentId,
      amount: money(result.amount),
      reason,
      duplicate,
    },
  })

  return {
    ok: true as const,
    duplicate,
    refund: {
      id: refundId,
      amount: money(result.amount),
      currency_code: typeof result.currency_code === 'string' ? result.currency_code : null,
      status: String(result.status || 'requested'),
      refundable_after: money(result.refundable_after),
    },
  }
}

/**
 * Marks a refund as externally completed and reconciles the invoice in the same
 * database transaction. This records a provider/bank reference; it does not call
 * PayPal or move money by itself.
 */
export async function completeInvoiceRefund(input: {
  companyId: string
  invoiceId: string
  refundId: string
  providerRefundId: string
  actorUserId: string
}) {
  const providerRefundId = input.providerRefundId.trim()
  if (providerRefundId.length < 3) {
    return { ok: false as const, status: 400, error: 'refund_reference_required' }
  }

  const db = getSupabaseServerClient()
  const { data, error } = await db.rpc('complete_invoice_refund_transaction', {
    p_company_id: input.companyId,
    p_invoice_id: input.invoiceId,
    p_refund_id: input.refundId,
    p_provider_refund_id: providerRefundId,
    p_actor_user_id: input.actorUserId,
  })

  if (error) {
    const code = rpcErrorCode(error.message)
    return { ok: false as const, status: rpcErrorStatus(code), error: code }
  }

  const result = rpcJson(data)
  const duplicate = result.duplicate === true

  await writeOperationalAudit({
    companyId: input.companyId,
    actorUserId: input.actorUserId,
    entityType: 'invoice_refund',
    entityId: input.refundId,
    action: 'refund_completed',
    newData: {
      invoice_id: input.invoiceId,
      provider_refund_id: providerRefundId,
      paid_total: money(result.paid_total),
      invoice_status: result.invoice_status,
      cancellation_completed: result.cancellation_completed === true,
      duplicate,
    },
  })

  return {
    ok: true as const,
    duplicate,
    refund: { id: input.refundId, status: 'completed', provider_refund_id: providerRefundId },
    invoice: {
      id: input.invoiceId,
      paid_total: money(result.paid_total),
      status: String(result.invoice_status || ''),
    },
    cancellationCompleted: result.cancellation_completed === true,
  }
}

/**
 * Atomically closes checkout links/holds and releases an unconverted agenda
 * reservation. Captured money keeps the cancellation pending until refunds bring
 * the net ledger to zero. A linked service order must use the operational
 * cancellation flow instead.
 */
export async function requestInvoiceCancellation(input: {
  companyId: string
  invoiceId: string
  reason: string
  actorUserId: string
}) {
  const reason = input.reason.trim()
  if (reason.length < 3) {
    return { ok: false as const, status: 400, error: 'cancellation_reason_required' }
  }

  const db = getSupabaseServerClient()
  const { data, error } = await db.rpc('cancel_invoice_and_release_reservation', {
    p_company_id: input.companyId,
    p_invoice_id: input.invoiceId,
    p_reason: reason,
    p_actor_user_id: input.actorUserId,
  })

  if (error) {
    const code = rpcErrorCode(error.message)
    return { ok: false as const, status: rpcErrorStatus(code), error: code }
  }

  const result = rpcJson(data)
  const cancellationId =
    typeof result.cancellation_id === 'string' ? result.cancellation_id : input.invoiceId
  const duplicate = result.duplicate === true
  const requiresRefund = result.requires_refund === true

  await writeOperationalAudit({
    companyId: input.companyId,
    actorUserId: input.actorUserId,
    entityType: 'invoice_cancellation',
    entityId: cancellationId,
    action: 'invoice_cancellation_requested',
    newData: {
      invoice_id: input.invoiceId,
      reason,
      status: result.status,
      paid_total: money(result.paid_total),
      agenda_rows_cancelled: Number(result.agenda_rows_cancelled || 0),
      payment_links_revoked: Number(result.payment_links_revoked || 0),
      schedule_holds_released: Number(result.schedule_holds_released || 0),
      duplicate,
    },
  })

  return {
    ok: true as const,
    duplicate,
    cancellation: {
      id: cancellationId,
      status: String(result.status || ''),
      reason,
    },
    agenda: { cancelled: Number(result.agenda_rows_cancelled || 0) },
    requiresRefund,
  }
}
