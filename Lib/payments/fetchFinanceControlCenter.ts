import 'server-only'

import { getSupabaseServerClient } from '@/Lib/supabaseServer'
import { resolveTenantCompanyDisplayName } from '@/Lib/tenant/companyDisplayName'
import { fetchPaypalOverview, fetchPaypalMonitors } from './fetchPaypalControl'
import {
  activityFromInvoice,
  buildAttentionItems,
  buildFinanceTrend,
  computeCaptureSuccessRate,
  emptyFinanceSearch,
  groupFinanceTotalsByCurrency,
  groupReconciliationRows,
  isPendingRefundStatus,
  mergeFinanceActivity,
  outboxDashboardCounts,
  parseFinanceControlPeriod,
  postEventFinalTotal,
  summarizeProviders,
} from './financeControlCenter'
import {
  detectOutboxHighlights,
  parseFinancePage,
  parseFinancePageSize,
  resolveFinancePeriodRange,
  sanitizeFinanceSearch,
  toOutboxObservabilityRow,
} from './financeObservability'
import type {
  FinanceActivityItem,
  FinanceAttentionItem,
  FinanceOverviewPayload,
  FinanceOutboxListRow,
  FinancePostEventRow,
  FinanceRefundRow,
  FinanceSearchResults,
} from './financeControlCenterTypes'
import type { InvoiceKind, InvoiceStatus, PaymentAttemptStatus, PaymentProvider } from './types'
import { sanitizeOutboxPayload } from './sanitizeFinanceObservability'

const INVOICE_SELECT =
  'id, invoice_number, invoice_kind, parent_invoice_id, quote_id, service_order_id, closeout_id, status, currency_code, snapshot, total, deposit_amount, paid_total, created_at, updated_at'

function money(value: unknown): number {
  const number = Number(value ?? 0)
  return Number.isFinite(number) ? Math.round(number * 100) / 100 : 0
}

function snapshotCustomer(snapshot: unknown): string | null {
  if (!snapshot || typeof snapshot !== 'object') return null
  const customer = (snapshot as { customer?: { name?: string } }).customer
  return customer?.name?.trim() || null
}

function snapshotQuoteNumber(snapshot: unknown): string | null {
  if (!snapshot || typeof snapshot !== 'object') return null
  const quote = (snapshot as { quote?: { number?: string } }).quote
  return quote?.number ?? null
}

function snapshotEvent(snapshot: unknown): { name: string | null; date: string | null } {
  if (!snapshot || typeof snapshot !== 'object') {
    return { name: null, date: null }
  }
  const event = (snapshot as { event?: { name?: string; date?: string } }).event
  return { name: event?.name ?? null, date: event?.date ?? null }
}

function appEnvironment(): 'DEV' | 'PROD' {
  const value = String(process.env.VERCEL_ENV || process.env.NEXT_PUBLIC_VERCEL_ENV || '').toLowerCase()
  return value === 'production' ? 'PROD' : 'DEV'
}

async function loadCompanyName(companyId: string): Promise<string | null> {
  const supabase = getSupabaseServerClient()
  const result = await supabase
    .from('companies')
    .select('company_name, trade_name, legal_name')
    .eq('id', companyId)
    .maybeSingle()
  if (result.error || !result.data) return null
  return resolveTenantCompanyDisplayName({
    id: companyId,
    company_name: result.data.company_name,
    trade_name: result.data.trade_name,
    legal_name: result.data.legal_name,
  })
}

export async function fetchFinanceOverview(input: {
  companyId: string
  period?: string | null
  from?: string | null
  to?: string | null
}): Promise<{ data: FinanceOverviewPayload | null; error: { message: string } | null }> {
  if (!input.companyId) {
    return { data: null, error: { message: 'company_required' } }
  }

  const period = parseFinanceControlPeriod(input.period)
  const range = resolveFinancePeriodRange({
    period,
    from: input.from,
    to: input.to,
  })
  const supabase = getSupabaseServerClient()

  const [companyName, invoicesResult, paymentsResult, refundsResult, outboxResult, providersResult, paypal] =
    await Promise.all([
      loadCompanyName(input.companyId),
      supabase
        .from('invoices')
        .select(INVOICE_SELECT)
        .eq('company_id', input.companyId)
        .order('created_at', { ascending: false })
        .limit(800),
      supabase
        .from('invoice_payments')
        .select('id, invoice_id, provider, status, amount, currency_code, created_at, captured_at')
        .eq('company_id', input.companyId)
        .order('created_at', { ascending: false })
        .limit(800),
      supabase
        .from('invoice_refunds')
        .select('id, amount, status, currency_code, requested_at, completed_at')
        .eq('company_id', input.companyId)
        .limit(800),
      supabase
        .from('finance_integration_outbox')
        .select('id, status, attempts, created_at, payload')
        .eq('company_id', input.companyId)
        .order('created_at', { ascending: false })
        .limit(200),
      supabase
        .from('company_payment_providers')
        .select('provider, enabled, environment')
        .eq('company_id', input.companyId),
      fetchPaypalOverview({
        companyId: input.companyId,
        period,
        from: range.from,
        to: range.to,
      }),
    ])

  for (const result of [invoicesResult, paymentsResult, refundsResult, outboxResult, providersResult]) {
    if (result.error) return { data: null, error: { message: result.error.message } }
  }

  const fromMs = range.from ? new Date(range.from).getTime() : 0
  const toMs = range.to ? new Date(range.to).getTime() : Date.now()
  const inPeriod = (value: string | null | undefined) => {
    if (!range.from && !range.to) return true
    if (!value) return false
    const time = new Date(value).getTime()
    return time >= fromMs && time <= toMs
  }

  const invoices = (invoicesResult.data ?? []).filter((row) => inPeriod(String(row.created_at)))
  const payments = (paymentsResult.data ?? []).filter((row) =>
    inPeriod(String(row.captured_at || row.created_at)),
  )
  const refunds = (refundsResult.data ?? []).filter((row) =>
    inPeriod(String(row.completed_at || row.requested_at)),
  )

  const currencies = groupFinanceTotalsByCurrency({
    invoices: invoices.map((invoice) => ({
      status: invoice.status as InvoiceStatus,
      invoice_kind: (invoice.invoice_kind || 'original') as InvoiceKind,
      currency_code: String(invoice.currency_code || 'USD'),
      total: money(invoice.total),
      paid_total: money(invoice.paid_total),
    })),
    payments: payments.map((payment) => ({
      status: payment.status as PaymentAttemptStatus,
      currency_code: String(payment.currency_code || 'USD'),
    })),
    refunds: refunds.map((refund) => ({
      status: String(refund.status),
      amount: money(refund.amount),
      currency_code: String(refund.currency_code || 'USD'),
    })),
  })

  const trend = buildFinanceTrend({
    invoices: invoices.map((invoice) => ({
      created_at: String(invoice.created_at),
      status: invoice.status as InvoiceStatus,
      currency_code: String(invoice.currency_code || 'USD'),
      total: money(invoice.total),
    })),
    payments: payments.map((payment) => ({
      captured_at: payment.captured_at ? String(payment.captured_at) : null,
      created_at: String(payment.created_at),
      status: payment.status as PaymentAttemptStatus,
      currency_code: String(payment.currency_code || 'USD'),
      amount: money(payment.amount),
    })),
    from: range.from,
    to: range.to,
  })

  const outboxRows = (outboxResult.data ?? []).map((row) => ({
    status: String(row.status),
    highlights: detectOutboxHighlights({
      status: String(row.status),
      attempts: Number(row.attempts || 0),
      created_at: String(row.created_at),
    }),
  }))

  const providers = summarizeProviders({
    configured: (providersResult.data ?? []).map((row) => ({
      provider: row.provider as PaymentProvider,
      enabled: row.enabled === true,
      environment: row.environment ? String(row.environment) : null,
    })),
    payments: (paymentsResult.data ?? []).map((payment) => ({
      provider: payment.provider as PaymentProvider,
      status: payment.status as PaymentAttemptStatus,
      amount: money(payment.amount),
      currency_code: String(payment.currency_code || 'USD'),
    })),
  })

  const paypalKpis = paypal.kpis
  const data: FinanceOverviewPayload = {
    company_name: companyName,
    app_environment: appEnvironment(),
    paypal_sandbox: paypal.health?.sandbox === true,
    paypal_fail_closed: paypal.failClosed,
    period: range.period,
    from: range.from,
    to: range.to,
    currencies,
    trend,
    paypal: {
      enabled: paypal.health?.enabled ?? null,
      environment: paypal.health?.environment ?? paypal.environment ?? null,
      connection_status: paypal.health?.connection_status ?? null,
      credentials_configured: paypal.health?.credentials_configured ?? null,
      webhook_configured: paypal.health?.webhook_configured ?? null,
      last_tested_at: paypal.health?.last_tested_at ?? null,
      transactions: paypalKpis?.payments_in_period ?? null,
      captured: paypalKpis?.captured_in_period ?? null,
      failed: paypalKpis?.failed_in_period ?? null,
      pending: paypalKpis?.pending_created ?? null,
      captured_value: paypalKpis?.total_captured ?? null,
      refunded_value: paypalKpis?.total_refunded ?? null,
      capture_success_rate:
        paypalKpis != null
          ? computeCaptureSuccessRate(paypalKpis.captured_in_period, paypalKpis.failed_in_period)
          : null,
      currency_code: paypalKpis?.currency_code || 'USD',
    },
    pscs_one: outboxDashboardCounts(outboxRows),
    providers,
  }

  return { data, error: paypal.error }
}

export async function fetchFinanceAttention(input: {
  companyId: string
}): Promise<{ data: FinanceAttentionItem[]; error: { message: string } | null }> {
  const supabase = getSupabaseServerClient()
  const [monitors, paymentsResult, refundsResult, invoicesResult] = await Promise.all([
    fetchPaypalMonitors({ companyId: input.companyId }),
    supabase
      .from('invoice_payments')
      .select('id, invoice_id, status, amount, currency_code')
      .eq('company_id', input.companyId)
      .eq('status', 'failed')
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('invoice_refunds')
      .select('id, invoice_id, status, amount, currency_code')
      .eq('company_id', input.companyId)
      .in('status', ['requested', 'processing'])
      .order('requested_at', { ascending: false })
      .limit(50),
    supabase
      .from('invoices')
      .select('id, invoice_number, snapshot')
      .eq('company_id', input.companyId)
      .limit(800),
  ])

  if (paymentsResult.error) return { data: [], error: { message: paymentsResult.error.message } }
  if (refundsResult.error) return { data: [], error: { message: refundsResult.error.message } }
  if (invoicesResult.error) return { data: [], error: { message: invoicesResult.error.message } }
  if (monitors.error) return { data: [], error: { message: monitors.error.message } }

  const invoicesById = new Map(
    (invoicesResult.data ?? []).map((invoice) => [
      String(invoice.id),
      {
        invoice_number: String(invoice.invoice_number),
        customer_name: snapshotCustomer(invoice.snapshot),
      },
    ]),
  )

  const alerts = [...monitors.idempotency, ...monitors.reconciliation]
  const items = buildAttentionItems({
    alerts,
    failedPayments: (paymentsResult.data ?? []).map((payment) => {
      const invoice = payment.invoice_id ? invoicesById.get(String(payment.invoice_id)) : null
      return {
        id: String(payment.id),
        invoice_id: payment.invoice_id ? String(payment.invoice_id) : null,
        invoice_number: invoice?.invoice_number ?? null,
        customer_name: invoice?.customer_name ?? null,
        amount: money(payment.amount),
        currency_code: String(payment.currency_code || 'USD'),
      }
    }),
    pendingRefunds: (refundsResult.data ?? []).map((refund) => {
      const invoice = invoicesById.get(String(refund.invoice_id))
      return {
        id: String(refund.id),
        invoice_id: String(refund.invoice_id),
        invoice_number: invoice?.invoice_number ?? null,
        customer_name: invoice?.customer_name ?? null,
        amount: money(refund.amount),
        currency_code: String(refund.currency_code || 'USD'),
      }
    }),
    outbox: monitors.outbox,
  })

  return { data: items, error: null }
}

export async function fetchFinanceActivity(input: {
  companyId: string
  page?: number
  pageSize?: number
}): Promise<{
  data: FinanceActivityItem[]
  total: number
  page: number
  pageSize: number
  error: { message: string } | null
}> {
  const page = input.page && input.page > 0 ? input.page : 1
  const pageSize = input.pageSize && input.pageSize > 0 ? Math.min(input.pageSize, 50) : 25
  const supabase = getSupabaseServerClient()
  const [invoicesResult, paymentsResult, refundsResult, outboxResult] = await Promise.all([
    supabase
      .from('invoices')
      .select('id, invoice_number, invoice_kind, status, total, paid_total, currency_code, snapshot, created_at, updated_at')
      .eq('company_id', input.companyId)
      .order('created_at', { ascending: false })
      .limit(80),
    supabase
      .from('invoice_payments')
      .select('id, invoice_id, provider, status, amount, currency_code, created_at, captured_at')
      .eq('company_id', input.companyId)
      .order('created_at', { ascending: false })
      .limit(80),
    supabase
      .from('invoice_refunds')
      .select('id, invoice_id, amount, currency_code, status, requested_at, completed_at')
      .eq('company_id', input.companyId)
      .order('requested_at', { ascending: false })
      .limit(40),
    supabase
      .from('finance_integration_outbox')
      .select('id, event_type, status, created_at, published_at, payload')
      .eq('company_id', input.companyId)
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(40),
  ])

  for (const result of [invoicesResult, paymentsResult, refundsResult, outboxResult]) {
    if (result.error) {
      return { data: [], total: 0, page, pageSize, error: { message: result.error.message } }
    }
  }

  const invoiceMeta = new Map(
    (invoicesResult.data ?? []).map((invoice) => [
      String(invoice.id),
      {
        invoice_number: String(invoice.invoice_number),
        customer_name: snapshotCustomer(invoice.snapshot),
      },
    ]),
  )

  const items: FinanceActivityItem[] = []
  for (const invoice of invoicesResult.data ?? []) {
    items.push(
      ...activityFromInvoice({
        id: String(invoice.id),
        invoice_number: String(invoice.invoice_number),
        invoice_kind: (invoice.invoice_kind || 'original') as InvoiceKind,
        status: invoice.status as InvoiceStatus,
        created_at: String(invoice.created_at),
        updated_at: invoice.updated_at ? String(invoice.updated_at) : null,
        customer_name: snapshotCustomer(invoice.snapshot),
        total: money(invoice.total),
        paid_total: money(invoice.paid_total),
        currency_code: String(invoice.currency_code || 'USD'),
      }),
    )
  }

  for (const payment of paymentsResult.data ?? []) {
    const invoice = payment.invoice_id ? invoiceMeta.get(String(payment.invoice_id)) : null
    if (payment.status === 'completed') {
      items.push({
        id: `payment:${payment.id}:completed`,
        kind: payment.provider === 'paypal' ? 'paypal_captured' : 'manual_reconciled',
        occurred_at: String(payment.captured_at || payment.created_at),
        invoice_id: payment.invoice_id ? String(payment.invoice_id) : null,
        invoice_number: invoice?.invoice_number ?? null,
        customer_name: invoice?.customer_name ?? null,
        amount: money(payment.amount),
        currency_code: String(payment.currency_code || 'USD'),
        href: payment.invoice_id ? `/invoices/${payment.invoice_id}` : '/payments/paypal-control',
      })
    }
  }

  for (const refund of refundsResult.data ?? []) {
    const invoice = invoiceMeta.get(String(refund.invoice_id))
    items.push({
      id: `refund:${refund.id}:${refund.status}`,
      kind: refund.status === 'completed' ? 'refund_completed' : 'refund_requested',
      occurred_at: String(refund.completed_at || refund.requested_at),
      invoice_id: String(refund.invoice_id),
      invoice_number: invoice?.invoice_number ?? null,
      customer_name: invoice?.customer_name ?? null,
      amount: money(refund.amount),
      currency_code: String(refund.currency_code || 'USD'),
      href: '/finance/refunds',
    })
  }

  for (const row of outboxResult.data ?? []) {
    const payload = sanitizeOutboxPayload(row.payload)
    items.push({
      id: `outbox:${row.id}`,
      kind: 'outbox_published',
      occurred_at: String(row.published_at || row.created_at),
      invoice_id: payload.invoice_id ? String(payload.invoice_id) : null,
      invoice_number: payload.invoice_number ? String(payload.invoice_number) : null,
      customer_name: null,
      amount: null,
      currency_code: null,
      href: '/finance/pscs-one',
    })
  }

  const merged = mergeFinanceActivity(items, 200)
  const offset = (page - 1) * pageSize
  return {
    data: merged.slice(offset, offset + pageSize),
    total: merged.length,
    page,
    pageSize,
    error: null,
  }
}

export async function fetchFinanceSearch(input: {
  companyId: string
  q: string
}): Promise<{ data: FinanceSearchResults; error: { message: string } | null }> {
  const query = sanitizeFinanceSearch(input.q)
  if (query.length < 2) return { data: emptyFinanceSearch(query), error: null }

  const supabase = getSupabaseServerClient()
  const like = `%${query}%`
  const [invoicesResult, paymentsResult, quotesResult, ordersResult] = await Promise.all([
    supabase
      .from('invoices')
      .select('id, invoice_number, snapshot, currency_code, total, status')
      .eq('company_id', input.companyId)
      .or(`invoice_number.ilike.${like}`)
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('invoice_payments')
      .select('id, invoice_id, provider_order_id, provider_capture_id, amount, currency_code, status')
      .eq('company_id', input.companyId)
      .or(`provider_order_id.ilike.${like},provider_capture_id.ilike.${like}`)
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('quotes')
      .select('id, quote_number')
      .eq('company_id', input.companyId)
      .ilike('quote_number', like)
      .order('created_at', { ascending: false })
      .limit(8),
    supabase
      .from('service_orders')
      .select('id, service_order_number')
      .eq('company_id', input.companyId)
      .ilike('service_order_number', like)
      .order('created_at', { ascending: false })
      .limit(8),
  ])

  for (const result of [invoicesResult, paymentsResult, quotesResult, ordersResult]) {
    if (result.error) return { data: emptyFinanceSearch(query), error: { message: result.error.message } }
  }

  const needle = query.toLowerCase()
  const invoices = (invoicesResult.data ?? [])
    .filter((invoice) => {
      const number = String(invoice.invoice_number || '').toLowerCase()
      const customer = (snapshotCustomer(invoice.snapshot) || '').toLowerCase()
      const quote = (snapshotQuoteNumber(invoice.snapshot) || '').toLowerCase()
      return number.includes(needle) || customer.includes(needle) || quote.includes(needle)
    })
    .slice(0, 8)
    .map((invoice) => ({
      id: String(invoice.id),
      label: String(invoice.invoice_number),
      secondary: snapshotCustomer(invoice.snapshot),
      href: `/invoices/${invoice.id}`,
      currency_code: String(invoice.currency_code || 'USD'),
      amount: money(invoice.total),
    }))

  // Customer / quote fallback: scan a bounded invoice window when number search missed.
  if (invoices.length < 8) {
    const extra = await supabase
      .from('invoices')
      .select('id, invoice_number, snapshot, currency_code, total')
      .eq('company_id', input.companyId)
      .order('created_at', { ascending: false })
      .limit(120)
    if (!extra.error) {
      const seen = new Set(invoices.map((item) => item.id))
      for (const invoice of extra.data ?? []) {
        if (seen.has(String(invoice.id))) continue
        const customer = snapshotCustomer(invoice.snapshot)
        const quote = snapshotQuoteNumber(invoice.snapshot)
        if (
          (customer && customer.toLowerCase().includes(needle)) ||
          (quote && quote.toLowerCase().includes(needle))
        ) {
          invoices.push({
            id: String(invoice.id),
            label: String(invoice.invoice_number),
            secondary: customer,
            href: `/invoices/${invoice.id}`,
            currency_code: String(invoice.currency_code || 'USD'),
            amount: money(invoice.total),
          })
          seen.add(String(invoice.id))
        }
        if (invoices.length >= 8) break
      }
    }
  }

  return {
    data: {
      query,
      invoices,
      payments: (paymentsResult.data ?? []).slice(0, 8).map((payment) => ({
        id: String(payment.id),
        label: String(payment.provider_order_id || payment.provider_capture_id || payment.id),
        secondary: payment.invoice_id ? String(payment.invoice_id) : null,
        href: payment.invoice_id ? `/invoices/${payment.invoice_id}` : '/payments/paypal-control',
        currency_code: String(payment.currency_code || 'USD'),
        amount: money(payment.amount),
      })),
      quotes: (quotesResult.data ?? []).map((quote) => ({
        id: String(quote.id),
        label: String(quote.quote_number || quote.id),
        secondary: null,
        href: `/quotes/${quote.id}`,
      })),
      service_orders: (ordersResult.data ?? []).map((order) => ({
        id: String(order.id),
        label: String(order.service_order_number || order.id),
        secondary: null,
        href: `/orders/${order.id}`,
      })),
    },
    error: null,
  }
}

export async function fetchFinanceRefunds(input: {
  companyId: string
  searchParams: URLSearchParams
}): Promise<{
  data: FinanceRefundRow[]
  total: number
  page: number
  pageSize: number
  error: { message: string } | null
}> {
  const page = parseFinancePage(input.searchParams.get('page'))
  const pageSize = parseFinancePageSize(input.searchParams.get('pageSize'))
  const status = input.searchParams.get('status')
  const provider = input.searchParams.get('provider')
  const invoice = sanitizeFinanceSearch(input.searchParams.get('invoice'))
  const customer = sanitizeFinanceSearch(input.searchParams.get('customer'))
  const range = resolveFinancePeriodRange({
    period: input.searchParams.get('period') || 'all',
    from: input.searchParams.get('from'),
    to: input.searchParams.get('to'),
  })

  const supabase = getSupabaseServerClient()
  let query = supabase
    .from('invoice_refunds')
    .select(
      'id, invoice_id, payment_id, amount, currency_code, status, reason, provider_refund_id, requested_at, completed_at',
    )
    .eq('company_id', input.companyId)
    .order('requested_at', { ascending: false })
    .limit(400)

  if (status && status !== 'all') query = query.eq('status', status)
  if (range.from) query = query.gte('requested_at', range.from)
  if (range.to) query = query.lte('requested_at', range.to)

  const refundsResult = await query
  if (refundsResult.error) {
    return { data: [], total: 0, page, pageSize, error: { message: refundsResult.error.message } }
  }

  const refunds = refundsResult.data ?? []
  const invoiceIds = [...new Set(refunds.map((row) => String(row.invoice_id)))]
  const paymentIds = [...new Set(refunds.map((row) => String(row.payment_id)))]

  const [invoicesResult, paymentsResult] = await Promise.all([
    invoiceIds.length
      ? supabase
          .from('invoices')
          .select('id, invoice_number, snapshot')
          .eq('company_id', input.companyId)
          .in('id', invoiceIds)
      : Promise.resolve({ data: [], error: null }),
    paymentIds.length
      ? supabase
          .from('invoice_payments')
          .select('id, provider')
          .eq('company_id', input.companyId)
          .in('id', paymentIds)
      : Promise.resolve({ data: [], error: null }),
  ])
  if (invoicesResult.error) {
    return { data: [], total: 0, page, pageSize, error: { message: invoicesResult.error.message } }
  }
  if (paymentsResult.error) {
    return { data: [], total: 0, page, pageSize, error: { message: paymentsResult.error.message } }
  }

  const invoicesById = new Map(
    (invoicesResult.data ?? []).map((invoice) => [
      String(invoice.id),
      {
        invoice_number: String(invoice.invoice_number),
        customer_name: snapshotCustomer(invoice.snapshot),
      },
    ]),
  )
  const providerByPayment = new Map(
    (paymentsResult.data ?? []).map((payment) => [String(payment.id), payment.provider as PaymentProvider]),
  )

  let rows: FinanceRefundRow[] = refunds.map((refund) => {
    const invoiceRow = invoicesById.get(String(refund.invoice_id))
    return {
      id: String(refund.id),
      invoice_id: String(refund.invoice_id),
      invoice_number: invoiceRow?.invoice_number ?? null,
      customer_name: invoiceRow?.customer_name ?? null,
      provider: providerByPayment.get(String(refund.payment_id)) ?? null,
      payment_id: String(refund.payment_id),
      amount: money(refund.amount),
      currency_code: String(refund.currency_code || 'USD'),
      status: refund.status as FinanceRefundRow['status'],
      reason: String(refund.reason || ''),
      requested_at: String(refund.requested_at),
      completed_at: refund.completed_at ? String(refund.completed_at) : null,
      provider_refund_id: refund.provider_refund_id ? String(refund.provider_refund_id) : null,
    }
  })

  if (provider && provider !== 'all') {
    rows = rows.filter((row) => row.provider === provider)
  }
  if (invoice) {
    const needle = invoice.toLowerCase()
    rows = rows.filter((row) => (row.invoice_number || '').toLowerCase().includes(needle))
  }
  if (customer) {
    const needle = customer.toLowerCase()
    rows = rows.filter((row) => (row.customer_name || '').toLowerCase().includes(needle))
  }

  const offset = (page - 1) * pageSize
  return {
    data: rows.slice(offset, offset + pageSize),
    total: rows.length,
    page,
    pageSize,
    error: null,
  }
}

export async function fetchFinancePostEvent(input: {
  companyId: string
  searchParams?: URLSearchParams
}): Promise<{
  data: FinancePostEventRow[]
  total: number
  page: number
  pageSize: number
  error: { message: string } | null
}> {
  const page = parseFinancePage(input.searchParams?.get('page'))
  const pageSize = parseFinancePageSize(input.searchParams?.get('pageSize'))
  const supabase = getSupabaseServerClient()
  const closeoutsResult = await supabase
    .from('event_financial_closeouts')
    .select(
      'id, service_order_id, original_invoice_id, supplemental_invoice_id, status, currency_code, original_invoice_total, contracted_billable_guests, final_billable_guests, billable_guest_overage, extra_services_total, adjustment_total',
    )
    .eq('company_id', input.companyId)
    .order('updated_at', { ascending: false })
    .limit(200)

  if (closeoutsResult.error) {
    return { data: [], total: 0, page, pageSize, error: { message: closeoutsResult.error.message } }
  }

  const closeouts = closeoutsResult.data ?? []
  const invoiceIds = [
    ...new Set(
      closeouts.flatMap((row) =>
        [row.original_invoice_id, row.supplemental_invoice_id].filter(Boolean).map(String),
      ),
    ),
  ]
  const orderIds = [...new Set(closeouts.map((row) => String(row.service_order_id)))]

  const [invoicesResult, ordersResult] = await Promise.all([
    invoiceIds.length
      ? supabase
          .from('invoices')
          .select('id, invoice_number, snapshot, status, paid_total, total')
          .eq('company_id', input.companyId)
          .in('id', invoiceIds)
      : Promise.resolve({ data: [], error: null }),
    orderIds.length
      ? supabase
          .from('service_orders')
          .select('id, service_order_number')
          .eq('company_id', input.companyId)
          .in('id', orderIds)
      : Promise.resolve({ data: [], error: null }),
  ])
  if (invoicesResult.error) {
    return { data: [], total: 0, page, pageSize, error: { message: invoicesResult.error.message } }
  }
  if (ordersResult.error) {
    return { data: [], total: 0, page, pageSize, error: { message: ordersResult.error.message } }
  }

  const invoicesById = new Map(
    (invoicesResult.data ?? []).map((invoice) => [String(invoice.id), invoice]),
  )
  const ordersById = new Map(
    (ordersResult.data ?? []).map((order) => [String(order.id), String(order.service_order_number)]),
  )

  const rows: FinancePostEventRow[] = closeouts.map((closeout) => {
    const original = invoicesById.get(String(closeout.original_invoice_id))
    const supplemental = closeout.supplemental_invoice_id
      ? invoicesById.get(String(closeout.supplemental_invoice_id))
      : null
    const event = snapshotEvent(original?.snapshot)
    const totals = postEventFinalTotal(
      money(closeout.original_invoice_total),
      money(closeout.adjustment_total),
    )
    return {
      id: String(closeout.id),
      customer_name: snapshotCustomer(original?.snapshot),
      service_order_id: String(closeout.service_order_id),
      service_order_number: ordersById.get(String(closeout.service_order_id)) ?? null,
      event_name: event.name,
      event_date: event.date,
      original_invoice_id: String(closeout.original_invoice_id),
      original_invoice_number: original?.invoice_number ? String(original.invoice_number) : null,
      original_invoice_total: totals.original_total,
      contracted_billable_guests: money(closeout.contracted_billable_guests),
      final_billable_guests:
        closeout.final_billable_guests == null ? null : money(closeout.final_billable_guests),
      billable_guest_overage: money(closeout.billable_guest_overage),
      extra_services_total: money(closeout.extra_services_total),
      adjustment_total: totals.adjustment_total,
      supplemental_invoice_id: closeout.supplemental_invoice_id
        ? String(closeout.supplemental_invoice_id)
        : null,
      supplemental_invoice_number: supplemental?.invoice_number
        ? String(supplemental.invoice_number)
        : null,
      supplemental_status: (supplemental?.status as InvoiceStatus) ?? null,
      supplemental_paid_total: supplemental ? money(supplemental.paid_total) : null,
      currency_code: String(closeout.currency_code || 'USD'),
      status: String(closeout.status),
      final_event_total: totals.final_event_total,
    }
  })

  const offset = (page - 1) * pageSize
  return {
    data: rows.slice(offset, offset + pageSize),
    total: rows.length,
    page,
    pageSize,
    error: null,
  }
}

export async function fetchFinanceProviders(input: { companyId: string }) {
  const supabase = getSupabaseServerClient()
  const [providersResult, paymentsResult] = await Promise.all([
    supabase
      .from('company_payment_providers')
      .select('provider, enabled, environment')
      .eq('company_id', input.companyId),
    supabase
      .from('invoice_payments')
      .select('provider, status, amount, currency_code')
      .eq('company_id', input.companyId)
      .limit(800),
  ])
  if (providersResult.error) return { data: [], error: { message: providersResult.error.message } }
  if (paymentsResult.error) return { data: [], error: { message: paymentsResult.error.message } }

  return {
    data: summarizeProviders({
      configured: (providersResult.data ?? []).map((row) => ({
        provider: row.provider as PaymentProvider,
        enabled: row.enabled === true,
        environment: row.environment ? String(row.environment) : null,
      })),
      payments: (paymentsResult.data ?? []).map((payment) => ({
        provider: payment.provider as PaymentProvider,
        status: payment.status as PaymentAttemptStatus,
        amount: money(payment.amount),
        currency_code: String(payment.currency_code || 'USD'),
      })),
    }),
    error: null,
  }
}

export async function fetchFinanceReconciliation(input: { companyId: string }) {
  const supabase = getSupabaseServerClient()
  const [invoicesResult, paymentsResult, refundsResult] = await Promise.all([
    supabase
      .from('invoices')
      .select('id, invoice_number, invoice_kind, status, total, paid_total, deposit_amount, currency_code, snapshot')
      .eq('company_id', input.companyId)
      .order('created_at', { ascending: false })
      .limit(800),
    supabase
      .from('invoice_payments')
      .select('invoice_id, status, amount, currency_code')
      .eq('company_id', input.companyId)
      .limit(800),
    supabase
      .from('invoice_refunds')
      .select('invoice_id, status, amount')
      .eq('company_id', input.companyId)
      .limit(800),
  ])
  for (const result of [invoicesResult, paymentsResult, refundsResult]) {
    if (result.error) return { data: [], error: { message: result.error.message } }
  }

  const rows = groupReconciliationRows({
    invoices: (invoicesResult.data ?? []).map((invoice) => ({
      id: String(invoice.id),
      invoice_number: String(invoice.invoice_number),
      customer_name: snapshotCustomer(invoice.snapshot),
      currency_code: String(invoice.currency_code || 'USD'),
      status: invoice.status as InvoiceStatus,
      invoice_kind: (invoice.invoice_kind || 'original') as InvoiceKind,
      total: money(invoice.total),
      paid_total: money(invoice.paid_total),
      deposit_amount: money(invoice.deposit_amount),
    })),
    payments: (paymentsResult.data ?? []).map((payment) => ({
      invoice_id: payment.invoice_id ? String(payment.invoice_id) : null,
      status: payment.status as PaymentAttemptStatus,
      amount: money(payment.amount),
      currency_code: String(payment.currency_code || 'USD'),
    })),
    refunds: (refundsResult.data ?? []).map((refund) => ({
      invoice_id: String(refund.invoice_id),
      status: String(refund.status),
      amount: money(refund.amount),
    })),
  })

  return { data: rows, error: null }
}

export async function fetchFinancePscsOne(input: {
  companyId: string
  searchParams?: URLSearchParams
}): Promise<{
  data: FinanceOutboxListRow[]
  counts: ReturnType<typeof outboxDashboardCounts>
  total: number
  page: number
  pageSize: number
  error: { message: string } | null
}> {
  const page = parseFinancePage(input.searchParams?.get('page'))
  const pageSize = parseFinancePageSize(input.searchParams?.get('pageSize'))
  const status = input.searchParams?.get('status')
  const supabase = getSupabaseServerClient()
  let query = supabase
    .from('finance_integration_outbox')
    .select(
      'id, event_type, aggregate_type, aggregate_id, dedup_key, destination, status, attempts, available_at, published_at, last_error, created_at, payload',
    )
    .eq('company_id', input.companyId)
    .order('created_at', { ascending: false })
    .limit(200)
  if (status && status !== 'all') query = query.eq('status', status)

  const result = await query
  if (result.error) {
    return {
      data: [],
      counts: { pending: 0, published: 0, failed: 0, stale_pending: 0 },
      total: 0,
      page,
      pageSize,
      error: { message: result.error.message },
    }
  }

  const mapped = (result.data ?? []).map((row) => {
    const payload = sanitizeOutboxPayload(row.payload)
    const observability = toOutboxObservabilityRow({
      id: String(row.id),
      event_type: String(row.event_type),
      aggregate_type: String(row.aggregate_type),
      aggregate_id: String(row.aggregate_id),
      dedup_key: String(row.dedup_key),
      destination: String(row.destination),
      status: String(row.status),
      attempts: Number(row.attempts || 0),
      available_at: String(row.available_at),
      published_at: row.published_at ? String(row.published_at) : null,
      last_error: row.last_error ? String(row.last_error) : null,
      created_at: String(row.created_at),
      invoice_id: payload.invoice_id ? String(payload.invoice_id) : null,
      invoice_number: payload.invoice_number ? String(payload.invoice_number) : null,
      invoice_kind: (payload.invoice_kind as InvoiceKind) || null,
      parent_invoice_id: payload.parent_invoice_id ? String(payload.parent_invoice_id) : null,
      payment_id: payload.payment_id ? String(payload.payment_id) : null,
    })
    return observability
  })

  const counts = outboxDashboardCounts(mapped)
  const offset = (page - 1) * pageSize
  return {
    data: mapped.slice(offset, offset + pageSize).map((row) => ({
      id: row.id,
      event_type: row.event_type,
      invoice_id: row.invoice_id,
      invoice_number: row.invoice_number,
      payment_id: row.payment_id,
      aggregate_type: row.aggregate_type,
      aggregate_id: row.aggregate_id,
      status: row.status,
      attempts: row.attempts,
      created_at: row.created_at,
      published_at: row.published_at,
      last_error: row.last_error,
    })),
    counts,
    total: mapped.length,
    page,
    pageSize,
    error: null,
  }
}

export { isPendingRefundStatus }
