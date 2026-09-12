import { MONEY_DIVERGENCE_THRESHOLD } from './financeObservabilityTypes.ts'
import type {
  InvoiceControlFilters,
  InvoiceControlListItem,
  InvoiceWorkspaceColumnId,
  InvoiceWorkspaceDirection,
  InvoiceWorkspaceSort,
  InvoiceWorkspaceView,
  InvoiceWorkspaceViewCounts,
} from './financeObservabilityTypes.ts'
import {
  INVOICE_WORKSPACE_COLUMNS,
  INVOICE_WORKSPACE_DEFAULT_COLUMNS,
  INVOICE_WORKSPACE_SORTS,
  INVOICE_WORKSPACE_VIEWS,
} from './financeObservabilityTypes.ts'
import { paymentLinkObservabilityState, roundFinanceMoney } from './financeObservability.ts'
import type { InvoiceKind, InvoiceStatus } from './types.ts'

export const INVOICE_WORKSPACE_PINNED_START: InvoiceWorkspaceColumnId[] = ['invoice']
export const INVOICE_WORKSPACE_PINNED_END: InvoiceWorkspaceColumnId[] = ['actions']
export const INVOICE_WORKSPACE_ALWAYS_VISIBLE: InvoiceWorkspaceColumnId[] = ['invoice', 'actions']

export const INVOICE_WORKSPACE_COLUMN_WIDTHS: Record<InvoiceWorkspaceColumnId, number> = {
  invoice: 168,
  customer: 188,
  customer_email: 180,
  customer_phone: 140,
  event: 176,
  event_date: 118,
  quote: 96,
  os: 96,
  kind: 128,
  status: 132,
  total: 104,
  gross: 112,
  refunds: 100,
  net: 112,
  outstanding: 108,
  deposit: 96,
  balance: 108,
  provider: 96,
  last_payment_status: 132,
  last_payment: 128,
  created_at: 118,
  updated_at: 118,
  actions: 76,
}

export type InvoiceWorkspaceDensity = 'comfortable' | 'compact'

export type InvoiceWorkspaceColumnPrefs = {
  order: InvoiceWorkspaceColumnId[]
  hidden: InvoiceWorkspaceColumnId[]
  widths: Partial<Record<InvoiceWorkspaceColumnId, number>>
  density: InvoiceWorkspaceDensity
}

export type InvoiceMovementTotals = {
  invoiceTotal: number
  paidTotal: number
  grossReceived: number
  refunded: number
  netReceived: number
  outstanding: number
  paidDelta: number
  divergence: boolean
}

export type InvoiceWorkspaceSortable = {
  invoice_number: string
  customer_name: string
  event_date: string | null
  created_at: string
  total: number
  net_received: number
  outstanding_amount: number
  status: InvoiceStatus
}

export function invoiceWorkspaceStorageKey(userId?: string | null, companyId?: string | null) {
  return `invoice-workspace-v3:${userId || 'anon'}:${companyId || 'company'}`
}

export function defaultInvoiceWorkspaceColumnPrefs(): InvoiceWorkspaceColumnPrefs {
  return {
    order: [...INVOICE_WORKSPACE_COLUMNS],
    hidden: INVOICE_WORKSPACE_COLUMNS.filter(
      (column) => !INVOICE_WORKSPACE_DEFAULT_COLUMNS.includes(column),
    ),
    widths: {},
    density: 'comfortable',
  }
}

export function parseInvoiceWorkspaceColumnPrefs(raw: unknown): InvoiceWorkspaceColumnPrefs {
  const fallback = defaultInvoiceWorkspaceColumnPrefs()
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return fallback
  const value = raw as Partial<InvoiceWorkspaceColumnPrefs>
  const known = new Set<string>(INVOICE_WORKSPACE_COLUMNS)
  const order = Array.isArray(value.order)
    ? value.order.filter((column): column is InvoiceWorkspaceColumnId => known.has(column))
    : []
  for (const column of INVOICE_WORKSPACE_COLUMNS) {
    if (!order.includes(column)) order.push(column)
  }
  const hidden = Array.isArray(value.hidden)
    ? value.hidden.filter(
        (column): column is InvoiceWorkspaceColumnId =>
          known.has(column) && !INVOICE_WORKSPACE_ALWAYS_VISIBLE.includes(column),
      )
    : fallback.hidden
  const widths: Partial<Record<InvoiceWorkspaceColumnId, number>> = {}
  if (value.widths && typeof value.widths === 'object') {
    for (const [column, width] of Object.entries(value.widths)) {
      if (!known.has(column)) continue
      const number = Number(width)
      if (Number.isFinite(number)) {
        widths[column as InvoiceWorkspaceColumnId] = Math.min(480, Math.max(72, Math.round(number)))
      }
    }
  }
  return {
    order,
    hidden,
    widths,
    density: value.density === 'compact' ? 'compact' : 'comfortable',
  }
}

export function visibleInvoiceWorkspaceColumns(
  prefs: InvoiceWorkspaceColumnPrefs,
): InvoiceWorkspaceColumnId[] {
  const hidden = new Set(prefs.hidden)
  const ordered = prefs.order.filter((column) => INVOICE_WORKSPACE_COLUMNS.includes(column))
  for (const column of INVOICE_WORKSPACE_COLUMNS) {
    if (!ordered.includes(column)) ordered.push(column)
  }
  const visible = ordered.filter(
    (column) => INVOICE_WORKSPACE_ALWAYS_VISIBLE.includes(column) || !hidden.has(column),
  )
  const start = INVOICE_WORKSPACE_PINNED_START.filter((column) => visible.includes(column))
  const end = INVOICE_WORKSPACE_PINNED_END.filter((column) => visible.includes(column))
  const middle = visible.filter(
    (column) =>
      !INVOICE_WORKSPACE_PINNED_START.includes(column) &&
      !INVOICE_WORKSPACE_PINNED_END.includes(column),
  )
  return [...start, ...middle, ...end]
}

export function reorderInvoiceWorkspaceColumn(
  prefs: InvoiceWorkspaceColumnPrefs,
  source: InvoiceWorkspaceColumnId,
  target: InvoiceWorkspaceColumnId,
): InvoiceWorkspaceColumnPrefs {
  if (source === target) return prefs
  if (INVOICE_WORKSPACE_PINNED_START.includes(source) || INVOICE_WORKSPACE_PINNED_END.includes(source)) {
    return prefs
  }
  if (INVOICE_WORKSPACE_PINNED_START.includes(target) || INVOICE_WORKSPACE_PINNED_END.includes(target)) {
    return prefs
  }
  const order = prefs.order.filter((column) => column !== source)
  const targetIndex = order.indexOf(target)
  if (targetIndex < 0) return prefs
  order.splice(targetIndex, 0, source)
  return { ...prefs, order }
}

export function computeInvoiceMovementTotals(input: {
  invoiceTotal: number
  paidTotal: number
  completedPaymentsTotal: number
  refundedTotal: number
}): InvoiceMovementTotals {
  const invoiceTotal = roundFinanceMoney(input.invoiceTotal)
  const paidTotal = roundFinanceMoney(input.paidTotal)
  const grossReceived = roundFinanceMoney(input.completedPaymentsTotal)
  const refunded = roundFinanceMoney(input.refundedTotal)
  const netReceived = roundFinanceMoney(grossReceived - refunded)
  const outstanding = roundFinanceMoney(Math.max(invoiceTotal - netReceived, 0))
  const paidDelta = roundFinanceMoney(Math.abs(netReceived - paidTotal))
  return {
    invoiceTotal,
    paidTotal,
    grossReceived,
    refunded,
    netReceived,
    outstanding,
    paidDelta,
    divergence: paidDelta > MONEY_DIVERGENCE_THRESHOLD,
  }
}

export function parseInvoiceWorkspaceView(value: unknown): InvoiceWorkspaceView {
  return INVOICE_WORKSPACE_VIEWS.includes(value as InvoiceWorkspaceView)
    ? (value as InvoiceWorkspaceView)
    : 'all'
}

export function parseInvoiceWorkspaceSort(value: unknown): InvoiceWorkspaceSort {
  return INVOICE_WORKSPACE_SORTS.includes(value as InvoiceWorkspaceSort)
    ? (value as InvoiceWorkspaceSort)
    : 'created_at'
}

export function parseInvoiceWorkspaceDirection(value: unknown): InvoiceWorkspaceDirection {
  return value === 'asc' ? 'asc' : 'desc'
}

export function parseOptionalFinanceMoney(value: unknown): number | null {
  if (value == null || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

export function chunkIds(ids: string[], size = 200): string[][] {
  const chunks: string[][] = []
  for (let index = 0; index < ids.length; index += size) {
    chunks.push(ids.slice(index, index + size))
  }
  return chunks
}

export function intersectIds(left: string[] | null, right: string[] | null): string[] | null {
  if (left === null) return right
  if (right === null) return left
  const allowed = new Set(right)
  return left.filter((id) => allowed.has(id))
}

export function matchesInvoiceWorkspaceView(input: {
  view: InvoiceWorkspaceView
  status: InvoiceStatus
  invoiceKind: InvoiceKind
  outstanding: number
  hasFailedPayment: boolean
}): boolean {
  switch (input.view) {
    case 'all':
      return true
    case 'receivable':
      return input.status !== 'canceled' && input.outstanding > 0
    case 'partially_paid':
      return input.status === 'partially_paid'
    case 'paid':
      return input.status === 'paid'
    case 'awaiting_deposit':
      return input.status === 'awaiting_deposit'
    case 'failed':
      return input.hasFailedPayment
    case 'adjustments':
      return input.invoiceKind === 'post_event_adjustment'
    case 'canceled':
      return input.status === 'canceled'
    default:
      return true
  }
}

export function countInvoiceWorkspaceViews(
  rows: Array<{
    status: InvoiceStatus
    invoice_kind: InvoiceKind
    outstanding_amount: number
    has_failed_payment: boolean
  }>,
): InvoiceWorkspaceViewCounts {
  const counts: InvoiceWorkspaceViewCounts = {
    all: rows.length,
    receivable: 0,
    partially_paid: 0,
    paid: 0,
    awaiting_deposit: 0,
    failed: 0,
    adjustments: 0,
    canceled: 0,
  }
  for (const row of rows) {
    if (matchesInvoiceWorkspaceView({
      view: 'receivable',
      status: row.status,
      invoiceKind: row.invoice_kind,
      outstanding: row.outstanding_amount,
      hasFailedPayment: row.has_failed_payment,
    })) {
      counts.receivable += 1
    }
    if (row.status === 'partially_paid') counts.partially_paid += 1
    if (row.status === 'paid') counts.paid += 1
    if (row.status === 'awaiting_deposit') counts.awaiting_deposit += 1
    if (row.has_failed_payment) counts.failed += 1
    if (row.invoice_kind === 'post_event_adjustment') counts.adjustments += 1
    if (row.status === 'canceled') counts.canceled += 1
  }
  return counts
}

export function compareInvoiceWorkspaceRows(
  left: InvoiceWorkspaceSortable,
  right: InvoiceWorkspaceSortable,
  sort: InvoiceWorkspaceSort,
  direction: InvoiceWorkspaceDirection,
): number {
  const factor = direction === 'asc' ? 1 : -1
  const emptyLast = (value: string | null | undefined) => !value
  switch (sort) {
    case 'total':
    case 'received':
    case 'outstanding': {
      const map = {
        total: left.total - right.total,
        received: left.net_received - right.net_received,
        outstanding: left.outstanding_amount - right.outstanding_amount,
      }
      return map[sort] * factor
    }
    case 'event_date': {
      if (emptyLast(left.event_date) && emptyLast(right.event_date)) return 0
      if (emptyLast(left.event_date)) return 1
      if (emptyLast(right.event_date)) return -1
      return String(left.event_date).localeCompare(String(right.event_date)) * factor
    }
    case 'created_at':
      return left.created_at.localeCompare(right.created_at) * factor
    case 'customer':
      return left.customer_name.localeCompare(right.customer_name, 'en', {
        numeric: true,
        sensitivity: 'base',
      }) * factor
    case 'status':
      return left.status.localeCompare(right.status) * factor
    case 'invoice_number':
    default:
      return left.invoice_number.localeCompare(right.invoice_number, 'en', {
        numeric: true,
        sensitivity: 'base',
      }) * factor
  }
}

export function matchesInvoiceWorkspaceAmountFilters(
  row: { total: number; outstanding_amount: number },
  filters: Pick<InvoiceControlFilters, 'minTotal' | 'maxTotal' | 'minOutstanding' | 'maxOutstanding'>,
): boolean {
  if (filters.minTotal != null && row.total < filters.minTotal) return false
  if (filters.maxTotal != null && row.total > filters.maxTotal) return false
  if (filters.minOutstanding != null && row.outstanding_amount < filters.minOutstanding) return false
  if (filters.maxOutstanding != null && row.outstanding_amount > filters.maxOutstanding) return false
  return true
}

export function resolvePaymentLinkState(input: {
  revoked_at: string | null
  expires_at: string | null
  now?: Date
}): 'active' | 'expired' | 'revoked' {
  return paymentLinkObservabilityState(input)
}

const CSV_COLUMNS: Array<{ key: keyof InvoiceControlListItem | 'kind'; header: string }> = [
  { key: 'invoice_number', header: 'invoice_number' },
  { key: 'invoice_kind', header: 'invoice_kind' },
  { key: 'parent_invoice_number', header: 'parent_invoice_number' },
  { key: 'customer_name', header: 'customer_name' },
  { key: 'event_name', header: 'event_name' },
  { key: 'event_date', header: 'event_date' },
  { key: 'quote_number', header: 'quote_number' },
  { key: 'service_order_number', header: 'service_order_number' },
  { key: 'status', header: 'status' },
  { key: 'currency_code', header: 'currency_code' },
  { key: 'total', header: 'total' },
  { key: 'gross_received', header: 'gross_received' },
  { key: 'refunded_total', header: 'refunded_total' },
  { key: 'net_received', header: 'net_received' },
  { key: 'outstanding_amount', header: 'outstanding' },
  { key: 'deposit_amount', header: 'deposit_amount' },
  { key: 'balance_amount', header: 'balance_amount' },
  { key: 'paid_total', header: 'paid_total' },
  { key: 'divergence', header: 'divergence' },
  { key: 'last_provider', header: 'provider' },
  { key: 'last_payment_status', header: 'last_payment_status' },
  { key: 'last_payment_at', header: 'last_payment_at' },
  { key: 'created_at', header: 'created_at' },
  { key: 'updated_at', header: 'updated_at' },
]

const MONEY_CSV_KEYS = new Set([
  'total',
  'gross_received',
  'refunded_total',
  'net_received',
  'outstanding_amount',
  'deposit_amount',
  'balance_amount',
  'paid_total',
])

export function csvEscapeCell(value: unknown): string {
  if (value == null) return ''
  const raw = typeof value === 'boolean' ? (value ? 'true' : 'false') : String(value)
  const guarded = /^[=+\-@]/.test(raw) ? `'${raw}` : raw
  if (/[",\n\r]/.test(guarded)) return `"${guarded.replace(/"/g, '""')}"`
  return guarded
}

export function formatInvoiceWorkspaceCsvMoney(value: number): string {
  return roundFinanceMoney(value).toFixed(2)
}

export function buildInvoiceWorkspaceCsv(rows: InvoiceControlListItem[]): string {
  const header = CSV_COLUMNS.map((column) => column.header).join(',')
  const lines = rows.map((row) =>
    CSV_COLUMNS.map((column) => {
      const value = row[column.key as keyof InvoiceControlListItem]
      if (MONEY_CSV_KEYS.has(column.key)) {
        return formatInvoiceWorkspaceCsvMoney(Number(value || 0))
      }
      if (column.key === 'divergence') return row.divergence ? 'true' : 'false'
      return csvEscapeCell(value)
    }).join(','),
  )
  return [header, ...lines].join('\n')
}

export function invoiceWorkspaceCsvHasForbiddenContent(csv: string): boolean {
  return /token_hash|webhook_route_key|client_secret|provider_payload|service_role|account_number|routing_number|buyer_password/i.test(
    csv,
  )
}
