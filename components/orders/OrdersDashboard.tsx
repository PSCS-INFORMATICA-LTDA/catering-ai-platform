'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { orderStatusLabel, tQuotesOrders } from '@/Lib/i18n/quotesOrders'
import { useAuthLocaleFromMe } from '@/Lib/i18n/useAuthLocaleFromMe'
import type { ServiceOrderListItem } from '@/Lib/orders/fetchServiceOrderList'
import { SERVICE_ORDER_STATUSES } from '@/Lib/orders/statusMachine'

type StatusFilter = 'all' | string

const STATUS_BADGE_CLASS: Record<string, string> = {
  planned: 'border-cdl-border bg-cdl-inset text-cdl-text-secondary',
  confirmed: 'border-cdl-accent-border bg-cdl-accent/15 text-cdl-brand',
  preparing: 'border-cdl-warning-border bg-cdl-warning-soft text-cdl-warning',
  team_assigned: 'border-cdl-accent-border bg-cdl-accent/15 text-cdl-brand',
  ready: 'border-cdl-success-border bg-cdl-success-soft text-cdl-success',
  in_progress: 'border-cdl-warning-border bg-cdl-warning-soft text-cdl-warning',
  completed: 'border-cdl-success-border bg-cdl-success-soft text-cdl-success',
  cancelled: 'border-red-300/40 bg-red-500/10 text-red-500',
}

function formatMoney(value: number | null | undefined) {
  if (value == null) return '—'
  return `$${Number(value).toFixed(2)}`
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  const normalized = value.includes('T') ? value : `${value}T00:00:00`
  const date = new Date(normalized)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export default function OrdersDashboard({
  initialOrders,
  canViewFinancial = false,
}: {
  initialOrders: ServiceOrderListItem[]
  canViewFinancial?: boolean
}) {
  const locale = useAuthLocaleFromMe()
  const [orders, setOrders] = useState<ServiceOrderListItem[]>(initialOrders)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function refresh() {
      setLoading(true)
      setError(null)
      try {
        const response = await fetch('/api/orders', {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' },
        })
        const result = (await response.json()) as {
          data?: ServiceOrderListItem[]
          error?: string
        }
        if (!response.ok) {
          throw new Error(result.error ?? tQuotesOrders(locale, 'fetchOrdersError'))
        }
        if (!cancelled) setOrders(result.data ?? [])
      } catch (refreshError) {
        if (!cancelled) {
          setError(
            refreshError instanceof Error
              ? refreshError.message
              : tQuotesOrders(locale, 'fetchOrdersError'),
          )
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void refresh()
    return () => {
      cancelled = true
    }
  }, [locale])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return orders.filter((order) => {
      if (statusFilter !== 'all' && order.status !== statusFilter) return false
      if (!q) return true
      return (
        order.service_order_number.toLowerCase().includes(q) ||
        (order.quote_number ?? '').toLowerCase().includes(q) ||
        order.customer_name.toLowerCase().includes(q) ||
        (order.city ?? '').toLowerCase().includes(q)
      )
    })
  }, [orders, query, statusFilter])

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-[var(--brand-primary)] sm:text-3xl">
            {tQuotesOrders(locale, 'ordersTitle')}
          </h1>
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--brand-primary-2)]/80">
            {filtered.length} {tQuotesOrders(locale, 'ordersCountLabel')}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">
              {tQuotesOrders(locale, 'search')}
            </span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={tQuotesOrders(locale, 'searchOrdersPlaceholder')}
              className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-900 outline-none focus:border-red-300 focus:bg-white focus:ring-2 focus:ring-red-100"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">
              {tQuotesOrders(locale, 'filterStatus')}
            </span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-900 outline-none focus:border-red-300 focus:bg-white focus:ring-2 focus:ring-red-100"
            >
              <option value="all">{tQuotesOrders(locale, 'allStatuses')}</option>
              {SERVICE_ORDER_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {orderStatusLabel(status, locale)}
                </option>
              ))}
            </select>
          </label>
        </div>
        {error ? <p className="mt-3 text-sm text-cdl-action">{error}</p> : null}
      </div>

      {filtered.length === 0 ? (
        <div className="pscs-panel p-8 text-center text-[var(--brand-text-muted)]">
          {loading
            ? tQuotesOrders(locale, 'loadingOrders')
            : tQuotesOrders(locale, 'emptyOrders')}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
          <div
            className={`hidden border-b border-neutral-100 bg-neutral-50 px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-neutral-500 lg:grid lg:gap-3 ${
              canViewFinancial
                ? 'lg:grid-cols-[8rem_minmax(0,1.4fr)_7rem_8rem_7rem_auto]'
                : 'lg:grid-cols-[8rem_minmax(0,1.4fr)_7rem_8rem_auto]'
            }`}
          >
            <span>{tQuotesOrders(locale, 'orderNumber')}</span>
            <span>{tQuotesOrders(locale, 'tableCustomerEvent')}</span>
            <span>{tQuotesOrders(locale, 'tableDate')}</span>
            <span>{tQuotesOrders(locale, 'status')}</span>
            {canViewFinancial ? (
              <span className="text-right">{tQuotesOrders(locale, 'total')}</span>
            ) : null}
            <span className="text-right">{tQuotesOrders(locale, 'actions')}</span>
          </div>
          <ul>
            {filtered.map((order) => (
              <li
                key={order.id}
                className="border-b border-neutral-100 px-4 py-3 last:border-b-0"
              >
                <div
                  className={`grid gap-2.5 lg:items-center lg:gap-3 ${
                    canViewFinancial
                      ? 'lg:grid-cols-[8rem_minmax(0,1.4fr)_7rem_8rem_7rem_auto]'
                      : 'lg:grid-cols-[8rem_minmax(0,1.4fr)_7rem_8rem_auto]'
                  }`}
                >
                  <p className="text-xs font-bold uppercase tracking-wide text-neutral-500 lg:text-sm">
                    {order.service_order_number}
                  </p>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-neutral-900">
                      {order.customer_name}
                    </p>
                    <p className="truncate text-xs text-neutral-500">
                      {[order.city, order.state].filter(Boolean).join(', ') || '—'}
                      {order.quote_number
                        ? ` · ${tQuotesOrders(locale, 'linkedQuote')} ${order.quote_number}`
                        : ''}
                    </p>
                  </div>
                  <p className="text-sm text-neutral-700">{formatDate(order.event_date)}</p>
                  <div>
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-wider ${
                        STATUS_BADGE_CLASS[order.status] ??
                        'border-cdl-border bg-cdl-inset text-cdl-text-secondary'
                      }`}
                    >
                      {orderStatusLabel(order.status, locale)}
                    </span>
                  </div>
                  {canViewFinancial ? (
                    <p className="text-right text-sm font-black text-neutral-900">
                      {formatMoney(order.service_order_total)}
                    </p>
                  ) : null}
                  <div className="flex justify-end">
                    <Link
                      href={`/orders/${order.id}`}
                      className="inline-flex min-h-[36px] items-center justify-center rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-xs font-bold uppercase tracking-wide text-neutral-800 transition hover:border-neutral-300"
                    >
                      {tQuotesOrders(locale, 'view')}
                    </Link>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
