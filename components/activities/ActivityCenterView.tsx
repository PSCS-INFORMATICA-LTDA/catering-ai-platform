'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { tActivities } from '@/Lib/i18n/activities'
import { tNotifications } from '@/Lib/i18n/notifications'
import type { ActivityCenterData, ActivityTimelineItem } from '@/Lib/notifications/loadActivityCenter'

const STATUS_LABEL: Record<string, 'statusPending' | 'statusProcessing' | 'statusSent' | 'statusDelivered' | 'statusRead' | 'statusFailed' | 'statusCancelled' | 'statusUncertain'> = {
  pending: 'statusPending',
  processing: 'statusProcessing',
  sent: 'statusSent',
  delivered: 'statusDelivered',
  read: 'statusRead',
  failed: 'statusFailed',
  cancelled: 'statusCancelled',
  uncertain: 'statusUncertain',
}

function money(value: number, currency: string) {
  return `${currency} ${value.toFixed(2)}`
}

function whatsappLabel(locale: string, status: string) {
  const key = STATUS_LABEL[status]
  return key ? tNotifications(locale, key) : status
}

export default function ActivityCenterView({
  locale,
  canViewFinance,
  data,
  timeline,
  initialTab,
}: {
  locale: string
  canViewFinance: boolean
  data: ActivityCenterData
  timeline: ActivityTimelineItem[]
  initialTab?: string
}) {
  const [tab, setTab] = useState(
    initialTab === 'transactions' || initialTab === 'whatsapp' ? initialTab : 'summary',
  )
  const [query, setQuery] = useState('')
  const [type, setType] = useState('')
  const [status, setStatus] = useState('')

  const transactions = useMemo(
    () =>
      data.transactions.filter((row) => {
        if (type && type !== row.purpose && type !== 'payment') return false
        if (status && status !== row.financialStatus) return false
        if (!query) return true
        const hay = `${row.customerName || ''} ${row.eventName || ''} ${row.invoiceNumber || ''}`.toLowerCase()
        return hay.includes(query.toLowerCase())
      }),
    [data.transactions, query, status, type],
  )
  const activities = useMemo(
    () =>
      data.activities.filter((row) => {
        if (type && type !== row.eventKey && type !== 'whatsapp') return false
        if (status && status !== row.status) return false
        if (!query) return true
        const hay = `${row.customerName || ''} ${row.eventName || ''} ${row.entityLabel}`.toLowerCase()
        return hay.includes(query.toLowerCase())
      }),
    [data.activities, query, status, type],
  )

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-black text-[var(--brand-primary)]">{tActivities(locale, 'title')}</h1>
        <p className="mt-2 text-sm text-neutral-600">{tActivities(locale, 'subtitle')}</p>
        {data.currencies.length > 1 ? (
          <p className="mt-2 text-xs text-amber-800">{tActivities(locale, 'multiCurrencyNote')}</p>
        ) : null}
      </div>

      <div className="grid gap-2 sm:grid-cols-4">
        <input
          className="rounded-lg border px-3 py-2 text-sm"
          placeholder={tActivities(locale, 'filterQuery')}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <select className="rounded-lg border px-3 py-2 text-sm" value={type} onChange={(event) => setType(event.target.value)}>
          <option value="">{tActivities(locale, 'filterType')}</option>
          <option value="deposit">deposit</option>
          <option value="balance">balance</option>
          <option value="full">full</option>
          <option value="quote.created">quote.created</option>
          <option value="quote.accepted">quote.accepted</option>
          <option value="payment.deposit_received">payment.deposit_received</option>
          <option value="payment.full_received">payment.full_received</option>
        </select>
        <select className="rounded-lg border px-3 py-2 text-sm" value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">{tActivities(locale, 'filterStatus')}</option>
          <option value="paid">paid</option>
          <option value="partially_paid">partially_paid</option>
          <option value="failed">failed</option>
          <option value="uncertain">uncertain</option>
          <option value="delivered">delivered</option>
        </select>
        <div className="flex gap-2">
          {(['summary', 'transactions', 'whatsapp'] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setTab(item)}
              className={`flex-1 rounded-lg px-2 py-2 text-[11px] font-bold uppercase ${
                tab === item ? 'bg-[var(--brand-primary-2,#1e3a5f)] text-white' : 'border'
              }`}
            >
              {tActivities(
                locale,
                item === 'summary' ? 'tabSummary' : item === 'transactions' ? 'tabTransactions' : 'tabWhatsapp',
              )}
            </button>
          ))}
        </div>
      </div>

      {tab === 'summary' ? (
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[
            ['quotesCreated', data.summary.quotesCreated],
            ['quotesAccepted', data.summary.quotesAccepted],
            ['deposits', data.summary.deposits],
            ['settled', data.summary.settled],
            ['needsAttention', data.summary.needsAttention],
          ].map(([key, value]) => (
            <article key={String(key)} className="rounded-2xl border bg-white p-4 shadow-sm">
              <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">
                {tActivities(locale, key as 'quotesCreated')}
              </p>
              <p className="mt-2 text-2xl font-black">{value}</p>
            </article>
          ))}
        </section>
      ) : null}

      {tab === 'transactions' ? (
        <section className="space-y-3">
          {transactions.length === 0 ? (
            <p className="text-sm text-neutral-500">{tActivities(locale, 'emptyTransactions')}</p>
          ) : (
            transactions.map((row) => (
              <article key={row.id} className="rounded-2xl border bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs text-neutral-500">{row.createdAt.slice(0, 19).replace('T', ' ')}</p>
                    <p className="font-bold">{row.customerName || '—'}</p>
                    <p className="text-sm text-neutral-600">
                      {row.eventName || '—'} · {row.invoiceNumber || row.quoteNumber || '—'}
                    </p>
                  </div>
                  <Link
                    href={row.openPath}
                    className="rounded-lg bg-[var(--brand-primary-2,#1e3a5f)] px-3 py-2 text-xs font-bold uppercase text-white"
                  >
                    {tActivities(locale, 'open')}
                  </Link>
                </div>
                <div className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
                  <p>
                    <span className="block text-[11px] uppercase text-neutral-500">{tActivities(locale, 'receivedNow')}</span>
                    {canViewFinance ? money(row.amount, row.currency) : '••••'}
                  </p>
                  <p>
                    <span className="block text-[11px] uppercase text-neutral-500">{tActivities(locale, 'paidTotal')}</span>
                    {canViewFinance ? money(row.paidTotal, row.currency) : '••••'}
                  </p>
                  <p>
                    <span className="block text-[11px] uppercase text-neutral-500">{tActivities(locale, 'outstanding')}</span>
                    {canViewFinance ? money(row.outstanding, row.currency) : '••••'}
                  </p>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full bg-emerald-50 px-2 py-1 font-semibold text-emerald-800">
                    {tActivities(locale, 'financialStatus')}: {row.financialStatus}
                  </span>
                  <span className="rounded-full bg-neutral-100 px-2 py-1 font-semibold text-neutral-700">
                    {tActivities(locale, 'whatsappStatus')}:{' '}
                    {row.whatsappStatuses.length
                      ? row.whatsappStatuses.map((item) => whatsappLabel(locale, item)).join(', ')
                      : '—'}
                  </span>
                  {row.whatsappStatuses.includes('failed') ? (
                    <span className="rounded-full bg-amber-50 px-2 py-1 text-amber-800">
                      {tActivities(locale, 'whatsappFailed')}
                    </span>
                  ) : null}
                </div>
              </article>
            ))
          )}
        </section>
      ) : null}

      {tab === 'whatsapp' ? (
        <section className="space-y-3">
          {activities.length === 0 ? (
            <p className="text-sm text-neutral-500">{tActivities(locale, 'emptyActivities')}</p>
          ) : (
            activities.map((row) => (
              <article key={row.id} className="rounded-2xl border bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs text-neutral-500">{row.createdAt.slice(0, 19).replace('T', ' ')}</p>
                    <p className="font-bold">{row.eventKey}</p>
                    <p className="text-sm text-neutral-600">
                      {row.customerName || '—'} · {row.entityLabel}
                    </p>
                    <p className="text-xs text-neutral-500">
                      {tActivities(locale, 'recipient')}: {row.recipientName || '—'} {row.phoneMasked || ''}
                    </p>
                  </div>
                  {row.openPath ? (
                    <Link href={row.openPath} className="text-xs font-bold uppercase text-[var(--brand-primary-2)]">
                      {tActivities(locale, 'open')}
                    </Link>
                  ) : null}
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full bg-neutral-100 px-2 py-1 font-semibold">
                    {whatsappLabel(locale, row.status)}
                  </span>
                  <span>
                    {tActivities(locale, 'attempts')}: {row.attemptCount}
                  </span>
                  {row.lastError ? <span className="text-red-600">{row.lastError}</span> : null}
                </div>
              </article>
            ))
          )}
        </section>
      ) : null}

      {timeline.length > 0 ? (
        <section className="rounded-2xl border bg-white p-4 shadow-sm">
          <h2 className="text-sm font-black uppercase tracking-wider">{tActivities(locale, 'timeline')}</h2>
          <ol className="mt-4 space-y-3">
            {timeline.map((item, index) => (
              <li key={`${item.kind}-${item.at}-${index}`} className="flex gap-3 text-sm">
                <span className="mt-1 h-2 w-2 rounded-full bg-[var(--brand-primary-2,#1e3a5f)]" />
                <div>
                  <p className="font-semibold">
                    {tActivities(locale, item.labelKey as 'timelineQuoteCreated')}
                  </p>
                  <p className="text-xs text-neutral-500">{item.at.slice(0, 19).replace('T', ' ')}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </main>
  )
}
