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
  InvoiceWorkspacePaymentPreview,
  InvoiceWorkspaceViewCounts,
} from './financeObservabilityTypes'
import {
  INVOICE_WORKSPACE_EXPORT_MAX,
  INVOICE_WORKSPACE_QUERY_CHUNK,
  INVOICE_WORKSPACE_WORKING_SET_CAP,
} from './financeObservabilityTypes'
import {
  chunkIds,
  compareInvoiceWorkspaceRows,
  computeInvoiceMovementTotals,
  countInvoiceWorkspaceViews,
  intersectIds,
  matchesInvoiceWorkspaceAmountFilters,
  matchesInvoiceWorkspaceView,
  parseInvoiceWorkspaceDirection,
  parseInvoiceWorkspaceSort,
  parseInvoiceWorkspaceView,
  parseOptionalFinanceMoney,
  resolvePaymentLinkState,
} from './invoiceWorkspace'
import type {
  InvoiceKind,
  InvoiceStatus,
  PaymentAttemptStatus,
  PaymentProvider,
} from './types'

const INVOICE_WORKSPACE_SELECT =
  'id, company_id, quote_id, invoice_number, invoice_kind, parent_invoice_id, service_order_id, closeout_id, status, currency_code, total, deposit_amount, balance_amount, paid_total, created_at, updated_at, customer_name:snapshot->customer->>name, customer_email:snapshot->customer->>email, customer_phone:snapshot->customer->>phone, event_name:snapshot->event->>name, event_date:snapshot->event->>date, snapshot_quote_number:snapshot->quote->>number'

const INVOICE_WORKSPACE_SELECT_FALLBACK =
  'id, company_id, quote_id, invoice_number, invoice_kind, parent_invoice_id, service_order_id, closeout_id, status, currency_code, snapshot, total, deposit_amount, balance_amount, paid_total, created_at, updated_at'

type InvoiceWorkspaceRow = Record<string, unknown>

type PaymentRow = {
  id: string
  invoice_id: string
  provider: PaymentProvider
  status: PaymentAttemptStatus
  amount: number
  currency_code: string
  created_at: string
  captured_at: string | null
}

type RefundRow = {
  invoice_id: string
  amount: number
  status: string
}

function money(value: unknown): number {
  const number = Number(value ?? 0)
  return Number.isFinite(number) ? Math.round(number * 100) / 100 : 0
}

function emptyViewCounts(): InvoiceWorkspaceViewCounts {
  return {
    all: 0,
    receivable: 0,
    partially_paid: 0,
    paid: 0,
    awaiting_deposit: 0,
    failed: 0,
    adjustments: 0,
    canceled: 0,
  }
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
    q: sanitizeFinanceSearch(searchParams.get('q')),
    invoiceNumber: sanitizeFinanceSearch(searchParams.get('invoiceNumber')),
    quoteNumber: sanitizeFinanceSearch(searchParams.get('quoteNumber')),
    os: sanitizeFinanceSearch(searchParams.get('os')),
    customer: sanitizeFinanceSearch(searchParams.get('customer')),
    status: (searchParams.get('status') || 'all') as InvoiceControlFilters['status'],
    invoiceKind: (searchParams.get('invoiceKind') || 'all') as InvoiceControlFilters['invoiceKind'],
    provider: (searchParams.get('provider') || 'all') as InvoiceControlFilters['provider'],
    paymentStatus: (searchParams.get('paymentStatus') ||
      'all') as InvoiceControlFilters['paymentStatus'],
    view: parseInvoiceWorkspaceView(searchParams.get('view')),
    sort: parseInvoiceWorkspaceSort(searchParams.get('sort')),
    direction: parseInvoiceWorkspaceDirection(searchParams.get('direction')),
    eventFrom: sanitizeFinanceSearch(searchParams.get('eventFrom')),
    eventTo: sanitizeFinanceSearch(searchParams.get('eventTo')),
    minTotal: parseOptionalFinanceMoney(searchParams.get('minTotal')),
    maxTotal: parseOptionalFinanceMoney(searchParams.get('maxTotal')),
    minOutstanding: parseOptionalFinanceMoney(searchParams.get('minOutstanding')),
    maxOutstanding: parseOptionalFinanceMoney(searchParams.get('maxOutstanding')),
    page: parseFinancePage(searchParams.get('page')),
    pageSize: parseFinancePageSize(searchParams.get('pageSize')),
  }
}

export async function fetchFinanceDashboard(input: {
  companyId: string
  filters: InvoiceControlFilters
  mode?: 'page' | 'export'
}): Promise<{
  kpis: InvoiceControlKpis
  invoices: InvoiceControlListItem[]
  viewCounts: InvoiceWorkspaceViewCounts
  total: number
  page: number
  pageSize: number
  sort: InvoiceControlFilters['sort']
  direction: InvoiceControlFilters['direction']
  truncated: boolean
  error: { message: string } | null
}> {
  const emptyKpis = computeInvoiceControlKpis({ invoices: [], payments: [] })
  const empty = {
    kpis: emptyKpis,
    invoices: [] as InvoiceControlListItem[],
    viewCounts: emptyViewCounts(),
    total: 0,
    page: input.filters.page,
    pageSize: input.filters.pageSize,
    sort: input.filters.sort,
    direction: input.filters.direction,
    truncated: false,
    error: null as { message: string } | null,
  }
  if (!input.companyId) return empty

  const started = Date.now()
  const supabase = getSupabaseServerClient()
  const { filters } = input
  const range = resolveFinancePeriodRange({
    period: filters.period,
    from: filters.from,
    to: filters.to,
  })

  const search = await resolveSearchInvoiceIds(supabase, input.companyId, filters)
  if (search.error) return { ...empty, error: search.error }
  const searchIds = search.ids
  if (searchIds && searchIds.length === 0) return empty

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
    paymentInvoiceIds = uniqueIds((paymentResult.data ?? []).map((row) => String(row.invoice_id)))
    if (paymentInvoiceIds.length === 0) return empty
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

  const constrainedIds = intersectIds(searchIds, paymentInvoiceIds)
  if (constrainedIds && constrainedIds.length === 0) return empty

  const working = await fetchMatchingInvoiceRows({
    supabase,
    companyId: input.companyId,
    filters,
    range,
    quoteIds,
    serviceOrderIds,
    constrainedIds,
  })
  if (working.error) return { ...empty, error: working.error }

  const invoiceIds = working.rows.map((row) => String(row.id))
  const [paymentsResult, refundsResult] = await Promise.all([
    fetchPaymentsForInvoices(supabase, input.companyId, invoiceIds),
    fetchRefundsForInvoices(supabase, input.companyId, invoiceIds),
  ])
  if (paymentsResult.error) return { ...empty, error: paymentsResult.error }
  if (refundsResult.error) return { ...empty, error: refundsResult.error }

  const paymentsByInvoice = groupPayments(paymentsResult.rows)
  const refundsByInvoice = groupRefunds(refundsResult.rows)
  const failedSet = new Set<string>()
  for (const payment of paymentsResult.rows) {
    if (payment.status === 'failed') failedSet.add(payment.invoice_id)
  }

  const enriched = working.rows.map((row) => {
    const invoiceId = String(row.id)
    const payments = paymentsByInvoice.get(invoiceId) ?? []
    const refunds = refundsByInvoice.get(invoiceId) ?? []
    const gross = payments
      .filter((payment) => payment.status === 'completed')
      .reduce((sum, payment) => sum + money(payment.amount), 0)
    const refunded = refunds
      .filter((refund) => refund.status === 'completed')
      .reduce((sum, refund) => sum + money(refund.amount), 0)
    const totals = computeInvoiceMovementTotals({
      invoiceTotal: money(row.total),
      paidTotal: money(row.paid_total),
      completedPaymentsTotal: gross,
      refundedTotal: refunded,
    })
    return {
      row,
      totals,
      payments,
      hasFailedPayment: failedSet.has(invoiceId),
    }
  })

  const afterAmounts = enriched.filter((item) =>
    matchesInvoiceWorkspaceAmountFilters(
      { total: item.totals.invoiceTotal, outstanding_amount: item.totals.outstanding },
      filters,
    ),
  )

  const viewCounts = countInvoiceWorkspaceViews(
    afterAmounts.map((item) => ({
      status: item.row.status as InvoiceStatus,
      invoice_kind: (item.row.invoice_kind || 'original') as InvoiceKind,
      outstanding_amount: item.totals.outstanding,
      has_failed_payment: item.hasFailedPayment,
    })),
  )

  const viewed = afterAmounts.filter((item) =>
    matchesInvoiceWorkspaceView({
      view: filters.view,
      status: item.row.status as InvoiceStatus,
      invoiceKind: (item.row.invoice_kind || 'original') as InvoiceKind,
      outstanding: item.totals.outstanding,
      hasFailedPayment: item.hasFailedPayment,
    }),
  )

  viewed.sort((left, right) =>
    compareInvoiceWorkspaceRows(
      {
        invoice_number: String(left.row.invoice_number || ''),
        customer_name: String(left.row.customer_name || ''),
        event_date: left.row.event_date ? String(left.row.event_date) : null,
        created_at: String(left.row.created_at || ''),
        total: left.totals.invoiceTotal,
        net_received: left.totals.netReceived,
        outstanding_amount: left.totals.outstanding,
        status: left.row.status as InvoiceStatus,
      },
      {
        invoice_number: String(right.row.invoice_number || ''),
        customer_name: String(right.row.customer_name || ''),
        event_date: right.row.event_date ? String(right.row.event_date) : null,
        created_at: String(right.row.created_at || ''),
        total: right.totals.invoiceTotal,
        net_received: right.totals.netReceived,
        outstanding_amount: right.totals.outstanding,
        status: right.row.status as InvoiceStatus,
      },
      filters.sort,
      filters.direction,
    ),
  )

  const exportMode = input.mode === 'export'
  const pageSize = exportMode ? INVOICE_WORKSPACE_EXPORT_MAX : filters.pageSize
  const page = exportMode ? 1 : filters.page
  const offset = (page - 1) * pageSize
  const pageItems = viewed.slice(offset, offset + pageSize)

  const parentIds = uniqueIds(
    pageItems
      .map((item) => (item.row.parent_invoice_id ? String(item.row.parent_invoice_id) : ''))
      .filter(Boolean),
  )
  const orderIds = uniqueIds(
    pageItems
      .map((item) => (item.row.service_order_id ? String(item.row.service_order_id) : ''))
      .filter(Boolean),
  )
  const pageQuoteIds = uniqueIds(
    pageItems.map((item) => (item.row.quote_id ? String(item.row.quote_id) : '')).filter(Boolean),
  )
  const pageInvoiceIds = pageItems.map((item) => String(item.row.id))

  const [parentsResult, ordersResult, quotesResult, linksResult] = await Promise.all([
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
    pageQuoteIds.length
      ? supabase
          .from('quotes')
          .select('id, quote_number')
          .eq('company_id', input.companyId)
          .in('id', pageQuoteIds)
      : Promise.resolve({ data: [], error: null }),
    pageInvoiceIds.length
      ? supabase
          .from('invoice_payment_links')
          .select('invoice_id, purpose, expires_at, revoked_at, created_at')
          .eq('company_id', input.companyId)
          .in('invoice_id', pageInvoiceIds)
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [], error: null }),
  ])

  for (const result of [parentsResult, ordersResult, quotesResult, linksResult]) {
    if (result.error) return { ...empty, error: { message: result.error.message } }
  }

  const parentNumberById = new Map(
    (parentsResult.data ?? []).map((row) => [String(row.id), String(row.invoice_number)]),
  )
  const orderNumberById = new Map(
    (ordersResult.data ?? []).map((row) => [String(row.id), String(row.service_order_number)]),
  )
  const quoteNumberById = new Map(
    (quotesResult.data ?? []).map((row) => [String(row.id), String(row.quote_number || '')]),
  )
  const linkStateByInvoice = new Map<string, 'active' | 'expired' | 'revoked'>()
  for (const link of linksResult.data ?? []) {
    const invoiceId = String(link.invoice_id)
    if (linkStateByInvoice.has(invoiceId)) continue
    linkStateByInvoice.set(
      invoiceId,
      resolvePaymentLinkState({
        revoked_at: link.revoked_at ? String(link.revoked_at) : null,
        expires_at: link.expires_at ? String(link.expires_at) : null,
      }),
    )
  }

  const invoices = pageItems.map((item) =>
    toListItem({
      row: item.row,
      totals: item.totals,
      payments: item.payments,
      parentNumberById,
      orderNumberById,
      quoteNumberById,
      paymentLinkState: linkStateByInvoice.get(String(item.row.id)) ?? null,
    }),
  )

  const kpis = computeInvoiceControlKpis({
    invoices: viewed.map((item) => ({
      status: item.row.status as InvoiceStatus,
      invoice_kind: (item.row.invoice_kind || 'original') as InvoiceKind,
      total: item.totals.invoiceTotal,
      paid_total: item.totals.paidTotal,
      currency_code: String(item.row.currency_code || 'USD'),
      outstanding_amount: item.totals.outstanding,
      refunded_total: item.totals.refunded,
      net_received: item.totals.netReceived,
      has_failed_payment: item.hasFailedPayment,
    })),
    payments: paymentsResult.rows
      .filter((payment) => viewed.some((item) => String(item.row.id) === payment.invoice_id))
      .map((payment) => ({ status: payment.status })),
  })

  if (process.env.NODE_ENV !== 'production') {
    console.info('[invoice-workspace]', {
      ms: Date.now() - started,
      companyScoped: true,
      matching: working.rows.length,
      viewed: viewed.length,
      page: invoices.length,
      truncated: working.truncated,
      sort: filters.sort,
      direction: filters.direction,
      view: filters.view,
    })
  }

  return {
    kpis,
    invoices,
    viewCounts,
    total: viewed.length,
    page,
    pageSize,
    sort: filters.sort,
    direction: filters.direction,
    truncated: working.truncated,
    error: null,
  }
}

async function resolveSearchInvoiceIds(
  supabase: ReturnType<typeof getSupabaseServerClient>,
  companyId: string,
  filters: InvoiceControlFilters,
): Promise<{ ids: string[] | null; error: { message: string } | null }> {
  const q = filters.q.trim()
  if (q.length < 2) return { ids: null, error: null }

  const like = `%${q}%`
  const [byNumber, byCustomer, quotes, orders, payments] = await Promise.all([
    supabase
      .from('invoices')
      .select('id')
      .eq('company_id', companyId)
      .ilike('invoice_number', like)
      .limit(500),
    supabase
      .from('invoices')
      .select('id')
      .eq('company_id', companyId)
      .filter('snapshot->customer->>name', 'ilike', like)
      .limit(500),
    supabase
      .from('quotes')
      .select('id')
      .eq('company_id', companyId)
      .ilike('quote_number', like)
      .limit(200),
    supabase
      .from('service_orders')
      .select('id')
      .eq('company_id', companyId)
      .ilike('service_order_number', like)
      .limit(200),
    q.length >= 6
      ? supabase
          .from('invoice_payments')
          .select('invoice_id')
          .eq('company_id', companyId)
          .or(`provider_order_id.ilike.${like},provider_capture_id.ilike.${like}`)
          .limit(200)
      : Promise.resolve({ data: [], error: null }),
  ])

  for (const result of [byNumber, byCustomer, quotes, orders, payments]) {
    if (result.error) return { ids: null, error: { message: result.error.message } }
  }

  const quoteIds = (quotes.data ?? []).map((row) => String(row.id))
  const orderIds = (orders.data ?? []).map((row) => String(row.id))
  const [byQuote, byOrder] = await Promise.all([
    quoteIds.length
      ? supabase
          .from('invoices')
          .select('id')
          .eq('company_id', companyId)
          .in('quote_id', quoteIds)
      : Promise.resolve({ data: [], error: null }),
    orderIds.length
      ? supabase
          .from('invoices')
          .select('id')
          .eq('company_id', companyId)
          .in('service_order_id', orderIds)
      : Promise.resolve({ data: [], error: null }),
  ])
  if (byQuote.error) return { ids: null, error: { message: byQuote.error.message } }
  if (byOrder.error) return { ids: null, error: { message: byOrder.error.message } }

  return {
    ids: uniqueIds([
      ...(byNumber.data ?? []).map((row) => String(row.id)),
      ...(byCustomer.data ?? []).map((row) => String(row.id)),
      ...(byQuote.data ?? []).map((row) => String(row.id)),
      ...(byOrder.data ?? []).map((row) => String(row.id)),
      ...(payments.data ?? []).map((row) => String(row.invoice_id)),
    ]),
    error: null,
  }
}

function applyInvoiceWorkspaceFilters(
  query: {
    eq: (column: string, value: string) => any
    gte: (column: string, value: string) => any
    lte: (column: string, value: string) => any
    ilike: (column: string, value: string) => any
    filter: (column: string, operator: string, value: string) => any
    in: (column: string, values: string[]) => any
  },
  input: {
    filters: InvoiceControlFilters
    range: { from: string | null; to: string | null }
    quoteIds: string[] | null
    serviceOrderIds: string[] | null
    constrainedIds: string[] | null
  },
) {
  let next: any = query
  if (input.range.from) next = next.gte('created_at', input.range.from)
  if (input.range.to) next = next.lte('created_at', input.range.to)
  if (input.filters.status !== 'all') next = next.eq('status', input.filters.status)
  if (input.filters.invoiceKind !== 'all') next = next.eq('invoice_kind', input.filters.invoiceKind)
  if (input.filters.invoiceNumber) {
    next = next.ilike('invoice_number', `%${input.filters.invoiceNumber}%`)
  }
  if (input.filters.customer) {
    next = next.filter('snapshot->customer->>name', 'ilike', `%${input.filters.customer}%`)
  }
  if (input.filters.eventFrom) {
    next = next.filter('snapshot->event->>date', 'gte', input.filters.eventFrom)
  }
  if (input.filters.eventTo) {
    next = next.filter('snapshot->event->>date', 'lte', input.filters.eventTo)
  }
  if (input.quoteIds) next = next.in('quote_id', input.quoteIds)
  if (input.serviceOrderIds) next = next.in('service_order_id', input.serviceOrderIds)
  if (input.constrainedIds) next = next.in('id', input.constrainedIds)
  return next
}

function hydrateWorkspaceRow(row: InvoiceWorkspaceRow): InvoiceWorkspaceRow {
  if (row.customer_name != null || !row.snapshot || typeof row.snapshot !== 'object') return row
  const snapshot = row.snapshot as {
    customer?: { name?: string | null; email?: string | null; phone?: string | null }
    event?: { name?: string | null; date?: string | null }
    quote?: { number?: string | null }
  }
  return {
    ...row,
    customer_name: snapshot.customer?.name ?? null,
    customer_email: snapshot.customer?.email ?? null,
    customer_phone: snapshot.customer?.phone ?? null,
    event_name: snapshot.event?.name ?? null,
    event_date: snapshot.event?.date ?? null,
    snapshot_quote_number: snapshot.quote?.number ?? null,
  }
}

async function fetchMatchingInvoiceRows(input: {
  supabase: ReturnType<typeof getSupabaseServerClient>
  companyId: string
  filters: InvoiceControlFilters
  range: { from: string | null; to: string | null }
  quoteIds: string[] | null
  serviceOrderIds: string[] | null
  constrainedIds: string[] | null
}): Promise<{
  rows: InvoiceWorkspaceRow[]
  truncated: boolean
  error: { message: string } | null
}> {
  const pageSize = 500
  const rows: InvoiceWorkspaceRow[] = []
  let from = 0
  let truncated = false
  let select = INVOICE_WORKSPACE_SELECT

  while (from < INVOICE_WORKSPACE_WORKING_SET_CAP) {
    const to = Math.min(from + pageSize - 1, INVOICE_WORKSPACE_WORKING_SET_CAP - 1)
    const result = await applyInvoiceWorkspaceFilters(
      input.supabase
        .from('invoices')
        .select(select)
        .eq('company_id', input.companyId)
        .order('created_at', { ascending: false })
        .range(from, to),
      input,
    )
    if (result.error && from === 0 && select === INVOICE_WORKSPACE_SELECT) {
      select = INVOICE_WORKSPACE_SELECT_FALLBACK
      continue
    }
    if (result.error) return { rows: [], truncated: false, error: { message: result.error.message } }
    const batch = ((result.data ?? []) as InvoiceWorkspaceRow[]).map(hydrateWorkspaceRow)
    rows.push(...batch)
    if (batch.length < pageSize) break
    from += pageSize
    if (from >= INVOICE_WORKSPACE_WORKING_SET_CAP) {
      truncated = true
      break
    }
  }

  return { rows, truncated, error: null }
}

async function fetchPaymentsForInvoices(
  supabase: ReturnType<typeof getSupabaseServerClient>,
  companyId: string,
  invoiceIds: string[],
): Promise<{ rows: PaymentRow[]; error: { message: string } | null }> {
  if (invoiceIds.length === 0) return { rows: [], error: null }
  const rows: PaymentRow[] = []
  for (const chunk of chunkIds(invoiceIds, INVOICE_WORKSPACE_QUERY_CHUNK)) {
    const result = await supabase
      .from('invoice_payments')
      .select('id, invoice_id, provider, status, amount, currency_code, created_at, captured_at')
      .eq('company_id', companyId)
      .in('invoice_id', chunk)
      .order('created_at', { ascending: false })
    if (result.error) return { rows: [], error: { message: result.error.message } }
    for (const row of result.data ?? []) {
      rows.push({
        id: String(row.id),
        invoice_id: String(row.invoice_id),
        provider: row.provider as PaymentProvider,
        status: row.status as PaymentAttemptStatus,
        amount: money(row.amount),
        currency_code: String(row.currency_code || 'USD'),
        created_at: String(row.created_at),
        captured_at: row.captured_at ? String(row.captured_at) : null,
      })
    }
  }
  return { rows, error: null }
}

async function fetchRefundsForInvoices(
  supabase: ReturnType<typeof getSupabaseServerClient>,
  companyId: string,
  invoiceIds: string[],
): Promise<{ rows: RefundRow[]; error: { message: string } | null }> {
  if (invoiceIds.length === 0) return { rows: [], error: null }
  const rows: RefundRow[] = []
  for (const chunk of chunkIds(invoiceIds, INVOICE_WORKSPACE_QUERY_CHUNK)) {
    const result = await supabase
      .from('invoice_refunds')
      .select('invoice_id, amount, status')
      .eq('company_id', companyId)
      .in('invoice_id', chunk)
    if (result.error) return { rows: [], error: { message: result.error.message } }
    for (const row of result.data ?? []) {
      rows.push({
        invoice_id: String(row.invoice_id),
        amount: money(row.amount),
        status: String(row.status),
      })
    }
  }
  return { rows, error: null }
}

function groupPayments(rows: PaymentRow[]) {
  const map = new Map<string, PaymentRow[]>()
  for (const row of rows) {
    const list = map.get(row.invoice_id) ?? []
    list.push(row)
    map.set(row.invoice_id, list)
  }
  return map
}

function groupRefunds(rows: RefundRow[]) {
  const map = new Map<string, RefundRow[]>()
  for (const row of rows) {
    const list = map.get(row.invoice_id) ?? []
    list.push(row)
    map.set(row.invoice_id, list)
  }
  return map
}

function uniqueIds(ids: string[]) {
  return [...new Set(ids.filter(Boolean))]
}

function toListItem(input: {
  row: InvoiceWorkspaceRow
  totals: ReturnType<typeof computeInvoiceMovementTotals>
  payments: PaymentRow[]
  parentNumberById: Map<string, string>
  orderNumberById: Map<string, string>
  quoteNumberById: Map<string, string>
  paymentLinkState: 'active' | 'expired' | 'revoked' | null
}): InvoiceControlListItem {
  const { row, totals } = input
  const lastPayment = input.payments[0] ?? null
  const parentId = row.parent_invoice_id ? String(row.parent_invoice_id) : null
  const serviceOrderId = row.service_order_id ? String(row.service_order_id) : null
  const quoteId = String(row.quote_id || '')
  const recentPayments: InvoiceWorkspacePaymentPreview[] = input.payments.slice(0, 5).map((payment) => ({
    id: payment.id,
    provider: payment.provider,
    status: payment.status,
    amount: payment.amount,
    currency_code: payment.currency_code,
    created_at: payment.created_at,
    captured_at: payment.captured_at,
  }))
  return {
    id: String(row.id),
    invoice_number: String(row.invoice_number),
    invoice_kind: (row.invoice_kind || 'original') as InvoiceKind,
    parent_invoice_id: parentId,
    parent_invoice_number: parentId ? input.parentNumberById.get(parentId) ?? null : null,
    quote_id: quoteId,
    quote_number:
      (quoteId && input.quoteNumberById.get(quoteId)) ||
      (row.snapshot_quote_number ? String(row.snapshot_quote_number) : null),
    service_order_id: serviceOrderId,
    service_order_number: serviceOrderId ? input.orderNumberById.get(serviceOrderId) ?? null : null,
    closeout_id: row.closeout_id ? String(row.closeout_id) : null,
    customer_name: String(row.customer_name || '').trim() || '—',
    customer_email: row.customer_email ? String(row.customer_email) : null,
    customer_phone: row.customer_phone ? String(row.customer_phone) : null,
    event_name: row.event_name ? String(row.event_name) : null,
    event_date: row.event_date ? String(row.event_date) : null,
    status: row.status as InvoiceStatus,
    currency_code: String(row.currency_code || 'USD'),
    total: totals.invoiceTotal,
    deposit_amount: money(row.deposit_amount),
    balance_amount: money(row.balance_amount),
    paid_total: totals.paidTotal,
    gross_received: totals.grossReceived,
    refunded_total: totals.refunded,
    net_received: totals.netReceived,
    outstanding_amount: totals.outstanding,
    divergence: totals.divergence,
    last_provider: lastPayment?.provider ?? null,
    last_payment_status: lastPayment?.status ?? null,
    last_payment_at: lastPayment ? lastPayment.captured_at || lastPayment.created_at : null,
    payment_link_state: input.paymentLinkState,
    recent_payments: recentPayments,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  }
}
