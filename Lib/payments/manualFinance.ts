import 'server-only'

import { createHash, randomUUID } from 'node:crypto'
import { writeOperationalAudit } from '@/Lib/orders/writeOperationalAudit'
import {
  cancelAgendaReservationForQuote,
  confirmQuoteDepositAndReserveSchedule,
} from '@/Lib/quotes/confirmQuoteDepositAndReserveSchedule'
import { getSupabaseServerClient } from '@/Lib/supabaseServer'
import { resolveAmountDue } from './amountDue'
import { isDepositSatisfied } from './invoiceStatus'
import type { PaymentPurpose } from './types'

export type ManualPaymentProvider = 'zelle' | 'bank_transfer'

function money(value: unknown) {
  const number = Number(value ?? 0)
  return Number.isFinite(number) ? Math.round(number * 100) / 100 : 0
}

function normalizePurpose(value: unknown): PaymentPurpose | null {
  return value === 'deposit' || value === 'balance' || value === 'full'
    ? value
    : null
}

export async function reconcileInvoiceLedger(companyId: string, invoiceId: string) {
  const db = getSupabaseServerClient()
  const { error } = await db.rpc('reconcile_invoice_ledger', {
    p_company_id: companyId,
    p_invoice_id: invoiceId,
  })
  if (error) return { ok: false as const, error: error.message }

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

export async function recordManualPayment(input: {
  companyId: string
  invoiceId: string
  provider: ManualPaymentProvider
  purpose: PaymentPurpose
  confirmationReference: string
  confirmationNote?: string | null
  actorUserId: string
}) {
  const db = getSupabaseServerClient()
  const reference = input.confirmationReference.trim()
  if (reference.length < 3) {
    return { ok: false as const, status: 400, error: 'confirmation_reference_required' }
  }
  const purpose = normalizePurpose(input.purpose)
  if (!purpose) return { ok: false as const, status: 400, error: 'invalid_purpose' }

  const { data: invoice, error: invoiceError } = await db
    .from('invoices')
    .select('id, quote_id, status, total, deposit_amount, paid_total, currency_code')
    .eq('company_id', input.companyId)
    .eq('id', input.invoiceId)
    .maybeSingle()

  if (invoiceError || !invoice) {
    return {
      ok: false as const,
      status: invoiceError ? 500 : 404,
      error: invoiceError?.message || 'invoice_not_found',
    }
  }
  if (invoice.status === 'canceled') {
    return { ok: false as const, status: 409, error: 'invoice_canceled' }
  }

  const due = resolveAmountDue({
    total: money(invoice.total),
    depositAmount: money(invoice.deposit_amount),
    paidTotal: money(invoice.paid_total),
    purpose,
  })
  if (due.amount <= 0) {
    return { ok: false as const, status: 409, error: due.reason }
  }

  const referenceHash = createHash('sha256')
    .update(`${input.provider}|${reference.toLowerCase()}`)
    .digest('hex')
    .slice(0, 32)
  const idempotencyKey = `manual:${input.invoiceId}:${referenceHash}`
  const confirmedAt = new Date().toISOString()

  const { data: existing } = await db
    .from('invoice_payments')
    .select('id, amount, status')
    .eq('company_id', input.companyId)
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle()

  if (existing) {
    const ledger = await reconcileInvoiceLedger(input.companyId, input.invoiceId)
    return {
      ok: true as const,
      duplicate: true,
      paymentId: existing.id,
      amount: money(existing.amount),
      invoice: ledger.ok ? ledger.invoice : invoice,
    }
  }

  const { data: payment, error: paymentError } = await db
    .from('invoice_payments')
    .insert({
      company_id: input.companyId,
      invoice_id: input.invoiceId,
      provider: input.provider,
      purpose,
      amount: due.amount,
      currency_code: invoice.currency_code || 'USD',
      status: 'completed',
      idempotency_key: idempotencyKey,
      confirmation_reference: reference,
      confirmation_note: input.confirmationNote?.trim() || null,
      confirmed_by: input.actorUserId,
      confirmed_at: confirmedAt,
      captured_at: confirmedAt,
      metadata: {
        manual_reconciliation: true,
        evidence_type: 'external_reference',
      },
    })
    .select('id, amount, status')
    .single()

  if (paymentError || !payment) {
    const { data: raced } = await db
      .from('invoice_payments')
      .select('id, amount, status')
      .eq('company_id', input.companyId)
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle()
    if (!raced) {
      return {
        ok: false as const,
        status: 500,
        error: paymentError?.message || 'manual_payment_insert_failed',
      }
    }
  }

  const ledger = await reconcileInvoiceLedger(input.companyId, input.invoiceId)
  if (!ledger.ok) {
    return { ok: false as const, status: 500, error: ledger.error }
  }

  let reservation: unknown = null
  if (
    isDepositSatisfied({
      depositAmount: money(ledger.invoice.deposit_amount),
      paidTotal: money(ledger.invoice.paid_total),
    })
  ) {
    reservation = await confirmQuoteDepositAndReserveSchedule({
      companyId: input.companyId,
      quoteId: String(ledger.invoice.quote_id),
      actorUserId: input.actorUserId,
    }).catch(() => null)
  }

  const paymentId = payment?.id || null
  await writeOperationalAudit({
    companyId: input.companyId,
    actorUserId: input.actorUserId,
    entityType: 'invoice_payment',
    entityId: paymentId || input.invoiceId,
    action: 'manual_payment_reconciled',
    newData: {
      invoice_id: input.invoiceId,
      provider: input.provider,
      purpose,
      amount: due.amount,
      confirmation_reference: reference,
    },
  })

  return {
    ok: true as const,
    duplicate: false,
    paymentId,
    amount: due.amount,
    invoice: ledger.invoice,
    reservation,
  }
}

export async function requestInvoiceRefund(input: {
  companyId: string
  invoiceId: string
  paymentId: string
  amount?: number | null
  reason: string
  actorUserId: string
  idempotencyKey?: string | null
}) {
  const db = getSupabaseServerClient()
  const reason = input.reason.trim()
  if (reason.length < 3) {
    return { ok: false as const, status: 400, error: 'refund_reason_required' }
  }

  const { data: payment, error: paymentError } = await db
    .from('invoice_payments')
    .select('id, invoice_id, amount, currency_code, status, provider')
    .eq('company_id', input.companyId)
    .eq('invoice_id', input.invoiceId)
    .eq('id', input.paymentId)
    .maybeSingle()

  if (paymentError || !payment) {
    return {
      ok: false as const,
      status: paymentError ? 500 : 404,
      error: paymentError?.message || 'payment_not_found',
    }
  }
  if (payment.status !== 'completed') {
    return { ok: false as const, status: 409, error: 'refund_requires_completed_payment' }
  }

  const { data: previous, error: previousError } = await db
    .from('invoice_refunds')
    .select('amount, status')
    .eq('company_id', input.companyId)
    .eq('invoice_id', input.invoiceId)
    .eq('payment_id', input.paymentId)
    .in('status', ['requested', 'processing', 'completed'])

  if (previousError) {
    return { ok: false as const, status: 500, error: previousError.message }
  }

  const alreadyReserved = money(
    (previous ?? []).reduce((sum, row) => sum + Number(row.amount || 0), 0),
  )
  const refundable = money(Number(payment.amount) - alreadyReserved)
  const requestedAmount = input.amount == null ? refundable : money(input.amount)
  if (requestedAmount <= 0 || requestedAmount > refundable + 0.009) {
    return {
      ok: false as const,
      status: 409,
      error: 'refund_amount_exceeds_available',
      refundable,
    }
  }

  const requestKey = (input.idempotencyKey || randomUUID()).trim()
  const idempotencyKey = `refund:${input.invoiceId}:${input.paymentId}:${requestKey}`

  const { data: existing } = await db
    .from('invoice_refunds')
    .select('*')
    .eq('company_id', input.companyId)
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle()
  if (existing) return { ok: true as const, duplicate: true, refund: existing }

  const { data: refund, error } = await db
    .from('invoice_refunds')
    .insert({
      company_id: input.companyId,
      invoice_id: input.invoiceId,
      payment_id: input.paymentId,
      amount: requestedAmount,
      currency_code: payment.currency_code || 'USD',
      status: 'requested',
      reason,
      idempotency_key: idempotencyKey,
      requested_by: input.actorUserId,
      metadata: { provider: payment.provider },
    })
    .select('*')
    .single()

  if (error || !refund) {
    return { ok: false as const, status: 500, error: error?.message || 'refund_request_failed' }
  }

  await writeOperationalAudit({
    companyId: input.companyId,
    actorUserId: input.actorUserId,
    entityType: 'invoice_refund',
    entityId: refund.id,
    action: 'refund_requested',
    newData: {
      invoice_id: input.invoiceId,
      payment_id: input.paymentId,
      amount: requestedAmount,
      currency_code: payment.currency_code,
      reason,
    },
  })

  return { ok: true as const, duplicate: false, refund }
}

export async function completeInvoiceRefund(input: {
  companyId: string
  invoiceId: string
  refundId: string
  providerRefundId: string
  actorUserId: string
}) {
  const db = getSupabaseServerClient()
  const providerRefundId = input.providerRefundId.trim()
  if (providerRefundId.length < 3) {
    return { ok: false as const, status: 400, error: 'refund_reference_required' }
  }

  const { data: current, error: currentError } = await db
    .from('invoice_refunds')
    .select('*')
    .eq('company_id', input.companyId)
    .eq('invoice_id', input.invoiceId)
    .eq('id', input.refundId)
    .maybeSingle()

  if (currentError || !current) {
    return {
      ok: false as const,
      status: currentError ? 500 : 404,
      error: currentError?.message || 'refund_not_found',
    }
  }
  if (current.status === 'completed') {
    const ledger = await reconcileInvoiceLedger(input.companyId, input.invoiceId)
    return { ok: true as const, duplicate: true, refund: current, ledger }
  }
  if (current.status === 'canceled') {
    return { ok: false as const, status: 409, error: 'refund_canceled' }
  }

  const completedAt = new Date().toISOString()
  const { data: refund, error } = await db
    .from('invoice_refunds')
    .update({
      status: 'completed',
      provider_refund_id: providerRefundId,
      completed_by: input.actorUserId,
      completed_at: completedAt,
      updated_at: completedAt,
    })
    .eq('company_id', input.companyId)
    .eq('invoice_id', input.invoiceId)
    .eq('id', input.refundId)
    .neq('status', 'completed')
    .select('*')
    .maybeSingle()

  if (error) return { ok: false as const, status: 500, error: error.message }
  if (!refund) {
    const { data: raced } = await db
      .from('invoice_refunds')
      .select('*')
      .eq('company_id', input.companyId)
      .eq('id', input.refundId)
      .maybeSingle()
    if (raced?.status !== 'completed') {
      return { ok: false as const, status: 409, error: 'refund_state_changed' }
    }
  }

  const ledger = await reconcileInvoiceLedger(input.companyId, input.invoiceId)
  if (!ledger.ok) return { ok: false as const, status: 500, error: ledger.error }

  let cancellationCompleted = false
  const { data: cancellation } = await db
    .from('invoice_cancellations')
    .select('id, status')
    .eq('company_id', input.companyId)
    .eq('invoice_id', input.invoiceId)
    .eq('status', 'pending_refund')
    .maybeSingle()

  if (cancellation && money(ledger.invoice.paid_total) <= 0) {
    const now = new Date().toISOString()
    await db
      .from('invoice_cancellations')
      .update({ status: 'completed', completed_at: now, updated_at: now })
      .eq('company_id', input.companyId)
      .eq('id', cancellation.id)
      .eq('status', 'pending_refund')
    await db
      .from('invoices')
      .update({ status: 'canceled', canceled_at: now, updated_at: now })
      .eq('company_id', input.companyId)
      .eq('id', input.invoiceId)
    cancellationCompleted = true
  }

  await writeOperationalAudit({
    companyId: input.companyId,
    actorUserId: input.actorUserId,
    entityType: 'invoice_refund',
    entityId: input.refundId,
    action: 'refund_completed',
    newData: {
      invoice_id: input.invoiceId,
      provider_refund_id: providerRefundId,
      cancellation_completed: cancellationCompleted,
    },
  })

  return {
    ok: true as const,
    duplicate: false,
    refund: refund ?? current,
    invoice: ledger.invoice,
    cancellationCompleted,
  }
}

export async function requestInvoiceCancellation(input: {
  companyId: string
  invoiceId: string
  reason: string
  actorUserId: string
}) {
  const db = getSupabaseServerClient()
  const reason = input.reason.trim()
  if (reason.length < 3) {
    return { ok: false as const, status: 400, error: 'cancellation_reason_required' }
  }

  const { data: invoice, error } = await db
    .from('invoices')
    .select('id, quote_id, status, paid_total')
    .eq('company_id', input.companyId)
    .eq('id', input.invoiceId)
    .maybeSingle()
  if (error || !invoice) {
    return {
      ok: false as const,
      status: error ? 500 : 404,
      error: error?.message || 'invoice_not_found',
    }
  }
  if (invoice.status === 'canceled') {
    return { ok: true as const, duplicate: true, status: 'completed' as const }
  }

  const { data: serviceAgenda, error: agendaCheckError } = await db
    .from('agenda_events')
    .select('id, service_order_id')
    .eq('company_id', input.companyId)
    .eq('quote_id', invoice.quote_id)
    .neq('status', 'cancelled')
    .not('service_order_id', 'is', null)
    .limit(1)

  if (agendaCheckError) {
    return { ok: false as const, status: 500, error: agendaCheckError.message }
  }
  if ((serviceAgenda ?? []).length > 0) {
    return {
      ok: false as const,
      status: 409,
      error: 'service_order_cancellation_required',
    }
  }

  const { data: existing } = await db
    .from('invoice_cancellations')
    .select('*')
    .eq('company_id', input.companyId)
    .eq('invoice_id', input.invoiceId)
    .in('status', ['requested', 'pending_refund'])
    .maybeSingle()
  if (existing) return { ok: true as const, duplicate: true, cancellation: existing }

  const agenda = await cancelAgendaReservationForQuote({
    companyId: input.companyId,
    quoteId: String(invoice.quote_id),
    actorUserId: input.actorUserId,
    reason,
  })
  if (!agenda.ok) {
    return { ok: false as const, status: 500, error: agenda.error || 'agenda_release_failed' }
  }

  const hasCapturedMoney = money(invoice.paid_total) > 0
  const now = new Date().toISOString()
  const cancellationStatus = hasCapturedMoney ? 'pending_refund' : 'completed'
  const { data: cancellation, error: insertError } = await db
    .from('invoice_cancellations')
    .insert({
      company_id: input.companyId,
      invoice_id: input.invoiceId,
      quote_id: invoice.quote_id,
      status: cancellationStatus,
      reason,
      requested_by: input.actorUserId,
      agenda_released_at: now,
      completed_at: hasCapturedMoney ? null : now,
      metadata: { agenda_rows_cancelled: agenda.cancelled },
    })
    .select('*')
    .single()

  if (insertError || !cancellation) {
    return {
      ok: false as const,
      status: 500,
      error: insertError?.message || 'cancellation_request_failed',
    }
  }

  if (!hasCapturedMoney) {
    await db
      .from('invoices')
      .update({ status: 'canceled', canceled_at: now, updated_at: now })
      .eq('company_id', input.companyId)
      .eq('id', input.invoiceId)
  }

  await writeOperationalAudit({
    companyId: input.companyId,
    actorUserId: input.actorUserId,
    entityType: 'invoice_cancellation',
    entityId: cancellation.id,
    action: 'invoice_cancellation_requested',
    newData: {
      invoice_id: input.invoiceId,
      quote_id: invoice.quote_id,
      reason,
      status: cancellationStatus,
      paid_total: money(invoice.paid_total),
      agenda_rows_cancelled: agenda.cancelled,
    },
  })

  return {
    ok: true as const,
    duplicate: false,
    cancellation,
    agenda,
    requiresRefund: hasCapturedMoney,
  }
}
