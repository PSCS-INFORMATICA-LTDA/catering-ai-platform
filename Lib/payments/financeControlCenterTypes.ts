import type {
  InvoiceKind,
  InvoiceStatus,
  PaymentAttemptStatus,
  PaymentProvider,
} from './types.ts'
import type { FinancePeriod, MonitorSeverity } from './financeObservabilityTypes.ts'

export type FinanceAttentionSeverity = 'error' | 'warning' | 'info'

export type FinanceCurrencyTotals = {
  currency_code: string
  billed_total: number
  received_total: number
  outstanding_total: number
  refunded_total: number
  invoice_count: number
  partially_paid_count: number
  post_event_count: number
  failed_payment_count: number
}

export type FinanceTrendPoint = {
  bucket: string
  billed_total: number
  received_total: number
}

export type FinanceTrendSeries = {
  currency_code: string
  points: FinanceTrendPoint[]
}

export type FinanceAttentionItem = {
  id: string
  severity: FinanceAttentionSeverity
  code: string
  invoice_id: string | null
  invoice_number: string | null
  customer_name: string | null
  amount: number | null
  currency_code: string | null
  href: string
}

export type FinanceActivityKind =
  | 'invoice_created'
  | 'paypal_captured'
  | 'invoice_partially_paid'
  | 'invoice_paid'
  | 'refund_requested'
  | 'refund_completed'
  | 'supplemental_created'
  | 'manual_reconciled'
  | 'outbox_published'

export type FinanceActivityItem = {
  id: string
  kind: FinanceActivityKind
  occurred_at: string
  invoice_id: string | null
  invoice_number: string | null
  customer_name: string | null
  amount: number | null
  currency_code: string | null
  href: string
}

export type FinanceSearchHit = {
  id: string
  label: string
  secondary: string | null
  href: string
  currency_code?: string | null
  amount?: number | null
}

export type FinanceSearchResults = {
  query: string
  invoices: FinanceSearchHit[]
  payments: FinanceSearchHit[]
  quotes: FinanceSearchHit[]
  service_orders: FinanceSearchHit[]
}

export type FinanceRefundRow = {
  id: string
  invoice_id: string
  invoice_number: string | null
  customer_name: string | null
  provider: PaymentProvider | null
  payment_id: string
  amount: number
  currency_code: string
  status: 'requested' | 'processing' | 'completed' | 'failed' | 'canceled'
  reason: string
  requested_at: string
  completed_at: string | null
  provider_refund_id: string | null
}

export type FinancePostEventRow = {
  id: string
  customer_name: string | null
  service_order_id: string
  service_order_number: string | null
  event_name: string | null
  event_date: string | null
  original_invoice_id: string
  original_invoice_number: string | null
  original_invoice_total: number
  contracted_billable_guests: number
  final_billable_guests: number | null
  billable_guest_overage: number
  extra_services_total: number
  adjustment_total: number
  supplemental_invoice_id: string | null
  supplemental_invoice_number: string | null
  supplemental_status: InvoiceStatus | null
  supplemental_paid_total: number | null
  currency_code: string
  status: string
  final_event_total: number
}

export type FinanceProviderSummary = {
  provider: PaymentProvider
  configured: boolean
  enabled: boolean
  environment: string | null
  sandbox: boolean | null
  transactions: number
  received_total: number
  currency_code: string
}

export type FinanceReconciliationRow = {
  invoice_id: string
  invoice_number: string
  customer_name: string | null
  currency_code: string
  invoice_received: number
  completed_payments: number
  refunded_total: number
  delta: number
  status: InvoiceStatus
  invoice_kind: InvoiceKind
  group: 'ok' | 'warning' | 'error'
}

export type FinanceOutboxListRow = {
  id: string
  event_type: string
  invoice_id: string | null
  invoice_number: string | null
  payment_id: string | null
  aggregate_type: string
  aggregate_id: string
  status: string
  attempts: number
  created_at: string
  published_at: string | null
  last_error: string | null
}

export type FinanceMoneyFlow = {
  total: number
  payments: number
  refunds: number
  net_paid: number
  outstanding: number
  currency_code: string
}

export type FinanceLineageNode = {
  key:
    | 'quote'
    | 'original_invoice'
    | 'payment'
    | 'service_order'
    | 'event'
    | 'closeout'
    | 'supplemental_invoice'
    | 'final_payment'
  id: string | null
  label: string | null
  href: string | null
  present: boolean
}

export type FinanceOverviewPayload = {
  company_name: string | null
  app_environment: 'DEV' | 'PROD'
  paypal_sandbox: boolean
  paypal_fail_closed: boolean
  period: FinancePeriod
  from: string | null
  to: string | null
  currencies: FinanceCurrencyTotals[]
  trend: FinanceTrendSeries[]
  paypal: {
    enabled: boolean | null
    environment: string | null
    connection_status: string | null
    credentials_configured: boolean | null
    webhook_configured: boolean | null
    last_tested_at: string | null
    transactions: number | null
    captured: number | null
    failed: number | null
    pending: number | null
    captured_value: number | null
    refunded_value: number | null
    capture_success_rate: number | null
    currency_code: string
  }
  pscs_one: {
    pending: number
    published: number
    failed: number
    stale_pending: number
  }
  providers: FinanceProviderSummary[]
}

export type { FinancePeriod, MonitorSeverity }
