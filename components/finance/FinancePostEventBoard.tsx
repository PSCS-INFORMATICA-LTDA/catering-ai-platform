'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { tFinanceControl } from '@/Lib/i18n/financeControl'
import { useAuthLocaleFromMe } from '@/Lib/i18n/useAuthLocaleFromMe'
import type { FinancePostEventRow } from '@/Lib/payments/financeControlCenterTypes'
import { formatFinanceMoney } from '@/components/payments/financeUi'
import { FinanceBackLink, FinanceBreadcrumb, FinanceErrorState } from './FinanceChrome'

export default function FinancePostEventBoard() {
  const locale = useAuthLocaleFromMe()
  const [rows, setRows] = useState<FinancePostEventRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/finance/post-event', { cache: 'no-store', signal: controller.signal })
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

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5" data-finance-post-event>
      <FinanceBreadcrumb locale={locale} current={tFinanceControl(locale, 'postEvent')} />
      <FinanceBackLink locale={locale} />
      <header className="liquid-glass-card p-5">
        <h1 className="text-2xl font-black tracking-tight sm:text-3xl">{tFinanceControl(locale, 'postEventTitle')}</h1>
        <p className="mt-2 text-sm text-cdl-muted">{tFinanceControl(locale, 'postEventSubtitle')}</p>
      </header>
      {error ? <FinanceErrorState locale={locale} message={error} /> : null}
      {rows === null ? <div className="h-40 animate-pulse rounded-2xl bg-cdl-surface" /> : null}
      {rows && rows.length === 0 ? (
        <div className="liquid-glass-card p-8 text-center text-sm text-cdl-muted">{tFinanceControl(locale, 'postEventEmpty')}</div>
      ) : null}
      {rows && rows.length > 0 ? (
        <ul className="space-y-4">
          {rows.map((row) => (
            <li key={row.id} className="liquid-glass-card space-y-3 p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-black">{row.customer_name || '—'}</p>
                <span className="text-[10px] font-black uppercase tracking-wider text-cdl-muted">{row.status}</span>
              </div>
              <p className="text-sm text-cdl-muted">
                {row.service_order_number || row.service_order_id} · {row.event_name || '—'}
              </p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Meta label={tFinanceControl(locale, 'contractedGuests')} value={String(row.contracted_billable_guests)} />
                <Meta label={tFinanceControl(locale, 'finalGuests')} value={row.final_billable_guests == null ? '—' : String(row.final_billable_guests)} />
                <Meta label={tFinanceControl(locale, 'extraGuests')} value={String(row.billable_guest_overage)} />
                <Meta label={tFinanceControl(locale, 'extraServices')} value={formatFinanceMoney(row.extra_services_total, row.currency_code, locale)} />
              </div>
              <p className="text-sm">
                {tFinanceControl(locale, 'extraAmount')}: {formatFinanceMoney(row.adjustment_total, row.currency_code, locale)}
              </p>
              <div className="flex flex-wrap gap-3 text-sm font-bold">
                <Link href={`/invoices/${row.original_invoice_id}`} className="hover:underline">
                  {row.original_invoice_number || row.original_invoice_id}
                </Link>
                {row.supplemental_invoice_id ? (
                  <Link href={`/invoices/${row.supplemental_invoice_id}`} className="hover:underline">
                    {row.supplemental_invoice_number || row.supplemental_invoice_id}
                  </Link>
                ) : (
                  <span className="text-cdl-muted">{tFinanceControl(locale, 'supplementalInvoice')}: —</span>
                )}
              </div>
              <div className="rounded-2xl bg-cdl-bg/70 p-4">
                <p className="text-[11px] font-black uppercase tracking-wider">{tFinanceControl(locale, 'finalEventTotal')}</p>
                <p className="mt-1 text-xl font-black">
                  {formatFinanceMoney(row.original_invoice_total, row.currency_code, locale)} + {formatFinanceMoney(row.adjustment_total, row.currency_code, locale)} = {formatFinanceMoney(row.final_event_total, row.currency_code, locale)}
                </p>
                <p className="mt-1 text-xs text-cdl-muted">{tFinanceControl(locale, 'originalPlusSupplemental')}</p>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-black uppercase tracking-wider text-cdl-muted">{label}</p>
      <p className="mt-1 text-sm font-bold">{value}</p>
    </div>
  )
}
