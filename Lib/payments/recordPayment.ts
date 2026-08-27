import 'server-only'

import { confirmQuoteDepositAndReserveSchedule } from '@/Lib/quotes/confirmQuoteDepositAndReserveSchedule'
import { getSupabaseServerClient } from '@/Lib/supabaseServer'
import { resolveAmountDue } from './amountDue'
import { toInvoice } from './createInvoiceFromQuote'
import { deriveInvoiceStatus, isDepositSatisfied } from './invoiceStatus'
import type {
  InvoicePaymentRecord,
  InvoiceRecord,
  PaymentAttemptStatus,
  PaymentProvider,
  PaymentPurpose,
} from './types'

export type RecordPaymentInput = {
  companyId: string
  invoiceId: string
  provider: PaymentProvider
  purpose: PaymentPurpose
  amount: number
  currency: string
  status: PaymentAttemptStatus
  providerOrderId?: string | null
  providerCaptureId?: string | null
  idempotencyKey: string
  metadata?: Record<string, unknown>
  actorUserId?: string | null
}

function toPayment(row: Record<string, unknown>): InvoicePaymentRecord {
  return {
    id: String(row.id),
    company_id: String(row.company_id),
    invoice_id: String(row.invoice_id),
    provider: row.provider as PaymentProvider,
    purpose: row.purpose as PaymentPurpose,
    amount: Number(row.amount),
    currency_code: String(row.currency_code),
    status: row.status as PaymentAttemptStatus,
    provider_order_id: (row.provider_order_id as string | null) ?? null,
    provider_capture_id: (row.provider_capture_id as string | null) ?? null,
    idempotency_key: String(row.idempotency_key),
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    created_at: String(row.created_at),
    captured_at: (row.captured_at as string | null) ?? null,
  }
}

export async function findPaymentByIdempotency(
  companyId: string,
  idempotencyKey: string,
): Promise<InvoicePaymentRecord | null> {
  const { data } = await getSupabaseServerClient()
    .from('invoice_payments')
    .select('*')
    .eq('company_id', companyId)
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle()
  return data ? toPayment(data) : null
}

export async function findPaymentByProviderOrder(
  companyId: string,
  provider: PaymentProvider,
  providerOrderId: string,
): Promise<InvoicePaymentRecord | null> {
  const { data } = await getSupabaseServerClient()
    .from('invoice_payments')
    .select('*')
    .eq('company_id', companyId)
    .eq('provider', provider)
    .eq('provider_order_id', providerOrderId)
    .maybeSingle()
  return data ? toPayment(data) : null
}

export async function recordPaymentAttempt(
  input: RecordPaymentInput,
): Promise<
  | { ok: true; payment: InvoicePaymentRecord; invoice: InvoiceRecord; duplicate: boolean }
  | { ok: false; status: number; error: string }
> {
  const supabase = getSupabaseServerClient()
  const existing = await findPaymentByIdempotency(input.companyId, input.idempotencyKey)
  if (existing) {
    const invoice = await supabase
      .from('invoices')
      .select('*')
      .eq('id', existing.invoice_id)
      .eq('company_id', input.companyId)
      .single()
    if (!invoice.data) return { ok: false, status: 404, error: 'invoice_not_found' }
    return {
      ok: true,
      payment: existing,
      invoice: toInvoice(invoice.data),
      duplicate: true,
    }
  }

  let existingByOrder: InvoicePaymentRecord | null = null
  if (input.providerOrderId) {
    existingByOrder = await findPaymentByProviderOrder(
      input.companyId,
      input.provider,
      input.providerOrderId,
    )
    if (existingByOrder?.status === 'completed') {
      const invoice = await supabase
        .from('invoices')
        .select('*')
        .eq('id', existingByOrder.invoice_id)
        .eq('company_id', input.companyId)
        .single()
      if (!invoice.data) return { ok: false, status: 404, error: 'invoice_not_found' }
      return {
        ok: true,
        payment: existingByOrder,
        invoice: toInvoice(invoice.data),
        duplicate: true,
      }
    }
    if (existingByOrder && input.status !== 'completed') {
      const invoice = await supabase
        .from('invoices')
        .select('*')
        .eq('id', existingByOrder.invoice_id)
        .eq('company_id', input.companyId)
        .single()
      if (!invoice.data) return { ok: false, status: 404, error: 'invoice_not_found' }
      return {
        ok: true,
        payment: existingByOrder,
        invoice: toInvoice(invoice.data),
        duplicate: true,
      }
    }
  }

  const invoiceRes = await supabase
    .from('invoices')
    .select('*')
    .eq('id', existingByOrder?.invoice_id ?? input.invoiceId)
    .eq('company_id', input.companyId)
    .maybeSingle()
  if (!invoiceRes.data) return { ok: false, status: 404, error: 'invoice_not_found' }
  const invoice = toInvoice(invoiceRes.data)
  if (invoice.status === 'canceled') {
    return { ok: false, status: 409, error: 'invoice_canceled' }
  }
  if (invoice.status === 'paid' && input.status === 'completed') {
    return { ok: false, status: 409, error: 'invoice_already_paid' }
  }

  const due = resolveAmountDue({
    total: invoice.total,
    depositAmount: invoice.deposit_amount,
    paidTotal: invoice.paid_total,
    purpose: existingByOrder?.purpose ?? input.purpose,
  })
  if (input.status === 'completed' && due.amount <= 0) {
    return { ok: false, status: 409, error: due.reason }
  }
  const amount = input.status === 'completed' ? due.amount : Math.max(due.amount, input.amount)

  let paymentRow: InvoicePaymentRecord
  if (existingByOrder && input.status === 'completed') {
    const completed = await supabase
      .from('invoice_payments')
      .update({
        status: 'completed',
        amount,
        provider_capture_id: input.providerCaptureId ?? existingByOrder.provider_capture_id,
        metadata: {
          ...existingByOrder.metadata,
          ...(input.metadata ?? {}),
        },
        captured_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', existingByOrder.id)
      .eq('company_id', input.companyId)
      .neq('status', 'completed')
      .select('*')
      .maybeSingle()

    if (!completed.data) {
      const raced = await findPaymentByProviderOrder(
        input.companyId,
        input.provider,
        input.providerOrderId || existingByOrder.provider_order_id || '',
      )
      if (raced?.status === 'completed') {
        return { ok: true, payment: raced, invoice, duplicate: true }
      }
      return { ok: false, status: 500, error: 'payment_complete_failed' }
    }
    paymentRow = toPayment(completed.data)
  } else {
    const inserted = await supabase
      .from('invoice_payments')
      .insert({
        company_id: input.companyId,
        invoice_id: invoice.id,
        provider: input.provider,
        purpose: input.purpose,
        amount,
        currency_code: input.currency,
        status: input.status,
        provider_order_id: input.providerOrderId ?? null,
        provider_capture_id: input.providerCaptureId ?? null,
        idempotency_key: input.idempotencyKey,
        metadata: input.metadata ?? {},
        captured_at: input.status === 'completed' ? new Date().toISOString() : null,
      })
      .select('*')
      .single()

    if (inserted.error || !inserted.data) {
      const raced = await findPaymentByIdempotency(input.companyId, input.idempotencyKey)
      if (raced) {
        return {
          ok: true,
          payment: raced,
          invoice,
          duplicate: true,
        }
      }
      if (input.providerOrderId) {
        const byOrder = await findPaymentByProviderOrder(
          input.companyId,
          input.provider,
          input.providerOrderId,
        )
        if (byOrder) {
          return { ok: true, payment: byOrder, invoice, duplicate: true }
        }
      }
      return { ok: false, status: 500, error: inserted.error?.message || 'payment_insert_failed' }
    }
    paymentRow = toPayment(inserted.data)
  }

  let nextInvoice = invoice
  if (input.status === 'completed') {
    const paidTotal = Math.round((invoice.paid_total + amount) * 100) / 100
    const status = deriveInvoiceStatus({
      current: invoice.status,
      total: invoice.total,
      depositAmount: invoice.deposit_amount,
      paidTotal,
    })
    const updated = await supabase
      .from('invoices')
      .update({
        paid_total: paidTotal,
        status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', invoice.id)
      .eq('company_id', input.companyId)
      .eq('paid_total', invoice.paid_total)
      .select('*')
      .maybeSingle()
    if (updated.data) nextInvoice = toInvoice(updated.data)

    if (
      isDepositSatisfied({
        depositAmount: nextInvoice.deposit_amount,
        paidTotal: nextInvoice.paid_total,
      }) &&
      typeof input.actorUserId === 'string' &&
      input.actorUserId
    ) {
      await confirmQuoteDepositAndReserveSchedule({
        companyId: input.companyId,
        quoteId: nextInvoice.quote_id,
        actorUserId: input.actorUserId,
      }).catch(() => null)
    }
  }

  return {
    ok: true,
    payment: paymentRow,
    invoice: nextInvoice,
    duplicate: false,
  }
}
