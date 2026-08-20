'use client'

import { useState } from 'react'
import { tPublicOps, resolveBrowserLocale } from '@/Lib/i18n/publicOps'
import { tQuotesOrders } from '@/Lib/i18n/quotesOrders'
import { formatUiDate } from '@/Lib/i18n/locales'

type OrderInfo = {
  service_order_number?: string | null
  event_date?: string | null
  start_time?: string | null
  end_time?: string | null
  pickup_time?: string | null
  address?: string | null
  team_name?: string | null
  supplier_name?: string | null
  guest_count?: number | null
  package_label?: string | null
}


function formatTime(value: string | null | undefined) {
  if (!value) return '—'
  return String(value).slice(0, 5)
}

export default function PublicSupplierGarnishClient({
  token,
  companyName,
  initialResponse,
  canRespond,
  order,
  language = 'pt',
}: {
  token: string
  companyName: string
  initialResponse: string
  canRespond: boolean
  order: OrderInfo
  language?: string | null
}) {
  const lang = resolveBrowserLocale(language)
  const [response, setResponse] = useState(initialResponse)
  const [allowed, setAllowed] = useState(canRespond)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function confirm() {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/public/confirmacao-guarnicao/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'confirm' }),
      })
      const json = (await res.json()) as {
        data?: { supplier_garnish_response?: string }
        error?: string
      }
      if (!res.ok) throw new Error(json.error ?? tPublicOps(lang, 'confirmError'))
      setResponse(json.data?.supplier_garnish_response ?? 'confirmed')
      setAllowed(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : tPublicOps(lang, 'genericError'))
    } finally {
      setBusy(false)
    }
  }

  const statusLabel =
    response === 'confirmed'
      ? tPublicOps(lang, 'receiptConfirmed')
      : tPublicOps(lang, 'awaitingReceipt')

  return (
    <main className="mx-auto min-h-screen max-w-lg bg-cdl-bg px-4 py-10 text-cdl-fg">
      <div className="liquid-glass-card space-y-5 p-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-cdl-muted">
            {tPublicOps(lang, 'garnishOrderTitle')}
          </p>
          <h1 className="mt-1 text-2xl font-bold text-red-600">
            {companyName || 'BBQ At Home'}
          </h1>
          <p className="mt-1 text-sm text-cdl-muted">
            {tPublicOps(lang, 'serviceOrderLabel', {
              number: order.service_order_number || '—',
            })}
          </p>
        </div>

        <dl className="grid gap-3 text-sm">
          {order.supplier_name ? (
            <div>
              <dt className="text-cdl-muted">
                {tPublicOps(lang, 'supplierLabel')}
              </dt>
              <dd className="font-semibold">{order.supplier_name}</dd>
            </div>
          ) : null}
          <div>
            <dt className="text-cdl-muted">
              {tQuotesOrders(lang, 'docEventDateLabel')}
            </dt>
            <dd className="font-semibold">
              {formatUiDate(order.event_date, lang)}
            </dd>
          </div>
          <div>
            <dt className="text-cdl-muted">{tPublicOps(lang, 'pickupTime')}</dt>
            <dd className="text-lg font-bold text-red-600">
              {formatTime(order.pickup_time)}
            </dd>
          </div>
          <div>
            <dt className="text-cdl-muted">{tPublicOps(lang, 'eventTime')}</dt>
            <dd className="font-semibold">
              {formatTime(order.start_time)} – {formatTime(order.end_time)}
            </dd>
          </div>
          {order.team_name ? (
            <div>
              <dt className="text-cdl-muted">
                {tQuotesOrders(lang, 'teamFieldLabel').replace(' *', '')}
              </dt>
              <dd className="font-semibold">{order.team_name}</dd>
            </div>
          ) : null}
          {order.guest_count != null ? (
            <div>
              <dt className="text-cdl-muted">
                {tPublicOps(lang, 'guestsLabel')}
              </dt>
              <dd className="font-semibold">{order.guest_count}</dd>
            </div>
          ) : null}
          {order.package_label ? (
            <div>
              <dt className="text-cdl-muted">
                {tQuotesOrders(lang, 'packageLabel')}
              </dt>
              <dd className="font-semibold">{order.package_label}</dd>
            </div>
          ) : null}
          {order.address ? (
            <div>
              <dt className="text-cdl-muted">
                {tQuotesOrders(lang, 'locationLabel')}
              </dt>
              <dd className="font-semibold">{order.address}</dd>
            </div>
          ) : null}
        </dl>

        <p className="text-sm text-cdl-muted">{statusLabel}</p>

        {allowed ? (
          <button
            type="button"
            disabled={busy}
            className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            onClick={() => void confirm()}
          >
            {tPublicOps(lang, 'confirmReceipt')}
          </button>
        ) : null}

        {error ? <p className="text-sm text-red-500">{error}</p> : null}
      </div>
    </main>
  )
}
