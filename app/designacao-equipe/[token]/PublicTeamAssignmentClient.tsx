'use client'

import { useState } from 'react'

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

function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  const [y, m, d] = value.split('-')
  if (!y || !m || !d) return value
  return `${d}/${m}/${y}`
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
}: {
  token: string
  companyName: string
  initialResponse: string
  canRespond: boolean
  assignment: Assignment
}) {
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
      if (!res.ok) throw new Error(json.error ?? 'Falha ao responder')
      setResponse(
        json.data?.team_assignment_response ??
          (action === 'accept' ? 'accepted' : 'rejected'),
      )
      setAllowed(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro')
    } finally {
      setBusy(false)
    }
  }

  const statusLabel =
    response === 'accepted'
      ? 'Você aceitou esta designação.'
      : response === 'rejected'
        ? 'Você recusou esta designação.'
        : 'Aguardando sua confirmação.'

  return (
    <main className="mx-auto min-h-screen max-w-lg bg-cdl-bg px-4 py-10 text-cdl-fg">
      <div className="liquid-glass-card space-y-5 p-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-cdl-muted">
            Designação da equipe
          </p>
          <h1 className="mt-1 text-2xl font-bold text-red-600">
            {companyName || 'BBQ At Home'}
          </h1>
          <p className="mt-1 text-sm text-cdl-muted">
            {assignment.code || '—'}
            {assignment.quote_number
              ? ` · Cotação ${assignment.quote_number}`
              : ''}
          </p>
        </div>

        <dl className="grid gap-3 text-sm">
          <div>
            <dt className="text-cdl-muted">Equipe</dt>
            <dd className="font-semibold">{assignment.team_name || '—'}</dd>
          </div>
          <div>
            <dt className="text-cdl-muted">Evento</dt>
            <dd className="font-semibold">{assignment.title || '—'}</dd>
          </div>
          <div>
            <dt className="text-cdl-muted">Cliente</dt>
            <dd className="font-semibold">{assignment.client_name || '—'}</dd>
          </div>
          <div>
            <dt className="text-cdl-muted">Data</dt>
            <dd className="font-semibold">
              {formatDate(assignment.event_date)}
            </dd>
          </div>
          <div>
            <dt className="text-cdl-muted">Horário de apresentação no local</dt>
            <dd className="text-lg font-bold text-red-600">
              {formatTime(assignment.presentation_time)}
            </dd>
          </div>
          <div>
            <dt className="text-cdl-muted">Horário do evento</dt>
            <dd className="font-semibold">
              {formatTime(assignment.start_time)} –{' '}
              {formatTime(assignment.end_time)}
            </dd>
          </div>
          {assignment.address ? (
            <div>
              <dt className="text-cdl-muted">Local</dt>
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
              Aceitar designação
            </button>
            <button
              type="button"
              disabled={busy}
              className="rounded-xl border border-cdl-border bg-cdl-surface px-4 py-2.5 text-sm font-semibold text-cdl-fg disabled:opacity-50"
              onClick={() => void respond('reject')}
            >
              Recusar
            </button>
          </div>
        ) : null}

        {error ? <p className="text-sm text-red-500">{error}</p> : null}
      </div>
    </main>
  )
}
