'use client'

import Link from 'next/link'
import { useMemo, useRef, useState } from 'react'
import { formatUiDate } from '@/Lib/i18n/locales'
import { tInvoiceWorkspace } from '@/Lib/i18n/invoiceWorkspace'
import {
  invoiceStatusLabel,
  paymentProviderLabel,
  paymentStatusLabel,
} from '@/Lib/i18n/payments'
import type {
  InvoiceControlListItem,
  InvoiceWorkspaceColumnId,
  InvoiceWorkspaceDirection,
  InvoiceWorkspaceSort,
} from '@/Lib/payments/financeObservabilityTypes'
import { INVOICE_WORKSPACE_SORTS } from '@/Lib/payments/financeObservabilityTypes'
import {
  INVOICE_WORKSPACE_COLUMN_WIDTHS,
  INVOICE_WORKSPACE_PINNED_END,
  INVOICE_WORKSPACE_PINNED_START,
  type InvoiceWorkspaceColumnPrefs,
  reorderInvoiceWorkspaceColumn,
  visibleInvoiceWorkspaceColumns,
} from '@/Lib/payments/invoiceWorkspace'
import { formatFinanceDateTime, formatFinanceMoney, INVOICE_STATUS_BADGE, kindBadgeClass } from './financeUi'

const COLUMN_LABEL: Record<InvoiceWorkspaceColumnId, Parameters<typeof tInvoiceWorkspace>[1]> = {
  invoice: 'colInvoice',
  customer: 'colCustomer',
  customer_email: 'colCustomerEmail',
  customer_phone: 'colCustomerPhone',
  event: 'colEvent',
  event_date: 'colEventDate',
  quote: 'colQuote',
  os: 'colOs',
  kind: 'colKind',
  status: 'colStatus',
  total: 'colTotal',
  gross: 'colGross',
  refunds: 'colRefunds',
  net: 'colNet',
  outstanding: 'colOutstanding',
  deposit: 'colDeposit',
  balance: 'colBalance',
  provider: 'colProvider',
  last_payment_status: 'colLastPaymentStatus',
  last_payment: 'colLastPayment',
  created_at: 'colCreated',
  updated_at: 'colUpdated',
  actions: 'colActions',
}

const SORT_BY_COLUMN: Partial<Record<InvoiceWorkspaceColumnId, InvoiceWorkspaceSort>> = {
  invoice: 'invoice_number',
  customer: 'customer',
  event_date: 'event_date',
  created_at: 'created_at',
  total: 'total',
  net: 'received',
  gross: 'received',
  outstanding: 'outstanding',
  status: 'status',
}

export function InvoiceWorkspaceGrid({
  locale,
  rows,
  prefs,
  sort,
  direction,
  selectedId,
  onPrefsChange,
  onSort,
  onPreview,
}: {
  locale: string
  rows: InvoiceControlListItem[]
  prefs: InvoiceWorkspaceColumnPrefs
  sort: InvoiceWorkspaceSort
  direction: InvoiceWorkspaceDirection
  selectedId: string | null
  onPrefsChange: (prefs: InvoiceWorkspaceColumnPrefs) => void
  onSort: (sort: InvoiceWorkspaceSort) => void
  onPreview: (invoice: InvoiceControlListItem) => void
}) {
  const columns = useMemo(() => visibleInvoiceWorkspaceColumns(prefs), [prefs])
  const compact = prefs.density === 'compact'
  const [menuId, setMenuId] = useState<string | null>(null)
  const dragSource = useRef<InvoiceWorkspaceColumnId | null>(null)

  const widths = columns.map((column) => prefs.widths[column] ?? INVOICE_WORKSPACE_COLUMN_WIDTHS[column])
  const stickyLeft = new Map<InvoiceWorkspaceColumnId, number>()
  let left = 0
  for (const column of columns) {
    if (column === 'invoice' || column === 'customer') {
      stickyLeft.set(column, left)
      left += prefs.widths[column] ?? INVOICE_WORKSPACE_COLUMN_WIDTHS[column]
    } else {
      break
    }
  }

  function startResize(column: InvoiceWorkspaceColumnId, event: React.MouseEvent) {
    event.preventDefault()
    event.stopPropagation()
    const startX = event.clientX
    const startWidth = prefs.widths[column] ?? INVOICE_WORKSPACE_COLUMN_WIDTHS[column]
    function onMove(move: MouseEvent) {
      const next = Math.min(480, Math.max(72, startWidth + (move.clientX - startX)))
      onPrefsChange({
        ...prefs,
        widths: { ...prefs.widths, [column]: next },
      })
    }
    function onUp() {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  return (
    <div className="hidden min-h-0 flex-1 overflow-auto rounded-2xl border border-neutral-200 bg-white shadow-sm xl:block">
      <table className="w-max min-w-full border-separate border-spacing-0 text-sm">
        <thead className="sticky top-0 z-20">
          <tr>
            {columns.map((column, index) => {
              const sortKey = SORT_BY_COLUMN[column]
              const sticky = stickyLeft.has(column) || INVOICE_WORKSPACE_PINNED_END.includes(column)
              const style: React.CSSProperties = {
                width: widths[index],
                minWidth: widths[index],
                maxWidth: widths[index],
              }
              if (stickyLeft.has(column)) {
                style.left = stickyLeft.get(column)
              }
              if (INVOICE_WORKSPACE_PINNED_END.includes(column)) {
                style.right = 0
              }
              return (
                <th
                  key={column}
                  style={style}
                  draggable={!INVOICE_WORKSPACE_PINNED_START.includes(column) && !INVOICE_WORKSPACE_PINNED_END.includes(column)}
                  onDragStart={() => {
                    dragSource.current = column
                  }}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => {
                    if (!dragSource.current) return
                    onPrefsChange(reorderInvoiceWorkspaceColumn(prefs, dragSource.current, column))
                    dragSource.current = null
                  }}
                  className={`relative border-b border-neutral-200 bg-neutral-50 px-2 py-2 text-left text-[11px] font-bold uppercase tracking-wider text-neutral-500 ${
                    sticky ? 'sticky z-30' : ''
                  } ${INVOICE_WORKSPACE_SORTS.includes((sortKey || '') as InvoiceWorkspaceSort) ? 'cursor-pointer select-none' : ''}`}
                  aria-sort={sortKey === sort ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'}
                >
                  <button
                    type="button"
                    className="flex w-full items-center gap-1 text-left"
                    onClick={() => {
                      if (sortKey) onSort(sortKey)
                    }}
                    aria-label={tInvoiceWorkspace(locale, 'sortBy', {
                      column: tInvoiceWorkspace(locale, COLUMN_LABEL[column]),
                    })}
                  >
                    <span className="truncate">{tInvoiceWorkspace(locale, COLUMN_LABEL[column])}</span>
                    {sortKey === sort ? <span>{direction === 'asc' ? '↑' : '↓'}</span> : null}
                  </button>
                  <button
                    type="button"
                    aria-label={tInvoiceWorkspace(locale, 'resizeColumn')}
                    onMouseDown={(event) => startResize(column, event)}
                    className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize bg-transparent hover:bg-[var(--brand-primary-2)]/40"
                  />
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((invoice) => (
            <tr
              key={invoice.id}
              onClick={() => onPreview(invoice)}
              className={`cursor-pointer ${selectedId === invoice.id ? 'bg-sky-50' : 'hover:bg-neutral-50'}`}
            >
              {columns.map((column, index) => {
                const style: React.CSSProperties = {
                  width: widths[index],
                  minWidth: widths[index],
                  maxWidth: widths[index],
                }
                const sticky = stickyLeft.has(column) || INVOICE_WORKSPACE_PINNED_END.includes(column)
                if (stickyLeft.has(column)) style.left = stickyLeft.get(column)
                if (INVOICE_WORKSPACE_PINNED_END.includes(column)) style.right = 0
                return (
                  <td
                    key={column}
                    style={style}
                    className={`border-b border-neutral-100 bg-inherit px-2 ${compact ? 'py-1.5 text-xs' : 'py-3'} ${
                      sticky ? 'sticky z-10 bg-white' : ''
                    } ${selectedId === invoice.id ? 'bg-sky-50' : ''}`}
                  >
                    <GridCell
                      column={column}
                      invoice={invoice}
                      locale={locale}
                      menuOpen={menuId === invoice.id}
                      onToggleMenu={(event) => {
                        event.stopPropagation()
                        setMenuId((current) => (current === invoice.id ? null : invoice.id))
                      }}
                    />
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function GridCell({
  column,
  invoice,
  locale,
  menuOpen,
  onToggleMenu,
}: {
  column: InvoiceWorkspaceColumnId
  invoice: InvoiceControlListItem
  locale: string
  menuOpen: boolean
  onToggleMenu: (event: React.MouseEvent) => void
}) {
  const money = (value: number) => formatFinanceMoney(value, invoice.currency_code, locale)
  switch (column) {
    case 'invoice':
      return (
        <div className="min-w-0" onClick={(event) => event.stopPropagation()}>
          <Link href={`/invoices/${invoice.id}`} className="font-black text-neutral-900 hover:underline">
            {invoice.invoice_number}
          </Link>
          <div className="mt-1 flex flex-wrap items-center gap-1">
            <span className={`inline-flex rounded-full border px-1.5 py-0.5 text-[9px] font-black uppercase ${kindBadgeClass(invoice.invoice_kind)}`}>
              {invoice.invoice_kind === 'post_event_adjustment'
                ? tInvoiceWorkspace(locale, 'kindAdjustment')
                : tInvoiceWorkspace(locale, 'kindOriginal')}
            </span>
            {invoice.divergence ? (
              <span className="inline-flex rounded-full border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[9px] font-black uppercase text-amber-900">
                {tInvoiceWorkspace(locale, 'divergence')}
              </span>
            ) : null}
          </div>
          {invoice.invoice_kind === 'post_event_adjustment' && invoice.parent_invoice_number ? (
            <p className="mt-0.5 truncate text-[11px] text-neutral-500">
              {tInvoiceWorkspace(locale, 'childOfOriginal', { number: invoice.parent_invoice_number })}
            </p>
          ) : null}
        </div>
      )
    case 'customer':
      return (
        <div className="min-w-0">
          <p className="truncate font-bold text-neutral-900">{invoice.customer_name}</p>
          <p className="truncate text-[11px] text-neutral-500">{invoice.event_name || '—'}</p>
        </div>
      )
    case 'customer_email':
      return <span className="truncate">{invoice.customer_email || '—'}</span>
    case 'customer_phone':
      return <span className="truncate">{invoice.customer_phone || '—'}</span>
    case 'event':
      return (
        <div className="min-w-0">
          <p className="truncate font-semibold">{invoice.event_name || '—'}</p>
          <p className="text-[11px] text-neutral-500">{invoice.event_date || '—'}</p>
        </div>
      )
    case 'event_date':
      return <span>{invoice.event_date || '—'}</span>
    case 'quote':
      return invoice.quote_id ? (
        <Link
          href={`/quotes/${invoice.quote_id}`}
          onClick={(event) => event.stopPropagation()}
          className="font-bold text-[var(--brand-primary-2)] hover:underline"
        >
          {invoice.quote_number || tInvoiceWorkspace(locale, 'noQuote')}
        </Link>
      ) : (
        <span>—</span>
      )
    case 'os':
      return invoice.service_order_id ? (
        <Link
          href={`/orders/${invoice.service_order_id}`}
          onClick={(event) => event.stopPropagation()}
          className="font-bold text-[var(--brand-primary-2)] hover:underline"
        >
          {invoice.service_order_number || tInvoiceWorkspace(locale, 'noOs')}
        </Link>
      ) : (
        <span className="text-neutral-400">—</span>
      )
    case 'kind':
      return (
        <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${kindBadgeClass(invoice.invoice_kind)}`}>
          {invoice.invoice_kind === 'post_event_adjustment'
            ? tInvoiceWorkspace(locale, 'kindAdjustment')
            : tInvoiceWorkspace(locale, 'kindOriginal')}
        </span>
      )
    case 'status':
      return (
        <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${INVOICE_STATUS_BADGE[invoice.status] ?? ''}`}>
          {invoiceStatusLabel(invoice.status, locale)}
        </span>
      )
    case 'total':
      return <p className="text-right font-black">{money(invoice.total)}</p>
    case 'gross':
      return <p className="text-right">{money(invoice.gross_received)}</p>
    case 'refunds':
      return <p className="text-right">{money(invoice.refunded_total)}</p>
    case 'net':
      return <p className="text-right font-bold">{money(invoice.net_received)}</p>
    case 'outstanding':
      return <p className="text-right font-black">{money(invoice.outstanding_amount)}</p>
    case 'deposit':
      return <p className="text-right">{money(invoice.deposit_amount)}</p>
    case 'balance':
      return <p className="text-right">{money(invoice.balance_amount)}</p>
    case 'provider':
      return <span>{invoice.last_provider ? paymentProviderLabel(invoice.last_provider, locale) : '—'}</span>
    case 'last_payment_status':
      return <span>{invoice.last_payment_status ? paymentStatusLabel(invoice.last_payment_status, locale) : '—'}</span>
    case 'last_payment':
      return <span className="text-xs text-neutral-600">{formatFinanceDateTime(invoice.last_payment_at, locale)}</span>
    case 'created_at':
      return <span>{formatUiDate(invoice.created_at, locale)}</span>
    case 'updated_at':
      return <span>{formatUiDate(invoice.updated_at, locale)}</span>
    case 'actions':
      return (
        <div className="relative" onClick={(event) => event.stopPropagation()}>
          <button
            type="button"
            onClick={onToggleMenu}
            className="inline-flex min-h-[32px] items-center rounded-lg border border-neutral-200 px-2 text-[10px] font-black uppercase"
          >
            {tInvoiceWorkspace(locale, 'actions')}
          </button>
          {menuOpen ? (
            <div className="absolute right-0 z-40 mt-1 w-52 rounded-xl border border-neutral-200 bg-white p-1 shadow-lg">
              <ActionLink href={`/invoices/${invoice.id}`} label={tInvoiceWorkspace(locale, 'actionOpenInvoice')} />
              <ActionLink href={`/quotes/${invoice.quote_id}`} label={tInvoiceWorkspace(locale, 'actionOpenQuote')} />
              {invoice.service_order_id ? (
                <ActionLink href={`/orders/${invoice.service_order_id}`} label={tInvoiceWorkspace(locale, 'actionOpenOs')} />
              ) : null}
              <a href={`/api/invoices/${invoice.id}/pdf`} className={actionClass}>
                {tInvoiceWorkspace(locale, 'actionPdf')}
              </a>
              <ActionLink href={`/invoices/${invoice.id}#payments`} label={tInvoiceWorkspace(locale, 'actionPayments')} />
              {invoice.payment_link_state ? (
                <ActionLink href={`/invoices/${invoice.id}#links`} label={tInvoiceWorkspace(locale, 'actionPaymentLink')} />
              ) : null}
            </div>
          ) : null}
        </div>
      )
    default:
      return null
  }
}

function ActionLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className={actionClass}>
      {label}
    </Link>
  )
}

const actionClass =
  'flex min-h-[36px] items-center rounded-lg px-3 text-left text-xs font-semibold text-neutral-800 hover:bg-neutral-50'
