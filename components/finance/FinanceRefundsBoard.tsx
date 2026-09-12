'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { tFinanceControl } from '@/Lib/i18n/financeControl'
import { useAuthLocaleFromMe } from '@/Lib/i18n/useAuthLocaleFromMe'
import type { FinanceRefundRow } from '@/Lib/payments/financeControlCenterTypes'
import { PAYMENT_PROVIDERS } from '@/Lib/payments/types'
import { formatFinanceDateTime, formatFinanceMoney } from '@/components/payments/financeUi'
import { FinanceBackLink, FinanceBreadcrumb, FinanceErrorState } from './FinanceChrome'

const STATUSES = ['all', 'requested', 'processing', 'completed', 'failed', 'canceled'] as const

export default function FinanceRefundsBoard() {
  const locale = useAuthLocaleFromMe()
  const [status, setStatus] = useState('all')
  const [provider, setProvider] = useState('all')
  const [invoice, setInvoice] = useState('')
  const [customer, setCustomer] = useState('')
  const [page, setPage] = useState(1)
  const [rows, setRows] = useState<FinanceRefundRow[] | null>(null)
  const [total, setTotal] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [filtersOpen, setFiltersOpen] = useState(false)

  const query = useMemo(() => {
    const params = new URLSearchParams({ status, provider, page: String(page), pageSize: '25' })
    if (invoice) params.set('invoice', invoice)
    if (customer) params.set('customer', customer)
    return params.toString()
  }, [customer, invoice, page, provider, status])

  useEffect(() => {
    const controller = new AbortController()
    fetch(`/api/finance/refunds?${query}`, { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) {
          setError(payload.error || tFinanceControl(locale, 'loadError'))
          setRows([])
          return
        }
        setError(null)
        setRows(payload.data ?? [])
        setTotal(Number(payload.total || 0))
      })
      .catch((err) => {
        if (controller.signal.aborted) return
        setError(err instanceof Error ? err.message : tFinanceControl(locale, 'loadError'))
        setRows([])
      })
    return () => controller.abort()
  }, [locale, query])

  const pages = Math.max(1, Math.ceil(total / 25))

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5" data-finance-refunds>
      <FinanceBreadcrumb locale={locale} current={tFinanceControl(locale, 'refunds')} />
      <FinanceBackLink locale={locale} />
      <header className="liquid-glass-card p-5">
        <h1 className="text-2xl font-black tracking-tight sm:text-3xl">{tFinanceControl(locale, 'refundsTitle')}</h1>
        <p className="mt-2 text-sm text-cdl-muted">{tFinanceControl(locale, 'refundsSubtitle')}</p>
      </header>
      <button
        type="button"
        className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-cdl-border bg-cdl-surface px-4 text-xs font-black uppercase lg:hidden"
        onClick={() => setFiltersOpen(true)}
      >
        {tFinanceControl(locale, 'filters')}
      </button>
      <div className="hidden grid-cols-2 gap-3 lg:grid lg:grid-cols-4">
        <FilterFields
          locale={locale}
          status={status}
          provider={provider}
          invoice={invoice}
          customer={customer}
          onStatus={setStatus}
          onProvider={setProvider}
          onInvoice={setInvoice}
          onCustomer={setCustomer}
          onPage={setPage}
        />
      </div>
      {filtersOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" className="absolute inset-0 bg-black/40" aria-label={tFinanceControl(locale, 'clear')} onClick={() => setFiltersOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 space-y-3 rounded-t-3xl bg-cdl-bg p-5">
            <FilterFields
              locale={locale}
              status={status}
              provider={provider}
              invoice={invoice}
              customer={customer}
              onStatus={setStatus}
              onProvider={setProvider}
              onInvoice={setInvoice}
              onCustomer={setCustomer}
              onPage={setPage}
            />
            <button type="button" className="min-h-[44px] w-full rounded-xl bg-cdl-fg text-xs font-black uppercase text-cdl-bg" onClick={() => setFiltersOpen(false)}>
              {tFinanceControl(locale, 'apply')}
            </button>
          </div>
        </div>
      ) : null}
      {error ? <FinanceErrorState locale={locale} message={error} /> : null}
      {rows === null ? <div className="h-40 animate-pulse rounded-2xl bg-cdl-surface" /> : null}
      {rows && rows.length === 0 ? (
        <div className="liquid-glass-card p-8 text-center text-sm font-bold text-emerald-800">
          {tFinanceControl(locale, 'refundEmpty')}
        </div>
      ) : null}
      {rows && rows.length > 0 ? (
        <>
          <div className="hidden overflow-hidden rounded-2xl border border-cdl-border xl:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-cdl-surface text-[11px] font-black uppercase tracking-wider text-cdl-muted">
                <tr>
                  <th className="px-4 py-3">{tFinanceControl(locale, 'colInvoice')}</th>
                  <th className="px-4 py-3">{tFinanceControl(locale, 'colCustomer')}</th>
                  <th className="px-4 py-3">{tFinanceControl(locale, 'colProvider')}</th>
                  <th className="px-4 py-3">{tFinanceControl(locale, 'colAmount')}</th>
                  <th className="px-4 py-3">{tFinanceControl(locale, 'colStatus')}</th>
                  <th className="px-4 py-3">{tFinanceControl(locale, 'colReason')}</th>
                  <th className="px-4 py-3">{tFinanceControl(locale, 'colRequestedAt')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t border-cdl-border">
                    <td className="px-4 py-3 font-bold">
                      <Link href={`/invoices/${row.invoice_id}`} className="hover:underline">{row.invoice_number || row.invoice_id}</Link>
                    </td>
                    <td className="px-4 py-3">{row.customer_name || '—'}</td>
                    <td className="px-4 py-3">{row.provider || '—'}</td>
                    <td className="px-4 py-3 font-bold">{formatFinanceMoney(row.amount, row.currency_code, locale)}</td>
                    <td className="px-4 py-3"><RefundBadge locale={locale} status={row.status} /></td>
                    <td className="px-4 py-3">{row.reason || '—'}</td>
                    <td className="px-4 py-3">{formatFinanceDateTime(row.requested_at, locale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="space-y-3 xl:hidden">
            {rows.map((row) => (
              <li key={row.id} className="liquid-glass-card p-4">
                <Link href={`/invoices/${row.invoice_id}`} className="font-black hover:underline">
                  {row.invoice_number || row.invoice_id}
                </Link>
                <p className="mt-1 text-sm text-cdl-muted">{row.customer_name || '—'}</p>
                <p className="mt-2 text-sm font-bold">{formatFinanceMoney(row.amount, row.currency_code, locale)}</p>
                <div className="mt-2"><RefundBadge locale={locale} status={row.status} /></div>
                <p className="mt-2 text-xs text-cdl-muted">{row.reason || '—'}</p>
                <p className="text-xs text-cdl-muted">{formatFinanceDateTime(row.requested_at, locale)}</p>
              </li>
            ))}
          </ul>
          <div className="flex justify-between">
            <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)} className="min-h-[40px] rounded-xl border px-3 text-xs font-black uppercase disabled:opacity-40">
              {tFinanceControl(locale, 'previous')}
            </button>
            <button type="button" disabled={page >= pages} onClick={() => setPage(page + 1)} className="min-h-[40px] rounded-xl border px-3 text-xs font-black uppercase disabled:opacity-40">
              {tFinanceControl(locale, 'next')}
            </button>
          </div>
        </>
      ) : null}
    </div>
  )
}

function RefundBadge({ locale, status }: { locale: string; status: FinanceRefundRow['status'] }) {
  const key =
    status === 'requested'
      ? 'refundStatusRequested'
      : status === 'processing'
        ? 'refundStatusProcessing'
        : status === 'completed'
          ? 'refundStatusCompleted'
          : status === 'failed'
            ? 'refundStatusFailed'
            : 'refundStatusCanceled'
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-black uppercase ${
      status === 'completed'
        ? 'border-emerald-300 text-emerald-800'
        : status === 'failed'
          ? 'border-red-300 text-red-700'
          : 'border-amber-300 text-amber-900'
    }`}>
      {tFinanceControl(locale, key)}
    </span>
  )
}

function FilterFields({
  locale,
  status,
  provider,
  invoice,
  customer,
  onStatus,
  onProvider,
  onInvoice,
  onCustomer,
  onPage,
}: {
  locale: string
  status: string
  provider: string
  invoice: string
  customer: string
  onStatus: (value: string) => void
  onProvider: (value: string) => void
  onInvoice: (value: string) => void
  onCustomer: (value: string) => void
  onPage: (value: number) => void
}) {
  return (
    <>
      <select value={status} onChange={(event) => { onStatus(event.target.value); onPage(1) }} className="min-h-[44px] rounded-xl border border-cdl-border bg-cdl-surface px-3 text-sm">
        {STATUSES.map((item) => (
          <option key={item} value={item}>{item}</option>
        ))}
      </select>
      <select value={provider} onChange={(event) => { onProvider(event.target.value); onPage(1) }} className="min-h-[44px] rounded-xl border border-cdl-border bg-cdl-surface px-3 text-sm">
        <option value="all">all</option>
        {PAYMENT_PROVIDERS.map((item) => (
          <option key={item} value={item}>{item}</option>
        ))}
      </select>
      <input value={invoice} onChange={(event) => { onInvoice(event.target.value); onPage(1) }} placeholder={tFinanceControl(locale, 'colInvoice')} className="min-h-[44px] rounded-xl border border-cdl-border bg-cdl-surface px-3 text-sm" />
      <input value={customer} onChange={(event) => { onCustomer(event.target.value); onPage(1) }} placeholder={tFinanceControl(locale, 'colCustomer')} className="min-h-[44px] rounded-xl border border-cdl-border bg-cdl-surface px-3 text-sm" />
    </>
  )
}
