'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { tNotifications } from '@/Lib/i18n/notifications'
import { V1_NOTIFICATION_EVENT_KEYS } from '@/Lib/notifications/types'

type Subscription = { event_key: string; enabled: boolean }

type Recipient = {
  id: string
  display_name: string | null
  phone_e164: string | null
  locale: string
  enabled: boolean
  channel: string
  subscriptions?: Subscription[]
}

type Delivery = {
  id: string
  created_at: string
  event_key?: string | null
  entity_type?: string | null
  entity_id?: string | null
  quote_number?: string | null
  invoice_number?: string | null
  customer_name?: string | null
  event_name?: string | null
  amount?: number | null
  recipient_name?: string | null
  phone_masked?: string | null
  channel: string
  provider: string | null
  template_key: string | null
  status: string
  provider_message_id: string | null
  attempt_count: number
  last_error: string | null
  sent_at: string | null
  delivered_at: string | null
  read_at: string | null
  failed_at: string | null
  deep_link?: string | null
}

type ProviderStatus = {
  configured: boolean
  source: string
  enabled: boolean
}

const EVENT_LABEL: Record<string, 'eventQuoteCreated' | 'eventDeposit' | 'eventFull'> = {
  'quote.created': 'eventQuoteCreated',
  'payment.deposit_received': 'eventDeposit',
  'payment.full_received': 'eventFull',
}

export default function NotificationCenterView({
  title,
  locale,
  canManage,
  recipients,
  deliveries,
  provider,
}: {
  title: string
  locale: string
  canManage: boolean
  recipients: Recipient[]
  deliveries: Delivery[]
  provider: ProviderStatus
}) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [recipientLocale, setRecipientLocale] = useState<'pt' | 'en' | 'es'>(
    locale === 'en' || locale === 'es' ? locale : 'pt',
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [eventFilter, setEventFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const filteredDeliveries = useMemo(
    () =>
      deliveries.filter((row) => {
        if (eventFilter && row.event_key !== eventFilter) return false
        if (statusFilter && row.status !== statusFilter) return false
        return true
      }),
    [deliveries, eventFilter, statusFilter],
  )

  async function addRecipient() {
    setBusy(true)
    setError(null)
    const response = await fetch('/api/notifications/recipients', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ displayName: name, phone, locale: recipientLocale }),
    })
    const json = await response.json().catch(() => null)
    setBusy(false)
    if (!response.ok) {
      setError(json?.error || 'save_failed')
      return
    }
    window.location.reload()
  }

  async function toggleRecipient(id: string, enabled: boolean) {
    await fetch('/api/notifications/recipients', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id, enabled }),
    })
    window.location.reload()
  }

  async function toggleSubscription(id: string, eventKey: string, enabled: boolean) {
    await fetch('/api/notifications/recipients', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id, subscriptions: { [eventKey]: enabled } }),
    })
    window.location.reload()
  }

  async function retry(id: string) {
    await fetch(`/api/notifications/deliveries/${id}/retry`, { method: 'POST' })
    window.location.reload()
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-black text-[var(--brand-primary)]">{title}</h1>
        <p className="mt-2 text-sm text-neutral-600">{tNotifications(locale, 'templatePending')}</p>
      </div>

      <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-black uppercase tracking-wider">
          {tNotifications(locale, 'providerStatus')}
        </h2>
        <p className="mt-3 text-sm font-semibold">
          {provider.configured
            ? tNotifications(locale, 'providerConfigured')
            : tNotifications(locale, 'providerMissing')}
        </p>
        {provider.source === 'env_fallback' ? (
          <p className="mt-1 text-xs text-neutral-500">
            {tNotifications(locale, 'providerFallback')}
          </p>
        ) : null}
        <p className="mt-3 text-xs text-neutral-500">{tNotifications(locale, 'futureChannels')}</p>
      </section>

      <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-black uppercase tracking-wider">
          {tNotifications(locale, 'recipients')}
        </h2>
        {recipients.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-500">
            {tNotifications(locale, 'emptyRecipients')}
          </p>
        ) : (
          <ul className="mt-4 space-y-4">
            {recipients.map((row) => (
              <li key={row.id} className="rounded-xl border border-neutral-100 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-bold">{row.display_name || row.phone_e164}</p>
                    <p className="text-sm text-neutral-500">
                      {row.channel} · {row.phone_e164} · {row.locale}
                    </p>
                  </div>
                  {canManage ? (
                    <button
                      type="button"
                      className="rounded-lg border px-3 py-1 text-xs font-bold uppercase"
                      onClick={() => toggleRecipient(row.id, !row.enabled)}
                    >
                      {row.enabled
                        ? tNotifications(locale, 'enabled')
                        : tNotifications(locale, 'disabled')}
                    </button>
                  ) : (
                    <span className="text-xs font-bold uppercase">
                      {row.enabled
                        ? tNotifications(locale, 'enabled')
                        : tNotifications(locale, 'disabled')}
                    </span>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap gap-3 text-sm">
                  {V1_NOTIFICATION_EVENT_KEYS.map((eventKey) => {
                    const subscribed =
                      row.subscriptions?.find((item) => item.event_key === eventKey)?.enabled ??
                      false
                    return (
                      <label key={eventKey} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={subscribed}
                          disabled={!canManage}
                          onChange={(event) =>
                            toggleSubscription(row.id, eventKey, event.target.checked)
                          }
                        />
                        {tNotifications(locale, EVENT_LABEL[eventKey])}
                      </label>
                    )
                  })}
                </div>
              </li>
            ))}
          </ul>
        )}
        {canManage ? (
          <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_1fr_auto_auto]">
            <input
              className="rounded-lg border px-3 py-2 text-sm"
              placeholder={tNotifications(locale, 'displayName')}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            <input
              className="rounded-lg border px-3 py-2 text-sm"
              placeholder={tNotifications(locale, 'phone')}
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
            />
            <select
              className="rounded-lg border px-3 py-2 text-sm"
              aria-label={tNotifications(locale, 'locale')}
              value={recipientLocale}
              onChange={(event) =>
                setRecipientLocale(
                  event.target.value === 'en' || event.target.value === 'es'
                    ? event.target.value
                    : 'pt',
                )
              }
            >
              <option value="pt">PT</option>
              <option value="en">EN</option>
              <option value="es">ES</option>
            </select>
            <button
              type="button"
              className="rounded-lg bg-[var(--brand-primary-2,#1e3a5f)] px-4 py-2 text-xs font-bold uppercase text-white disabled:opacity-60"
              disabled={busy}
              onClick={addRecipient}
            >
              {tNotifications(locale, 'addRecipient')}
            </button>
          </div>
        ) : null}
        {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      </section>

      <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-black uppercase tracking-wider">
          {tNotifications(locale, 'deliveries')}
        </h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <select
            className="rounded-lg border px-3 py-2 text-sm"
            value={eventFilter}
            onChange={(event) => setEventFilter(event.target.value)}
          >
            <option value="">{tNotifications(locale, 'filterEvent')}</option>
            {V1_NOTIFICATION_EVENT_KEYS.map((eventKey) => (
              <option key={eventKey} value={eventKey}>
                {tNotifications(locale, EVENT_LABEL[eventKey])}
              </option>
            ))}
          </select>
          <select
            className="rounded-lg border px-3 py-2 text-sm"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="">{tNotifications(locale, 'filterStatus')}</option>
            {['pending', 'processing', 'sent', 'delivered', 'read', 'failed', 'cancelled'].map(
              (status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ),
            )}
          </select>
        </div>
        {filteredDeliveries.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-500">
            {tNotifications(locale, 'emptyDeliveries')}
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">
                <tr>
                  <th className="py-2">{tNotifications(locale, 'createdAt')}</th>
                  <th>{tNotifications(locale, 'filterEvent')}</th>
                  <th>{tNotifications(locale, 'entity')}</th>
                  <th>{tNotifications(locale, 'recipients')}</th>
                  <th>{tNotifications(locale, 'status')}</th>
                  <th>{tNotifications(locale, 'attempts')}</th>
                  <th>{tNotifications(locale, 'error')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filteredDeliveries.map((row) => (
                  <tr key={row.id} className="border-t border-neutral-100">
                    <td className="py-2 text-xs">
                      {row.created_at ? String(row.created_at).slice(0, 19).replace('T', ' ') : '—'}
                    </td>
                    <td>{row.event_key || '—'}</td>
                    <td className="text-xs">
                      {row.invoice_number || row.quote_number || row.entity_id || '—'}
                      <div className="text-neutral-500">
                        {row.customer_name || '—'}
                        {row.event_name ? ` · ${row.event_name}` : ''}
                      </div>
                    </td>
                    <td className="text-xs">
                      {row.recipient_name || '—'}
                      <div className="text-neutral-500">{row.phone_masked || '—'}</div>
                    </td>
                    <td className="font-bold">{row.status}</td>
                    <td>{row.attempt_count}</td>
                    <td className="text-xs text-neutral-500">{row.last_error || '—'}</td>
                    <td className="space-x-2">
                      {row.deep_link ? (
                        <Link
                          href={row.deep_link}
                          className="text-xs font-bold uppercase text-[var(--brand-primary-2)]"
                        >
                          {tNotifications(locale, 'openEntity')}
                        </Link>
                      ) : null}
                      {canManage && (row.status === 'failed' || row.status === 'pending') ? (
                        <button
                          type="button"
                          className="text-xs font-bold uppercase text-[var(--brand-primary-2)]"
                          onClick={() => retry(row.id)}
                        >
                          {tNotifications(locale, 'retry')}
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  )
}
