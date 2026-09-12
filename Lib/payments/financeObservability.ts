import { resolveAmountDue } from './amountDue.ts'
import { deriveInvoiceStatus } from './invoiceStatus.ts'
import type {
  FinanceOutboxRow,
  FinancePageSize,
  FinancePeriod,
  FinancialCheckResult,
  InvoiceControlKpis,
  ObservabilityAlert,
  PaymentLinkObservability,
  ScheduleHoldObservability,
} from './financeObservabilityTypes.ts'
import {
  FINANCE_PAGE_SIZES,
  FINANCE_PERIODS,
  MONEY_DIVERGENCE_THRESHOLD,
} from './financeObservabilityTypes.ts'
import type { InvoiceKind, InvoiceStatus, PaymentAttemptStatus } from './types.ts'

export function roundFinanceMoney(value: unknown): number {
  const number = Number(value ?? 0)
  return Number.isFinite(number) ? Math.round(number * 100) / 100 : 0
}

export function parseFinancePageSize(value: unknown): FinancePageSize {
  const number = Number(value)
  return (FINANCE_PAGE_SIZES as readonly number[]).includes(number)
    ? (number as FinancePageSize)
    : 25
}

export function parseFinancePage(value: unknown): number {
  const number = Number(value)
  if (!Number.isFinite(number) || number < 1) return 1
  return Math.floor(number)
}

export function parseFinancePeriod(value: unknown): FinancePeriod {
  return FINANCE_PERIODS.includes(value as FinancePeriod) ? (value as FinancePeriod) : '30d'
}

export function resolveFinancePeriodRange(input: {
  period?: string | null
  from?: string | null
  to?: string | null
  now?: Date
}): { period: FinancePeriod; from: string | null; to: string | null } {
  const period = parseFinancePeriod(input.period)
  if (period === 'all') return { period, from: null, to: null }
  if (period === 'custom') {
    return {
      period,
      from: input.from ? new Date(input.from).toISOString() : null,
      to: input.to ? new Date(input.to).toISOString() : null,
    }
  }

  const now = input.now ?? new Date()
  const start = new Date(now)
  if (period === 'today') {
    start.setHours(0, 0, 0, 0)
  } else {
    const days = period === '7d' ? 7 : period === '90d' ? 90 : 30
    start.setDate(start.getDate() - days)
  }
  return { period, from: start.toISOString(), to: now.toISOString() }
}

export function sanitizeFinanceSearch(value: unknown): string {
  return String(value ?? '')
    .replace(/[%_,.()]/g, ' ')
    .trim()
    .slice(0, 80)
}

export function paymentLinkObservabilityState(input: {
  revoked_at: string | null
  expires_at: string | null
  now?: Date
}): PaymentLinkObservability['state'] {
  if (input.revoked_at) return 'revoked'
  if (input.expires_at && new Date(input.expires_at).getTime() <= (input.now ?? new Date()).getTime()) {
    return 'expired'
  }
  return 'active'
}

export function computeInvoiceControlKpis(input: {
  invoices: Array<{
    status: InvoiceStatus
    invoice_kind: InvoiceKind
    total: number
    paid_total: number
    currency_code?: string
  }>
  payments: Array<{ status: PaymentAttemptStatus }>
  currency?: string
}): InvoiceControlKpis {
  const active = input.invoices.filter((invoice) => invoice.status !== 'canceled')
  const canceled = input.invoices.filter((invoice) => invoice.status === 'canceled')
  return {
    currency_code:
      input.currency ||
      active[0]?.currency_code ||
      input.invoices[0]?.currency_code ||
      'USD',
    billed_total: roundFinanceMoney(active.reduce((sum, invoice) => sum + invoice.total, 0)),
    received_total: roundFinanceMoney(active.reduce((sum, invoice) => sum + invoice.paid_total, 0)),
    outstanding_total: roundFinanceMoney(
      active.reduce((sum, invoice) => sum + Math.max(0, invoice.total - invoice.paid_total), 0),
    ),
    canceled_total: roundFinanceMoney(canceled.reduce((sum, invoice) => sum + invoice.total, 0)),
    original_count: input.invoices.filter((invoice) => invoice.invoice_kind !== 'post_event_adjustment').length,
    adjustment_count: input.invoices.filter((invoice) => invoice.invoice_kind === 'post_event_adjustment').length,
    payments_completed: input.payments.filter((payment) => payment.status === 'completed').length,
    payments_failed: input.payments.filter((payment) => payment.status === 'failed').length,
  }
}

export function computeFinancialCheck(input: {
  invoiceTotal: number
  invoicePaidTotal: number
  invoiceStatus: InvoiceStatus
  depositAmount: number
  canceled?: boolean
  completedPaymentsTotal: number
  refundedTotal: number
}): FinancialCheckResult {
  const invoiceTotal = roundFinanceMoney(input.invoiceTotal)
  const completedPaymentsTotal = roundFinanceMoney(input.completedPaymentsTotal)
  const refundedTotal = roundFinanceMoney(input.refundedTotal)
  const registeredPaidTotal = roundFinanceMoney(input.invoicePaidTotal)
  const expectedPaidTotal = roundFinanceMoney(completedPaymentsTotal - refundedTotal)
  const outstanding = roundFinanceMoney(Math.max(0, invoiceTotal - registeredPaidTotal))
  const amountDue = resolveAmountDue({
    total: invoiceTotal,
    depositAmount: input.depositAmount,
    paidTotal: registeredPaidTotal,
    purpose: 'full',
  })
  const derivedStatus = deriveInvoiceStatus({
    current: input.invoiceStatus,
    total: invoiceTotal,
    depositAmount: input.depositAmount,
    paidTotal: registeredPaidTotal,
    canceled: input.canceled,
  })
  const paidDelta = roundFinanceMoney(Math.abs(registeredPaidTotal - expectedPaidTotal))
  const outstandingDelta = roundFinanceMoney(Math.abs(outstanding - amountDue.amount))
  const ok =
    paidDelta <= MONEY_DIVERGENCE_THRESHOLD && outstandingDelta <= MONEY_DIVERGENCE_THRESHOLD

  return {
    invoiceTotal,
    completedPaymentsTotal,
    refundedTotal,
    registeredPaidTotal,
    outstanding,
    expectedPaidTotal,
    amountDue: amountDue.amount,
    derivedStatus,
    currentStatus: input.invoiceStatus,
    statusMismatch: derivedStatus !== input.invoiceStatus,
    paidDelta,
    outstandingDelta,
    ok,
    signal: ok ? 'ok' : 'attention',
  }
}

export function computeEventFinalTotal(originalTotal: number, adjustmentTotal: number) {
  return {
    original_total: roundFinanceMoney(originalTotal),
    adjustment_total: roundFinanceMoney(adjustmentTotal),
    final_event_total: roundFinanceMoney(originalTotal + adjustmentTotal),
  }
}

export function detectIdempotencyIssues(
  payments: Array<{
    id: string
    invoice_id: string
    invoice_number?: string | null
    provider_order_id: string | null
    provider_capture_id: string | null
    idempotency_key: string | null
    status: string
    amount: number
  }>,
): ObservabilityAlert[] {
  const alerts: ObservabilityAlert[] = []

  pushGroupAlerts(
    alerts,
    payments,
    (payment) => payment.provider_order_id,
    'duplicate_provider_order_id',
    'error',
  )
  pushGroupAlerts(
    alerts,
    payments,
    (payment) => payment.provider_capture_id,
    'duplicate_provider_capture_id',
    'error',
  )

  const byKey = groupBy(
    payments.filter((payment) => payment.idempotency_key),
    (payment) => String(payment.idempotency_key),
  )
  for (const [value, rows] of byKey) {
    if (rows.length < 2) continue
    const signatures = new Set(
      rows.map((row) => `${row.invoice_id}:${row.amount}:${row.status}`),
    )
    if (signatures.size > 1) {
      alerts.push({
        severity: 'error',
        code: 'conflicting_idempotency_key',
        payment_ids: rows.map((row) => row.id),
        invoice_id: rows[0]?.invoice_id,
        invoice_number: rows[0]?.invoice_number ?? null,
        value,
      })
    }
  }

  const completedByInvoice = groupBy(
    payments.filter((payment) => payment.status === 'completed'),
    (payment) => payment.invoice_id,
  )
  for (const [invoiceId, rows] of completedByInvoice) {
    const byPurposeAmount = groupBy(rows, (row) => `${row.amount}`)
    for (const [value, duplicates] of byPurposeAmount) {
      if (duplicates.length < 2) continue
      alerts.push({
        severity: 'warning',
        code: 'duplicate_completed_payment',
        payment_ids: duplicates.map((row) => row.id),
        invoice_id: invoiceId,
        invoice_number: duplicates[0]?.invoice_number ?? null,
        value,
      })
    }
  }

  return alerts
}

export function detectReconciliationAlerts(input: {
  invoices: Array<{
    id: string
    invoice_number: string
    invoice_kind: InvoiceKind
    parent_invoice_id: string | null
    status: InvoiceStatus
    total: number
    paid_total: number
    deposit_amount: number
    currency_code: string
  }>
  payments: Array<{
    id: string
    invoice_id: string | null
    status: PaymentAttemptStatus
    amount: number
    currency_code: string
    provider_capture_id: string | null
  }>
  holds: Array<{
    invoice_id: string
    status: string
    expires_at: string
  }>
  now?: Date
}): ObservabilityAlert[] {
  const alerts: ObservabilityAlert[] = []
  const invoicesById = new Map(input.invoices.map((invoice) => [invoice.id, invoice]))
  const paymentsByInvoice = groupBy(input.payments, (payment) => payment.invoice_id || 'missing')
  const now = (input.now ?? new Date()).getTime()

  for (const invoice of input.invoices) {
    const invoicePayments = paymentsByInvoice.get(invoice.id) ?? []
    const completed = invoicePayments.filter((payment) => payment.status === 'completed')
    const completedTotal = roundFinanceMoney(completed.reduce((sum, payment) => sum + payment.amount, 0))
    const check = computeFinancialCheck({
      invoiceTotal: invoice.total,
      invoicePaidTotal: invoice.paid_total,
      invoiceStatus: invoice.status,
      depositAmount: invoice.deposit_amount,
      canceled: invoice.status === 'canceled',
      completedPaymentsTotal: completedTotal,
      refundedTotal: 0,
    })

    if (completed.length > 0 && !check.ok) {
      alerts.push({
        severity: 'error',
        code: 'completed_not_reflected',
        invoice_id: invoice.id,
        invoice_number: invoice.invoice_number,
        payment_ids: completed.map((payment) => payment.id),
      })
    }

    if (invoice.status === 'paid' && completedTotal + 0.009 < invoice.total) {
      alerts.push({
        severity: 'error',
        code: 'paid_without_completed_payments',
        invoice_id: invoice.id,
        invoice_number: invoice.invoice_number,
        payment_ids: completed.map((payment) => payment.id),
      })
    }

    if (completed.some((payment) => payment.currency_code !== invoice.currency_code)) {
      alerts.push({
        severity: 'error',
        code: 'currency_mismatch',
        invoice_id: invoice.id,
        invoice_number: invoice.invoice_number,
        payment_ids: completed
          .filter((payment) => payment.currency_code !== invoice.currency_code)
          .map((payment) => payment.id),
      })
    }

    if (completedTotal - invoice.total > MONEY_DIVERGENCE_THRESHOLD) {
      alerts.push({
        severity: 'error',
        code: 'completed_exceeds_invoice',
        invoice_id: invoice.id,
        invoice_number: invoice.invoice_number,
        payment_ids: completed.map((payment) => payment.id),
      })
    }

    if (invoice.invoice_kind === 'post_event_adjustment' && !invoice.parent_invoice_id) {
      alerts.push({
        severity: 'error',
        code: 'supplemental_missing_parent',
        invoice_id: invoice.id,
        invoice_number: invoice.invoice_number,
        payment_ids: [],
      })
    }
  }

  for (const payment of input.payments) {
    if (payment.provider_capture_id && (!payment.invoice_id || !invoicesById.has(payment.invoice_id))) {
      alerts.push({
        severity: 'error',
        code: 'capture_without_invoice',
        invoice_id: payment.invoice_id,
        payment_ids: [payment.id],
        value: payment.provider_capture_id,
      })
    }
  }

  for (const hold of input.holds) {
    const invoice = invoicesById.get(hold.invoice_id)
    const active = hold.status === 'active' && new Date(hold.expires_at).getTime() > now
    if (invoice?.invoice_kind === 'post_event_adjustment' && active) {
      alerts.push({
        severity: 'error',
        code: 'post_event_active_hold',
        invoice_id: invoice.id,
        invoice_number: invoice.invoice_number,
        payment_ids: [],
      })
    }
  }

  return alerts
}

export function classifyScheduleHold(input: {
  status: string
  expires_at: string
  invoice_kind?: InvoiceKind | null
  now?: Date
}): Pick<ScheduleHoldObservability, 'status' | 'severity'> {
  const now = (input.now ?? new Date()).getTime()
  const expired = new Date(input.expires_at).getTime() <= now
  if (input.status === 'consumed') return { status: 'consumed', severity: 'ok' }
  if (input.status === 'released') return { status: 'released', severity: 'ok' }
  if (input.status === 'expired' || (input.status === 'active' && expired)) {
    return { status: 'expired', severity: 'warning' }
  }
  if (input.invoice_kind === 'post_event_adjustment') {
    return { status: 'held', severity: 'error' }
  }
  return { status: 'held', severity: 'ok' }
}

export function detectOutboxHighlights(row: {
  status: string
  attempts: number
  created_at: string
  invoice_kind?: string | null
  parent_invoice_id?: string | null
  now?: Date
}): string[] {
  const highlights: string[] = []
  if (row.status === 'failed') highlights.push('failed')
  if (row.attempts > 0) highlights.push('attempts')
  if (
    row.status === 'pending' &&
    Date.now() - new Date(row.created_at).getTime() > 60 * 60 * 1000
  ) {
    highlights.push('pending_stale')
  }
  if (!row.invoice_kind) highlights.push('missing_invoice_kind')
  if (row.invoice_kind === 'post_event_adjustment' && !row.parent_invoice_id) {
    highlights.push('missing_parent_invoice_id')
  }
  return highlights
}

export function toOutboxObservabilityRow(input: {
  id: string
  event_type: string
  aggregate_type: string
  aggregate_id: string
  dedup_key: string
  destination: string
  status: string
  attempts: number
  available_at: string
  published_at: string | null
  last_error: string | null
  created_at: string
  invoice_id?: string | null
  invoice_number?: string | null
  invoice_kind?: InvoiceKind | null
  parent_invoice_id?: string | null
  payment_id?: string | null
}): FinanceOutboxRow {
  return {
    id: input.id,
    event_type: input.event_type,
    aggregate_type: input.aggregate_type,
    aggregate_id: input.aggregate_id,
    dedup_key: input.dedup_key,
    destination: input.destination,
    status: input.status,
    attempts: input.attempts,
    available_at: input.available_at,
    published_at: input.published_at,
    last_error: input.last_error,
    created_at: input.created_at,
    invoice_id: input.invoice_id ?? null,
    invoice_number: input.invoice_number ?? null,
    invoice_kind: input.invoice_kind ?? null,
    parent_invoice_id: input.parent_invoice_id ?? null,
    payment_id: input.payment_id ?? null,
    highlights: detectOutboxHighlights(input),
  }
}

function pushGroupAlerts(
  alerts: ObservabilityAlert[],
  payments: Array<{
    id: string
    invoice_id: string
    invoice_number?: string | null
  }>,
  keyOf: (payment: (typeof payments)[number] & { provider_order_id?: string | null; provider_capture_id?: string | null }) => string | null | undefined,
  code: string,
  severity: ObservabilityAlert['severity'],
) {
  const grouped = groupBy(payments, (payment) => keyOf(payment as never) ?? '')
  for (const [value, rows] of grouped) {
    if (!value || rows.length < 2) continue
    alerts.push({
      severity,
      code,
      payment_ids: rows.map((row) => row.id),
      invoice_id: rows[0]?.invoice_id,
      invoice_number: rows[0]?.invoice_number ?? null,
      value,
    })
  }
}

function groupBy<T>(rows: T[], keyOf: (row: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>()
  for (const row of rows) {
    const key = keyOf(row)
    if (!key) continue
    const list = map.get(key) ?? []
    list.push(row)
    map.set(key, list)
  }
  return map
}
