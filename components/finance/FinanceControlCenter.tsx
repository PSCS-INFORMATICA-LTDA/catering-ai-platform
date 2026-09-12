'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTenant } from '@/components/tenant/TenantProvider'
import { tFinanceControl } from '@/Lib/i18n/financeControl'
import { useAuthLocaleFromMe } from '@/Lib/i18n/useAuthLocaleFromMe'
import { resolveTenantCompanyDisplayName } from '@/Lib/tenant/companyDisplayName'
import type {
  FinanceActivityItem,
  FinanceAttentionItem,
  FinanceOverviewPayload,
  FinanceSearchResults,
} from '@/Lib/payments/financeControlCenterTypes'
import { formatFinanceDateTime, formatFinanceMoney } from '@/components/payments/financeUi'
import { FinanceEnvBadges, FinanceErrorState, FinanceSkeleton } from './FinanceChrome'

const ATTENTION_COPY: Record<string, Parameters<typeof tFinanceControl>[1]> = {
  payment_failed: 'alertPaymentFailed',
  completed_not_reflected: 'alertDivergence',
  paid_without_completed_payments: 'alertDivergence',
  completed_exceeds_invoice: 'alertReconciliation',
  currency_mismatch: 'alertReconciliation',
  duplicate_provider_capture_id: 'alertDuplicateCapture',
  duplicate_provider_order_id: 'alertDuplicateOrder',
  conflicting_idempotency_key: 'alertIdempotency',
  refund_pending: 'alertRefundPending',
  failed_pscs_one_outbox: 'alertOutboxFailed',
  stale_pending_outbox: 'alertOutboxStale',
  post_event_active_hold: 'alertPostEventHold',
}

const ACTIVITY_COPY: Record<FinanceActivityItem['kind'], Parameters<typeof tFinanceControl>[1]> = {
  invoice_created: 'activityInvoiceCreated',
  paypal_captured: 'activityPaypalCaptured',
  invoice_partially_paid: 'activityPartiallyPaid',
  invoice_paid: 'activityPaid',
  refund_requested: 'activityRefundRequested',
  refund_completed: 'activityRefundCompleted',
  supplemental_created: 'activitySupplemental',
  manual_reconciled: 'activityManual',
  outbox_published: 'activityOutbox',
}

export default function FinanceControlCenter() {
  const locale = useAuthLocaleFromMe()
  const { company } = useTenant()
  const tenantName = resolveTenantCompanyDisplayName(company)
  const [period, setPeriod] = useState('30d')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [overview, setOverview] = useState<FinanceOverviewPayload | null>(null)
  const [attention, setAttention] = useState<FinanceAttentionItem[] | null>(null)
  const [activity, setActivity] = useState<FinanceActivityItem[] | null>(null)
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<FinanceSearchResults | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const periodQuery = useMemo(() => {
    const params = new URLSearchParams({ period })
    if (period === 'custom') {
      if (from) params.set('from', from)
      if (to) params.set('to', to)
    }
    return params.toString()
  }, [from, period, to])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [overviewRes, attentionRes, activityRes] = await Promise.all([
        fetch(`/api/finance/overview?${periodQuery}`, { cache: 'no-store' }),
        fetch('/api/finance/attention', { cache: 'no-store' }),
        fetch('/api/finance/activity?pageSize=12', { cache: 'no-store' }),
      ])
      const overviewPayload = await overviewRes.json().catch(() => ({}))
      const attentionPayload = await attentionRes.json().catch(() => ({}))
      const activityPayload = await activityRes.json().catch(() => ({}))
      if (!overviewRes.ok) throw new Error(overviewPayload.error || tFinanceControl(locale, 'loadError'))
      if (!attentionRes.ok) throw new Error(attentionPayload.error || tFinanceControl(locale, 'loadError'))
      if (!activityRes.ok) throw new Error(activityPayload.error || tFinanceControl(locale, 'loadError'))
      setOverview(overviewPayload.data ?? null)
      setAttention(attentionPayload.data ?? [])
      setActivity(activityPayload.data ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : tFinanceControl(locale, 'loadError'))
    } finally {
      setLoading(false)
    }
  }, [locale, periodQuery])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const q = search.trim()
    if (q.length < 2) {
      setResults(null)
      return
    }
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      fetch(`/api/finance/search?q=${encodeURIComponent(q)}`, {
        cache: 'no-store',
        signal: controller.signal,
      })
        .then(async (response) => {
          const payload = await response.json().catch(() => ({}))
          if (!response.ok) return
          setResults(payload.data ?? null)
        })
        .catch(() => undefined)
    }, 220)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [search])

  const currency = overview?.currencies[0]
  const extraCurrencies = overview?.currencies.slice(1) ?? []
  const companyName = overview?.company_name || tenantName

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5" data-finance-home>
      <header className="liquid-glass-card space-y-4 p-5 sm:p-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-cdl-muted">
              {tFinanceControl(locale, 'homeName')}
            </p>
            <h1 className="mt-1 text-3xl font-black tracking-tight text-cdl-fg sm:text-4xl">
              {tFinanceControl(locale, 'homeTitle')}
            </h1>
            <p className="mt-2 max-w-xl text-sm text-cdl-muted">
              {tFinanceControl(locale, 'homeSubtitle')}
            </p>
          </div>
          <FinanceEnvBadges
            locale={locale}
            companyName={companyName}
            appEnvironment={overview?.app_environment}
            paypalSandbox={overview?.paypal_sandbox}
          />
        </div>
        {overview?.paypal_sandbox ? (
          <p className="text-xs font-semibold text-amber-800">{tFinanceControl(locale, 'sandboxNotReal')}</p>
        ) : null}
        <p className="text-xs text-cdl-muted">{tFinanceControl(locale, 'readOnly')}</p>
      </header>

      <section className="liquid-glass-card p-4 sm:p-5" aria-label={tFinanceControl(locale, 'searchInvoice')}>
        <label className="sr-only" htmlFor="finance-global-search">
          {tFinanceControl(locale, 'searchPlaceholder')}
        </label>
        <input
          id="finance-global-search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={tFinanceControl(locale, 'searchPlaceholder')}
          className="min-h-[48px] w-full rounded-2xl border border-cdl-border bg-cdl-bg px-4 text-sm text-cdl-fg outline-none ring-cdl-accent focus-visible:ring-2"
        />
        {search.trim().length > 0 && search.trim().length < 2 ? (
          <p className="mt-2 text-xs text-cdl-muted">{tFinanceControl(locale, 'searchHint')}</p>
        ) : null}
        {results ? <SearchResults locale={locale} results={results} /> : null}
      </section>

      <div className="flex flex-wrap items-end gap-2">
        {(['7d', '30d', '90d', 'custom'] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setPeriod(value)}
            className={`min-h-[40px] rounded-full border px-4 text-xs font-black uppercase tracking-wide ${
              period === value
                ? 'border-cdl-fg bg-cdl-fg text-cdl-bg'
                : 'border-cdl-border bg-cdl-surface text-cdl-fg'
            }`}
          >
            {tFinanceControl(
              locale,
              value === '7d'
                ? 'period7d'
                : value === '90d'
                  ? 'period90d'
                  : value === 'custom'
                    ? 'periodCustom'
                    : 'period30d',
            )}
          </button>
        ))}
        {period === 'custom' ? (
          <>
            <input
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
              className="min-h-[40px] rounded-xl border border-cdl-border bg-cdl-surface px-3 text-sm"
            />
            <input
              type="date"
              value={to}
              onChange={(event) => setTo(event.target.value)}
              className="min-h-[40px] rounded-xl border border-cdl-border bg-cdl-surface px-3 text-sm"
            />
          </>
        ) : null}
      </div>

      {error ? <FinanceErrorState locale={locale} message={error} onRetry={() => void load()} /> : null}
      {loading && !overview ? <FinanceSkeleton rows={8} /> : null}

      {overview && currency ? (
        <>
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCard label={tFinanceControl(locale, 'kpiBilled')} value={formatFinanceMoney(currency.billed_total, currency.currency_code, locale)} accent />
            <KpiCard label={tFinanceControl(locale, 'kpiReceived')} value={formatFinanceMoney(currency.received_total, currency.currency_code, locale)} />
            <KpiCard label={tFinanceControl(locale, 'kpiOutstanding')} value={formatFinanceMoney(currency.outstanding_total, currency.currency_code, locale)} />
            <KpiCard label={tFinanceControl(locale, 'kpiRefunded')} value={formatFinanceMoney(currency.refunded_total, currency.currency_code, locale)} />
          </section>
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCard label={tFinanceControl(locale, 'kpiInvoices')} value={String(currency.invoice_count)} compact />
            <KpiCard label={tFinanceControl(locale, 'kpiPartiallyPaid')} value={String(currency.partially_paid_count)} compact />
            <KpiCard label={tFinanceControl(locale, 'kpiPostEvent')} value={String(currency.post_event_count)} compact />
            <KpiCard label={tFinanceControl(locale, 'kpiFailedPayments')} value={String(currency.failed_payment_count)} compact warn={currency.failed_payment_count > 0} />
          </section>
          {extraCurrencies.length > 0 ? (
            <section className="liquid-glass-card space-y-3 p-4">
              <p className="text-xs font-bold text-cdl-muted">{tFinanceControl(locale, 'moreCurrencies')}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {extraCurrencies.map((row) => (
                  <div key={row.currency_code} className="rounded-2xl border border-cdl-border bg-cdl-bg/60 p-4">
                    <p className="text-[11px] font-black uppercase tracking-wider">{row.currency_code}</p>
                    <p className="mt-2 text-sm font-bold">
                      {formatFinanceMoney(row.billed_total, row.currency_code, locale)} · {formatFinanceMoney(row.received_total, row.currency_code, locale)}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <TrendCard locale={locale} overview={overview} />

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
            <AttentionCard locale={locale} items={attention ?? []} />
            <QuickActions locale={locale} />
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <HealthCard locale={locale} overview={overview} />
            <ProvidersCard locale={locale} overview={overview} />
          </div>

          <ActivityCard locale={locale} items={activity ?? []} />
        </>
      ) : null}
    </div>
  )
}

function KpiCard({
  label,
  value,
  accent = false,
  compact = false,
  warn = false,
}: {
  label: string
  value: string
  accent?: boolean
  compact?: boolean
  warn?: boolean
}) {
  return (
    <article
      className={`liquid-glass-card p-4 ${accent ? 'ring-1 ring-cdl-accent/70' : ''} ${warn ? 'ring-1 ring-red-400/50' : ''}`}
    >
      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-cdl-muted">{label}</p>
      <p className={`mt-2 font-black text-cdl-fg ${compact ? 'text-2xl' : 'text-xl sm:text-2xl'}`}>{value}</p>
    </article>
  )
}

function TrendCard({
  locale,
  overview,
}: {
  locale: string
  overview: FinanceOverviewPayload
}) {
  const series = overview.trend[0]
  const max = Math.max(
    1,
    ...(series?.points ?? []).flatMap((point) => [point.billed_total, point.received_total]),
  )
  return (
    <section className="liquid-glass-card p-5" aria-label={tFinanceControl(locale, 'trendTitle')}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-black uppercase tracking-[0.16em]">{tFinanceControl(locale, 'trendTitle')}</h2>
        <p className="text-xs text-cdl-muted">{series?.currency_code || 'USD'}</p>
      </div>
      <div className="mt-4 flex flex-wrap gap-4 text-xs font-bold">
        <span className="inline-flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-cdl-fg" /> {tFinanceControl(locale, 'trendBilled')}
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-cdl-accent" /> {tFinanceControl(locale, 'trendReceived')}
        </span>
      </div>
      {series && series.points.length > 0 ? (
        <svg viewBox="0 0 320 92" className="mt-4 h-28 w-full" role="img" aria-label={tFinanceControl(locale, 'trendTitle')}>
          {drawLine(series.points.map((point) => point.billed_total), max, '#111')}
          {drawLine(series.points.map((point) => point.received_total), max, '#f6d000')}
        </svg>
      ) : (
        <div className="mt-6 h-16 rounded-xl bg-cdl-bg/70" />
      )}
    </section>
  )
}

function drawLine(values: number[], max: number, color: string) {
  if (values.length === 0) return null
  const step = values.length === 1 ? 0 : 320 / (values.length - 1)
  const points = values
    .map((value, index) => `${index * step},${88 - (value / max) * 76}`)
    .join(' ')
  return <polyline fill="none" stroke={color} strokeWidth="2.4" points={points} strokeLinecap="round" strokeLinejoin="round" />
}

function AttentionCard({ locale, items }: { locale: string; items: FinanceAttentionItem[] }) {
  return (
    <section className="liquid-glass-card p-5" aria-label={tFinanceControl(locale, 'attentionTitle')}>
      <h2 className="text-sm font-black uppercase tracking-[0.16em]">{tFinanceControl(locale, 'attentionTitle')}</h2>
      {items.length === 0 ? (
        <p className="mt-4 rounded-2xl bg-emerald-500/10 p-4 text-sm font-bold text-emerald-800">
          {tFinanceControl(locale, 'attentionEmpty')}
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {items.slice(0, 8).map((item) => (
            <li key={item.id} className="rounded-2xl border border-cdl-border bg-cdl-bg/50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-black tracking-wider ${
                    item.severity === 'error'
                      ? 'bg-red-500/15 text-red-700'
                      : item.severity === 'warning'
                        ? 'bg-amber-400/20 text-amber-900'
                        : 'bg-sky-400/15 text-sky-800'
                  }`}
                >
                  {tFinanceControl(
                    locale,
                    item.severity === 'error'
                      ? 'severityError'
                      : item.severity === 'warning'
                        ? 'severityWarning'
                        : 'severityInfo',
                  )}
                </span>
                <Link href={item.href} className="text-xs font-black uppercase tracking-wider text-[var(--brand-primary-2)] hover:underline">
                  {tFinanceControl(locale, 'viewDetails')}
                </Link>
              </div>
              <p className="mt-2 text-sm font-bold">
                {tFinanceControl(locale, ATTENTION_COPY[item.code] || 'alertReconciliation')}
              </p>
              <p className="mt-1 text-xs text-cdl-muted">
                {[item.invoice_number, item.customer_name].filter(Boolean).join(' · ') || '—'}
                {item.amount != null
                  ? ` · ${formatFinanceMoney(item.amount, item.currency_code || 'USD', locale)}`
                  : ''}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function QuickActions({ locale }: { locale: string }) {
  const actions = [
    { href: '/invoices', key: 'actionInvoices' as const },
    { href: '/payments/paypal-control', key: 'actionPaypal' as const },
    { href: '/finance/reconciliation', key: 'actionReconciliation' as const },
    { href: '/finance/refunds', key: 'actionRefunds' as const },
    { href: '/finance/post-event', key: 'actionPostEvent' as const },
    { href: '/finance/pscs-one', key: 'actionPscsOne' as const },
  ]
  return (
    <section className="liquid-glass-card p-5" aria-label={tFinanceControl(locale, 'quickActions')}>
      <h2 className="text-sm font-black uppercase tracking-[0.16em]">{tFinanceControl(locale, 'quickActions')}</h2>
      <div className="mt-4 grid grid-cols-2 gap-3">
        {actions.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className="inline-flex min-h-[52px] items-center justify-center rounded-2xl border border-cdl-border bg-cdl-bg px-3 text-center text-xs font-black uppercase tracking-wider text-cdl-fg hover:border-cdl-accent"
          >
            {tFinanceControl(locale, action.key)}
          </Link>
        ))}
      </div>
    </section>
  )
}

function HealthCard({ locale, overview }: { locale: string; overview: FinanceOverviewPayload }) {
  const rate = overview.paypal.capture_success_rate
  return (
    <section className="liquid-glass-card space-y-4 p-5">
      <div>
        <h2 className="text-sm font-black uppercase tracking-[0.16em]">{tFinanceControl(locale, 'paypalHealthTitle')}</h2>
        <p className="mt-2 text-sm">
          {overview.paypal_sandbox ? tFinanceControl(locale, 'paypalSandbox') : overview.paypal.environment || '—'}
          {' · '}
          {overview.paypal.enabled ? tFinanceControl(locale, 'yes') : tFinanceControl(locale, 'no')}
        </p>
        {rate != null ? (
          <p className="mt-2 text-2xl font-black">
            {tFinanceControl(locale, 'captureSuccessRate')} {rate.toFixed(1)}%
          </p>
        ) : null}
      </div>
      <div>
        <h2 className="text-sm font-black uppercase tracking-[0.16em]">{tFinanceControl(locale, 'pscsHealthTitle')}</h2>
        <p className="mt-2 text-xs font-bold text-cdl-muted">{tFinanceControl(locale, 'pscsSource')}</p>
        <p className="text-xs font-bold text-cdl-muted">{tFinanceControl(locale, 'pscsDestination')}</p>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <MiniStat label={tFinanceControl(locale, 'pscsPending')} value={overview.pscs_one.pending} />
          <MiniStat label={tFinanceControl(locale, 'pscsPublished')} value={overview.pscs_one.published} />
          <MiniStat label={tFinanceControl(locale, 'pscsFailed')} value={overview.pscs_one.failed} warn={overview.pscs_one.failed > 0} />
        </div>
      </div>
    </section>
  )
}

function MiniStat({ label, value, warn = false }: { label: string; value: number; warn?: boolean }) {
  return (
    <div className={`rounded-xl p-3 ${warn ? 'bg-red-500/10' : 'bg-cdl-bg/70'}`}>
      <p className="text-[10px] font-black uppercase tracking-wider text-cdl-muted">{label}</p>
      <p className="mt-1 text-xl font-black">{value}</p>
    </div>
  )
}

function ProvidersCard({ locale, overview }: { locale: string; overview: FinanceOverviewPayload }) {
  return (
    <section className="liquid-glass-card p-5" aria-label={tFinanceControl(locale, 'providersTitle')}>
      <h2 className="text-sm font-black uppercase tracking-[0.16em]">{tFinanceControl(locale, 'providersTitle')}</h2>
      <ul className="mt-4 space-y-3">
        {overview.providers.map((provider) => (
          <li key={provider.provider} className="rounded-2xl border border-cdl-border bg-cdl-bg/50 p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="font-black">
                {tFinanceControl(
                  locale,
                  provider.provider === 'paypal'
                    ? 'providerPaypal'
                    : provider.provider === 'zelle'
                      ? 'providerZelle'
                      : 'providerBank',
                )}
              </p>
              <span className="text-[10px] font-black uppercase tracking-wider text-cdl-muted">
                {provider.enabled ? tFinanceControl(locale, 'providerEnabled') : tFinanceControl(locale, 'providerConfigured')}
              </span>
            </div>
            <p className="mt-2 text-sm">
              {tFinanceControl(locale, 'providerTransactions')} {provider.transactions} ·{' '}
              {formatFinanceMoney(provider.received_total, provider.currency_code, locale)}
            </p>
          </li>
        ))}
      </ul>
    </section>
  )
}

function ActivityCard({ locale, items }: { locale: string; items: FinanceActivityItem[] }) {
  return (
    <section className="liquid-glass-card p-5" aria-label={tFinanceControl(locale, 'recentActivity')}>
      <h2 className="text-sm font-black uppercase tracking-[0.16em]">{tFinanceControl(locale, 'recentActivity')}</h2>
      {items.length === 0 ? (
        <p className="mt-4 text-sm text-cdl-muted">{tFinanceControl(locale, 'activityEmpty')}</p>
      ) : (
        <ol className="mt-4 space-y-3">
          {items.map((item) => (
            <li key={item.id}>
              <Link href={item.href} className="block rounded-2xl border border-cdl-border bg-cdl-bg/50 p-4 hover:border-cdl-accent">
                <p className="text-sm font-bold">
                  {tFinanceControl(locale, ACTIVITY_COPY[item.kind], { number: item.invoice_number || '' })}
                </p>
                <p className="mt-1 text-xs text-cdl-muted">
                  {[item.invoice_number, item.customer_name, formatFinanceDateTime(item.occurred_at, locale)]
                    .filter(Boolean)
                    .join(' · ')}
                  {item.amount != null
                    ? ` · ${formatFinanceMoney(item.amount, item.currency_code || 'USD', locale)}`
                    : ''}
                </p>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

function SearchResults({ locale, results }: { locale: string; results: FinanceSearchResults }) {
  const groups = [
    { key: 'invoices' as const, title: 'searchGroupInvoices' as const },
    { key: 'payments' as const, title: 'searchGroupPayments' as const },
    { key: 'quotes' as const, title: 'searchGroupQuotes' as const },
    { key: 'service_orders' as const, title: 'searchGroupOrders' as const },
  ]
  const empty = groups.every((group) => results[group.key].length === 0)
  if (empty) {
    return <p className="mt-3 text-sm text-cdl-muted">{tFinanceControl(locale, 'searchEmpty')}</p>
  }
  return (
    <div className="mt-4 grid gap-4 md:grid-cols-2">
      {groups.map((group) =>
        results[group.key].length === 0 ? null : (
          <div key={group.key}>
            <p className="text-[11px] font-black uppercase tracking-wider text-cdl-muted">
              {tFinanceControl(locale, group.title)}
            </p>
            <ul className="mt-2 space-y-2">
              {results[group.key].map((hit) => (
                <li key={`${group.key}-${hit.id}`}>
                  <Link href={hit.href} className="block rounded-xl bg-cdl-bg px-3 py-2 text-sm font-bold hover:underline">
                    {hit.label}
                    {hit.secondary ? <span className="ml-2 font-normal text-cdl-muted">{hit.secondary}</span> : null}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ),
      )}
    </div>
  )
}
