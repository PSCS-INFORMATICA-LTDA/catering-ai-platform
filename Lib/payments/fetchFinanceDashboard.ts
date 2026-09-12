import 'server-only'

import { getSupabaseServerClient } from '@/Lib/supabaseServer'
import {
  computeInvoiceControlKpis,
  parseFinancePage,
  parseFinancePageSize,
  resolveFinancePeriodRange,
  sanitizeFinanceSearch,
} from './financeObservability'
import type {
  InvoiceControlFilters,
  InvoiceControlKpis,
  InvoiceControlListItem,
} from './financeObservabilityTypes'
import type {
  InvoiceKind,
  InvoiceSnapshot,
  InvoiceStatus,
  PaymentAttemptStatus,
  PaymentProvider,
} from './types'

const INVOICE_LIST_SELECT =
  'id, company_id, quote_id, invoice_number, invoice_kind, parent_invoice_id, service_order_id, closeout_id, status, currency_code, snapshot, total, deposit_amount, paid_total, created_at, updated_at'

type InvoiceRow = Record<string, unknown> & {
  snapshot?: InvoiceSnapshot | null
}

function money(value: unknown): number {
  const number = Number(value ?? 0)
  return Number.isFinite(number) ? Math.round(number * 100) / 100 : 0
}

function snapshotFrom(row: InvoiceRow): InvoiceSnapshot | null {
  return row.snapshot && typeof row.snapshot === 'object' ? row.snapshot : null
}

export function parseInvoiceControlFilters(
  searchParams: URLSearchParams,
): InvoiceControlFilters {
  const range = resolveFinancePeriodRange({
    period: searchParams.get('period') || 'all',
    from: searchParams.get('from'),
    to: searchParams.get('to'),
  })
  return {
    period: range.period,
    from: range.from,
    to: range.to,
    invoiceNumber: sanitizeFinanceSearch(searchParams.get('invoiceNumber')),
    quoteNumber: sanitizeFinanceSearch(searchParams.get('quoteNumber')),
    os: sanitizeFinanceSearch(searchParams.get('os')),
    customer: sanitizeFinanceSearch(searchParams.get('customer')),
    status: (searchParams.get('status') || 'all') as InvoiceControlFilters['status'],
    invoiceKind: (searchParams.get('invoiceKind') || 'all') as InvoiceControlFilters['invoiceKind'],
    provider: (searchParams.get('provider') || 'all') as InvoiceControlFilters['provider'],
    paymentStatus: (searchParams.get('paymentStatus') ||
      'all') as InvoiceControlFilters['paymentStatus'],
    page: parseFinancePage(searchParams.get('page')),
    pageSize: parseFinancePageSize(searchParams.get('pageSize')),
  }
}

export async function fetchFinanceDashboard(input: {
  companyId: string
  filters: InvoiceControlFilters
}): Promise<{
  kpis: InvoiceControlKpis
  invoices: InvoiceControlListItem[]
  total: number
  page: number
  pageSize: number
  error: { message: string } | null
}> {
  const empty = {
    kpis: computeInvoiceControlKpis({ invoices: [], payments: [] }),
    invoices: [] as InvoiceControlListItem[],
    total: 0,
    page: input.filters.page,
    pageSize: input.filters.pageSize,
    error: null as { message: string } | null,
  }
  if (!input.companyId) return empty

  const supabase = getSupabaseServerClient()
  const { filters } = input
  const range = resolveFinancePeriodRange({
    period: filters.period,
    from: filters.from,
    to: filters.to,
  })

  let paymentInvoiceIds: string[] | null = null
  if (filters.provider !== 'all' || filters.paymentStatus !== 'all') {
    let paymentQuery = supabase
      .from('invoice_payments')
      .select('invoice_id')
      .eq('company_id', input.companyId)
    if (filters.provider !== 'all') paymentQuery = paymentQuery.eq('provider', filters.provider)
    if (filters.paymentStatus !== 'all') {
      paymentQuery = paymentQuery.eq('status', filters.paymentStatus)
    }
    const paymentResult = await paymentQuery
    if (paymentResult.error) {
      return { ...empty, error: { message: paymentResult.error.message } }
    }
    paymentInvoiceIds = [
      ...new Set((paymentResult.data ?? []).map((row) => String(row.invoice_id)).filter(Boolean)),
    ]
    if (paymentInvoiceIds.length === 0) {
      return empty
    }
  }

  let quoteIds: string[] | null = null
  if (filters.quoteNumber) {
    const quotesResult = await supabase
      .from('quotes')
      .select('id')
      .eq('company_id', input.companyId)
      .ilike('quote_number', `%${filters.quoteNumber}%`)
    if (quotesResult.error) {
      return { ...empty, error: { message: quotesResult.error.message } }
    }
    quoteIds = (quotesResult.data ?? []).map((row) => String(row.id))
    if (quoteIds.length === 0) return empty
  }

  let serviceOrderIds: string[] | null = null
  if (filters.os) {
    const osResult = await supabase
      .from('service_orders')
      .select('id')
      .eq('company_id', input.companyId)
      .ilike('service_order_number', `%${filters.os}%`)
    if (osResult.error) {
      return { ...empty, error: { message: osResult.error.message } }
    }
    serviceOrderIds = (osResult.data ?? []).map((row) => String(row.id))
    if (serviceOrderIds.length === 0) return empty
  }

  let invoiceQuery = supabase
    .from('invoices')
    .select(INVOICE_LIST_SELECT)
    .eq('company_id', input.companyId)
    .order('created_at', { ascending: false })
    .limit(800)

  if (range.from) invoiceQuery = invoiceQuery.gte('created_at', range.from)
  if (range.to) invoiceQuery = invoiceQuery.lte('created_at', range.to)
  if (filters.status !== 'all') invoiceQuery = invoiceQuery.eq('status', filters.status)
  if (filters.invoiceKind !== 'all') invoiceQuery = invoiceQuery.eq('invoice_kind', filters.invoiceKind)
  if (filters.invoiceNumber) {
    invoiceQuery = invoiceQuery.ilike('invoice_number', `%${filters.invoiceNumber}%`)
  }
  if (paymentInvoiceIds) invoiceQuery = invoiceQuery.in('id', paymentInvoiceIds)
  if (quoteIds) invoiceQuery = invoiceQuery.in('quote_id', quoteIds)
  if (serviceOrderIds) invoiceQuery = invoiceQuery.in('service_order_id', serviceOrderIds)

  const invoicesResult = await invoiceQuery
  if (invoicesResult.error) {
    return { ...empty, error: { message: invoicesResult.error.message } }
  }

  let rows = (invoicesResult.data ?? []) as unknown as InvoiceRow[]
  if (filters.customer) {
    const needle = filters.customer.toLowerCase()
    rows = rows.filter((row) => {
      const name = snapshotFrom(row)?.customer?.name?.toLowerCase() || ''
      return name.includes(needle)
    })
  }

  const invoiceIds = rows.map((row) => String(row.id))
  const parentIds = [
    ...new Set(rows.map((row) => (row.parent_invoice_id ? String(row.parent_invoice_id) : '')).filter(Boolean)),
  ]
  const orderIds = [
    ...new Set(rows.map((row) => (row.service_order_id ? String(row.service_order_id) : '')).filter(Boolean)),
  ]

  const [paymentsResult, parentsResult, ordersResult] = await Promise.all([
    invoiceIds.length
      ? supabase
          .from('invoice_payments')
          .select('id, invoice_id, provider, status, created_at, captured_at')
          .eq('company_id', input.companyId)
          .in('invoice_id', invoiceIds)
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    parentIds.length
      ? supabase
          .from('invoices')
          .select('id, invoice_number')
          .eq('company_id', input.companyId)
          .in('id', parentIds)
      : Promise.resolve({ data: [], error: null }),
    orderIds.length
      ? supabase
          .from('service_orders')
          .select('id, service_order_number')
          .eq('company_id', input.companyId)
          .in('id', orderIds)
      : Promise.resolve({ data: [], error: null }),
  ])

  for (const result of [paymentsResult, parentsResult, ordersResult]) {
    if (result.error) return { ...empty, error: { message: result.error.message } }
  }

  const lastPaymentByInvoice = new Map<
    string,
    { provider: PaymentProvider; status: PaymentAttemptStatus; at: string }
  >()
  for (const payment of paymentsResult.data ?? []) {
    const invoiceId = String(payment.invoice_id)
    if (lastPaymentByInvoice.has(invoiceId)) continue
    lastPaymentByInvoice.set(invoiceId, {
      provider: payment.provider as PaymentProvider,
      status: payment.status as PaymentAttemptStatus,
      at: String(payment.captured_at || payment.created_at),
    })
  }
  const parentNumberById = new Map(
    (parentsResult.data ?? []).map((row) => [String(row.id), String(row.invoice_number)]),
  )
  const orderNumberById = new Map(
    (ordersResult.data ?? []).map((row) => [String(row.id), String(row.service_order_number)]),
  )

  const items = rows.map((row) => toListItem(row, lastPaymentByInvoice, parentNumberById, orderNumberById))
  const offset = (filters.page - 1) * filters.pageSize
  const pageRows = items.slice(offset, offset + filters.pageSize)

  return {
    kpis: computeInvoiceControlKpis({
      invoices: items,
      payments: (paymentsResult.data ?? []).map((payment) => ({
        status: payment.status as PaymentAttemptStatus,
      })),
    }),
    invoices: pageRows,
    total: items.length,
    page: filters.page,
    pageSize: filters.pageSize,
    error: null,
  }
}

function toListItem(
  row: InvoiceRow,
  lastPaymentByInvoice: Map<string, { provider: PaymentProvider; status: PaymentAttemptStatus; at: string }>,
  parentNumberById: Map<string, string>,
  orderNumberById: Map<string, string>,
): InvoiceControlListItem {
  const snapshot = snapshotFrom(row)
  const total = money(row.total)
  const paidTotal = money(row.paid_total)
  const lastPayment = lastPaymentByInvoice.get(String(row.id)) ?? null
  const parentId = row.parent_invoice_id ? String(row.parent_invoice_id) : null
  const serviceOrderId = row.service_order_id ? String(row.service_order_id) : null
  return {
    id: String(row.id),
    invoice_number: String(row.invoice_number),
    invoice_kind: (row.invoice_kind || 'original') as InvoiceKind,
    parent_invoice_id: parentId,
    parent_invoice_number: parentId ? parentNumberById.get(parentId) ?? null : null,
    quote_id: String(row.quote_id),
    quote_number: snapshot?.quote?.number ?? null,
    service_order_id: serviceOrderId,
    service_order_number: serviceOrderId ? orderNumberById.get(serviceOrderId) ?? null : null,
    closeout_id: row.closeout_id ? String(row.closeout_id) : null,
    customer_name: snapshot?.customer?.name?.trim() || '—',
    event_name: snapshot?.event?.name ?? null,
    event_date: snapshot?.event?.date ?? null,
    status: row.status as InvoiceStatus,
    currency_code: String(row.currency_code || snapshot?.totals?.currency || 'USD'),
    total,
    paid_total: paidTotal,
    outstanding_amount: Math.max(0, money(total - paidTotal)),
    last_provider: lastPayment?.provider ?? null,
    last_payment_status: lastPayment?.status ?? null,
    last_payment_at: lastPayment?.at ?? null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  }
}
