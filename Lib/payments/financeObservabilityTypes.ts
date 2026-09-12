import type {
  InvoiceKind,
  InvoiceStatus,
  PaymentAttemptStatus,
  PaymentProvider,
  PaymentPurpose,
} from './types.ts'

export const FINANCE_PAGE_SIZES = [25, 50, 100] as const
export type FinancePageSize = (typeof FINANCE_PAGE_SIZES)[number]

export const FINANCE_PERIODS = ['today', '7d', '30d', '90d', 'custom', 'all'] as const
export type FinancePeriod = (typeof FINANCE_PERIODS)[number]

export const MONEY_DIVERGENCE_THRESHOLD = 0.01

export type MonitorSeverity = 'ok' | 'warning' | 'error'

export const INVOICE_WORKSPACE_VIEWS = [
  'all',
  'receivable',
  'partially_paid',
  'paid',
  'awaiting_deposit',
  'failed',
  'adjustments',
  'canceled',
] as const
export type InvoiceWorkspaceView = (typeof INVOICE_WORKSPACE_VIEWS)[number]

export const INVOICE_WORKSPACE_SORTS = [
  'invoice_number',
  'customer',
  'event_date',
  'created_at',
  'total',
  'received',
  'outstanding',
  'status',
] as const
export type InvoiceWorkspaceSort = (typeof INVOICE_WORKSPACE_SORTS)[number]
export type InvoiceWorkspaceDirection = 'asc' | 'desc'

export const INVOICE_WORKSPACE_COLUMNS = [
  'invoice',
  'customer',
  'customer_email',
  'customer_phone',
  'event',
  'event_date',
  'quote',
  'os',
  'kind',
  'status',
  'total',
  'gross',
  'refunds',
  'net',
  'outstanding',
  'deposit',
  'balance',
  'provider',
  'last_payment_status',
  'last_payment',
  'created_at',
  'updated_at',
  'actions',
] as const
export type InvoiceWorkspaceColumnId = (typeof INVOICE_WORKSPACE_COLUMNS)[number]

export const INVOICE_WORKSPACE_DEFAULT_COLUMNS: InvoiceWorkspaceColumnId[] = [
  'invoice',
  'customer',
  'event',
  'quote',
  'os',
  'status',
  'total',
  'net',
  'refunds',
  'outstanding',
  'provider',
  'last_payment',
  'actions',
]

export const INVOICE_WORKSPACE_WORKING_SET_CAP = 5000
export const INVOICE_WORKSPACE_EXPORT_MAX = 2000
export const INVOICE_WORKSPACE_QUERY_CHUNK = 200

export type InvoiceWorkspaceViewCounts = {
  all: number
  receivable: number
  partially_paid: number
  paid: number
  awaiting_deposit: number
  failed: number
  adjustments: number
  canceled: number
}

export type InvoiceWorkspacePaymentPreview = {
  id: string
  provider: PaymentProvider
  status: PaymentAttemptStatus
  amount: number
  currency_code: string
  created_at: string
  captured_at: string | null
}

export type InvoiceControlListItem = {
  id: string
  invoice_number: string
  invoice_kind: InvoiceKind
  parent_invoice_id: string | null
  parent_invoice_number: string | null
  quote_id: string
  quote_number: string | null
  service_order_id: string | null
  service_order_number: string | null
  closeout_id: string | null
  customer_name: string
  customer_email: string | null
  customer_phone: string | null
  event_name: string | null
  event_date: string | null
  status: InvoiceStatus
  currency_code: string
  total: number
  deposit_amount: number
  balance_amount: number
  paid_total: number
  gross_received: number
  refunded_total: number
  net_received: number
  outstanding_amount: number
  divergence: boolean
  last_provider: PaymentProvider | null
  last_payment_status: PaymentAttemptStatus | null
  last_payment_at: string | null
  payment_link_state: 'active' | 'expired' | 'revoked' | null
  recent_payments: InvoiceWorkspacePaymentPreview[]
  created_at: string
  updated_at: string
}

export type InvoiceControlKpis = {
  currency_code: string
  billed_total: number
  received_total: number
  outstanding_total: number
  refunded_total: number
  canceled_total: number
  invoice_count: number
  receivable_count: number
  partially_paid_count: number
  failed_count: number
  original_count: number
  adjustment_count: number
  payments_completed: number
  payments_failed: number
}

export type InvoiceControlFilters = {
  period: FinancePeriod
  from: string | null
  to: string | null
  q: string
  invoiceNumber: string
  quoteNumber: string
  os: string
  customer: string
  status: InvoiceStatus | 'all'
  invoiceKind: InvoiceKind | 'all'
  provider: PaymentProvider | 'all'
  paymentStatus: PaymentAttemptStatus | 'all'
  view: InvoiceWorkspaceView
  sort: InvoiceWorkspaceSort
  direction: InvoiceWorkspaceDirection
  eventFrom: string
  eventTo: string
  minTotal: number | null
  maxTotal: number | null
  minOutstanding: number | null
  maxOutstanding: number | null
  page: number
  pageSize: FinancePageSize
}

export type FinancialCheckResult = {
  invoiceTotal: number
  completedPaymentsTotal: number
  refundedTotal: number
  registeredPaidTotal: number
  outstanding: number
  expectedPaidTotal: number
  amountDue: number
  derivedStatus: InvoiceStatus
  currentStatus: InvoiceStatus
  statusMismatch: boolean
  paidDelta: number
  outstandingDelta: number
  ok: boolean
  signal: 'ok' | 'attention'
}

export type PaymentLinkObservability = {
  id: string
  purpose: PaymentPurpose
  created_at: string
  expires_at: string | null
  revoked_at: string | null
  state: 'active' | 'expired' | 'revoked'
}

export type InvoicePaymentObservability = {
  id: string
  provider: PaymentProvider
  purpose: PaymentPurpose
  status: PaymentAttemptStatus
  amount: number
  currency_code: string
  created_at: string
  captured_at: string | null
  provider_order_id: string | null
  provider_capture_id: string | null
  idempotency_summary: string | null
  metadata: Record<string, unknown>
}

export type InvoiceLineage = {
  kind: InvoiceKind
  parent: {
    id: string
    invoice_number: string
    total: number
    paid_total: number
    status: InvoiceStatus
  } | null
  supplements: Array<{
    id: string
    invoice_number: string
    total: number
    paid_total: number
    status: InvoiceStatus
  }>
  service_order_id: string | null
  service_order_number: string | null
  closeout_id: string | null
  original_total: number | null
  adjustment_total: number | null
  final_event_total: number | null
}

export type FinanceOutboxRow = {
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
  invoice_id: string | null
  invoice_number: string | null
  invoice_kind: InvoiceKind | null
  parent_invoice_id: string | null
  payment_id: string | null
  highlights: string[]
}

export type FinanceAuditEvent = {
  id: string
  action: string
  entity_type: string
  entity_id: string
  created_at: string
  user_id: string | null
  data: unknown
}

export type ScheduleHoldObservability = {
  id: string
  invoice_id: string
  invoice_number: string | null
  invoice_kind: InvoiceKind | null
  event_id: string
  event_date: string
  start_time: string
  end_time: string
  status: 'held' | 'consumed' | 'released' | 'expired'
  raw_status: string
  expires_at: string
  release_reason: string | null
  severity: MonitorSeverity
}

export type PaypalProviderHealth = {
  enabled: boolean
  environment: string
  sandbox: boolean
  connection_status: string
  credentials_configured: boolean
  public_client_id_state: 'configured' | 'missing'
  webhook_configured: boolean
  last_tested_at: string | null
  last_test_status: string | null
}

export type PaypalControlKpis = {
  payments_in_period: number
  captured_in_period: number
  failed_in_period: number
  pending_created: number
  total_captured: number
  total_refunded: number
  currency_code: string
}

export type PaypalTransactionRow = {
  id: string
  created_at: string
  captured_at: string | null
  invoice_id: string
  invoice_number: string | null
  invoice_status: InvoiceStatus | null
  invoice_kind: InvoiceKind | null
  customer_name: string | null
  quote_id: string | null
  quote_number: string | null
  service_order_id: string | null
  service_order_number: string | null
  purpose: PaymentPurpose
  amount: number
  currency_code: string
  status: PaymentAttemptStatus
  provider_order_id: string | null
  provider_capture_id: string | null
  idempotency_summary: string | null
  metadata: Record<string, unknown>
}

export type ObservabilityAlert = {
  severity: MonitorSeverity
  code: string
  invoice_id?: string | null
  invoice_number?: string | null
  payment_ids: string[]
  value?: string | null
}

export type InvoiceObservabilityPayload = {
  invoice: {
    id: string
    invoice_number: string
    invoice_kind: InvoiceKind
    status: InvoiceStatus
    currency_code: string
    subtotal: number
    total: number
    paid_total: number
    outstanding_amount: number
    deposit_amount: number
    balance_amount: number
    quote_id: string
    quote_number: string | null
    service_order_id: string | null
    service_order_number: string | null
    closeout_id: string | null
    customer_name: string
    customer_email: string | null
    customer_phone: string | null
    event_name: string | null
    event_date: string | null
    locale: string
  }
  lineage: InvoiceLineage
  payments: InvoicePaymentObservability[]
  payment_links: PaymentLinkObservability[]
  refunds: Array<{
    id: string
    status: string
    amount: number
    reason: string
    provider_refund_id: string | null
    requested_at: string
    completed_at: string | null
  }>
  cancellations: Array<{
    id: string
    status: string
    reason: string
    requested_at: string
    agenda_released_at: string | null
    completed_at: string | null
  }>
  outbox: FinanceOutboxRow[]
  audit: FinanceAuditEvent[]
  financial_check: FinancialCheckResult
}
