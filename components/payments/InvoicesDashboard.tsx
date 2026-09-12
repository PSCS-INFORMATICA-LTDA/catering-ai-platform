'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useOptionalAppSession } from '@/components/auth/AppSessionProvider'
import { FinanceBackLink, FinanceBreadcrumb } from '@/components/finance/FinanceChrome'
import { tFinanceControl } from '@/Lib/i18n/financeControl'
import { tInvoiceWorkspace } from '@/Lib/i18n/invoiceWorkspace'
import { tFinanceObservability } from '@/Lib/i18n/financeObservability'
import {
  invoiceStatusLabel,
  paymentProviderLabel,
  paymentStatusLabel,
  tPayments,
} from '@/Lib/i18n/payments'
import { useAuthLocaleFromMe } from '@/Lib/i18n/useAuthLocaleFromMe'
import type {
  InvoiceControlKpis,
  InvoiceControlListItem,
  InvoiceWorkspaceColumnId,
  InvoiceWorkspaceSort,
  InvoiceWorkspaceView,
  InvoiceWorkspaceViewCounts,
} from '@/Lib/payments/financeObservabilityTypes'
import {
  FINANCE_PAGE_SIZES,
  INVOICE_WORKSPACE_COLUMNS,
  INVOICE_WORKSPACE_VIEWS,
} from '@/Lib/payments/financeObservabilityTypes'
import {
  defaultInvoiceWorkspaceColumnPrefs,
  INVOICE_WORKSPACE_ALWAYS_VISIBLE,
  invoiceWorkspaceStorageKey,
  parseInvoiceWorkspaceColumnPrefs,
  type InvoiceWorkspaceColumnPrefs,
} from '@/Lib/payments/invoiceWorkspace'
import { INVOICE_KINDS, INVOICE_STATUSES, PAYMENT_ATTEMPT_STATUSES, PAYMENT_PROVIDERS } from '@/Lib/payments/types'
import { InvoiceWorkspaceGrid } from './InvoiceWorkspaceGrid'
import { InvoiceWorkspacePreview } from './InvoiceWorkspacePreview'
import { formatFinanceMoney, INVOICE_STATUS_BADGE } from './financeUi'

type FiltersState = {
  period: string
  from: string
  to: string
  q: string
  invoiceNumber: string
  quoteNumber: string
  os: string
  customer: string
  status: string
  invoiceKind: string
  provider: string
  paymentStatus: string
  view: InvoiceWorkspaceView
  sort: string
  direction: 'asc' | 'desc'
  eventFrom: string
  eventTo: string
  minTotal: string
  maxTotal: string
  minOutstanding: string
  maxOutstanding: string
  page: number
  pageSize: number
}

const INITIAL_FILTERS: FiltersState = {
  period: 'all',
  from: '',
  to: '',
  q: '',
  invoiceNumber: '',
  quoteNumber: '',
  os: '',
  customer: '',
  status: 'all',
  invoiceKind: 'all',
  provider: 'all',
  paymentStatus: 'all',
  view: 'all',
  sort: 'created_at',
  direction: 'desc',
  eventFrom: '',
  eventTo: '',
  minTotal: '',
  maxTotal: '',
  minOutstanding: '',
  maxOutstanding: '',
  page: 1,
  pageSize: 25,
}

const VIEW_LABEL: Record<InvoiceWorkspaceView, Parameters<typeof tInvoiceWorkspace>[1]> = {
  all: 'viewAll',
  receivable: 'viewReceivable',
  partially_paid: 'viewPartial',
  paid: 'viewPaid',
  awaiting_deposit: 'viewAwaitingDeposit',
  failed: 'viewFailed',
  adjustments: 'viewAdjustments',
  canceled: 'viewCanceled',
}

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

function toQuery(filters: FiltersState) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (value === '' || value == null) continue
    params.set(key, String(value))
  }
  return params.toString()
}

export default function InvoicesDashboard() {
  const locale = useAuthLocaleFromMe()
  const session = useOptionalAppSession()
  const storageKey = invoiceWorkspaceStorageKey(
    session?.userId,
    session?.activeMembership?.companyId,
  )
  const [filters, setFilters] = useState<FiltersState>(INITIAL_FILTERS)
  const [applied, setApplied] = useState<FiltersState>(INITIAL_FILTERS)
  const [searchDraft, setSearchDraft] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [columnsOpen, setColumnsOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [invoices, setInvoices] = useState<InvoiceControlListItem[] | null>(null)
  const [kpis, setKpis] = useState<InvoiceControlKpis | null>(null)
  const [viewCounts, setViewCounts] = useState<InvoiceWorkspaceViewCounts | null>(null)
  const [total, setTotal] = useState(0)
  const [preview, setPreview] = useState<InvoiceControlListItem | null>(null)
  const [exporting, setExporting] = useState(false)
  const [prefs, setPrefs] = useState<InvoiceWorkspaceColumnPrefs>(defaultInvoiceWorkspaceColumnPrefs)
  const query = useMemo(() => toQuery(applied), [applied])

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey)
      if (raw) setPrefs(parseInvoiceWorkspaceColumnPrefs(JSON.parse(raw)))
    } catch {
      /* ignore */
    }
  }, [storageKey])

  function persistPrefs(next: InvoiceWorkspaceColumnPrefs) {
    setPrefs(next)
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(next))
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    if (searchDraft === applied.q) return
    const handle = window.setTimeout(() => {
      setApplied((current) => ({ ...current, q: searchDraft, page: 1 }))
      setFilters((current) => ({ ...current, q: searchDraft, page: 1 }))
    }, 400)
    return () => window.clearTimeout(handle)
  }, [applied.q, searchDraft])

  useEffect(() => {
    const controller = new AbortController()
    fetch(`/api/finance/invoices?${query}`, { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}))
        if (controller.signal.aborted) return
        if (!response.ok) {
          setError(payload.error || tInvoiceWorkspace(locale, 'loadError'))
          setInvoices([])
          return
        }
        setError(null)
        setInvoices(payload.data ?? [])
        setKpis(payload.kpis ?? null)
        setViewCounts(payload.viewCounts ?? null)
        setTotal(Number(payload.total || 0))
      })
      .catch((err) => {
        if (controller.signal.aborted) return
        setError(err instanceof Error ? err.message : tInvoiceWorkspace(locale, 'loadError'))
        setInvoices([])
      })
    return () => controller.abort()
  }, [locale, query])

  const loading = invoices === null
  const rows = invoices ?? []
  const pages = Math.max(1, Math.ceil(total / applied.pageSize))

  function applyAdvanced() {
    const next = { ...filters, q: searchDraft, page: 1 }
    setFilters(next)
    setApplied(next)
    setFiltersOpen(false)
  }

  function updateApplied(partial: Partial<FiltersState>) {
    const next = { ...applied, ...partial }
    setFilters(next)
    setApplied(next)
  }

  async function exportCsv() {
    setExporting(true)
    try {
      const response = await fetch(`/api/finance/invoices/export?${query}`, { cache: 'no-store' })
      if (!response.ok) throw new Error(tInvoiceWorkspace(locale, 'exportError'))
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'faturamento.csv'
      link.click()
      URL.revokeObjectURL(url)
    } catch {
      setError(tInvoiceWorkspace(locale, 'exportError'))
    } finally {
      setExporting(false)
    }
  }

  const moneyCards = kpis
    ? [
        { key: 'kpiBilled' as const, value: formatFinanceMoney(kpis.billed_total, kpis.currency_code, locale) },
        { key: 'kpiNetReceived' as const, value: formatFinanceMoney(kpis.received_total, kpis.currency_code, locale) },
        { key: 'kpiOutstanding' as const, value: formatFinanceMoney(kpis.outstanding_total, kpis.currency_code, locale) },
        { key: 'kpiRefunds' as const, value: formatFinanceMoney(kpis.refunded_total, kpis.currency_code, locale) },
      ]
    : []
  const countCards = kpis
    ? [
        { key: 'kpiInvoices' as const, value: String(kpis.invoice_count) },
        { key: 'kpiReceivable' as const, value: String(kpis.receivable_count) },
        { key: 'kpiPartial' as const, value: String(kpis.partially_paid_count) },
        { key: 'kpiFailed' as const, value: String(kpis.failed_count) },
      ]
    : []

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-4 xl:h-[calc(100dvh-6.5rem)] xl:overflow-hidden">
      <div className="flex flex-col gap-2">
        <FinanceBreadcrumb locale={locale} current={tFinanceControl(locale, 'invoices')} />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-[var(--brand-primary)] sm:text-3xl">
              {tInvoiceWorkspace(locale, 'title')}
            </h1>
            <p className="mt-1 text-sm text-neutral-500">{tInvoiceWorkspace(locale, 'subtitle')}</p>
          </div>
          <FinanceBackLink locale={locale} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {moneyCards.map((card) => (
          <div key={card.key} className="rounded-2xl border border-neutral-200 bg-white p-3 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
              {tInvoiceWorkspace(locale, card.key)}
            </p>
            <p className="mt-1 text-lg font-black text-neutral-900">{card.value}</p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {countCards.map((card) => (
          <div key={card.key} className="rounded-xl border border-neutral-100 bg-neutral-50 px-3 py-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
              {tInvoiceWorkspace(locale, card.key)}
            </p>
            <p className="text-sm font-black">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="sticky top-0 z-20 space-y-3 rounded-2xl border border-neutral-200 bg-white/95 p-3 shadow-sm backdrop-blur">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          <input
            value={searchDraft}
            onChange={(event) => setSearchDraft(event.target.value)}
            placeholder={tInvoiceWorkspace(locale, 'searchPlaceholder')}
            aria-label={tInvoiceWorkspace(locale, 'searchAria')}
            className="min-h-[44px] flex-1 rounded-xl border border-neutral-200 bg-neutral-50 px-4 text-sm outline-none focus:border-red-300 focus:bg-white focus:ring-2 focus:ring-red-100"
          />
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setAdvancedOpen((value) => !value)} className={toolbarBtn}>
              {tInvoiceWorkspace(locale, 'advancedFilters')}
            </button>
            <button type="button" onClick={() => setColumnsOpen((value) => !value)} className={toolbarBtn}>
              {tInvoiceWorkspace(locale, 'columns')}
            </button>
            <button
              type="button"
              onClick={() =>
                persistPrefs({
                  ...prefs,
                  density: prefs.density === 'compact' ? 'comfortable' : 'compact',
                })
              }
              className={toolbarBtn}
            >
              {prefs.density === 'compact'
                ? tInvoiceWorkspace(locale, 'densityComfortable')
                : tInvoiceWorkspace(locale, 'densityCompact')}
            </button>
            <button type="button" onClick={exportCsv} disabled={exporting} className={toolbarBtn}>
              {exporting ? tInvoiceWorkspace(locale, 'exporting') : tInvoiceWorkspace(locale, 'exportCsv')}
            </button>
            <button
              type="button"
              className={`${toolbarBtn} xl:hidden`}
              onClick={() => setFiltersOpen(true)}
            >
              {tInvoiceWorkspace(locale, 'filters')}
            </button>
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {INVOICE_WORKSPACE_VIEWS.map((view) => {
            const count = viewCounts?.[view] ?? 0
            const active = applied.view === view
            return (
              <button
                key={view}
                type="button"
                onClick={() => updateApplied({ view, page: 1 })}
                className={`inline-flex min-h-[36px] shrink-0 items-center gap-2 rounded-full border px-3 text-[11px] font-black uppercase tracking-wide ${
                  active
                    ? 'border-[var(--brand-primary-2)] bg-[var(--brand-primary-2)] text-white'
                    : 'border-neutral-200 bg-white text-neutral-600'
                }`}
              >
                {tInvoiceWorkspace(locale, VIEW_LABEL[view])}
                <span className={active ? 'text-white/80' : 'text-neutral-400'}>{count}</span>
              </button>
            )
          })}
        </div>

        {advancedOpen ? (
          <div className="hidden xl:block">
            <FilterGrid
              locale={locale}
              filters={filters}
              setFilters={setFilters}
              onApply={applyAdvanced}
              onClear={() => {
                setSearchDraft('')
                setFilters(INITIAL_FILTERS)
                setApplied(INITIAL_FILTERS)
              }}
            />
          </div>
        ) : null}

        {columnsOpen ? (
          <div className="rounded-xl border border-neutral-100 bg-neutral-50 p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">
                {tInvoiceWorkspace(locale, 'columns')}
              </p>
              <button
                type="button"
                onClick={() => persistPrefs(defaultInvoiceWorkspaceColumnPrefs())}
                className="text-[11px] font-bold uppercase text-[var(--brand-primary-2)]"
              >
                {tInvoiceWorkspace(locale, 'restoreDefault')}
              </button>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {INVOICE_WORKSPACE_COLUMNS.map((column) => {
                const locked = INVOICE_WORKSPACE_ALWAYS_VISIBLE.includes(column)
                const checked = locked || !prefs.hidden.includes(column)
                return (
                  <label key={column} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={locked}
                      onChange={(event) => {
                        const hidden = new Set(prefs.hidden)
                        if (event.target.checked) hidden.delete(column)
                        else hidden.add(column)
                        persistPrefs({ ...prefs, hidden: [...hidden] })
                      }}
                    />
                    {tInvoiceWorkspace(locale, COLUMN_LABEL[column])}
                  </label>
                )
              })}
            </div>
          </div>
        ) : null}
      </div>

      {filtersOpen ? (
        <div className="fixed inset-0 z-50 xl:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label={tInvoiceWorkspace(locale, 'closeFilters')}
            onClick={() => setFiltersOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[88dvh] overflow-y-auto rounded-t-3xl bg-white p-4 shadow-xl">
            <FilterGrid
              locale={locale}
              filters={filters}
              setFilters={setFilters}
              onApply={applyAdvanced}
              onClear={() => {
                setSearchDraft('')
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

      <div className="relative min-h-0 flex-1">
        {loading ? (
          <div className="rounded-2xl border border-neutral-200 bg-white p-8 text-center text-neutral-500">…</div>
        ) : rows.length === 0 ? (
          <div className="pscs-panel p-8 text-center text-[var(--brand-text-muted)]">
            {tInvoiceWorkspace(locale, 'empty')}
          </div>
        ) : (
          <>
            <InvoiceWorkspaceGrid
              locale={locale}
              rows={rows}
              prefs={prefs}
              sort={applied.sort as InvoiceWorkspaceSort}
              direction={applied.direction}
              selectedId={preview?.id ?? null}
              onPrefsChange={persistPrefs}
              onSort={(sort) =>
                updateApplied({
                  sort,
                  direction: applied.sort === sort && applied.direction === 'desc' ? 'asc' : 'desc',
                  page: 1,
                })
              }
              onPreview={setPreview}
            />

            <ul className="space-y-3 xl:hidden">
              {rows.map((invoice) => (
                <li key={invoice.id} className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-black">{invoice.invoice_number}</p>
                      <p className="text-[10px] font-bold uppercase text-neutral-500">
                        {invoice.invoice_kind === 'post_event_adjustment'
                          ? tInvoiceWorkspace(locale, 'kindAdjustment')
                          : tInvoiceWorkspace(locale, 'kindOriginal')}
                      </p>
                    </div>
                    <span className={`inline-flex rounded-full border px-2 py-1 text-[0.65rem] font-bold uppercase ${INVOICE_STATUS_BADGE[invoice.status] ?? ''}`}>
                      {invoiceStatusLabel(invoice.status, locale)}
                    </span>
                  </div>
                  <p className="mt-2 text-sm font-bold">{invoice.customer_name}</p>
                  <p className="text-xs text-neutral-500">{invoice.event_name || '—'}</p>
                  <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <dt className="text-[10px] font-bold uppercase text-neutral-500">{tInvoiceWorkspace(locale, 'colTotal')}</dt>
                      <dd className="font-black">{formatFinanceMoney(invoice.total, invoice.currency_code, locale)}</dd>
                    </div>
                    <div>
                      <dt className="text-[10px] font-bold uppercase text-neutral-500">{tInvoiceWorkspace(locale, 'colOutstanding')}</dt>
                      <dd className="font-black">{formatFinanceMoney(invoice.outstanding_amount, invoice.currency_code, locale)}</dd>
                    </div>
                    <div>
                      <dt className="text-[10px] font-bold uppercase text-neutral-500">{tInvoiceWorkspace(locale, 'colQuote')}</dt>
                      <dd>{invoice.quote_number || '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-[10px] font-bold uppercase text-neutral-500">{tInvoiceWorkspace(locale, 'colOs')}</dt>
                      <dd>{invoice.service_order_number || '—'}</dd>
                    </div>
                  </dl>
                  {invoice.divergence ? (
                    <p className="mt-2 text-[10px] font-black uppercase text-amber-800">
                      {tInvoiceWorkspace(locale, 'divergence')}
                    </p>
                  ) : null}
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

        {preview ? (
          <div className="fixed inset-0 z-40 hidden xl:block">
            <button
              type="button"
              className="absolute inset-0 bg-black/20"
              aria-label={tInvoiceWorkspace(locale, 'closePreview')}
              onClick={() => setPreview(null)}
            />
            <div className="absolute inset-y-0 right-0">
              <InvoiceWorkspacePreview invoice={preview} locale={locale} onClose={() => setPreview(null)} />
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="flex items-center gap-2 text-sm">
          <span className="text-neutral-500">{tInvoiceWorkspace(locale, 'pageSize')}</span>
          <select
            value={applied.pageSize}
            onChange={(event) => updateApplied({ page: 1, pageSize: Number(event.target.value) })}
            className="rounded-lg border border-neutral-200 bg-white px-2 py-1.5"
          >
            {FINANCE_PAGE_SIZES.map((size) => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
          <span className="text-xs text-neutral-500">
            {tInvoiceWorkspace(locale, 'resultsCount', { count: total })}
          </span>
        </label>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={applied.page <= 1}
            onClick={() => updateApplied({ page: applied.page - 1 })}
            className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-bold uppercase disabled:opacity-40"
          >
            {tInvoiceWorkspace(locale, 'previous')}
          </button>
          <span className="text-xs font-semibold text-neutral-600">
            {tInvoiceWorkspace(locale, 'pageOf', { page: applied.page, pages })}
          </span>
          <button
            type="button"
            disabled={applied.page >= pages}
            onClick={() => updateApplied({ page: applied.page + 1 })}
            className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-bold uppercase disabled:opacity-40"
          >
            {tInvoiceWorkspace(locale, 'next')}
          </button>
        </div>
      </div>
    </div>
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
          <Field label={tInvoiceWorkspace(locale, 'filterFrom')}>
            <input type="date" value={filters.from} onChange={(event) => patch({ from: event.target.value })} className={fieldClass} />
          </Field>
          <Field label={tInvoiceWorkspace(locale, 'filterTo')}>
            <input type="date" value={filters.to} onChange={(event) => patch({ to: event.target.value })} className={fieldClass} />
          </Field>
        </>
      ) : null}
      <Field label={tInvoiceWorkspace(locale, 'filterEventDate')}>
        <input type="date" value={filters.eventFrom} onChange={(event) => patch({ eventFrom: event.target.value })} className={fieldClass} />
      </Field>
      <Field label={tInvoiceWorkspace(locale, 'filterTo')}>
        <input type="date" value={filters.eventTo} onChange={(event) => patch({ eventTo: event.target.value })} className={fieldClass} />
      </Field>
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
                ? tInvoiceWorkspace(locale, 'kindAdjustment')
                : tInvoiceWorkspace(locale, 'kindOriginal')}
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
      <Field label={tInvoiceWorkspace(locale, 'filterMinTotal')}>
        <input type="number" value={filters.minTotal} onChange={(event) => patch({ minTotal: event.target.value })} className={fieldClass} />
      </Field>
      <Field label={tInvoiceWorkspace(locale, 'filterMaxTotal')}>
        <input type="number" value={filters.maxTotal} onChange={(event) => patch({ maxTotal: event.target.value })} className={fieldClass} />
      </Field>
      <Field label={tInvoiceWorkspace(locale, 'filterMinOutstanding')}>
        <input type="number" value={filters.minOutstanding} onChange={(event) => patch({ minOutstanding: event.target.value })} className={fieldClass} />
      </Field>
      <Field label={tInvoiceWorkspace(locale, 'filterMaxOutstanding')}>
        <input type="number" value={filters.maxOutstanding} onChange={(event) => patch({ maxOutstanding: event.target.value })} className={fieldClass} />
      </Field>
      <div className="flex items-end gap-2 md:col-span-2">
        <button type="button" onClick={onApply} className="min-h-[40px] rounded-xl bg-[var(--brand-primary-2,#1e3a5f)] px-4 text-xs font-bold uppercase text-white">
          {tInvoiceWorkspace(locale, 'applyFilters')}
        </button>
        <button type="button" onClick={onClear} className="min-h-[40px] rounded-xl border border-neutral-200 px-4 text-xs font-bold uppercase">
          {tInvoiceWorkspace(locale, 'clearFilters')}
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

const toolbarBtn =
  'inline-flex min-h-[40px] items-center rounded-xl border border-neutral-200 bg-white px-3 text-[11px] font-bold uppercase tracking-wide disabled:opacity-50'
