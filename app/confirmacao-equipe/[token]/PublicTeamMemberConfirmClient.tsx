'use client'

import { useState } from 'react'
import { operationalRoleLabel } from '@/Lib/agenda/operationalRoles'
import { glassBtn } from '@/Lib/liquidGlass'
import { tPublicOps, resolveBrowserLocale } from '@/Lib/i18n/publicOps'
import { tQuotesOrders } from '@/Lib/i18n/quotesOrders'
import { formatUiDate } from '@/Lib/i18n/locales'

type Assignment = {
  role_key: string
  person_name: string
  team_name: string
  event_title: string
  event_date: string
  start_time: string
  end_time: string
  client_name?: string | null
  location?: string | null
}

function fmtTime(v: string) {
  return v?.slice(0, 5) || '—'
}

export default function PublicTeamMemberConfirmClient({
  token,
  companyName,
  initialStatus,
  canRespond,
  confirmation,
  language = 'pt',
}: {
  token: string
  companyName: string
  initialStatus: string
  canRespond: boolean
  confirmation: Assignment
  language?: string | null
}) {
  const lang = resolveBrowserLocale(language)
  const [status, setStatus] = useState(initialStatus)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const role = operationalRoleLabel(confirmation.role_key, lang)

  async function respond(response: 'confirmed' | 'declined') {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/public/confirmacao-equipe/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response }),
      })
      const data = (await res.json()) as {
        ok?: boolean
        status?: string
        error?: string
        idempotent?: boolean
      }
      if (!res.ok || !data.ok) {
        setError(data.error || tPublicOps(lang, 'registerResponseError'))
        return
      }
      setStatus(data.status || response)
    } catch {
      setError(tPublicOps(lang, 'networkRetry'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-lg items-center justify-center px-4 py-8">
      <div className="liquid-glass-card w-full space-y-4 p-6 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-cdl-muted">
          {companyName}
        </p>
        <h1 className="text-2xl font-bold text-cdl-fg">
          {tPublicOps(lang, 'memberConfirmTitle')}
        </h1>
        <dl className="space-y-2 text-sm text-cdl-fg">
          <div>
            <dt className="text-cdl-muted">{tQuotesOrders(lang, 'tableDate')}</dt>
            <dd className="font-medium">
              {formatUiDate(confirmation.event_date, lang)}
            </dd>
          </div>
          <div>
            <dt className="text-cdl-muted">
              {tQuotesOrders(lang, 'timeLabel')}
            </dt>
            <dd className="font-medium">
              {fmtTime(confirmation.start_time)}–{fmtTime(confirmation.end_time)}
            </dd>
          </div>
          <div>
            <dt className="text-cdl-muted">{tQuotesOrders(lang, 'event')}</dt>
            <dd className="font-medium">{confirmation.event_title}</dd>
          </div>
          <div>
            <dt className="text-cdl-muted">
              {tQuotesOrders(lang, 'locationLabel')}
            </dt>
            <dd className="font-medium">{confirmation.location || '—'}</dd>
          </div>
          <div>
            <dt className="text-cdl-muted">
              {tQuotesOrders(lang, 'teamFieldLabel').replace(' *', '')}
            </dt>
            <dd className="font-medium">{confirmation.team_name}</dd>
          </div>
          <div>
            <dt className="text-cdl-muted">{tPublicOps(lang, 'roleLabel')}</dt>
            <dd className="font-medium">{role}</dd>
          </div>
          <div>
            <dt className="text-cdl-muted">{tPublicOps(lang, 'memberLabel')}</dt>
            <dd className="font-medium">{confirmation.person_name}</dd>
          </div>
        </dl>

        {status === 'confirmed' ? (
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            {tPublicOps(lang, 'participationConfirmed')}
          </p>
        ) : null}
        {status === 'declined' ? (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {tPublicOps(lang, 'unavailabilityRecorded')}
          </p>
        ) : null}
        {status === 'cancelled' ? (
          <p className="rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-700">
            {tPublicOps(lang, 'inviteCancelled')}
          </p>
        ) : null}

        {canRespond && status === 'pending' ? (
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              disabled={busy}
              className={glassBtn('primary')}
              onClick={() => void respond('confirmed')}
            >
              {tPublicOps(lang, 'confirmParticipation')}
            </button>
            <button
              type="button"
              disabled={busy}
              className={glassBtn('ghost')}
              onClick={() => void respond('declined')}
            >
              {tPublicOps(lang, 'cannotParticipate')}
            </button>
          </div>
        ) : null}

        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </div>
    </main>
  )
}
