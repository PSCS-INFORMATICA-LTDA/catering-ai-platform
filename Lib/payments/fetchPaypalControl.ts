import 'server-only'

import { getSupabaseServerClient } from '@/Lib/supabaseServer'
import { hasCompanyPaypalSecret } from './secretVault'
import { loadCompanyPaypalRow } from './companyPaypal'
import {
  classifyScheduleHold,
  detectIdempotencyIssues,
  detectReconciliationAlerts,
  parseFinancePage,
  parseFinancePageSize,
  resolveFinancePeriodRange,
  sanitizeFinanceSearch,
  toOutboxObservabilityRow,
} from './financeObservability'
import type {
  FinanceOutboxRow,
  ObservabilityAlert,
  PaypalControlKpis,
  PaypalProviderHealth,
  PaypalTransactionRow,
  ScheduleHoldObservability,
} from './financeObservabilityTypes'
import {
  sanitizeOutboxPayload,
  sanitizePaymentMetadataForBackoffice,
  sanitizePaypalProviderForObservability,
  summarizeIdempotencyKey,
} from './sanitizeFinanceObservability'
import type { InvoiceKind, InvoiceStatus, PaymentAttemptStatus, PaymentPurpose } from './types'

function money(value: unknown): number {
  const number = Number(value ?? 0)
  return Number.isFinite(number) ? Math.round(number * 100) / 100 : 0
}

export async function fetchPaypalOverview(input: {
  companyId: string
  period?: string | null
  from?: string | null
  to?: string | null
}): Promise<{
  failClosed: boolean
  environment: string
  health: PaypalProviderHealth | null
  kpis: PaypalControlKpis | null
  error: { message: string } | null
}> {
  const row = await loadCompanyPaypalRow(input.companyId)
  const secretConfigured = await hasCompanyPaypalSecret(input.companyId)
  const health = sanitizePaypalProviderForObservability({
    enabled: row?.enabled === true,
    environment: row?.environment ? String(row.environment) : 'sandbox',
    publicClientId: row?.public_client_id ? String(row.public_client_id) : null,
    webhookRouteKey: row?.webhook_route_key ? String(row.webhook_route_key) : null,
    metadata: row?.metadata,
    secretConfigured,
  })

  if (!health.sandbox) {
    return {
      failClosed: true,
      environment: health.environment,
      health,
      kpis: null,
      error: null,
    }
  }

  const range = resolveFinancePeriodRange({
    period: input.period || 'today',
    from: input.from,
    to: input.to,
  })
  const supabase = getSupabaseServerClient()
  const [paymentsResult, refundsResult] = await Promise.all([
    supabase
      .from('invoice_payments')
      .select('id, status, amount, currency_code, created_at, captured_at')
      .eq('company_id', input.companyId)
      .eq('provider', 'paypal')
      .order('created_at', { ascending: false })
      .limit(800),
    supabase
      .from('invoice_refunds')
      .select('id, amount, status, completed_at, requested_at, payment_id')
      .eq('company_id', input.companyId)
      .eq('status', 'completed')
      .limit(800),
  ])

  if (paymentsResult.error) return { failClosed: false, environment: health.environment, health, kpis: null, error: { message: paymentsResult.error.message } }
  if (refundsResult.error) return { failClosed: false, environment: health.environment, health, kpis: null, error: { message: refundsResult.error.message } }

  const fromMs = range.from ? new Date(range.from).getTime() : 0
  const toMs = range.to ? new Date(range.to).getTime() : Date.now()
  const inPeriod = (value: string | null | undefined) => {
    if (!value) return false
    const time = new Date(value).getTime()
    return time >= fromMs && time <= toMs
  }

  const payments = paymentsResult.data ?? []
  const paypalPaymentIds = new Set(payments.map((payment) => String(payment.id)))
  const refunds = (refundsResult.data ?? []).filter((refund) => paypalPaymentIds.has(String(refund.payment_id)))
  const capturedInPeriod = payments.filter(
    (payment) => payment.status === 'completed' && inPeriod(String(payment.captured_at || payment.created_at)),
  )

  return {
    failClosed: false,
    environment: health.environment,
    health,
    kpis: {
      payments_in_period: payments.filter((payment) => inPeriod(String(payment.created_at))).length,
      captured_in_period: capturedInPeriod.length,
      failed_in_period: payments.filter(
        (payment) => payment.status === 'failed' && inPeriod(String(payment.created_at)),
      ).length,
      pending_created: payments.filter((payment) => payment.status === 'created' || payment.status === 'approved').length,
      total_captured: money(
        capturedInPeriod.reduce((sum, payment) => sum + Number(payment.amount || 0), 0),
      ),
      total_refunded: money(
        refunds
          .filter((refund) => inPeriod(String(refund.completed_at || refund.requested_at)))
          .reduce((sum, refund) => sum + Number(refund.amount || 0), 0),
      ),
      currency_code: String(payments[0]?.currency_code || 'USD'),
    },
    error: null,
  }
}

export async function fetchPaypalTransactions(input: {
  companyId: string
  searchParams: URLSearchParams
}): Promise<{
  failClosed: boolean
  environment: string
  rows: PaypalTransactionRow[]
  total: number
  page: number
  pageSize: number
  error: { message: string } | null
}> {
  const overview = await fetchPaypalOverview({ companyId: input.companyId })
  if (overview.failClosed) {
    return {
      failClosed: true,
      environment: overview.environment,
      rows: [],
      total: 0,
      page: 1,
      pageSize: 25,
      error: null,
    }
  }

  const page = parseFinancePage(input.searchParams.get('page'))
  const pageSize = parseFinancePageSize(input.searchParams.get('pageSize'))
  const status = input.searchParams.get('status')
  const purpose = input.searchParams.get('purpose')
  const q = sanitizeFinanceSearch(input.searchParams.get('q'))
  const range = resolveFinancePeriodRange({
    period: input.searchParams.get('period') || 'today',
    from: input.searchParams.get('from'),
    to: input.searchParams.get('to'),
  })

  const supabase = getSupabaseServerClient()
  let query = supabase
    .from('invoice_payments')
    .select(
      'id, invoice_id, purpose, amount, currency_code, status, provider_order_id, provider_capture_id, idempotency_key, metadata, created_at, captured_at',
    )
    .eq('company_id', input.companyId)
    .eq('provider', 'paypal')
    .order('created_at', { ascending: false })
    .limit(800)

  if (range.from) query = query.gte('created_at', range.from)
  if (range.to) query = query.lte('created_at', range.to)
  if (status && status !== 'all') query = query.eq('status', status)
  if (purpose && purpose !== 'all') query = query.eq('purpose', purpose)

  const result = await query
  if (result.error) {
    return {
      failClosed: false,
      environment: overview.environment,
      rows: [],
      total: 0,
      page,
      pageSize,
      error: { message: result.error.message },
    }
  }

  let payments = result.data ?? []
  if (q) {
    const needle = q.toLowerCase()
    payments = payments.filter((payment) =>
      [
        payment.provider_order_id,
        payment.provider_capture_id,
        payment.id,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle)),
    )
  }

  const invoiceIds = [...new Set(payments.map((payment) => String(payment.invoice_id)))]
  const invoicesResult = invoiceIds.length
    ? await supabase
        .from('invoices')
        .select(
          'id, invoice_number, status, invoice_kind, quote_id, service_order_id, snapshot, currency_code',
        )
        .eq('company_id', input.companyId)
        .in('id', invoiceIds)
    : { data: [], error: null }

  if (invoicesResult.error) {
    return {
      failClosed: false,
      environment: overview.environment,
      rows: [],
      total: 0,
      page,
      pageSize,
      error: { message: invoicesResult.error.message },
    }
  }

  if (q) {
    const needle = q.toLowerCase()
    const matchingInvoiceIds = new Set(
      (invoicesResult.data ?? [])
        .filter((invoice) => String(invoice.invoice_number || '').toLowerCase().includes(needle))
        .map((invoice) => String(invoice.id)),
    )
    if (matchingInvoiceIds.size > 0) {
      payments = (result.data ?? []).filter(
        (payment) =>
          matchingInvoiceIds.has(String(payment.invoice_id)) ||
          [payment.provider_order_id, payment.provider_capture_id]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(needle)),
      )
    }
  }

  const invoicesById = new Map((invoicesResult.data ?? []).map((invoice) => [String(invoice.id), invoice]))
  const orderIds = [
    ...new Set(
      (invoicesResult.data ?? [])
        .map((invoice) => (invoice.service_order_id ? String(invoice.service_order_id) : ''))
        .filter(Boolean),
    ),
  ]
  const ordersResult = orderIds.length
    ? await supabase
        .from('service_orders')
        .select('id, service_order_number')
        .eq('company_id', input.companyId)
        .in('id', orderIds)
    : { data: [], error: null }
  if (ordersResult.error) {
    return {
      failClosed: false,
      environment: overview.environment,
      rows: [],
      total: 0,
      page,
      pageSize,
      error: { message: ordersResult.error.message },
    }
  }
  const orderNumberById = new Map(
    (ordersResult.data ?? []).map((order) => [String(order.id), String(order.service_order_number)]),
  )

  const rows: PaypalTransactionRow[] = payments.map((payment) => {
    const invoice = invoicesById.get(String(payment.invoice_id))
    const snapshot =
      invoice?.snapshot && typeof invoice.snapshot === 'object'
        ? (invoice.snapshot as { customer?: { name?: string }; quote?: { number?: string } })
        : null
    return {
      id: String(payment.id),
      created_at: String(payment.created_at),
      captured_at: payment.captured_at ? String(payment.captured_at) : null,
      invoice_id: String(payment.invoice_id),
      invoice_number: invoice?.invoice_number ? String(invoice.invoice_number) : null,
      invoice_status: (invoice?.status as InvoiceStatus) ?? null,
      invoice_kind: (invoice?.invoice_kind as InvoiceKind) ?? null,
      customer_name: snapshot?.customer?.name ?? null,
      quote_id: invoice?.quote_id ? String(invoice.quote_id) : null,
      quote_number: snapshot?.quote?.number ?? null,
      service_order_id: invoice?.service_order_id ? String(invoice.service_order_id) : null,
      service_order_number: invoice?.service_order_id
        ? orderNumberById.get(String(invoice.service_order_id)) ?? null
        : null,
      purpose: payment.purpose as PaymentPurpose,
      amount: money(payment.amount),
      currency_code: String(payment.currency_code || 'USD'),
      status: payment.status as PaymentAttemptStatus,
      provider_order_id: payment.provider_order_id ? String(payment.provider_order_id) : null,
      provider_capture_id: payment.provider_capture_id ? String(payment.provider_capture_id) : null,
      idempotency_summary: summarizeIdempotencyKey(
        payment.idempotency_key ? String(payment.idempotency_key) : null,
      ),
      metadata: sanitizePaymentMetadataForBackoffice(payment.metadata),
    }
  })

  const offset = (page - 1) * pageSize
  return {
    failClosed: false,
    environment: overview.environment,
    rows: rows.slice(offset, offset + pageSize),
    total: rows.length,
    page,
    pageSize,
    error: null,
  }
}

export async function fetchPaypalMonitors(input: {
  companyId: string
}): Promise<{
  failClosed: boolean
  environment: string
  idempotency: ObservabilityAlert[]
  reconciliation: ObservabilityAlert[]
  holds: ScheduleHoldObservability[]
  outbox: FinanceOutboxRow[]
  error: { message: string } | null
}> {
  const overview = await fetchPaypalOverview({ companyId: input.companyId })
  const empty = {
    failClosed: overview.failClosed,
    environment: overview.environment,
    idempotency: [] as ObservabilityAlert[],
    reconciliation: [] as ObservabilityAlert[],
    holds: [] as ScheduleHoldObservability[],
    outbox: [] as FinanceOutboxRow[],
    error: null as { message: string } | null,
  }
  if (overview.failClosed) return empty

  const supabase = getSupabaseServerClient()
  const [paymentsResult, invoicesResult, holdsResult, outboxResult] = await Promise.all([
    supabase
      .from('invoice_payments')
      .select(
        'id, invoice_id, status, amount, currency_code, provider_order_id, provider_capture_id, idempotency_key, created_at',
      )
      .eq('company_id', input.companyId)
      .eq('provider', 'paypal')
      .order('created_at', { ascending: false })
      .limit(800),
    supabase
      .from('invoices')
      .select(
        'id, invoice_number, invoice_kind, parent_invoice_id, status, total, paid_total, deposit_amount, currency_code',
      )
      .eq('company_id', input.companyId)
      .order('created_at', { ascending: false })
      .limit(800),
    supabase
      .from('payment_schedule_holds')
      .select(
        'id, invoice_id, event_id, event_date, start_time, end_time, status, expires_at, release_reason',
      )
      .eq('company_id', input.companyId)
      .order('created_at', { ascending: false })
      .limit(200),
    supabase
      .from('finance_integration_outbox')
      .select(
        'id, event_type, aggregate_type, aggregate_id, dedup_key, destination, status, attempts, available_at, published_at, last_error, created_at, payload',
      )
      .eq('company_id', input.companyId)
      .order('created_at', { ascending: false })
      .limit(200),
  ])

  for (const result of [paymentsResult, invoicesResult, holdsResult, outboxResult]) {
    if (result.error) return { ...empty, error: { message: result.error.message } }
  }

  const invoices = (invoicesResult.data ?? []).map((invoice) => ({
    id: String(invoice.id),
    invoice_number: String(invoice.invoice_number),
    invoice_kind: (invoice.invoice_kind || 'original') as InvoiceKind,
    parent_invoice_id: invoice.parent_invoice_id ? String(invoice.parent_invoice_id) : null,
    status: invoice.status as InvoiceStatus,
    total: money(invoice.total),
    paid_total: money(invoice.paid_total),
    deposit_amount: money(invoice.deposit_amount),
    currency_code: String(invoice.currency_code || 'USD'),
  }))
  const invoicesById = new Map(invoices.map((invoice) => [invoice.id, invoice]))
  const payments = (paymentsResult.data ?? []).map((payment) => ({
    id: String(payment.id),
    invoice_id: payment.invoice_id ? String(payment.invoice_id) : '',
    invoice_number: payment.invoice_id ? invoicesById.get(String(payment.invoice_id))?.invoice_number ?? null : null,
    status: payment.status as PaymentAttemptStatus,
    amount: money(payment.amount),
    currency_code: String(payment.currency_code || 'USD'),
    provider_order_id: payment.provider_order_id ? String(payment.provider_order_id) : null,
    provider_capture_id: payment.provider_capture_id ? String(payment.provider_capture_id) : null,
    idempotency_key: payment.idempotency_key ? String(payment.idempotency_key) : null,
  }))

  const holds: ScheduleHoldObservability[] = (holdsResult.data ?? []).map((hold) => {
    const invoice = invoicesById.get(String(hold.invoice_id))
    const classified = classifyScheduleHold({
      status: String(hold.status),
      expires_at: String(hold.expires_at),
      invoice_kind: invoice?.invoice_kind ?? null,
    })
    return {
      id: String(hold.id),
      invoice_id: String(hold.invoice_id),
      invoice_number: invoice?.invoice_number ?? null,
      invoice_kind: invoice?.invoice_kind ?? null,
      event_id: String(hold.event_id),
      event_date: String(hold.event_date),
      start_time: String(hold.start_time),
      end_time: String(hold.end_time),
      status: classified.status,
      raw_status: String(hold.status),
      expires_at: String(hold.expires_at),
      release_reason: hold.release_reason ? String(hold.release_reason) : null,
      severity: classified.severity,
    }
  })

  const outbox = (outboxResult.data ?? []).map((row) => {
    const payload = sanitizeOutboxPayload(row.payload)
    return toOutboxObservabilityRow({
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
  })

  return {
    failClosed: false,
    environment: overview.environment,
    idempotency: detectIdempotencyIssues(payments),
    reconciliation: detectReconciliationAlerts({
      invoices,
      payments: payments.map((payment) => ({
        ...payment,
        invoice_id: payment.invoice_id || null,
      })),
      holds: (holdsResult.data ?? []).map((hold) => ({
        invoice_id: String(hold.invoice_id),
        status: String(hold.status),
        expires_at: String(hold.expires_at),
      })),
    }),
    holds,
    outbox,
    error: null,
  }
}
