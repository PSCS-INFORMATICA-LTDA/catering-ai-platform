import { computeEventFinalTotal, computeFinancialCheck, roundFinanceMoney } from './financeObservability.ts'
import { MONEY_DIVERGENCE_THRESHOLD } from './financeObservabilityTypes.ts'
import type {
  FinanceActivityItem,
  FinanceActivityKind,
  FinanceAttentionItem,
  FinanceAttentionSeverity,
  FinanceCurrencyTotals,
  FinanceLineageNode,
  FinanceMoneyFlow,
  FinanceProviderSummary,
  FinanceReconciliationRow,
  FinanceSearchResults,
  FinanceTrendPoint,
  FinanceTrendSeries,
} from './financeControlCenterTypes.ts'
import type { ObservabilityAlert } from './financeObservabilityTypes.ts'
import type { InvoiceKind, InvoiceStatus, PaymentAttemptStatus, PaymentProvider } from './types.ts'

export const FINANCE_CONTROL_SEARCH_MIN = 2
export const FINANCE_CONTROL_SEARCH_LIMIT = 8

const REFUND_PENDING_STATUSES = new Set(['requested', 'processing'])

export function parseFinanceControlPeriod(value: unknown): '7d' | '30d' | '90d' | 'custom' {
  if (value === '7d' || value === '90d' || value === 'custom') return value
  return '30d'
}

export function computeCaptureSuccessRate(captured: number, failed: number): number | null {
  const valid = captured + failed
  if (valid <= 0) return null
  return roundFinanceMoney((captured / valid) * 100)
}

export function groupFinanceTotalsByCurrency(input: {
  invoices: Array<{
    status: InvoiceStatus
    invoice_kind: InvoiceKind
    currency_code?: string | null
    total: number
    paid_total: number
  }>
  payments: Array<{ status: PaymentAttemptStatus; currency_code?: string | null }>
  refunds: Array<{ status: string; amount: number; currency_code?: string | null }>
}): FinanceCurrencyTotals[] {
  const map = new Map<string, FinanceCurrencyTotals>()

  function bucket(currency: string | null | undefined) {
    const code = String(currency || 'USD').toUpperCase()
    const existing = map.get(code)
    if (existing) return existing
    const created: FinanceCurrencyTotals = {
      currency_code: code,
      billed_total: 0,
      received_total: 0,
      outstanding_total: 0,
      refunded_total: 0,
      invoice_count: 0,
      partially_paid_count: 0,
      post_event_count: 0,
      failed_payment_count: 0,
    }
    map.set(code, created)
    return created
  }

  for (const invoice of input.invoices) {
    const row = bucket(invoice.currency_code)
    row.invoice_count += 1
    if (invoice.invoice_kind === 'post_event_adjustment') row.post_event_count += 1
    if (invoice.status === 'partially_paid') row.partially_paid_count += 1
    if (invoice.status === 'canceled') continue
    row.billed_total = roundFinanceMoney(row.billed_total + invoice.total)
    row.received_total = roundFinanceMoney(row.received_total + invoice.paid_total)
    row.outstanding_total = roundFinanceMoney(
      row.outstanding_total + Math.max(0, invoice.total - invoice.paid_total),
    )
  }

  for (const payment of input.payments) {
    if (payment.status !== 'failed') continue
    bucket(payment.currency_code).failed_payment_count += 1
  }

  for (const refund of input.refunds) {
    if (refund.status !== 'completed') continue
    const row = bucket(refund.currency_code)
    row.refunded_total = roundFinanceMoney(row.refunded_total + refund.amount)
  }

  const rows = [...map.values()].sort((left, right) => {
    if (left.currency_code === 'USD') return -1
    if (right.currency_code === 'USD') return 1
    return left.currency_code.localeCompare(right.currency_code)
  })
  return rows.length > 0 ? rows : [bucket('USD')]
}

export function buildFinanceTrend(input: {
  invoices: Array<{
    created_at: string
    status: InvoiceStatus
    currency_code?: string | null
    total: number
  }>
  payments: Array<{
    captured_at?: string | null
    created_at: string
    status: PaymentAttemptStatus
    currency_code?: string | null
    amount: number
  }>
  from: string | null
  to: string | null
  now?: Date
}): FinanceTrendSeries[] {
  const to = input.to ? new Date(input.to) : (input.now ?? new Date())
  const from = input.from ? new Date(input.from) : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000)
  const spanDays = Math.max(1, Math.round((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000)))
  const bucketMs = spanDays > 45 ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000
  const currencies = new Set<string>()

  const pointsByCurrency = new Map<string, Map<string, FinanceTrendPoint>>()

  function ensure(currency: string, bucket: string) {
    const code = currency.toUpperCase()
    currencies.add(code)
    let series = pointsByCurrency.get(code)
    if (!series) {
      series = new Map()
      pointsByCurrency.set(code, series)
    }
    const existing = series.get(bucket)
    if (existing) return existing
    const created = { bucket, billed_total: 0, received_total: 0 }
    series.set(bucket, created)
    return created
  }

  function bucketKey(value: string) {
    const time = new Date(value).getTime()
    if (!Number.isFinite(time)) return null
    const start = from.getTime()
    const index = Math.max(0, Math.floor((time - start) / bucketMs))
    const bucketStart = new Date(start + index * bucketMs)
    return bucketStart.toISOString().slice(0, 10)
  }

  for (const invoice of input.invoices) {
    if (invoice.status === 'canceled') continue
    const key = bucketKey(invoice.created_at)
    if (!key) continue
    const point = ensure(invoice.currency_code || 'USD', key)
    point.billed_total = roundFinanceMoney(point.billed_total + invoice.total)
  }

  for (const payment of input.payments) {
    if (payment.status !== 'completed') continue
    const key = bucketKey(payment.captured_at || payment.created_at)
    if (!key) continue
    const point = ensure(payment.currency_code || 'USD', key)
    point.received_total = roundFinanceMoney(point.received_total + payment.amount)
  }

  const startMs = from.getTime()
  const endMs = to.getTime()
  const keys: string[] = []
  for (let cursor = startMs; cursor <= endMs; cursor += bucketMs) {
    keys.push(new Date(cursor).toISOString().slice(0, 10))
  }

  const codes = [...currencies].sort((left, right) => {
    if (left === 'USD') return -1
    if (right === 'USD') return 1
    return left.localeCompare(right)
  })
  if (codes.length === 0) codes.push('USD')

  return codes.map((currency_code) => ({
    currency_code,
    points: keys.map((bucket) => {
      const point = pointsByCurrency.get(currency_code)?.get(bucket)
      return {
        bucket,
        billed_total: point?.billed_total ?? 0,
        received_total: point?.received_total ?? 0,
      }
    }),
  }))
}

export function mapMonitorSeverity(severity: string): FinanceAttentionSeverity {
  if (severity === 'error') return 'error'
  if (severity === 'warning') return 'warning'
  return 'info'
}

export function attentionHref(input: {
  invoice_id?: string | null
  code?: string
}): string {
  if (input.code === 'failed_pscs_one_outbox' || input.code === 'stale_pending_outbox') {
    return '/finance/pscs-one'
  }
  if (input.code === 'refund_pending') return '/finance/refunds'
  if (input.invoice_id) return `/invoices/${input.invoice_id}`
  return '/finance/reconciliation'
}

export function buildAttentionItems(input: {
  alerts: ObservabilityAlert[]
  failedPayments: Array<{
    id: string
    invoice_id: string | null
    invoice_number?: string | null
    customer_name?: string | null
    amount: number
    currency_code?: string | null
  }>
  pendingRefunds: Array<{
    id: string
    invoice_id: string
    invoice_number?: string | null
    customer_name?: string | null
    amount: number
    currency_code?: string | null
  }>
  outbox: Array<{
    id: string
    status: string
    highlights?: string[]
    invoice_id?: string | null
    invoice_number?: string | null
  }>
}): FinanceAttentionItem[] {
  const items: FinanceAttentionItem[] = []

  for (const alert of input.alerts) {
    items.push({
      id: `alert:${alert.code}:${alert.invoice_id || alert.value || alert.payment_ids[0] || 'x'}`,
      severity: mapMonitorSeverity(alert.severity),
      code: alert.code,
      invoice_id: alert.invoice_id ?? null,
      invoice_number: alert.invoice_number ?? null,
      customer_name: null,
      amount: null,
      currency_code: null,
      href: attentionHref({ invoice_id: alert.invoice_id, code: alert.code }),
    })
  }

  for (const payment of input.failedPayments) {
    items.push({
      id: `payment-failed:${payment.id}`,
      severity: 'error',
      code: 'payment_failed',
      invoice_id: payment.invoice_id,
      invoice_number: payment.invoice_number ?? null,
      customer_name: payment.customer_name ?? null,
      amount: roundFinanceMoney(payment.amount),
      currency_code: payment.currency_code || 'USD',
      href: attentionHref({ invoice_id: payment.invoice_id, code: 'payment_failed' }),
    })
  }

  for (const refund of input.pendingRefunds) {
    items.push({
      id: `refund-pending:${refund.id}`,
      severity: 'warning',
      code: 'refund_pending',
      invoice_id: refund.invoice_id,
      invoice_number: refund.invoice_number ?? null,
      customer_name: refund.customer_name ?? null,
      amount: roundFinanceMoney(refund.amount),
      currency_code: refund.currency_code || 'USD',
      href: attentionHref({ invoice_id: refund.invoice_id, code: 'refund_pending' }),
    })
  }

  for (const row of input.outbox) {
    const highlights = row.highlights ?? []
    if (row.status === 'failed' || highlights.includes('failed')) {
      items.push({
        id: `outbox-failed:${row.id}`,
        severity: 'error',
        code: 'failed_pscs_one_outbox',
        invoice_id: row.invoice_id ?? null,
        invoice_number: row.invoice_number ?? null,
        customer_name: null,
        amount: null,
        currency_code: null,
        href: '/finance/pscs-one',
      })
    } else if (highlights.includes('pending_stale')) {
      items.push({
        id: `outbox-stale:${row.id}`,
        severity: 'warning',
        code: 'stale_pending_outbox',
        invoice_id: row.invoice_id ?? null,
        invoice_number: row.invoice_number ?? null,
        customer_name: null,
        amount: null,
        currency_code: null,
        href: '/finance/pscs-one',
      })
    }
  }

  const rank: Record<FinanceAttentionSeverity, number> = { error: 0, warning: 1, info: 2 }
  return items.sort((left, right) => rank[left.severity] - rank[right.severity])
}

export function isPendingRefundStatus(status: string) {
  return REFUND_PENDING_STATUSES.has(status)
}

export function computeInvoiceMoneyFlow(input: {
  total: number
  completedPaymentsTotal: number
  refundedTotal: number
  paidTotal: number
  currency_code?: string | null
}): FinanceMoneyFlow {
  const total = roundFinanceMoney(input.total)
  const payments = roundFinanceMoney(input.completedPaymentsTotal)
  const refunds = roundFinanceMoney(input.refundedTotal)
  const netPaid = roundFinanceMoney(Math.max(0, payments - refunds))
  return {
    total,
    payments,
    refunds,
    net_paid: netPaid,
    outstanding: roundFinanceMoney(Math.max(0, total - input.paidTotal)),
    currency_code: String(input.currency_code || 'USD').toUpperCase(),
  }
}

export function buildDocumentaryLineage(input: {
  quote_id?: string | null
  quote_number?: string | null
  original_invoice_id?: string | null
  original_invoice_number?: string | null
  payment_id?: string | null
  service_order_id?: string | null
  service_order_number?: string | null
  event_id?: string | null
  event_name?: string | null
  closeout_id?: string | null
  supplemental_invoice_id?: string | null
  supplemental_invoice_number?: string | null
  final_payment_id?: string | null
}): FinanceLineageNode[] {
  return [
    {
      key: 'quote',
      id: input.quote_id ?? null,
      label: input.quote_number ?? input.quote_id ?? null,
      href: input.quote_id ? `/quotes/${input.quote_id}` : null,
      present: Boolean(input.quote_id),
    },
    {
      key: 'original_invoice',
      id: input.original_invoice_id ?? null,
      label: input.original_invoice_number ?? input.original_invoice_id ?? null,
      href: input.original_invoice_id ? `/invoices/${input.original_invoice_id}` : null,
      present: Boolean(input.original_invoice_id),
    },
    {
      key: 'payment',
      id: input.payment_id ?? null,
      label: input.payment_id ?? null,
      href: input.original_invoice_id ? `/invoices/${input.original_invoice_id}` : null,
      present: Boolean(input.payment_id),
    },
    {
      key: 'service_order',
      id: input.service_order_id ?? null,
      label: input.service_order_number ?? input.service_order_id ?? null,
      href: input.service_order_id ? `/orders/${input.service_order_id}` : null,
      present: Boolean(input.service_order_id),
    },
    {
      key: 'event',
      id: input.event_id ?? null,
      label: input.event_name ?? input.event_id ?? null,
      href: input.service_order_id ? `/orders/${input.service_order_id}` : null,
      present: Boolean(input.event_id || input.event_name),
    },
    {
      key: 'closeout',
      id: input.closeout_id ?? null,
      label: input.closeout_id ?? null,
      href: '/finance/post-event',
      present: Boolean(input.closeout_id),
    },
    {
      key: 'supplemental_invoice',
      id: input.supplemental_invoice_id ?? null,
      label: input.supplemental_invoice_number ?? input.supplemental_invoice_id ?? null,
      href: input.supplemental_invoice_id ? `/invoices/${input.supplemental_invoice_id}` : null,
      present: Boolean(input.supplemental_invoice_id),
    },
    {
      key: 'final_payment',
      id: input.final_payment_id ?? null,
      label: input.final_payment_id ?? null,
      href: input.supplemental_invoice_id
        ? `/invoices/${input.supplemental_invoice_id}`
        : input.original_invoice_id
          ? `/invoices/${input.original_invoice_id}`
          : null,
      present: Boolean(input.final_payment_id),
    },
  ]
}

export function groupReconciliationRows(input: {
  invoices: Array<{
    id: string
    invoice_number: string
    customer_name?: string | null
    currency_code?: string | null
    status: InvoiceStatus
    invoice_kind: InvoiceKind
    total: number
    paid_total: number
    deposit_amount: number
  }>
  payments: Array<{
    invoice_id: string | null
    status: PaymentAttemptStatus
    amount: number
    currency_code?: string | null
  }>
  refunds: Array<{
    invoice_id: string
    status: string
    amount: number
  }>
}): FinanceReconciliationRow[] {
  const paymentsByInvoice = new Map<string, typeof input.payments>()
  for (const payment of input.payments) {
    if (!payment.invoice_id) continue
    const list = paymentsByInvoice.get(payment.invoice_id) ?? []
    list.push(payment)
    paymentsByInvoice.set(payment.invoice_id, list)
  }
  const refundsByInvoice = new Map<string, number>()
  for (const refund of input.refunds) {
    if (refund.status !== 'completed') continue
    refundsByInvoice.set(
      refund.invoice_id,
      roundFinanceMoney((refundsByInvoice.get(refund.invoice_id) || 0) + refund.amount),
    )
  }

  return input.invoices.map((invoice) => {
    const invoicePayments = paymentsByInvoice.get(invoice.id) ?? []
    const completed = invoicePayments.filter((payment) => payment.status === 'completed')
    const completedTotal = roundFinanceMoney(completed.reduce((sum, payment) => sum + payment.amount, 0))
    const refundedTotal = refundsByInvoice.get(invoice.id) || 0
    const check = computeFinancialCheck({
      invoiceTotal: invoice.total,
      invoicePaidTotal: invoice.paid_total,
      invoiceStatus: invoice.status,
      depositAmount: invoice.deposit_amount,
      canceled: invoice.status === 'canceled',
      completedPaymentsTotal: completedTotal,
      refundedTotal,
    })
    const currencyMismatch = completed.some(
      (payment) => (payment.currency_code || 'USD') !== (invoice.currency_code || 'USD'),
    )
    let group: FinanceReconciliationRow['group'] = 'ok'
    if (!check.ok || currencyMismatch || Math.abs(completedTotal - invoice.paid_total) > MONEY_DIVERGENCE_THRESHOLD) {
      group = 'error'
    } else if (check.statusMismatch) {
      group = 'warning'
    }
    return {
      invoice_id: invoice.id,
      invoice_number: invoice.invoice_number,
      customer_name: invoice.customer_name ?? null,
      currency_code: String(invoice.currency_code || 'USD').toUpperCase(),
      invoice_received: roundFinanceMoney(invoice.paid_total),
      completed_payments: completedTotal,
      refunded_total: refundedTotal,
      delta: roundFinanceMoney(completedTotal - invoice.paid_total),
      status: invoice.status,
      invoice_kind: invoice.invoice_kind,
      group,
    }
  })
}

export function summarizeProviders(input: {
  configured: Array<{
    provider: PaymentProvider
    enabled: boolean
    environment?: string | null
  }>
  payments: Array<{
    provider: PaymentProvider
    status: PaymentAttemptStatus
    amount: number
    currency_code?: string | null
  }>
}): FinanceProviderSummary[] {
  const providers: PaymentProvider[] = ['paypal', 'zelle', 'bank_transfer']
  return providers.map((provider) => {
    const row = input.configured.find((item) => item.provider === provider)
    const payments = input.payments.filter((payment) => payment.provider === provider)
    const completed = payments.filter((payment) => payment.status === 'completed')
    const currencies = new Set(completed.map((payment) => String(payment.currency_code || 'USD').toUpperCase()))
    const currency_code = currencies.has('USD')
      ? 'USD'
      : [...currencies][0] || 'USD'
    const received_total = roundFinanceMoney(
      completed
        .filter((payment) => String(payment.currency_code || 'USD').toUpperCase() === currency_code)
        .reduce((sum, payment) => sum + payment.amount, 0),
    )
    const environment = row?.environment ? String(row.environment) : null
    return {
      provider,
      configured: Boolean(row),
      enabled: row?.enabled === true,
      environment,
      sandbox: provider === 'paypal' ? environment === 'sandbox' : null,
      transactions: payments.length,
      received_total,
      currency_code,
    }
  })
}

export function maskBankAccount(value: string | null | undefined): string | null {
  if (!value) return null
  const digits = String(value).replace(/\D/g, '')
  if (!digits) return null
  if (digits.length <= 4) return `••••${digits}`
  return `••••${digits.slice(-4)}`
}

export function emptyFinanceSearch(query = ''): FinanceSearchResults {
  return { query, invoices: [], payments: [], quotes: [], service_orders: [] }
}

export function activityFromInvoice(input: {
  id: string
  invoice_number: string
  invoice_kind: InvoiceKind
  status: InvoiceStatus
  created_at: string
  updated_at?: string | null
  customer_name?: string | null
  total: number
  paid_total?: number
  currency_code?: string | null
}): FinanceActivityItem[] {
  const items: FinanceActivityItem[] = [
    {
      id: `invoice:${input.id}:created`,
      kind: input.invoice_kind === 'post_event_adjustment' ? 'supplemental_created' : 'invoice_created',
      occurred_at: input.created_at,
      invoice_id: input.id,
      invoice_number: input.invoice_number,
      customer_name: input.customer_name ?? null,
      amount: roundFinanceMoney(input.total),
      currency_code: input.currency_code || 'USD',
      href: `/invoices/${input.id}`,
    },
  ]
  if (input.status === 'paid' || input.status === 'partially_paid') {
    items.push({
      id: `invoice:${input.id}:${input.status}`,
      kind: input.status === 'paid' ? 'invoice_paid' : 'invoice_partially_paid',
      occurred_at: input.updated_at || input.created_at,
      invoice_id: input.id,
      invoice_number: input.invoice_number,
      customer_name: input.customer_name ?? null,
      amount: roundFinanceMoney(input.paid_total ?? input.total),
      currency_code: input.currency_code || 'USD',
      href: `/invoices/${input.id}`,
    })
  }
  return items
}

export function mergeFinanceActivity(items: FinanceActivityItem[], limit = 25): FinanceActivityItem[] {
  return [...items]
    .sort((left, right) => String(right.occurred_at).localeCompare(String(left.occurred_at)))
    .slice(0, limit)
}

export function postEventFinalTotal(originalTotal: number, adjustmentTotal: number) {
  return computeEventFinalTotal(originalTotal, adjustmentTotal)
}

export function outboxDashboardCounts(rows: Array<{ status: string; highlights?: string[] }>) {
  return {
    pending: rows.filter((row) => row.status === 'pending').length,
    published: rows.filter((row) => row.status === 'published').length,
    failed: rows.filter((row) => row.status === 'failed').length,
    stale_pending: rows.filter((row) => (row.highlights ?? []).includes('pending_stale')).length,
  }
}
