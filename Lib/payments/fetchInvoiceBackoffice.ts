import 'server-only'

import { getSupabaseServerClient } from '@/Lib/supabaseServer'
import type {
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

export type InvoiceBackofficeDetail = InvoiceBackofficeListItem & {
  locale: string
  subtotal: number
  balance_amount: number
  snapshot: InvoiceSnapshot | null
  payments: InvoiceBackofficePayment[]
  payment_links: InvoiceBackofficePaymentLink[]
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
      'id, company_id, quote_id, invoice_number, status, currency_code, snapshot, total, deposit_amount, paid_total, created_at, updated_at',
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
      'id, company_id, quote_id, invoice_number, status, locale, currency_code, snapshot, subtotal, total, deposit_amount, balance_amount, paid_total, created_at, updated_at',
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

  const [paymentsResult, linksResult] = await Promise.all([
    supabase
      .from('invoice_payments')
      .select(
        'id, provider, purpose, amount, currency_code, status, provider_order_id, provider_capture_id, captured_at, created_at',
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
  ])

  if (paymentsResult.error) {
    return { data: null, error: { message: paymentsResult.error.message } }
  }
  if (linksResult.error) {
    return { data: null, error: { message: linksResult.error.message } }
  }

  const row = invoiceResult.data as unknown as InvoiceRow
  const base = toListItem(row)
  const payments: InvoiceBackofficePayment[] = (paymentsResult.data ?? []).map((payment) => ({
    id: String(payment.id),
    provider: payment.provider as PaymentProvider,
    purpose: payment.purpose as PaymentPurpose,
    amount: money(payment.amount),
    currency_code: String(payment.currency_code || base.currency_code),
    status: payment.status as PaymentAttemptStatus,
    provider_order_id: payment.provider_order_id ?? null,
    provider_capture_id: payment.provider_capture_id ?? null,
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

  return {
    data: {
      ...base,
      locale: String(row.locale || 'pt'),
      subtotal: money(row.subtotal),
      balance_amount: money(row.balance_amount),
      snapshot: snapshotFrom(row),
      payments,
      payment_links: paymentLinks,
    },
    error: null,
  }
}
