'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { tFinanceObservability } from '@/Lib/i18n/financeObservability'
import {
  invoiceStatusLabel,
  paymentPurposeLabel,
  paymentStatusLabel,
} from '@/Lib/i18n/payments'
import { useAuthLocaleFromMe } from '@/Lib/i18n/useAuthLocaleFromMe'
import type {
  FinanceOutboxRow,
  ObservabilityAlert,
  PaypalControlKpis,
  PaypalProviderHealth,
  PaypalTransactionRow,
  ScheduleHoldObservability,
} from '@/Lib/payments/financeObservabilityTypes'
import { FINANCE_PAGE_SIZES } from '@/Lib/payments/financeObservabilityTypes'
import { PAYMENT_ATTEMPT_STATUSES, PAYMENT_PURPOSES } from '@/Lib/payments/types'
import FinanceCopyId from './FinanceCopyId'
import { formatFinanceDateTime, formatFinanceMoney } from './financeUi'

type Tab = 'overview' | 'transactions' | 'idempotency' | 'reconciliation' | 'holds' | 'outbox'

const ALERT_LABEL: Record<string, 'alertDuplicateOrder' | 'alertDuplicateCapture' | 'alertConflictingIdempotency' | 'alertDuplicateCompleted' | 'alertCompletedNotReflected' | 'alertPaidWithoutPayments' | 'alertCurrencyMismatch' | 'alertOverpayment' | 'alertCaptureWithoutInvoice' | 'alertSupplementalWithoutParent' | 'alertPostEventHold'> = {
  duplicate_provider_order_id: 'alertDuplicateOrder',
  duplicate_provider_capture_id: 'alertDuplicateCapture',
  conflicting_idempotency_key: 'alertConflictingIdempotency',
  duplicate_completed_payment: 'alertDuplicateCompleted',
  completed_not_reflected: 'alertCompletedNotReflected',
  paid_without_completed_payments: 'alertPaidWithoutPayments',
  currency_mismatch: 'alertCurrencyMismatch',
  completed_exceeds_invoice: 'alertOverpayment',
  capture_without_invoice: 'alertCaptureWithoutInvoice',
  supplemental_missing_parent: 'alertSupplementalWithoutParent',
  post_event_active_hold: 'alertPostEventHold',
}

export default function PaypalControlCenter() {
  const locale = useAuthLocaleFromMe()
  const [tab, setTab] = useState<Tab>('overview')
  const [period, setPeriod] = useState('today')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [status, setStatus] = useState('all')
  const [purpose, setPurpose] = useState('all')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [failClosed, setFailClosed] = useState(false)
  const [environment, setEnvironment] = useState('sandbox')
  const [health, setHealth] = useState<PaypalProviderHealth | null>(null)
  const [kpis, setKpis] = useState<PaypalControlKpis | null>(null)
  const [transactions, setTransactions] = useState<PaypalTransactionRow[]>([])
  const [total, setTotal] = useState(0)
  const [alerts, setAlerts] = useState<{ idempotency: ObservabilityAlert[]; reconciliation: ObservabilityAlert[]; holds: ScheduleHoldObservability[] }>({
    idempotency: [],
    reconciliation: [],
    holds: [],
  })
  const [outbox, setOutbox] = useState<FinanceOutboxRow[]>([])
  const [selected, setSelected] = useState<PaypalTransactionRow | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const periodQuery = `period=${period}${period === 'custom' ? `&from=${from}&to=${to}` : ''}`

  const loadOverview = useCallback(async () => {
    const response = await fetch(`/api/finance/paypal/overview?${periodQuery}`, { cache: 'no-store' })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(payload.error || 'overview_failed')
    setFailClosed(Boolean(payload.data?.failClosed))
    setEnvironment(String(payload.data?.environment || 'sandbox'))
    setHealth(payload.data?.health ?? null)
    setKpis(payload.data?.kpis ?? null)
  }, [periodQuery])

  const loadTransactions = useCallback(async () => {
    const params = new URLSearchParams({
      period,
      status,
      purpose,
      q,
      page: String(page),
      pageSize: String(pageSize),
    })
    if (period === 'custom') {
      if (from) params.set('from', from)
      if (to) params.set('to', to)
    }
    const response = await fetch(`/api/finance/paypal/transactions?${params}`, { cache: 'no-store' })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(payload.error || 'transactions_failed')
    setFailClosed(Boolean(payload.failClosed))
    setTransactions(payload.data ?? [])
    setTotal(Number(payload.total || 0))
  }, [from, page, pageSize, period, purpose, q, status, to])

  const loadMonitors = useCallback(async () => {
    const [recon, box] = await Promise.all([
      fetch('/api/finance/paypal/reconciliation', { cache: 'no-store' }),
      fetch('/api/finance/paypal/outbox', { cache: 'no-store' }),
    ])
    const reconPayload = await recon.json().catch(() => ({}))
    const boxPayload = await box.json().catch(() => ({}))
    if (!recon.ok) throw new Error(reconPayload.error || 'reconciliation_failed')
    if (!box.ok) throw new Error(boxPayload.error || 'outbox_failed')
    setFailClosed(Boolean(reconPayload.data?.failClosed))
    setAlerts({
      idempotency: reconPayload.data?.idempotency ?? [],
      reconciliation: reconPayload.data?.reconciliation ?? [],
      holds: reconPayload.data?.holds ?? [],
    })
    setOutbox(boxPayload.data ?? [])
  }, [])

  useEffect(() => {
    let cancelled = false
    async function run() {
      try {
        await loadOverview()
        if (cancelled) return
        if (tab === 'transactions') await loadTransactions()
        if (cancelled) return
        if (tab !== 'overview' && tab !== 'transactions') await loadMonitors()
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : tFinanceObservability(locale, 'loadError'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [loadMonitors, loadOverview, loadTransactions, locale, tab])

  const pages = Math.max(1, Math.ceil(total / pageSize))
  const tabs: Tab[] = ['overview', 'transactions', 'idempotency', 'reconciliation', 'holds', 'outbox']

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-black tracking-tight text-[var(--brand-primary)] sm:text-3xl">
            {tFinanceObservability(locale, 'paypalControlTitle')}
          </h1>
          <span className="rounded-full border-2 border-amber-400 bg-amber-100 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-amber-950">
            {tFinanceObservability(locale, 'paypalSandboxBadge')}
          </span>
        </div>
        <p className="text-sm text-neutral-500">{tFinanceObservability(locale, 'paypalControlSubtitle')}</p>
        <p className="text-xs font-semibold text-neutral-500">{tFinanceObservability(locale, 'readOnlyNotice')}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setTab(item)}
            className={`min-h-[40px] rounded-full border px-3 text-xs font-bold uppercase tracking-wide ${
              tab === item
                ? 'border-[var(--brand-primary-2)] bg-[var(--brand-primary-2)] text-white'
                : 'border-neutral-200 bg-white text-neutral-700'
            }`}
          >
            {tFinanceObservability(
              locale,
              item === 'overview'
                ? 'tabOverview'
                : item === 'transactions'
                  ? 'tabTransactions'
                  : item === 'idempotency'
                    ? 'tabIdempotency'
                    : item === 'reconciliation'
                      ? 'tabReconciliation'
                      : item === 'holds'
                        ? 'tabHolds'
                        : 'tabOutbox',
            )}
          </button>
        ))}
      </div>

      <PeriodBar
        locale={locale}
        period={period}
        from={from}
        to={to}
        onPeriod={setPeriod}
        onFrom={setFrom}
        onTo={setTo}
      />

      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}

      {failClosed ? (
        <div className="rounded-2xl border border-red-300 bg-red-50 p-5">
          <h2 className="text-lg font-black text-red-800">{tFinanceObservability(locale, 'failClosedTitle')}</h2>
          <p className="mt-2 text-sm text-red-700">{tFinanceObservability(locale, 'failClosedCopy')}</p>
          <p className="mt-2 text-xs font-bold uppercase text-red-800">{environment}</p>
        </div>
      ) : null}

      {loading ? <div className="rounded-2xl border border-neutral-200 bg-white p-8 text-center text-neutral-500">…</div> : null}

      {!failClosed && !loading && tab === 'overview' && health ? (
        <Overview health={health} kpis={kpis} locale={locale} />
      ) : null}

      {!failClosed && !loading && tab === 'transactions' ? (
        <Transactions
          locale={locale}
          rows={transactions}
          status={status}
          purpose={purpose}
          q={q}
          page={page}
          pages={pages}
          pageSize={pageSize}
          onStatus={setStatus}
          onPurpose={setPurpose}
          onQuery={setQ}
          onPage={setPage}
          onPageSize={(value) => {
            setPage(1)
            setPageSize(value)
          }}
          onSelect={setSelected}
        />
      ) : null}

      {!failClosed && !loading && tab === 'idempotency' ? (
        <AlertList locale={locale} alerts={alerts.idempotency} />
      ) : null}
      {!failClosed && !loading && tab === 'reconciliation' ? (
        <AlertList locale={locale} alerts={alerts.reconciliation} />
      ) : null}
      {!failClosed && !loading && tab === 'holds' ? (
        <Holds locale={locale} rows={alerts.holds} />
      ) : null}
      {!failClosed && !loading && tab === 'outbox' ? (
        <Outbox locale={locale} rows={outbox} />
      ) : null}

      {selected ? (
        <TransactionDrawer row={selected} locale={locale} onClose={() => setSelected(null)} />
      ) : null}
    </div>
  )
}

function PeriodBar({
  locale,
  period,
  from,
  to,
  onPeriod,
  onFrom,
  onTo,
}: {
  locale: string
  period: string
  from: string
  to: string
  onPeriod: (value: string) => void
  onFrom: (value: string) => void
  onTo: (value: string) => void
}) {
  return (
    <div className="flex flex-wrap items-end gap-2">
      {['today', '7d', '30d', 'custom'].map((value) => (
        <button
          key={value}
          type="button"
          onClick={() => onPeriod(value)}
          className={`min-h-[36px] rounded-full border px-3 text-xs font-bold uppercase ${
            period === value ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-200 bg-white'
          }`}
        >
          {tFinanceObservability(
            locale,
            value === 'today' ? 'periodToday' : value === '7d' ? 'period7d' : value === '30d' ? 'period30d' : 'periodCustom',
          )}
        </button>
      ))}
      {period === 'custom' ? (
        <>
          <input type="date" value={from} onChange={(event) => onFrom(event.target.value)} className="rounded-xl border border-neutral-200 px-3 py-2 text-sm" />
          <input type="date" value={to} onChange={(event) => onTo(event.target.value)} className="rounded-xl border border-neutral-200 px-3 py-2 text-sm" />
        </>
      ) : null}
    </div>
  )
}

function Overview({
  health,
  kpis,
  locale,
}: {
  health: PaypalProviderHealth
  kpis: PaypalControlKpis | null
  locale: string
}) {
  const currency = kpis?.currency_code || 'USD'
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <HealthCard label={tFinanceObservability(locale, 'healthEnabled')} value={health.enabled ? tFinanceObservability(locale, 'yes') : tFinanceObservability(locale, 'no')} />
        <HealthCard label={tFinanceObservability(locale, 'healthEnvironment')} value={health.environment} />
        <HealthCard label={tFinanceObservability(locale, 'healthConnection')} value={health.connection_status} />
        <HealthCard
          label={tFinanceObservability(locale, 'healthCredentials')}
          value={health.credentials_configured ? tFinanceObservability(locale, 'configured') : tFinanceObservability(locale, 'missing')}
        />
        <HealthCard
          label={tFinanceObservability(locale, 'healthWebhook')}
          value={health.webhook_configured ? tFinanceObservability(locale, 'configured') : tFinanceObservability(locale, 'missing')}
        />
        <HealthCard
          label={tFinanceObservability(locale, 'healthLastValidation')}
          value={formatFinanceDateTime(health.last_tested_at, locale)}
        />
      </div>
      {kpis ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <Kpi label={tFinanceObservability(locale, 'kpiPaymentsPeriod')} value={String(kpis.payments_in_period)} />
          <Kpi label={tFinanceObservability(locale, 'kpiCapturedPeriod')} value={String(kpis.captured_in_period)} />
          <Kpi label={tFinanceObservability(locale, 'kpiFailedPeriod')} value={String(kpis.failed_in_period)} />
          <Kpi label={tFinanceObservability(locale, 'kpiPendingCreated')} value={String(kpis.pending_created)} />
          <Kpi label={tFinanceObservability(locale, 'kpiTotalCaptured')} value={formatFinanceMoney(kpis.total_captured, currency, locale)} />
          <Kpi label={tFinanceObservability(locale, 'kpiTotalRefunded')} value={formatFinanceMoney(kpis.total_refunded, currency, locale)} />
        </div>
      ) : null}
    </div>
  )
}

function Transactions({
  locale,
  rows,
  status,
  purpose,
  q,
  page,
  pages,
  pageSize,
  onStatus,
  onPurpose,
  onQuery,
  onPage,
  onPageSize,
  onSelect,
}: {
  locale: string
  rows: PaypalTransactionRow[]
  status: string
  purpose: string
  q: string
  page: number
  pages: number
  pageSize: number
  onStatus: (value: string) => void
  onPurpose: (value: string) => void
  onQuery: (value: string) => void
  onPage: (value: number) => void
  onPageSize: (value: number) => void
  onSelect: (row: PaypalTransactionRow) => void
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <input
          value={q}
          onChange={(event) => onQuery(event.target.value)}
          placeholder={tFinanceObservability(locale, 'searchPaypalPlaceholder')}
          className="rounded-xl border border-neutral-200 px-3 py-2.5 text-sm"
        />
        <select value={status} onChange={(event) => onStatus(event.target.value)} className="rounded-xl border border-neutral-200 px-3 py-2.5 text-sm">
          <option value="all">{tFinanceObservability(locale, 'periodAll')}</option>
          {PAYMENT_ATTEMPT_STATUSES.map((item) => (
            <option key={item} value={item}>{paymentStatusLabel(item, locale)}</option>
          ))}
        </select>
        <select value={purpose} onChange={(event) => onPurpose(event.target.value)} className="rounded-xl border border-neutral-200 px-3 py-2.5 text-sm">
          <option value="all">{tFinanceObservability(locale, 'periodAll')}</option>
          {PAYMENT_PURPOSES.map((item) => (
            <option key={item} value={item}>{paymentPurposeLabel(item, locale)}</option>
          ))}
        </select>
      </div>
      {rows.length === 0 ? (
        <div className="rounded-2xl border border-neutral-200 bg-white p-8 text-center text-neutral-500">
          {tFinanceObservability(locale, 'noTransactions')}
        </div>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-2xl border border-neutral-200 bg-white xl:block">
            <div className="grid grid-cols-[8rem_7rem_minmax(0,1fr)_6rem_6rem_7rem_9rem_9rem] gap-3 bg-neutral-50 px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-neutral-500">
              <span>{tFinanceObservability(locale, 'colTimestamp')}</span>
              <span>{tFinanceObservability(locale, 'colInvoice')}</span>
              <span>{tFinanceObservability(locale, 'colCustomer')}</span>
              <span>{tFinanceObservability(locale, 'purpose')}</span>
              <span>{tFinanceObservability(locale, 'amount')}</span>
              <span>{tFinanceObservability(locale, 'colStatus')}</span>
              <span>{tFinanceObservability(locale, 'colPaypalOrder')}</span>
              <span>{tFinanceObservability(locale, 'colPaypalCapture')}</span>
            </div>
            <ul>
              {rows.map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(row)}
                    className="grid w-full grid-cols-[8rem_7rem_minmax(0,1fr)_6rem_6rem_7rem_9rem_9rem] gap-3 px-4 py-3 text-left text-sm hover:bg-neutral-50"
                  >
                    <span>{formatFinanceDateTime(row.created_at, locale)}</span>
                    <span className="font-bold">{row.invoice_number || '—'}</span>
                    <span className="truncate">{row.customer_name || '—'}</span>
                    <span>{paymentPurposeLabel(row.purpose, locale)}</span>
                    <span className="font-bold">{formatFinanceMoney(row.amount, row.currency_code, locale)}</span>
                    <span>{paymentStatusLabel(row.status, locale)}</span>
                    <span className="truncate font-mono text-xs">{row.provider_order_id || '—'}</span>
                    <span className="truncate font-mono text-xs">{row.provider_capture_id || '—'}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <ul className="space-y-3 xl:hidden">
            {rows.map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  onClick={() => onSelect(row)}
                  className="w-full rounded-2xl border border-neutral-200 bg-white p-4 text-left shadow-sm"
                >
                  <p className="font-black">{row.invoice_number || row.id}</p>
                  <p className="text-sm text-neutral-600">{row.customer_name || '—'}</p>
                  <p className="mt-2 text-sm font-bold">{formatFinanceMoney(row.amount, row.currency_code, locale)} · {paymentStatusLabel(row.status, locale)}</p>
                  <p className="text-xs text-neutral-500">{formatFinanceDateTime(row.created_at, locale)}</p>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <select value={pageSize} onChange={(event) => onPageSize(Number(event.target.value))} className="rounded-lg border border-neutral-200 px-2 py-1.5 text-sm">
          {FINANCE_PAGE_SIZES.map((size) => (
            <option key={size} value={size}>{size}</option>
          ))}
        </select>
        <div className="flex gap-2">
          <button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)} className="rounded-lg border px-3 py-1.5 text-xs font-bold uppercase disabled:opacity-40">
            {tFinanceObservability(locale, 'previous')}
          </button>
          <button type="button" disabled={page >= pages} onClick={() => onPage(page + 1)} className="rounded-lg border px-3 py-1.5 text-xs font-bold uppercase disabled:opacity-40">
            {tFinanceObservability(locale, 'next')}
          </button>
        </div>
      </div>
    </div>
  )
}

function AlertList({ locale, alerts }: { locale: string; alerts: ObservabilityAlert[] }) {
  if (alerts.length === 0) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm font-bold text-emerald-800">
        {tFinanceObservability(locale, 'monitorOk')} · {tFinanceObservability(locale, 'noAlerts')}
      </div>
    )
  }
  return (
    <ul className="space-y-3">
      {alerts.map((alert, index) => (
        <li key={`${alert.code}-${alert.value || ''}-${index}`} className={`rounded-2xl border p-4 ${alert.severity === 'error' ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50'}`}>
          <p className="text-[10px] font-black uppercase tracking-wider">
            {tFinanceObservability(locale, alert.severity === 'error' ? 'monitorError' : 'monitorWarning')}
          </p>
          <p className="mt-1 font-bold">
            {tFinanceObservability(locale, ALERT_LABEL[alert.code] || 'monitorWarning')}
          </p>
          {alert.invoice_id ? (
            <Link href={`/invoices/${alert.invoice_id}`} className="mt-2 inline-block text-sm font-bold text-[var(--brand-primary-2)] hover:underline">
              {alert.invoice_number || alert.invoice_id}
            </Link>
          ) : null}
          <p className="mt-1 font-mono text-xs text-neutral-600">{alert.payment_ids.join(', ')}</p>
        </li>
      ))}
    </ul>
  )
}

function Holds({ locale, rows }: { locale: string; rows: ScheduleHoldObservability[] }) {
  if (rows.length === 0) {
    return <div className="rounded-2xl border border-neutral-200 bg-white p-8 text-center text-neutral-500">{tFinanceObservability(locale, 'noHolds')}</div>
  }
  return (
    <ul className="space-y-3">
      {rows.map((hold) => (
        <li key={hold.id} className={`rounded-2xl border p-4 ${hold.severity === 'error' ? 'border-red-300 bg-red-50' : 'border-neutral-200 bg-white'}`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Link href={`/invoices/${hold.invoice_id}`} className="font-black hover:underline">
              {hold.invoice_number || hold.invoice_id}
            </Link>
            <span className="rounded-full border px-2 py-0.5 text-[10px] font-black uppercase">
              {tFinanceObservability(
                locale,
                hold.status === 'consumed'
                  ? 'holdConsumed'
                  : hold.status === 'released'
                    ? 'holdReleased'
                    : hold.status === 'expired'
                      ? 'holdExpired'
                      : 'holdHeld',
              )}
            </span>
          </div>
          <p className="mt-2 text-sm">{hold.event_date} · {hold.start_time}–{hold.end_time}</p>
          <p className="text-xs text-neutral-500">{tFinanceObservability(locale, 'holdExpires')}: {formatFinanceDateTime(hold.expires_at, locale)}</p>
          {hold.release_reason ? <p className="text-xs text-neutral-500">{tFinanceObservability(locale, 'holdReleaseReason')}: {hold.release_reason}</p> : null}
          {hold.severity === 'error' ? (
            <p className="mt-2 text-sm font-bold text-red-700">{tFinanceObservability(locale, 'holdPostEventError')}</p>
          ) : null}
        </li>
      ))}
    </ul>
  )
}

function Outbox({ locale, rows }: { locale: string; rows: FinanceOutboxRow[] }) {
  if (rows.length === 0) {
    return <div className="rounded-2xl border border-neutral-200 bg-white p-8 text-center text-neutral-500">{tFinanceObservability(locale, 'noOutboxEvents')}</div>
  }
  return (
    <ul className="space-y-3">
      {rows.map((row) => (
        <li key={row.id} className={`rounded-2xl border p-4 ${row.highlights.length ? 'border-amber-200 bg-amber-50' : 'border-neutral-200 bg-white'}`}>
          <p className="font-black">{row.event_type}</p>
          <p className="text-sm">{row.status} · {row.destination} · {tFinanceObservability(locale, 'outboxAttempts')} {row.attempts}</p>
          {row.invoice_id ? (
            <Link href={`/invoices/${row.invoice_id}`} className="text-sm font-bold text-[var(--brand-primary-2)] hover:underline">
              {row.invoice_number || row.invoice_id}
            </Link>
          ) : null}
          <p className="text-xs text-neutral-500">{formatFinanceDateTime(row.created_at, locale)}</p>
          {row.last_error ? <p className="text-xs text-red-600">{row.last_error}</p> : null}
        </li>
      ))}
    </ul>
  )
}

function TransactionDrawer({
  row,
  locale,
  onClose,
}: {
  row: PaypalTransactionRow
  locale: string
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50">
      <button type="button" className="absolute inset-0 bg-black/40" aria-label={tFinanceObservability(locale, 'closeDrawer')} onClick={onClose} />
      <aside className="absolute inset-y-0 right-0 flex w-full max-w-lg flex-col overflow-y-auto bg-white p-5 shadow-2xl">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-black">{tFinanceObservability(locale, 'drawerTitle')}</h2>
          <button type="button" onClick={onClose} className="rounded-lg border px-3 py-1.5 text-xs font-bold uppercase">
            {tFinanceObservability(locale, 'closeDrawer')}
          </button>
        </div>
        <dl className="mt-5 space-y-3 text-sm">
          <Row label={tFinanceObservability(locale, 'internalPaymentId')} value={<FinanceCopyId value={row.id} />} />
          <Row
            label={tFinanceObservability(locale, 'colInvoice')}
            value={<Link href={`/invoices/${row.invoice_id}`} className="font-bold text-[var(--brand-primary-2)] hover:underline">{row.invoice_number || row.invoice_id}</Link>}
          />
          <Row label={tFinanceObservability(locale, 'colQuote')} value={row.quote_number || '—'} />
          <Row label={tFinanceObservability(locale, 'serviceOrder')} value={row.service_order_number || '—'} />
          <Row label={tFinanceObservability(locale, 'purpose')} value={paymentPurposeLabel(row.purpose, locale)} />
          <Row label={tFinanceObservability(locale, 'amount')} value={formatFinanceMoney(row.amount, row.currency_code, locale)} />
          <Row label={tFinanceObservability(locale, 'colStatus')} value={`${paymentStatusLabel(row.status, locale)} · ${row.invoice_status ? invoiceStatusLabel(row.invoice_status, locale) : '—'}`} />
          <Row label={tFinanceObservability(locale, 'colPaypalOrder')} value={<FinanceCopyId value={row.provider_order_id} />} />
          <Row label={tFinanceObservability(locale, 'colPaypalCapture')} value={<FinanceCopyId value={row.provider_capture_id} />} />
          <Row label={tFinanceObservability(locale, 'createdAt')} value={formatFinanceDateTime(row.created_at, locale)} />
          <Row label={tFinanceObservability(locale, 'approvedCaptured')} value={formatFinanceDateTime(row.captured_at, locale)} />
          <Row label={tFinanceObservability(locale, 'idempotencySummary')} value={row.idempotency_summary || '—'} />
          <Row
            label={tFinanceObservability(locale, 'sanitizedMetadata')}
            value={<pre className="overflow-x-auto rounded-lg bg-neutral-50 p-2 text-[11px]">{JSON.stringify(row.metadata, null, 2)}</pre>}
          />
        </dl>
      </aside>
    </div>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">{label}</dt>
      <dd className="mt-1">{value}</dd>
    </div>
  )
}

function HealthCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
      <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">{label}</p>
      <p className="mt-1 text-lg font-black">{value}</p>
    </div>
  )
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
      <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">{label}</p>
      <p className="mt-1 text-xl font-black">{value}</p>
    </div>
  )
}
