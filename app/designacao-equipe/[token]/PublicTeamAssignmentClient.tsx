'use client'

import { useState } from 'react'
import { tPublicOps, resolveBrowserLocale } from '@/Lib/i18n/publicOps'
import { tQuotesOrders } from '@/Lib/i18n/quotesOrders'
import { formatUiDate } from '@/Lib/i18n/locales'

type Assignment = {
  code?: string | null
  title?: string | null
  client_name?: string | null
  team_name?: string | null
  event_date?: string | null
  start_time?: string | null
  end_time?: string | null
  presentation_time?: string | null
  address?: string | null
  quote_number?: string | null
}


function formatTime(value: string | null | undefined) {
  if (!value) return '—'
  return String(value).slice(0, 5)
}

export default function PublicTeamAssignmentClient({
  token,
  companyName,
  initialResponse,
  canRespond,
  assignment,
  language = 'pt',
}: {
  token: string
  companyName: string
  initialResponse: string
  canRespond: boolean
  assignment: Assignment
  language?: string | null
}) {
  const lang = resolveBrowserLocale(language)
  const [response, setResponse] = useState(initialResponse)
  const [allowed, setAllowed] = useState(canRespond)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function respond(action: 'accept' | 'reject') {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/public/designacao-equipe/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const json = (await res.json()) as {
        data?: { team_assignment_response?: string }
        error?: string
      }
      if (!res.ok) throw new Error(json.error ?? tPublicOps(lang, 'respondError'))
      setResponse(
        json.data?.team_assignment_response ??
          (action === 'accept' ? 'accepted' : 'rejected'),
      )
      setAllowed(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : tPublicOps(lang, 'genericError'))
    } finally {
      setBusy(false)
    }
  }

  const statusLabel =
    response === 'accepted'
      ? tPublicOps(lang, 'acceptedAssignment')
      : response === 'rejected'
        ? tPublicOps(lang, 'rejectedAssignment')
        : tPublicOps(lang, 'awaitingYourConfirmation')

  return (
    <main className="mx-auto min-h-screen max-w-lg bg-cdl-bg px-4 py-10 text-cdl-fg">
      <div className="liquid-glass-card space-y-5 p-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-cdl-muted">
            {tPublicOps(lang, 'assignmentTitle')}
          </p>
          <h1 className="mt-1 text-2xl font-bold text-red-600">
            {companyName || 'BBQ At Home'}
          </h1>
          <p className="mt-1 text-sm text-cdl-muted">
            {assignment.code || '—'}
            {assignment.quote_number
              ? tPublicOps(lang, 'quoteSuffix', {
                  number: assignment.quote_number,
                })
              : ''}
          </p>
        </div>

        <dl className="grid gap-3 text-sm">
          <div>
            <dt className="text-cdl-muted">
              {tQuotesOrders(lang, 'teamFieldLabel').replace(' *', '')}
            </dt>
            <dd className="font-semibold">{assignment.team_name || '—'}</dd>
          </div>
          <div>
            <dt className="text-cdl-muted">{tQuotesOrders(lang, 'event')}</dt>
            <dd className="font-semibold">{assignment.title || '—'}</dd>
          </div>
          <div>
            <dt className="text-cdl-muted">{tQuotesOrders(lang, 'customer')}</dt>
            <dd className="font-semibold">{assignment.client_name || '—'}</dd>
          </div>
          <div>
            <dt className="text-cdl-muted">
              {tQuotesOrders(lang, 'tableDate')}
            </dt>
            <dd className="font-semibold">
              {formatUiDate(assignment.event_date, lang)}
            </dd>
          </div>
          <div>
            <dt className="text-cdl-muted">
              {tPublicOps(lang, 'presentationTime')}
            </dt>
            <dd className="text-lg font-bold text-red-600">
              {formatTime(assignment.presentation_time)}
            </dd>
          </div>
          <div>
            <dt className="text-cdl-muted">{tPublicOps(lang, 'eventTime')}</dt>
            <dd className="font-semibold">
              {formatTime(assignment.start_time)} –{' '}
              {formatTime(assignment.end_time)}
            </dd>
          </div>
          {assignment.address ? (
            <div>
              <dt className="text-cdl-muted">
                {tQuotesOrders(lang, 'locationLabel')}
              </dt>
              <dd className="font-semibold">{assignment.address}</dd>
            </div>
          ) : null}
        </dl>

        <p className="text-sm text-cdl-muted">{statusLabel}</p>

        {allowed ? (
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={busy}
              className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              onClick={() => void respond('accept')}
            >
              {tPublicOps(lang, 'acceptAssignment')}
            </button>
            <button
              type="button"
              disabled={busy}
              className="rounded-xl border border-cdl-border bg-cdl-surface px-4 py-2.5 text-sm font-semibold text-cdl-fg disabled:opacity-50"
              onClick={() => void respond('reject')}
            >
              {tPublicOps(lang, 'decline')}
            </button>
          </div>
        ) : null}

        {error ? <p className="text-sm text-red-500">{error}</p> : null}
      </div>
    </main>
  )
}
