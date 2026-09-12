'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import {
  invoiceStatusLabel,
  paymentProviderLabel,
  paymentStatusLabel,
  tPayments,
} from '@/Lib/i18n/payments'
import { tFinanceObservability } from '@/Lib/i18n/financeObservability'
import { formatUiDate } from '@/Lib/i18n/locales'
import { useAuthLocaleFromMe } from '@/Lib/i18n/useAuthLocaleFromMe'
import type {
  InvoiceControlKpis,
  InvoiceControlListItem,
} from '@/Lib/payments/financeObservabilityTypes'
import { FINANCE_PAGE_SIZES } from '@/Lib/payments/financeObservabilityTypes'
import { INVOICE_KINDS, INVOICE_STATUSES, PAYMENT_ATTEMPT_STATUSES, PAYMENT_PROVIDERS } from '@/Lib/payments/types'
import { tFinanceControl } from '@/Lib/i18n/financeControl'
import { FinanceBackLink, FinanceBreadcrumb } from '@/components/finance/FinanceChrome'
import { formatFinanceDateTime, formatFinanceMoney, INVOICE_STATUS_BADGE, kindBadgeClass } from './financeUi'

type FiltersState = {
  period: string
  from: string
  to: string
  invoiceNumber: string
  quoteNumber: string
  os: string
  customer: string
  status: string
  invoiceKind: string
  provider: string
  paymentStatus: string
  page: number
  pageSize: number
}

const INITIAL_FILTERS: FiltersState = {
  period: 'all',
  from: '',
  to: '',
  invoiceNumber: '',
  quoteNumber: '',
  os: '',
  customer: '',
  status: 'all',
  invoiceKind: 'all',
  provider: 'all',
  paymentStatus: 'all',
  page: 1,
  pageSize: 25,
}

function toQuery(filters: FiltersState) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (value === '' || value == null) continue
    if (key === 'period' && value === 'all') params.set(key, 'all')
    else params.set(key, String(value))
  }
  return params.toString()
}

export default function InvoicesDashboard() {
  const locale = useAuthLocaleFromMe()
  const [filters, setFilters] = useState<FiltersState>(INITIAL_FILTERS)
  const [applied, setApplied] = useState<FiltersState>(INITIAL_FILTERS)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [invoices, setInvoices] = useState<InvoiceControlListItem[] | null>(null)
  const [kpis, setKpis] = useState<InvoiceControlKpis | null>(null)
  const [total, setTotal] = useState(0)
  const query = useMemo(() => toQuery(applied), [applied])

  useEffect(() => {
    const controller = new AbortController()
    fetch(`/api/finance/invoices?${query}`, { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}))
        if (controller.signal.aborted) return
        if (!response.ok) {
          setError(payload.error || tFinanceObservability(locale, 'loadError'))
          setInvoices([])
          return
        }
        setError(null)
        setInvoices(payload.data ?? [])
        setKpis(payload.kpis ?? null)
        setTotal(Number(payload.total || 0))
      })
      .catch((err) => {
        if (controller.signal.aborted) return
        setError(err instanceof Error ? err.message : tFinanceObservability(locale, 'loadError'))
        setInvoices([])
      })
    return () => controller.abort()
  }, [locale, query])

  const loading = invoices === null
  const rows = invoices ?? []
  const pages = Math.max(1, Math.ceil(total / applied.pageSize))
  const cards = useMemo(() => {
    if (!kpis) return []
    const currency = kpis.currency_code || 'USD'
    return [
      { key: 'kpiBilled', value: formatFinanceMoney(kpis.billed_total, currency, locale) },
      { key: 'kpiReceived', value: formatFinanceMoney(kpis.received_total, currency, locale) },
      { key: 'kpiOutstanding', value: formatFinanceMoney(kpis.outstanding_total, currency, locale) },
      { key: 'kpiCanceled', value: formatFinanceMoney(kpis.canceled_total, currency, locale) },
      { key: 'kpiOriginals', value: String(kpis.original_count) },
      { key: 'kpiAdjustments', value: String(kpis.adjustment_count) },
      { key: 'kpiPaymentsCompleted', value: String(kpis.payments_completed) },
      { key: 'kpiPaymentsFailed', value: String(kpis.payments_failed) },
    ] as const
  }, [kpis, locale])

  function applyFilters() {
    const next = { ...filters, page: 1 }
    setFilters(next)
    setApplied(next)
    setFiltersOpen(false)
  }

  function updatePage(page: number) {
    const next = { ...applied, page }
    setFilters(next)
    setApplied(next)
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
      <FinanceBreadcrumb locale={locale} current={tFinanceControl(locale, 'invoices')} />
      <FinanceBackLink locale={locale} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-[var(--brand-primary)] sm:text-3xl">
            {tFinanceObservability(locale, 'invoiceControlTitle')}
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            {tFinanceObservability(locale, 'invoiceControlSubtitle')}
          </p>
        </div>
        <button
          type="button"
          className="inline-flex min-h-[40px] items-center justify-center rounded-xl border border-neutral-200 bg-white px-4 text-xs font-bold uppercase tracking-wide lg:hidden"
          onClick={() => setFiltersOpen(true)}
        >
          {tFinanceObservability(locale, 'filters')}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((card) => (
          <div key={card.key} className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
            <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">
              {tFinanceObservability(locale, card.key)}
            </p>
            <p className="mt-1 text-lg font-black text-neutral-900 sm:text-xl">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="hidden rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm lg:block">
        <FilterGrid
          locale={locale}
          filters={filters}
          setFilters={setFilters}
          onApply={applyFilters}
          onClear={() => {
            setFilters(INITIAL_FILTERS)
            setApplied(INITIAL_FILTERS)
          }}
        />
      </div>

      {filtersOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label={tFinanceObservability(locale, 'closeFilters')}
            onClick={() => setFiltersOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[88dvh] overflow-y-auto rounded-t-3xl bg-white p-4 shadow-xl">
            <FilterGrid
              locale={locale}
              filters={filters}
              setFilters={setFilters}
              onApply={applyFilters}
              onClear={() => {
                setFilters(INITIAL_FILTERS)
                setApplied(INITIAL_FILTERS)
                setFiltersOpen(false)
              }}
            />
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      ) : null}

      {loading ? (
        <div className="rounded-2xl border border-neutral-200 bg-white p-8 text-center text-neutral-500">
          …
        </div>
      ) : rows.length === 0 ? (
        <div className="pscs-panel p-8 text-center text-[var(--brand-text-muted)]">
          {tFinanceObservability(locale, 'empty')}
        </div>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm xl:block">
            <div className="grid grid-cols-[7.5rem_7rem_minmax(0,1fr)_5rem_5rem_6.5rem_6rem_6rem_6rem_6rem_7rem_5rem] gap-3 border-b border-neutral-100 bg-neutral-50 px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-neutral-500">
              <span>{tFinanceObservability(locale, 'colInvoice')}</span>
              <span>{tFinanceObservability(locale, 'colKind')}</span>
              <span>{tFinanceObservability(locale, 'colCustomer')}</span>
              <span>{tFinanceObservability(locale, 'colQuote')}</span>
              <span>{tFinanceObservability(locale, 'colOs')}</span>
              <span>{tFinanceObservability(locale, 'colStatus')}</span>
              <span className="text-right">{tFinanceObservability(locale, 'colTotal')}</span>
              <span className="text-right">{tFinanceObservability(locale, 'colPaid')}</span>
              <span className="text-right">{tFinanceObservability(locale, 'colOutstanding')}</span>
              <span>{tFinanceObservability(locale, 'colProvider')}</span>
              <span>{tFinanceObservability(locale, 'colLastPayment')}</span>
              <span>{tFinanceObservability(locale, 'colDate')}</span>
            </div>
            <ul>
              {rows.map((invoice) => (
                <li key={invoice.id} className="grid grid-cols-[7.5rem_7rem_minmax(0,1fr)_5rem_5rem_6.5rem_6rem_6rem_6rem_6rem_7rem_5rem] items-center gap-3 border-b border-neutral-100 px-4 py-3 last:border-b-0">
                  <InvoiceIdentity invoice={invoice} locale={locale} />
                  <KindCell invoice={invoice} locale={locale} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-neutral-900">{invoice.customer_name}</p>
                    <p className="truncate text-xs text-neutral-500">{invoice.event_name || '—'}</p>
                  </div>
                  <Link href={`/quotes/${invoice.quote_id}`} className="truncate text-sm font-bold text-[var(--brand-primary-2)] hover:underline">
                    {invoice.quote_number || '—'}
                  </Link>
                  <span className="truncate text-sm text-neutral-700">{invoice.service_order_number || '—'}</span>
                  <StatusBadge status={invoice.status} locale={locale} />
                  <p className="text-right text-sm font-bold">{formatFinanceMoney(invoice.total, invoice.currency_code, locale)}</p>
                  <p className="text-right text-sm">{formatFinanceMoney(invoice.paid_total, invoice.currency_code, locale)}</p>
                  <p className="text-right text-sm font-black">{formatFinanceMoney(invoice.outstanding_amount, invoice.currency_code, locale)}</p>
                  <p className="text-sm text-neutral-700">{invoice.last_provider ? paymentProviderLabel(invoice.last_provider, locale) : '—'}</p>
                  <p className="text-xs text-neutral-600">
                    {invoice.last_payment_status ? paymentStatusLabel(invoice.last_payment_status, locale) : '—'}
                    <br />
                    {formatFinanceDateTime(invoice.last_payment_at, locale)}
                  </p>
                  <p className="text-sm text-neutral-700">{formatUiDate(invoice.created_at, locale)}</p>
                </li>
              ))}
            </ul>
          </div>

          <ul className="space-y-3 xl:hidden">
            {rows.map((invoice) => (
              <li key={invoice.id} className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <InvoiceIdentity invoice={invoice} locale={locale} />
                  <StatusBadge status={invoice.status} locale={locale} />
                </div>
                <div className="mt-2">
                  <KindCell invoice={invoice} locale={locale} />
                </div>
                <p className="mt-2 text-sm font-bold text-neutral-900">{invoice.customer_name}</p>
                <p className="text-xs text-neutral-500">{invoice.event_name || '—'}</p>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <dt className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">{tFinanceObservability(locale, 'colTotal')}</dt>
                    <dd className="font-black">{formatFinanceMoney(invoice.total, invoice.currency_code, locale)}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">{tFinanceObservability(locale, 'colOutstanding')}</dt>
                    <dd className="font-black">{formatFinanceMoney(invoice.outstanding_amount, invoice.currency_code, locale)}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">{tFinanceObservability(locale, 'colQuote')}</dt>
                    <dd>{invoice.quote_number || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">{tFinanceObservability(locale, 'colOs')}</dt>
                    <dd>{invoice.service_order_number || '—'}</dd>
                  </div>
                </dl>
                <Link
                  href={`/invoices/${invoice.id}`}
                  className="mt-3 inline-flex min-h-[36px] items-center rounded-lg border border-neutral-200 px-3 text-xs font-bold uppercase"
                >
                  {tPayments(locale, 'view')}
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="flex items-center gap-2 text-sm">
          <span className="text-neutral-500">{tFinanceObservability(locale, 'pageSize')}</span>
          <select
            value={applied.pageSize}
            onChange={(event) => {
              const next = { ...applied, page: 1, pageSize: Number(event.target.value) }
              setFilters(next)
              setApplied(next)
            }}
            className="rounded-lg border border-neutral-200 bg-white px-2 py-1.5"
          >
            {FINANCE_PAGE_SIZES.map((size) => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
        </label>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={applied.page <= 1}
            onClick={() => updatePage(applied.page - 1)}
            className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-bold uppercase disabled:opacity-40"
          >
            {tFinanceObservability(locale, 'previous')}
          </button>
          <span className="text-xs font-semibold text-neutral-600">
            {tFinanceObservability(locale, 'pageOf', { page: applied.page, pages })}
          </span>
          <button
            type="button"
            disabled={applied.page >= pages}
            onClick={() => updatePage(applied.page + 1)}
            className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-bold uppercase disabled:opacity-40"
          >
            {tFinanceObservability(locale, 'next')}
          </button>
        </div>
      </div>
    </div>
  )
}

function InvoiceIdentity({
  invoice,
  locale,
}: {
  invoice: InvoiceControlListItem
  locale: string
}) {
  return (
    <div className="min-w-0">
      <Link href={`/invoices/${invoice.id}`} className="text-sm font-black text-neutral-900 hover:underline">
        {invoice.invoice_number}
      </Link>
      {invoice.invoice_kind === 'post_event_adjustment' && invoice.parent_invoice_number ? (
        <p className="text-[11px] text-neutral-500">
          ↳ {tFinanceObservability(locale, 'childOfOriginal', { number: invoice.parent_invoice_number })}
        </p>
      ) : null}
    </div>
  )
}

function KindCell({
  invoice,
  locale,
}: {
  invoice: InvoiceControlListItem
  locale: string
}) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${kindBadgeClass(invoice.invoice_kind)}`}>
      {invoice.invoice_kind === 'post_event_adjustment'
        ? tFinanceObservability(locale, 'kindAdjustment')
        : tFinanceObservability(locale, 'kindOriginal')}
    </span>
  )
}

function StatusBadge({ status, locale }: { status: string; locale: string }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-wider ${INVOICE_STATUS_BADGE[status] ?? 'border-cdl-border bg-cdl-inset text-cdl-text-secondary'}`}>
      {invoiceStatusLabel(status, locale)}
    </span>
  )
}

function FilterGrid({
  locale,
  filters,
  setFilters,
  onApply,
  onClear,
}: {
  locale: string
  filters: FiltersState
  setFilters: (value: FiltersState) => void
  onApply: () => void
  onClear: () => void
}) {
  function patch(partial: Partial<FiltersState>) {
    setFilters({ ...filters, ...partial })
  }

  return (
    <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-4">
      <Field label={tFinanceObservability(locale, 'filterPeriod')}>
        <select value={filters.period} onChange={(event) => patch({ period: event.target.value })} className={fieldClass}>
          <option value="all">{tFinanceObservability(locale, 'periodAll')}</option>
          <option value="today">{tFinanceObservability(locale, 'periodToday')}</option>
          <option value="7d">{tFinanceObservability(locale, 'period7d')}</option>
          <option value="30d">{tFinanceObservability(locale, 'period30d')}</option>
          <option value="custom">{tFinanceObservability(locale, 'periodCustom')}</option>
        </select>
      </Field>
      {filters.period === 'custom' ? (
        <>
          <Field label={tFinanceObservability(locale, 'periodCustom')}>
            <input type="date" value={filters.from} onChange={(event) => patch({ from: event.target.value })} className={fieldClass} />
          </Field>
          <Field label={tFinanceObservability(locale, 'periodCustom')}>
            <input type="date" value={filters.to} onChange={(event) => patch({ to: event.target.value })} className={fieldClass} />
          </Field>
        </>
      ) : null}
      <Field label={tFinanceObservability(locale, 'filterInvoiceNumber')}>
        <input value={filters.invoiceNumber} onChange={(event) => patch({ invoiceNumber: event.target.value })} className={fieldClass} />
      </Field>
      <Field label={tFinanceObservability(locale, 'filterQuoteNumber')}>
        <input value={filters.quoteNumber} onChange={(event) => patch({ quoteNumber: event.target.value })} className={fieldClass} />
      </Field>
      <Field label={tFinanceObservability(locale, 'filterOs')}>
        <input value={filters.os} onChange={(event) => patch({ os: event.target.value })} className={fieldClass} />
      </Field>
      <Field label={tFinanceObservability(locale, 'filterCustomer')}>
        <input value={filters.customer} onChange={(event) => patch({ customer: event.target.value })} className={fieldClass} />
      </Field>
      <Field label={tPayments(locale, 'filterStatus')}>
        <select value={filters.status} onChange={(event) => patch({ status: event.target.value })} className={fieldClass}>
          <option value="all">{tPayments(locale, 'allStatuses')}</option>
          {INVOICE_STATUSES.map((status) => (
            <option key={status} value={status}>{invoiceStatusLabel(status, locale)}</option>
          ))}
        </select>
      </Field>
      <Field label={tFinanceObservability(locale, 'filterKind')}>
        <select value={filters.invoiceKind} onChange={(event) => patch({ invoiceKind: event.target.value })} className={fieldClass}>
          <option value="all">{tFinanceObservability(locale, 'allKinds')}</option>
          {INVOICE_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {kind === 'post_event_adjustment'
                ? tFinanceObservability(locale, 'kindAdjustment')
                : tFinanceObservability(locale, 'kindOriginal')}
            </option>
          ))}
        </select>
      </Field>
      <Field label={tFinanceObservability(locale, 'filterProvider')}>
        <select value={filters.provider} onChange={(event) => patch({ provider: event.target.value })} className={fieldClass}>
          <option value="all">{tPayments(locale, 'allStatuses')}</option>
          {PAYMENT_PROVIDERS.map((provider) => (
            <option key={provider} value={provider}>{paymentProviderLabel(provider, locale)}</option>
          ))}
        </select>
      </Field>
      <Field label={tFinanceObservability(locale, 'filterPaymentStatus')}>
        <select value={filters.paymentStatus} onChange={(event) => patch({ paymentStatus: event.target.value })} className={fieldClass}>
          <option value="all">{tPayments(locale, 'allStatuses')}</option>
          {PAYMENT_ATTEMPT_STATUSES.map((status) => (
            <option key={status} value={status}>{paymentStatusLabel(status, locale)}</option>
          ))}
        </select>
      </Field>
      <div className="flex items-end gap-2 md:col-span-2">
        <button type="button" onClick={onApply} className="min-h-[40px] rounded-xl bg-[var(--brand-primary-2,#1e3a5f)] px-4 text-xs font-bold uppercase text-white">
          {tFinanceObservability(locale, 'applyFilters')}
        </button>
        <button type="button" onClick={onClear} className="min-h-[40px] rounded-xl border border-neutral-200 px-4 text-xs font-bold uppercase">
          {tFinanceObservability(locale, 'clearFilters')}
        </button>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">{label}</span>
      {children}
    </label>
  )
}

const fieldClass =
  'rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-900 outline-none focus:border-red-300 focus:bg-white focus:ring-2 focus:ring-red-100'
