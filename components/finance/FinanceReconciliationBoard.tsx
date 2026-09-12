'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { tFinanceControl } from '@/Lib/i18n/financeControl'
import { useAuthLocaleFromMe } from '@/Lib/i18n/useAuthLocaleFromMe'
import type { FinanceReconciliationRow } from '@/Lib/payments/financeControlCenterTypes'
import { formatFinanceMoney } from '@/components/payments/financeUi'
import { FinanceBackLink, FinanceBreadcrumb, FinanceErrorState } from './FinanceChrome'

export default function FinanceReconciliationBoard() {
  const locale = useAuthLocaleFromMe()
  const [rows, setRows] = useState<FinanceReconciliationRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/finance/ledger-reconciliation', { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) {
          setError(payload.error || tFinanceControl(locale, 'loadError'))
          setRows([])
          return
        }
        setError(null)
        setRows(payload.data ?? [])
      })
      .catch((err) => {
        if (controller.signal.aborted) return
        setError(err instanceof Error ? err.message : tFinanceControl(locale, 'loadError'))
        setRows([])
      })
    return () => controller.abort()
  }, [locale])

  const groups = {
    error: rows?.filter((row) => row.group === 'error') ?? [],
    warning: rows?.filter((row) => row.group === 'warning') ?? [],
    ok: rows?.filter((row) => row.group === 'ok') ?? [],
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5" data-finance-reconciliation>
      <FinanceBreadcrumb locale={locale} current={tFinanceControl(locale, 'reconciliation')} />
      <FinanceBackLink locale={locale} />
      <header className="liquid-glass-card p-5">
        <h1 className="text-2xl font-black tracking-tight sm:text-3xl">{tFinanceControl(locale, 'reconciliationTitle')}</h1>
        <p className="mt-2 text-sm text-cdl-muted">{tFinanceControl(locale, 'reconciliationSubtitle')}</p>
      </header>
      {error ? <FinanceErrorState locale={locale} message={error} /> : null}
      {rows === null ? <div className="h-40 animate-pulse rounded-2xl bg-cdl-surface" /> : null}
      {rows && groups.error.length === 0 && groups.warning.length === 0 ? (
        <div className="liquid-glass-card p-8 text-center text-sm font-bold text-emerald-800">
          {tFinanceControl(locale, 'reconciliationEmpty')}
        </div>
      ) : null}
      {rows ? (
        <>
          <Group title={tFinanceControl(locale, 'reconciliationErrors')} rows={groups.error} locale={locale} tone="error" />
          <Group title={tFinanceControl(locale, 'reconciliationWarnings')} rows={groups.warning} locale={locale} tone="warning" />
          <Group title={tFinanceControl(locale, 'reconciliationOk')} rows={groups.ok} locale={locale} tone="ok" />
        </>
      ) : null}
    </div>
  )
}

function Group({
  title,
  rows,
  locale,
  tone,
}: {
  title: string
  rows: FinanceReconciliationRow[]
  locale: string
  tone: 'ok' | 'warning' | 'error'
}) {
  if (rows.length === 0) return null
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-black uppercase tracking-[0.16em]">{title}</h2>
      <ul className="space-y-3">
        {rows.map((row) => (
          <li
            key={row.invoice_id}
            className={`liquid-glass-card p-4 ${
              tone === 'error' ? 'ring-1 ring-red-400/40' : tone === 'warning' ? 'ring-1 ring-amber-400/40' : ''
            }`}
          >
            <Link href={`/invoices/${row.invoice_id}`} className="font-black hover:underline">
              {row.invoice_number}
            </Link>
            <p className="mt-1 text-sm text-cdl-muted">{row.customer_name || '—'}</p>
            <p className="mt-3 text-sm">
              {tFinanceControl(locale, 'invoiceReceived')}: {formatFinanceMoney(row.invoice_received, row.currency_code, locale)}
            </p>
            <p className="text-sm">
              {tFinanceControl(locale, 'completedPayments')}: {formatFinanceMoney(row.completed_payments, row.currency_code, locale)}
            </p>
            <p className="mt-2 text-xs font-black uppercase tracking-wider">
              {tFinanceControl(locale, 'colStatus')}: {row.group === 'ok' ? tFinanceControl(locale, 'reconciliationOk') : `${tFinanceControl(locale, 'divergence')}: ${formatFinanceMoney(Math.abs(row.delta), row.currency_code, locale)}`}
            </p>
          </li>
        ))}
      </ul>
    </section>
  )
}
