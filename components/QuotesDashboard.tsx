'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import DeleteQuoteButton from '@/components/DeleteQuoteButton'
import {
  getQuoteListPackageName,
  type QuoteListItem,
} from '@/Lib/fetchQuoteList'
import { glassBtn } from '@/Lib/liquidGlass'
import { useAuthLocaleFromMe } from '@/Lib/i18n/useAuthLocaleFromMe'
import { formatUiDate } from '@/Lib/i18n/locales'
import {
  quoteStatusLabel,
  tQuotesOrders,
} from '@/Lib/i18n/quotesOrders'

type StatusFilter = 'all' | string
type AcceptanceFilter = 'all' | 'pending' | 'accepted' | 'rejected'
type HasOrderFilter = 'all' | 'yes' | 'no'

type QuotesFilters = {
  q: string
  status: StatusFilter
  acceptance: AcceptanceFilter
  hasOrder: HasOrderFilter
}

const EMPTY_FILTERS: QuotesFilters = {
  q: '',
  status: 'all',
  acceptance: 'all',
  hasOrder: 'all',
}

function formatMoney(value: number | null | undefined) {
  if (value == null) return '—'
  return `$${Number(value).toFixed(2)}`
}

function formatDate(
  value: string | null | undefined,
  locale: string | null | undefined,
) {
  return formatUiDate(value, locale)
}

function acceptanceLabel(
  value: string | null | undefined,
  locale: Parameters<typeof tQuotesOrders>[0],
) {
  if (value === 'accepted') return tQuotesOrders(locale, 'acceptanceAccepted')
  if (value === 'rejected') return tQuotesOrders(locale, 'acceptanceRejected')
  return tQuotesOrders(locale, 'acceptancePending')
}

function acceptanceClassName(value: string | null | undefined) {
  if (value === 'accepted') {
    return 'border-cdl-success-border bg-cdl-success-soft text-cdl-success'
  }
  if (value === 'rejected') {
    return 'border-red-300/40 bg-red-500/10 text-red-500'
  }
  return 'border-cdl-border bg-cdl-inset text-cdl-text-secondary'
}

function quoteStatusClassName(status: string | null | undefined) {
  const key = (status ?? '').trim().toLowerCase()
  if (key === 'accepted' || key === 'approved' || key === 'converted') {
    return 'border-cdl-success-border bg-cdl-success-soft text-cdl-success'
  }
  if (key === 'sent' || key === 'viewed' || key === 'ready_for_review') {
    return 'border-cdl-accent-border bg-cdl-accent/15 text-cdl-brand'
  }
  if (key === 'rejected' || key === 'cancelled' || key === 'canceled') {
    return 'border-red-300/40 bg-red-500/10 text-red-500'
  }
  return 'border-cdl-border bg-cdl-inset text-cdl-text-secondary'
}

function Pill({
  className,
  children,
}: {
  className: string
  children: ReactNode
}) {
  return (
    <span
      className={`inline-flex max-w-full items-center truncate rounded-full border px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-wider ${className}`}
    >
      {children}
    </span>
  )
}

function buildQuery(filters: QuotesFilters) {
  const params = new URLSearchParams({ _: String(Date.now()) })
  if (filters.q.trim()) params.set('q', filters.q.trim())
  if (filters.status !== 'all') params.set('status', filters.status)
  if (filters.acceptance !== 'all') params.set('has_acceptance', filters.acceptance)
  if (filters.hasOrder !== 'all') params.set('has_order', filters.hasOrder)
  params.set('pageSize', '200')
  return params
}

async function fetchQuotesFromApi(
  filters: QuotesFilters,
  locale: Parameters<typeof tQuotesOrders>[0],
): Promise<QuoteListItem[]> {
  const params = buildQuery(filters)
  const response = await fetch(`/api/quotes?${params.toString()}`, {
    cache: 'no-store',
    headers: { 'Cache-Control': 'no-cache' },
  })
  const result = (await response.json()) as {
    data?: QuoteListItem[]
    error?: string
  }

  if (!response.ok) {
    throw new Error(result.error ?? tQuotesOrders(locale, 'fetchQuotesError'))
  }

  return result.data ?? []
}

function isConvertEligible(quote: QuoteListItem) {
  return quote.proposal_response === 'accepted' && !quote.converted_service_order_id
}

export default function QuotesDashboard({
  initialQuotes,
  canConvert = false,
}: {
  initialQuotes: QuoteListItem[]
  canConvert?: boolean
}) {
  const router = useRouter()
  const locale = useAuthLocaleFromMe()
  const [quotes, setQuotes] = useState<QuoteListItem[]>(initialQuotes)
  const [filters, setFilters] = useState<QuotesFilters>(EMPTY_FILTERS)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [convertingId, setConvertingId] = useState<string | null>(null)
  const [convertHint, setConvertHint] = useState<string | null>(null)

  const availableStatuses = useMemo(() => {
    const set = new Set<string>()
    for (const quote of initialQuotes) {
      if (quote.quote_status) set.add(quote.quote_status)
    }
    return Array.from(set).sort()
  }, [initialQuotes])

  const refreshQuotes = useCallback(
    async (nextFilters: QuotesFilters) => {
      setLoading(true)
      setError(null)
      try {
        const next = await fetchQuotesFromApi(nextFilters, locale)
        setQuotes(next)
      } catch (refreshError) {
        setError(
          refreshError instanceof Error
            ? refreshError.message
            : tQuotesOrders(locale, 'fetchQuotesError'),
        )
      } finally {
        setLoading(false)
      }
    },
    [locale],
  )

  useEffect(() => {
    const timeout = setTimeout(() => {
      void refreshQuotes(filters)
    }, 250)
    return () => clearTimeout(timeout)
  }, [filters, refreshQuotes])

  function handleQuoteDeleted(quoteId: string) {
    setQuotes((current) => current.filter((quote) => quote.id !== quoteId))
  }

  async function handleConvert(quote: QuoteListItem) {
    if (!isConvertEligible(quote)) return
    if (!window.confirm(tQuotesOrders(locale, 'convertConfirm'))) {
      return
    }
    setConvertingId(quote.id)
    setConvertHint(null)
    setError(null)
    try {
      const response = await fetch(`/api/quotes/${quote.id}/convert`, {
        method: 'POST',
      })
      const result = (await response.json()) as {
        data?: { id: string; service_order_number: string }
        error?: string
      }
      if (!response.ok) {
        throw new Error(result.error ?? tQuotesOrders(locale, 'fetchQuotesError'))
      }
      setConvertHint(
        `${tQuotesOrders(locale, 'orderNumber')} ${result.data?.service_order_number ?? ''} — ${tQuotesOrders(locale, 'convertSuccess')}`,
      )
      await refreshQuotes(filters)
      if (result.data?.id) {
        router.push(`/orders/${result.data.id}`)
      }
    } catch (convertError) {
      setError(
        convertError instanceof Error
          ? convertError.message
          : tQuotesOrders(locale, 'fetchQuotesError'),
      )
    } finally {
      setConvertingId(null)
    }
  }

  function renderActions(quote: QuoteListItem) {
    const eligible = isConvertEligible(quote)
    const actionBtn =
      'liquid-glass-btn liquid-glass-btn--secondary !min-h-[28px] !px-2 !py-1 !text-[10px] !font-bold uppercase tracking-wide'
    return (
      <div className="flex flex-wrap items-center justify-center gap-1">
        <Link href={`/quotes/${quote.id}`} className={actionBtn}>
          {tQuotesOrders(locale, 'view')}
        </Link>
        <Link
          href={`/quotes/${quote.id}/edit?step=churrasqueira`}
          className={actionBtn}
        >
          {tQuotesOrders(locale, 'edit')}
        </Link>
        <Link href={`/quotes/${quote.id}?pdf=1`} className={actionBtn}>
          {tQuotesOrders(locale, 'pdf')}
        </Link>
        {canConvert && quote.converted_service_order_id ? (
          <span className="inline-flex min-h-[28px] items-center justify-center rounded-lg border border-cdl-success-border bg-cdl-success-soft px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-cdl-success">
            {tQuotesOrders(locale, 'converted')}
          </span>
        ) : canConvert && eligible ? (
          <button
            type="button"
            onClick={() => void handleConvert(quote)}
            disabled={convertingId === quote.id}
            className={`${glassBtn('primary')} !min-h-[28px] whitespace-nowrap !px-2 !py-1 !text-[10px]`}
          >
            {convertingId === quote.id
              ? tQuotesOrders(locale, 'converting')
              : tQuotesOrders(locale, 'convert')}
          </button>
        ) : null}
        <DeleteQuoteButton
          quoteId={quote.id}
          compact
          redirectToList={false}
          onDeleted={handleQuoteDeleted}
        />
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-[var(--brand-primary)] sm:text-3xl">
            {tQuotesOrders(locale, 'quotesTitle')}
          </h1>
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--brand-primary-2)]/80">
            {quotes.length} {tQuotesOrders(locale, 'quotesCountLabel')}
          </p>
        </div>
        <Link
          href="/quotes/new"
          className={glassBtn('primary', 'inline-flex min-h-[44px] items-center justify-center rounded-xl px-5 py-3 text-sm font-bold')}
        >
          {tQuotesOrders(locale, 'newQuote')}
        </Link>
      </div>

      <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">
              {tQuotesOrders(locale, 'search')}
            </span>
            <input
              type="search"
              value={filters.q}
              onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
              placeholder={tQuotesOrders(locale, 'searchQuotesPlaceholder')}
              className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-900 outline-none focus:border-red-300 focus:bg-white focus:ring-2 focus:ring-red-100"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">
              {tQuotesOrders(locale, 'filterStatus')}
            </span>
            <select
              value={filters.status}
              onChange={(e) =>
                setFilters((f) => ({ ...f, status: e.target.value as StatusFilter }))
              }
              className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-900 outline-none focus:border-red-300 focus:bg-white focus:ring-2 focus:ring-red-100"
            >
              <option value="all">{tQuotesOrders(locale, 'allStatuses')}</option>
              {availableStatuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">
              {tQuotesOrders(locale, 'filterAcceptance')}
            </span>
            <select
              value={filters.acceptance}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  acceptance: e.target.value as AcceptanceFilter,
                }))
              }
              className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-900 outline-none focus:border-red-300 focus:bg-white focus:ring-2 focus:ring-red-100"
            >
              <option value="all">{tQuotesOrders(locale, 'allAcceptance')}</option>
              <option value="pending">{tQuotesOrders(locale, 'acceptancePending')}</option>
              <option value="accepted">{tQuotesOrders(locale, 'acceptanceAccepted')}</option>
              <option value="rejected">{tQuotesOrders(locale, 'acceptanceRejected')}</option>
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">
              {tQuotesOrders(locale, 'filterHasOrder')}
            </span>
            <select
              value={filters.hasOrder}
              onChange={(e) =>
                setFilters((f) => ({ ...f, hasOrder: e.target.value as HasOrderFilter }))
              }
              className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-900 outline-none focus:border-red-300 focus:bg-white focus:ring-2 focus:ring-red-100"
            >
              <option value="all">{tQuotesOrders(locale, 'hasOrderAny')}</option>
              <option value="yes">{tQuotesOrders(locale, 'hasOrderYes')}</option>
              <option value="no">{tQuotesOrders(locale, 'hasOrderNo')}</option>
            </select>
          </label>
        </div>
        {filters !== EMPTY_FILTERS ? (
          <button
            type="button"
            onClick={() => setFilters(EMPTY_FILTERS)}
            className="mt-3 text-xs font-bold uppercase tracking-wider text-[var(--brand-primary-2)] hover:underline"
          >
            {tQuotesOrders(locale, 'clearFilters')}
          </button>
        ) : null}
        {error ? <p className="mt-3 text-sm text-cdl-action">{error}</p> : null}
        {convertHint ? (
          <p className="mt-3 text-sm text-emerald-700">{convertHint}</p>
        ) : null}
      </div>

      {quotes.length === 0 ? (
        <div className="pscs-panel p-8 text-center text-[var(--brand-text-muted)]">
          {loading
            ? tQuotesOrders(locale, 'loadingQuotes')
            : tQuotesOrders(locale, 'noQuotesFiltered')}
        </div>
      ) : (
        <>
          {/* Mobile: stacked cards keep the same field order */}
          <ul className="space-y-3 lg:hidden">
            {quotes.map((quote) => (
              <li
                key={quote.id}
                className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-wide text-neutral-500">
                      {quote.quote_number}
                    </p>
                    <p className="truncate text-sm font-bold text-neutral-900">
                      {quote.customer_name}
                    </p>
                    <p className="mt-1 text-xs text-neutral-500">
                      {formatDate(quote.event_date, locale)}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-black text-neutral-900">
                    {formatMoney(quote.quote_total)}
                  </p>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Pill className={quoteStatusClassName(quote.quote_status)}>
                    {quoteStatusLabel(quote.quote_status, locale)}
                  </Pill>
                  <Pill className={acceptanceClassName(quote.proposal_response)}>
                    {acceptanceLabel(quote.proposal_response, locale)}
                  </Pill>
                </div>
                <div className="mt-3 border-t border-neutral-100 pt-3">
                  {renderActions(quote)}
                </div>
              </li>
            ))}
          </ul>

          {/* Desktop: real table so every value stays under its header */}
          <div className="hidden max-h-[min(70vh,52rem)] overflow-auto rounded-2xl border border-neutral-200 bg-white shadow-sm lg:block">
            <table className="w-full min-w-[960px] table-fixed border-collapse text-center">
              <colgroup>
                <col className="w-[11%]" />
                <col className="w-[20%]" />
                <col className="w-[11%]" />
                <col className="w-[11%]" />
                <col className="w-[10%]" />
                <col className="w-[9%]" />
                <col className="w-[28%]" />
              </colgroup>
              <thead className="sticky top-0 z-20">
                <tr className="border-b border-neutral-100 bg-neutral-50 text-[11px] font-bold uppercase tracking-wider text-neutral-500">
                  <th className="px-2 py-2.5 text-center font-bold">
                    {tQuotesOrders(locale, 'tableNumber')}
                  </th>
                  <th className="px-2 py-2.5 text-center font-bold">
                    {tQuotesOrders(locale, 'tableCustomerEvent')}
                  </th>
                  <th className="px-2 py-2.5 text-center font-bold">
                    {tQuotesOrders(locale, 'tableDate')}
                  </th>
                  <th className="px-2 py-2.5 text-center font-bold">
                    {tQuotesOrders(locale, 'status')}
                  </th>
                  <th className="px-2 py-2.5 text-center font-bold">
                    {tQuotesOrders(locale, 'filterAcceptance')}
                  </th>
                  <th className="px-2 py-2.5 text-center font-bold">
                    {tQuotesOrders(locale, 'total')}
                  </th>
                  <th className="px-2 py-2.5 text-center font-bold">
                    {tQuotesOrders(locale, 'actions')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {quotes.map((quote) => (
                  <tr
                    key={quote.id}
                    className="border-b border-neutral-100 last:border-b-0"
                  >
                    <td className="align-middle px-2 py-2.5 text-[11px] font-bold uppercase tracking-wide text-neutral-500">
                      <span className="block truncate">{quote.quote_number}</span>
                    </td>
                    <td className="align-middle px-2 py-2.5">
                      <p className="truncate text-xs font-bold text-neutral-900">
                        {quote.customer_name}
                      </p>
                      <p className="truncate text-[11px] text-neutral-500">
                        {[quote.city, quote.state].filter(Boolean).join(', ') ||
                          '—'}
                        {getQuoteListPackageName(quote, locale)
                          ? ` · ${getQuoteListPackageName(quote, locale)}`
                          : ''}
                      </p>
                    </td>
                    <td className="align-middle whitespace-nowrap px-2 py-2.5 text-xs text-neutral-700">
                      {formatDate(quote.event_date, locale)}
                    </td>
                    <td className="align-middle px-2 py-2.5">
                      <div className="flex justify-center">
                        <Pill className={quoteStatusClassName(quote.quote_status)}>
                          {quoteStatusLabel(quote.quote_status, locale)}
                        </Pill>
                      </div>
                    </td>
                    <td className="align-middle px-2 py-2.5">
                      <div className="flex justify-center">
                        <Pill
                          className={acceptanceClassName(quote.proposal_response)}
                        >
                          {acceptanceLabel(quote.proposal_response, locale)}
                        </Pill>
                      </div>
                    </td>
                    <td className="align-middle whitespace-nowrap px-2 py-2.5 text-xs font-black text-neutral-900">
                      {formatMoney(quote.quote_total)}
                    </td>
                    <td className="align-middle px-2 py-2.5">
                      {renderActions(quote)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
