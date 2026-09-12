import 'server-only'

import { getSupabaseServerClient } from '@/Lib/supabaseServer'
import type {
  InvoiceKind,
  InvoiceSnapshot,
  InvoiceStatus,
  PaymentAttemptStatus,
  PaymentProvider,
  PaymentPurpose,
} from './types'

export type InvoiceBackofficeListItem = {
  id: string
  quote_id: string
  invoice_number: string
  invoice_kind: InvoiceKind
  parent_invoice_id: string | null
  service_order_id: string | null
  closeout_id: string | null
  quote_number: string | null
  customer_name: string
  event_name: string | null
  event_date: string | null
  status: InvoiceStatus
  currency_code: string
  total: number
  deposit_amount: number
  paid_total: number
  outstanding_amount: number
  created_at: string
  updated_at: string
}

export type InvoiceBackofficePayment = {
  id: string
  provider: PaymentProvider
  purpose: PaymentPurpose
  amount: number
  currency_code: string
  status: PaymentAttemptStatus
  provider_order_id: string | null
  provider_capture_id: string | null
  confirmation_reference: string | null
  confirmation_note: string | null
  confirmed_by: string | null
  confirmed_at: string | null
  captured_at: string | null
  created_at: string
}

export type InvoiceBackofficePaymentLink = {
  id: string
  purpose: PaymentPurpose
  expires_at: string | null
  revoked_at: string | null
  created_at: string
}

export type InvoiceBackofficeRefund = {
  id: string
  payment_id: string
  amount: number
  currency_code: string
  status: 'requested' | 'processing' | 'completed' | 'failed' | 'canceled'
  reason: string
  provider_refund_id: string | null
  requested_by: string | null
  completed_by: string | null
  requested_at: string
  completed_at: string | null
}

export type InvoiceBackofficeCancellation = {
  id: string
  status: 'requested' | 'pending_refund' | 'completed' | 'rejected'
  reason: string
  requested_by: string | null
  requested_at: string
  agenda_released_at: string | null
  completed_at: string | null
}

export type InvoiceBackofficeDetail = InvoiceBackofficeListItem & {
  locale: string
  subtotal: number
  balance_amount: number
  snapshot: InvoiceSnapshot | null
  parent_invoice_number: string | null
  supplemental_invoices: Array<{
    id: string
    invoice_number: string
    status: InvoiceStatus
    total: number
    paid_total: number
  }>
  payments: InvoiceBackofficePayment[]
  payment_links: InvoiceBackofficePaymentLink[]
  refunds: InvoiceBackofficeRefund[]
  cancellations: InvoiceBackofficeCancellation[]
}

type InvoiceRow = Record<string, unknown> & {
  snapshot?: InvoiceSnapshot | null
}

function money(value: unknown): number {
  const number = Number(value ?? 0)
  return Number.isFinite(number) ? Math.round(number * 100) / 100 : 0
}

function snapshotFrom(row: InvoiceRow): InvoiceSnapshot | null {
  const snapshot = row.snapshot
  if (!snapshot || typeof snapshot !== 'object') return null
  return snapshot
}

function toListItem(row: InvoiceRow): InvoiceBackofficeListItem {
  const snapshot = snapshotFrom(row)
  const total = money(row.total)
  const paidTotal = money(row.paid_total)

  return {
    id: String(row.id),
    quote_id: String(row.quote_id),
    invoice_number: String(row.invoice_number),
    invoice_kind: (row.invoice_kind || 'original') as InvoiceKind,
    parent_invoice_id: row.parent_invoice_id ? String(row.parent_invoice_id) : null,
    service_order_id: row.service_order_id ? String(row.service_order_id) : null,
    closeout_id: row.closeout_id ? String(row.closeout_id) : null,
    quote_number: snapshot?.quote?.number ?? null,
    customer_name: snapshot?.customer?.name?.trim() || '—',
    event_name: snapshot?.event?.name ?? null,
    event_date: snapshot?.event?.date ?? null,
    status: row.status as InvoiceStatus,
    currency_code: String(row.currency_code || snapshot?.totals?.currency || 'USD'),
    total,
    deposit_amount: money(row.deposit_amount),
    paid_total: paidTotal,
    outstanding_amount: Math.max(0, Math.round((total - paidTotal) * 100) / 100),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  }
}

export async function fetchInvoiceBackofficeList(
  companyId: string,
): Promise<{
  data: InvoiceBackofficeListItem[] | null
  error: { message: string } | null
}> {
  if (!companyId) return { data: [], error: null }

  const { data, error } = await getSupabaseServerClient()
    .from('invoices')
    .select(
      'id, company_id, quote_id, invoice_number, invoice_kind, parent_invoice_id, service_order_id, closeout_id, status, currency_code, snapshot, total, deposit_amount, paid_total, created_at, updated_at',
    )
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) return { data: null, error: { message: error.message } }

  return {
    data: ((data ?? []) as unknown as InvoiceRow[]).map(toListItem),
    error: null,
  }
}

export async function fetchInvoiceBackofficeDetail(
  companyId: string,
  invoiceId: string,
): Promise<{
  data: InvoiceBackofficeDetail | null
  error: { message: string; status?: number } | null
}> {
  if (!companyId || !invoiceId) {
    return { data: null, error: { message: 'invoice_not_found', status: 404 } }
  }

  const supabase = getSupabaseServerClient()
  const invoiceResult = await supabase
    .from('invoices')
    .select(
      'id, company_id, quote_id, invoice_number, invoice_kind, parent_invoice_id, service_order_id, closeout_id, status, locale, currency_code, snapshot, subtotal, total, deposit_amount, balance_amount, paid_total, created_at, updated_at',
    )
    .eq('company_id', companyId)
    .eq('id', invoiceId)
    .maybeSingle()

  if (invoiceResult.error) {
    return { data: null, error: { message: invoiceResult.error.message } }
  }
  if (!invoiceResult.data) {
    return { data: null, error: { message: 'invoice_not_found', status: 404 } }
  }

  const invoiceRow = invoiceResult.data as unknown as InvoiceRow
  const parentInvoiceId = invoiceRow.parent_invoice_id ? String(invoiceRow.parent_invoice_id) : null

  const [paymentsResult, linksResult, refundsResult, cancellationsResult, parentResult, supplementsResult] = await Promise.all([
    supabase
      .from('invoice_payments')
      .select(
        'id, provider, purpose, amount, currency_code, status, provider_order_id, provider_capture_id, confirmation_reference, confirmation_note, confirmed_by, confirmed_at, captured_at, created_at',
      )
      .eq('company_id', companyId)
      .eq('invoice_id', invoiceId)
      .order('created_at', { ascending: false }),
    supabase
      .from('invoice_payment_links')
      .select('id, purpose, expires_at, revoked_at, created_at')
      .eq('company_id', companyId)
      .eq('invoice_id', invoiceId)
      .order('created_at', { ascending: false }),
    supabase
      .from('invoice_refunds')
      .select(
        'id, payment_id, amount, currency_code, status, reason, provider_refund_id, requested_by, completed_by, requested_at, completed_at',
      )
      .eq('company_id', companyId)
      .eq('invoice_id', invoiceId)
      .order('requested_at', { ascending: false }),
    supabase
      .from('invoice_cancellations')
      .select(
        'id, status, reason, requested_by, requested_at, agenda_released_at, completed_at',
      )
      .eq('company_id', companyId)
      .eq('invoice_id', invoiceId)
      .order('requested_at', { ascending: false }),
    parentInvoiceId
      ? supabase
          .from('invoices')
          .select('invoice_number')
          .eq('company_id', companyId)
          .eq('id', parentInvoiceId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase
      .from('invoices')
      .select('id, invoice_number, status, total, paid_total')
      .eq('company_id', companyId)
      .eq('parent_invoice_id', invoiceId)
      .order('created_at', { ascending: true }),
  ])

  for (const result of [paymentsResult, linksResult, refundsResult, cancellationsResult, parentResult, supplementsResult]) {
    if (result.error) {
      return { data: null, error: { message: result.error.message } }
    }
  }

  const base = toListItem(invoiceRow)
  const payments: InvoiceBackofficePayment[] = (paymentsResult.data ?? []).map((payment) => ({
    id: String(payment.id),
    provider: payment.provider as PaymentProvider,
    purpose: payment.purpose as PaymentPurpose,
    amount: money(payment.amount),
    currency_code: String(payment.currency_code || base.currency_code),
    status: payment.status as PaymentAttemptStatus,
    provider_order_id: payment.provider_order_id ?? null,
    provider_capture_id: payment.provider_capture_id ?? null,
    confirmation_reference: payment.confirmation_reference ?? null,
    confirmation_note: payment.confirmation_note ?? null,
    confirmed_by: payment.confirmed_by ?? null,
    confirmed_at: payment.confirmed_at ?? null,
    captured_at: payment.captured_at ?? null,
    created_at: String(payment.created_at),
  }))
  const paymentLinks: InvoiceBackofficePaymentLink[] = (linksResult.data ?? []).map((link) => ({
    id: String(link.id),
    purpose: link.purpose as PaymentPurpose,
    expires_at: link.expires_at ?? null,
    revoked_at: link.revoked_at ?? null,
    created_at: String(link.created_at),
  }))
  const refunds: InvoiceBackofficeRefund[] = (refundsResult.data ?? []).map((refund) => ({
    id: String(refund.id),
    payment_id: String(refund.payment_id),
    amount: money(refund.amount),
    currency_code: String(refund.currency_code || base.currency_code),
    status: refund.status as InvoiceBackofficeRefund['status'],
    reason: String(refund.reason || ''),
    provider_refund_id: refund.provider_refund_id ?? null,
    requested_by: refund.requested_by ?? null,
    completed_by: refund.completed_by ?? null,
    requested_at: String(refund.requested_at),
    completed_at: refund.completed_at ?? null,
  }))
  const cancellations: InvoiceBackofficeCancellation[] = (cancellationsResult.data ?? []).map(
    (cancellation) => ({
      id: String(cancellation.id),
      status: cancellation.status as InvoiceBackofficeCancellation['status'],
      reason: String(cancellation.reason || ''),
      requested_by: cancellation.requested_by ?? null,
      requested_at: String(cancellation.requested_at),
      agenda_released_at: cancellation.agenda_released_at ?? null,
      completed_at: cancellation.completed_at ?? null,
    }),
  )

  return {
    data: {
      ...base,
      locale: String(invoiceRow.locale || 'pt'),
      subtotal: money(invoiceRow.subtotal),
      balance_amount: money(invoiceRow.balance_amount),
      snapshot: snapshotFrom(invoiceRow),
      parent_invoice_number: parentResult.data?.invoice_number ? String(parentResult.data.invoice_number) : null,
      supplemental_invoices: (supplementsResult.data ?? []).map((child) => ({
        id: String(child.id),
        invoice_number: String(child.invoice_number),
        status: child.status as InvoiceStatus,
        total: money(child.total),
        paid_total: money(child.paid_total),
      })),
      payments,
      payment_links: paymentLinks,
      refunds,
      cancellations,
    },
    error: null,
  }
}
