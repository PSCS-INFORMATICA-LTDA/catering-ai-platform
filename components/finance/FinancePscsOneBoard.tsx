'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { tFinanceControl } from '@/Lib/i18n/financeControl'
import { useAuthLocaleFromMe } from '@/Lib/i18n/useAuthLocaleFromMe'
import type { FinanceOutboxListRow } from '@/Lib/payments/financeControlCenterTypes'
import { formatFinanceDateTime } from '@/components/payments/financeUi'
import { FinanceBackLink, FinanceBreadcrumb, FinanceErrorState } from './FinanceChrome'

export default function FinancePscsOneBoard() {
  const locale = useAuthLocaleFromMe()
  const [rows, setRows] = useState<FinanceOutboxListRow[] | null>(null)
  const [counts, setCounts] = useState({ pending: 0, published: 0, failed: 0 })
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/finance/pscs-one', { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) {
          setError(payload.error || tFinanceControl(locale, 'loadError'))
          setRows([])
          return
        }
        setError(null)
        setRows(payload.data ?? [])
        setCounts(payload.counts ?? { pending: 0, published: 0, failed: 0 })
      })
      .catch((err) => {
        if (controller.signal.aborted) return
        setError(err instanceof Error ? err.message : tFinanceControl(locale, 'loadError'))
        setRows([])
      })
    return () => controller.abort()
  }, [locale])

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5" data-finance-pscs-one>
      <FinanceBreadcrumb locale={locale} current={tFinanceControl(locale, 'pscsOne')} />
      <FinanceBackLink locale={locale} />
      <header className="liquid-glass-card space-y-2 p-5">
        <h1 className="text-2xl font-black tracking-tight sm:text-3xl">{tFinanceControl(locale, 'pscsTitle')}</h1>
        <p className="text-sm text-cdl-muted">{tFinanceControl(locale, 'pscsSubtitle')}</p>
        <p className="text-xs font-black uppercase tracking-wider">{tFinanceControl(locale, 'pscsSource')}</p>
        <p className="text-xs font-black uppercase tracking-wider">{tFinanceControl(locale, 'pscsDestination')}</p>
      </header>
      <section className="grid grid-cols-3 gap-3">
        <Stat label={tFinanceControl(locale, 'pscsPending')} value={counts.pending} />
        <Stat label={tFinanceControl(locale, 'pscsPublished')} value={counts.published} />
        <Stat label={tFinanceControl(locale, 'pscsFailed')} value={counts.failed} warn={counts.failed > 0} />
      </section>
      {error ? <FinanceErrorState locale={locale} message={error} /> : null}
      {rows === null ? <div className="h-40 animate-pulse rounded-2xl bg-cdl-surface" /> : null}
      {rows && rows.length === 0 ? (
        <div className="liquid-glass-card p-8 text-center text-sm text-cdl-muted">{tFinanceControl(locale, 'pscsEmpty')}</div>
      ) : null}
      {rows && rows.length > 0 ? (
        <>
          <div className="hidden overflow-hidden rounded-2xl border border-cdl-border xl:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-cdl-surface text-[11px] font-black uppercase tracking-wider text-cdl-muted">
                <tr>
                  <th className="px-4 py-3">{tFinanceControl(locale, 'colEvent')}</th>
                  <th className="px-4 py-3">{tFinanceControl(locale, 'colInvoice')}</th>
                  <th className="px-4 py-3">{tFinanceControl(locale, 'colPayment')}</th>
                  <th className="px-4 py-3">{tFinanceControl(locale, 'colAggregate')}</th>
                  <th className="px-4 py-3">{tFinanceControl(locale, 'colStatus')}</th>
                  <th className="px-4 py-3">{tFinanceControl(locale, 'colAttempts')}</th>
                  <th className="px-4 py-3">{tFinanceControl(locale, 'colCreated')}</th>
                  <th className="px-4 py-3">{tFinanceControl(locale, 'colPublished')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t border-cdl-border">
                    <td className="px-4 py-3 font-bold">{row.event_type}</td>
                    <td className="px-4 py-3">
                      {row.invoice_id ? (
                        <Link href={`/invoices/${row.invoice_id}`} className="hover:underline">{row.invoice_number || row.invoice_id}</Link>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{row.payment_id || '—'}</td>
                    <td className="px-4 py-3">{row.aggregate_type}</td>
                    <td className="px-4 py-3">{row.status}</td>
                    <td className="px-4 py-3">{row.attempts}</td>
                    <td className="px-4 py-3">{formatFinanceDateTime(row.created_at, locale)}</td>
                    <td className="px-4 py-3">{formatFinanceDateTime(row.published_at, locale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="space-y-3 xl:hidden">
            {rows.map((row) => (
              <li key={row.id} className="liquid-glass-card p-4">
                <p className="font-black">{row.event_type}</p>
                <p className="mt-1 text-sm">{row.status} · {row.attempts}</p>
                {row.invoice_id ? (
                  <Link href={`/invoices/${row.invoice_id}`} className="mt-2 inline-block text-sm font-bold hover:underline">
                    {row.invoice_number || row.invoice_id}
                  </Link>
                ) : null}
                {row.last_error ? <p className="mt-2 text-xs text-red-600">{row.last_error}</p> : null}
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  )
}

function Stat({ label, value, warn = false }: { label: string; value: number; warn?: boolean }) {
  return (
    <div className={`liquid-glass-card p-4 ${warn ? 'ring-1 ring-red-400/40' : ''}`}>
      <p className="text-[10px] font-black uppercase tracking-wider text-cdl-muted">{label}</p>
      <p className="mt-1 text-2xl font-black">{value}</p>
    </div>
  )
}
