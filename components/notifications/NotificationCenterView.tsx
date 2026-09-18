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
  person_id?: string | null
  consent_status?: string | null
  subscriptions?: Subscription[]
}

type Delivery = {
  id: string
  created_at: string
  event_key?: string | null
  quote_number?: string | null
  invoice_number?: string | null
  customer_name?: string | null
  event_name?: string | null
  recipient_name?: string | null
  phone_masked?: string | null
  channel: string
  status: string
  attempt_count: number
  last_error: string | null
  deep_link?: string | null
}

type ProviderStatus = {
  configured: boolean
  source: string
  enabled: boolean
  reason?: string | null
}

type ContactHit = {
  id: string
  displayName: string
  phoneMasked: string
  phone: string
  locale: 'pt' | 'en' | 'es'
}

const EVENT_LABEL: Record<string, 'eventQuoteCreated' | 'eventQuoteAccepted' | 'eventDeposit' | 'eventFull'> = {
  'quote.created': 'eventQuoteCreated',
  'quote.accepted': 'eventQuoteAccepted',
  'payment.deposit_received': 'eventDeposit',
  'payment.full_received': 'eventFull',
}

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
  const [personId, setPersonId] = useState('')
  const [contactQuery, setContactQuery] = useState('')
  const [contacts, setContacts] = useState<ContactHit[]>([])
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

  async function searchContacts(value: string) {
    setContactQuery(value)
    if (value.trim().length < 2) {
      setContacts([])
      return
    }
    const response = await fetch(`/api/notifications/contacts?q=${encodeURIComponent(value)}`)
    const json = await response.json().catch(() => null)
    setContacts(Array.isArray(json?.data) ? json.data : [])
  }

  async function addRecipient() {
    setBusy(true)
    setError(null)
    const response = await fetch('/api/notifications/recipients', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        displayName: name,
        phone,
        locale: recipientLocale,
        personId: personId || undefined,
      }),
    })
    const json = await response.json().catch(() => null)
    setBusy(false)
    if (!response.ok) {
      setError(json?.error || 'save_failed')
      return
    }
    window.location.reload()
  }

  async function patchRecipient(body: Record<string, unknown>) {
    await fetch('/api/notifications/recipients', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    window.location.reload()
  }

  async function sendTest(id: string) {
    setBusy(true)
    await fetch('/api/notifications/test', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ recipientId: id, eventKey: 'quote.created' }),
    })
    setBusy(false)
    window.location.reload()
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-black text-[var(--brand-primary)]">{title}</h1>
        <p className="mt-2 text-sm text-neutral-600">{tNotifications(locale, 'templatesUnverified')}</p>
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
        {provider.reason ? (
          <p className="mt-1 text-xs text-amber-800">
            {tNotifications(locale, 'missingConfig')}: {provider.reason}
          </p>
        ) : null}
        <p className="mt-3 text-xs text-neutral-500">{tNotifications(locale, 'futureChannels')}</p>
        <Link href="/activities" className="mt-3 inline-block text-xs font-bold uppercase text-[var(--brand-primary-2)]">
          {tNotifications(locale, 'openEntity')} atividades
        </Link>
      </section>

      <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-black uppercase tracking-wider">
          {tNotifications(locale, 'recipients')}
        </h2>
        {recipients.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-500">{tNotifications(locale, 'emptyRecipients')}</p>
        ) : (
          <ul className="mt-4 space-y-4">
            {recipients.map((row) => {
              const consent = row.consent_status || 'unknown'
              const subscribed = V1_NOTIFICATION_EVENT_KEYS.filter(
                (eventKey) => row.subscriptions?.find((item) => item.event_key === eventKey)?.enabled,
              )
              return (
                <li key={row.id} className="rounded-xl border border-neutral-100 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-bold">{row.display_name || row.phone_e164}</p>
                      <p className="text-sm text-neutral-500">
                        {row.channel} · {row.phone_e164} · {row.locale}
                      </p>
                      <p className="mt-1 text-xs font-semibold">
                        {consent === 'confirmed'
                          ? tNotifications(locale, 'consentConfirmed')
                          : consent === 'denied'
                            ? tNotifications(locale, 'consentDenied')
                            : tNotifications(locale, 'consentUnknown')}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {canManage ? (
                        <>
                          <button
                            type="button"
                            className="rounded-lg border px-3 py-1 text-xs font-bold uppercase"
                            onClick={() => patchRecipient({ id: row.id, enabled: !row.enabled })}
                          >
                            {row.enabled
                              ? tNotifications(locale, 'enabled')
                              : tNotifications(locale, 'disabled')}
                          </button>
                          {consent !== 'confirmed' ? (
                            <button
                              type="button"
                              className="rounded-lg border px-3 py-1 text-xs font-bold uppercase"
                              onClick={() => patchRecipient({ id: row.id, confirmConsent: true })}
                            >
                              {tNotifications(locale, 'confirmConsent')}
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="rounded-lg border px-3 py-1 text-xs font-bold uppercase"
                              onClick={() => patchRecipient({ id: row.id, denyConsent: true })}
                            >
                              {tNotifications(locale, 'denyConsent')}
                            </button>
                          )}
                          <button
                            type="button"
                            className="rounded-lg bg-[var(--brand-primary-2,#1e3a5f)] px-3 py-1 text-xs font-bold uppercase text-white disabled:opacity-50"
                            disabled={busy || !row.enabled}
                            onClick={() => sendTest(row.id)}
                          >
                            {tNotifications(locale, 'sendTest')}
                          </button>
                        </>
                      ) : (
                        <span className="text-xs font-bold uppercase">
                          {row.enabled
                            ? tNotifications(locale, 'enabled')
                            : tNotifications(locale, 'disabled')}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-3 text-sm">
                    {V1_NOTIFICATION_EVENT_KEYS.map((eventKey) => {
                      const on =
                        row.subscriptions?.find((item) => item.event_key === eventKey)?.enabled ?? false
                      return (
                        <label key={eventKey} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={on}
                            disabled={!canManage}
                            onChange={(event) =>
                              patchRecipient({
                                id: row.id,
                                subscriptions: { [eventKey]: event.target.checked },
                              })
                            }
                          />
                          {tNotifications(locale, EVENT_LABEL[eventKey])}
                        </label>
                      )
                    })}
                  </div>
                  <p className="mt-2 text-xs text-neutral-500">
                    {tNotifications(locale, 'diagnosis')}:{' '}
                    {provider.configured && row.enabled && consent === 'confirmed' && subscribed.length > 0
                      ? tNotifications(locale, 'readyToSend')
                      : tNotifications(locale, 'missingConfig')}
                  </p>
                </li>
              )
            })}
          </ul>
        )}
        {canManage ? (
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <input
              className="rounded-lg border px-3 py-2 text-sm"
              placeholder={tNotifications(locale, 'searchContact')}
              value={contactQuery}
              onChange={(event) => searchContacts(event.target.value)}
            />
            <div className="text-xs text-neutral-500">{tNotifications(locale, 'existingContact')}</div>
            {contacts.length > 0 ? (
              <ul className="sm:col-span-2 space-y-1 rounded-lg border p-2">
                {contacts.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      className="w-full rounded px-2 py-1 text-left text-sm hover:bg-neutral-50"
                      onClick={() => {
                        setName(item.displayName)
                        setPhone(item.phone)
                        setPersonId(item.id)
                        setRecipientLocale(item.locale)
                        setContacts([])
                      }}
                    >
                      {item.displayName} · {item.phoneMasked}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
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
                  event.target.value === 'en' || event.target.value === 'es' ? event.target.value : 'pt',
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
            {Object.keys(STATUS_LABEL).map((status) => (
              <option key={status} value={status}>
                {tNotifications(locale, STATUS_LABEL[status])}
              </option>
            ))}
          </select>
        </div>
        {filteredDeliveries.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-500">{tNotifications(locale, 'emptyDeliveries')}</p>
        ) : (
          <div className="mt-4 space-y-3 md:hidden">
            {filteredDeliveries.map((row) => (
              <article key={row.id} className="rounded-xl border p-3 text-sm">
                <p className="text-xs text-neutral-500">
                  {row.created_at ? String(row.created_at).slice(0, 19).replace('T', ' ') : '—'}
                </p>
                <p className="font-bold">{row.event_key}</p>
                <p>{row.invoice_number || row.quote_number || row.customer_name || '—'}</p>
                <p className="text-xs">
                  {STATUS_LABEL[row.status]
                    ? tNotifications(locale, STATUS_LABEL[row.status])
                    : row.status}{' '}
                  · {row.attempt_count}
                </p>
                {row.deep_link ? (
                  <Link href={row.deep_link} className="text-xs font-bold uppercase text-[var(--brand-primary-2)]">
                    {tNotifications(locale, 'openEntity')}
                  </Link>
                ) : null}
              </article>
            ))}
          </div>
        )}
        {filteredDeliveries.length > 0 ? (
          <div className="mt-4 hidden overflow-x-auto md:block">
            <table className="w-full min-w-[880px] text-left text-sm">
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
                      {row.invoice_number || row.quote_number || '—'}
                      <div className="text-neutral-500">{row.customer_name || '—'}</div>
                    </td>
                    <td className="text-xs">
                      {row.recipient_name || '—'}
                      <div className="text-neutral-500">{row.phone_masked || '—'}</div>
                    </td>
                    <td className="font-bold">
                      {STATUS_LABEL[row.status]
                        ? tNotifications(locale, STATUS_LABEL[row.status])
                        : row.status}
                    </td>
                    <td>{row.attempt_count}</td>
                    <td className="text-xs text-neutral-500">{row.last_error || '—'}</td>
                    <td>
                      {row.deep_link ? (
                        <Link
                          href={row.deep_link}
                          className="text-xs font-bold uppercase text-[var(--brand-primary-2)]"
                        >
                          {tNotifications(locale, 'openEntity')}
                        </Link>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </main>
  )
}
