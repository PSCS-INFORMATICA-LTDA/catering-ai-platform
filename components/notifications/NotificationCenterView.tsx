'use client'

import { useState } from 'react'
import { tNotifications } from '@/Lib/i18n/notifications'

type Recipient = {
  id: string
  event_key: string
  channel: string
  display_name: string | null
  phone_e164: string | null
  locale: string
  enabled: boolean
}

type Delivery = {
  id: string
  channel: string
  provider: string | null
  template_key: string | null
  status: string
  provider_message_id: string | null
  attempt_count: number
  last_error: string | null
  created_at: string
  sent_at: string | null
  failed_at: string | null
}

export default function NotificationCenterView({
  title,
  locale,
  canManage,
  recipients,
  deliveries,
}: {
  title: string
  locale: string
  canManage: boolean
  recipients: Recipient[]
  deliveries: Delivery[]
}) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [recipientLocale, setRecipientLocale] = useState<'pt' | 'en' | 'es'>(
    locale === 'en' || locale === 'es' ? locale : 'pt',
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  async function toggle(id: string, enabled: boolean) {
    await fetch('/api/notifications/recipients', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id, enabled }),
    })
    window.location.reload()
  }

  async function retry(id: string) {
    await fetch(`/api/notifications/deliveries/${id}/retry`, { method: 'POST' })
    window.location.reload()
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-black text-[var(--brand-primary)]">{title}</h1>
        <p className="mt-2 text-sm text-neutral-600">
          {tNotifications(locale, 'templatePending')}
        </p>
      </div>

      <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-black uppercase tracking-wider">
          {tNotifications(locale, 'recipients')}
        </h2>
        {recipients.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-500">
            {tNotifications(locale, 'emptyRecipients')}
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {recipients.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 text-sm">
                <div>
                  <p className="font-bold">{row.display_name || row.phone_e164}</p>
                  <p className="text-neutral-500">
                    {row.channel} · {row.event_key} · {row.phone_e164} · {row.locale}
                  </p>
                </div>
                {canManage ? (
                  <button
                    type="button"
                    className="rounded-lg border px-3 py-1 text-xs font-bold uppercase"
                    onClick={() => toggle(row.id, !row.enabled)}
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
                setRecipientLocale(event.target.value === 'en' || event.target.value === 'es' ? event.target.value : 'pt')
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
        {deliveries.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-500">
            {tNotifications(locale, 'emptyDeliveries')}
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">
                <tr>
                  <th className="py-2">{tNotifications(locale, 'status')}</th>
                  <th>{tNotifications(locale, 'channel')}</th>
                  <th>{tNotifications(locale, 'template')}</th>
                  <th>{tNotifications(locale, 'providerId')}</th>
                  <th>{tNotifications(locale, 'error')}</th>
                  <th>{tNotifications(locale, 'createdAt')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {deliveries.map((row) => (
                  <tr key={row.id} className="border-t border-neutral-100">
                    <td className="py-2 font-bold">{row.status}</td>
                    <td>{row.channel}</td>
                    <td>{row.template_key || '—'}</td>
                    <td className="font-mono text-xs">{row.provider_message_id || '—'}</td>
                    <td className="text-xs text-neutral-500">{row.last_error || '—'}</td>
                    <td className="text-xs text-neutral-500">
                      {row.created_at ? String(row.created_at).slice(0, 19).replace('T', ' ') : '—'}
                    </td>
                    <td>
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
