'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import {
  invoiceStatusLabel,
  tPayments,
} from '@/Lib/i18n/payments'
import { formatUiDate, toBcp47Locale } from '@/Lib/i18n/locales'
import { useAuthLocaleFromMe } from '@/Lib/i18n/useAuthLocaleFromMe'
import type { InvoiceBackofficeListItem } from '@/Lib/payments/fetchInvoiceBackoffice'
import { INVOICE_STATUSES } from '@/Lib/payments/types'

const STATUS_BADGE_CLASS: Record<string, string> = {
  draft: 'border-cdl-border bg-cdl-inset text-cdl-text-secondary',
  ready: 'border-cdl-accent-border bg-cdl-accent/15 text-cdl-brand',
  awaiting_deposit: 'border-cdl-warning-border bg-cdl-warning-soft text-cdl-warning',
  partially_paid: 'border-cdl-warning-border bg-cdl-warning-soft text-cdl-warning',
  paid: 'border-cdl-success-border bg-cdl-success-soft text-cdl-success',
  canceled: 'border-red-300/40 bg-red-500/10 text-red-500',
}

function formatMoney(
  value: number,
  currency: string,
  locale: string | null | undefined,
) {
  try {
    return new Intl.NumberFormat(toBcp47Locale(locale), {
      style: 'currency',
      currency: currency || 'USD',
    }).format(Number(value || 0))
  } catch {
    return `${currency || 'USD'} ${Number(value || 0).toFixed(2)}`
  }
}

export default function InvoicesDashboard({
  initialInvoices,
}: {
  initialInvoices: InvoiceBackofficeListItem[]
}) {
  const locale = useAuthLocaleFromMe()
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return initialInvoices.filter((invoice) => {
      if (statusFilter !== 'all' && invoice.status !== statusFilter) return false
      if (!q) return true
      return (
        invoice.invoice_number.toLowerCase().includes(q) ||
        (invoice.quote_number ?? '').toLowerCase().includes(q) ||
        invoice.customer_name.toLowerCase().includes(q) ||
        (invoice.event_name ?? '').toLowerCase().includes(q)
      )
    })
  }, [initialInvoices, query, statusFilter])

  const operationalTotals = useMemo(() => {
    const active = initialInvoices.filter((invoice) => invoice.status !== 'canceled')
    return active.reduce(
      (acc, invoice) => {
        acc.total += invoice.total
        acc.paid += invoice.paid_total
        acc.outstanding += invoice.outstanding_amount
        return acc
      },
      { total: 0, paid: 0, outstanding: 0 },
    )
  }, [initialInvoices])

  const currency =
    initialInvoices.find((invoice) => invoice.status !== 'canceled')?.currency_code ||
    initialInvoices[0]?.currency_code ||
    'USD'

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-[var(--brand-primary)] sm:text-3xl">
          {tPayments(locale, 'backofficeTitle')}
        </h1>
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--brand-primary-2)]/80">
          {filtered.length} {tPayments(locale, 'backofficeCount')}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">
            {tPayments(locale, 'totalReceivable')}
          </p>
          <p className="mt-1 text-xl font-black text-neutral-900">
            {formatMoney(operationalTotals.total, currency, locale)}
          </p>
        </div>
        <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">
            {tPayments(locale, 'capturedTotal')}
          </p>
          <p className="mt-1 text-xl font-black text-neutral-900">
            {formatMoney(operationalTotals.paid, currency, locale)}
          </p>
        </div>
        <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">
            {tPayments(locale, 'invoiceOutstanding')}
          </p>
          <p className="mt-1 text-xl font-black text-neutral-900">
            {formatMoney(operationalTotals.outstanding, currency, locale)}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">
              {tPayments(locale, 'search')}
            </span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={tPayments(locale, 'searchPlaceholder')}
              className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-900 outline-none focus:border-red-300 focus:bg-white focus:ring-2 focus:ring-red-100"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">
              {tPayments(locale, 'filterStatus')}
            </span>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-900 outline-none focus:border-red-300 focus:bg-white focus:ring-2 focus:ring-red-100"
            >
              <option value="all">{tPayments(locale, 'allStatuses')}</option>
              {INVOICE_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {invoiceStatusLabel(status, locale)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="pscs-panel p-8 text-center text-[var(--brand-text-muted)]">
          {tPayments(locale, 'noInvoices')}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
          <div className="hidden border-b border-neutral-100 bg-neutral-50 px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-neutral-500 xl:grid xl:grid-cols-[8rem_8rem_minmax(0,1.35fr)_7rem_8.5rem_7rem_7rem_7rem_auto] xl:gap-3">
            <span>{tPayments(locale, 'invoiceTitle')}</span>
            <span>{tPayments(locale, 'sourceQuote')}</span>
            <span>{tPayments(locale, 'customerEvent')}</span>
            <span>{tPayments(locale, 'date')}</span>
            <span>{tPayments(locale, 'filterStatus')}</span>
            <span className="text-right">{tPayments(locale, 'total')}</span>
            <span className="text-right">{tPayments(locale, 'paid')}</span>
            <span className="text-right">{tPayments(locale, 'invoiceOutstanding')}</span>
            <span className="text-right">{tPayments(locale, 'actions')}</span>
          </div>
          <ul>
            {filtered.map((invoice) => (
              <li key={invoice.id} className="border-b border-neutral-100 px-4 py-4 last:border-b-0">
                <div className="grid gap-3 xl:grid-cols-[8rem_8rem_minmax(0,1.35fr)_7rem_8.5rem_7rem_7rem_7rem_auto] xl:items-center xl:gap-3">
                  <Link
                    href={`/invoices/${invoice.id}`}
                    className="text-sm font-black text-neutral-900 hover:underline"
                  >
                    {invoice.invoice_number}
                  </Link>
                  <Link
                    href={`/quotes/${invoice.quote_id}`}
                    className="text-sm font-bold text-[var(--brand-primary-2)] hover:underline"
                  >
                    {invoice.quote_number || '—'}
                  </Link>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-neutral-900">
                      {invoice.customer_name}
                    </p>
                    <p className="truncate text-xs text-neutral-500">
                      {invoice.event_name || '—'}
                    </p>
                  </div>
                  <p className="text-sm text-neutral-700">
                    {formatUiDate(invoice.event_date, locale)}
                  </p>
                  <div>
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-wider ${
                        STATUS_BADGE_CLASS[invoice.status] ??
                        'border-cdl-border bg-cdl-inset text-cdl-text-secondary'
                      }`}
                    >
                      {invoiceStatusLabel(invoice.status, locale)}
                    </span>
                  </div>
                  <p className="text-sm font-bold text-neutral-900 xl:text-right">
                    {formatMoney(invoice.total, invoice.currency_code, locale)}
                  </p>
                  <p className="text-sm text-neutral-700 xl:text-right">
                    {formatMoney(invoice.paid_total, invoice.currency_code, locale)}
                  </p>
                  <p className="text-sm font-black text-neutral-900 xl:text-right">
                    {formatMoney(invoice.outstanding_amount, invoice.currency_code, locale)}
                  </p>
                  <div className="flex xl:justify-end">
                    <Link
                      href={`/invoices/${invoice.id}`}
                      className="inline-flex min-h-[36px] items-center justify-center rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-xs font-bold uppercase tracking-wide text-neutral-800 transition hover:border-neutral-300"
                    >
                      {tPayments(locale, 'view')}
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
