'use client'

import { useState } from 'react'
import { operationalRoleLabel } from '@/Lib/agenda/operationalRoles'
import { glassBtn } from '@/Lib/liquidGlass'

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
}: {
  token: string
  companyName: string
  initialStatus: string
  canRespond: boolean
  confirmation: Assignment
}) {
  const [status, setStatus] = useState(initialStatus)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const role = operationalRoleLabel(confirmation.role_key, 'pt')

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
        setError(data.error || 'Não foi possível registrar a resposta.')
        return
      }
      setStatus(data.status || response)
    } catch {
      setError('Falha de rede. Tente novamente.')
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
        <h1 className="text-2xl font-bold text-cdl-fg">Confirmação de escala</h1>
        <dl className="space-y-2 text-sm text-cdl-fg">
          <div>
            <dt className="text-cdl-muted">Data</dt>
            <dd className="font-medium">{confirmation.event_date}</dd>
          </div>
          <div>
            <dt className="text-cdl-muted">Horário</dt>
            <dd className="font-medium">
              {fmtTime(confirmation.start_time)}–{fmtTime(confirmation.end_time)}
            </dd>
          </div>
          <div>
            <dt className="text-cdl-muted">Evento</dt>
            <dd className="font-medium">{confirmation.event_title}</dd>
          </div>
          <div>
            <dt className="text-cdl-muted">Local</dt>
            <dd className="font-medium">{confirmation.location || '—'}</dd>
          </div>
          <div>
            <dt className="text-cdl-muted">Equipe</dt>
            <dd className="font-medium">{confirmation.team_name}</dd>
          </div>
          <div>
            <dt className="text-cdl-muted">Função</dt>
            <dd className="font-medium">{role}</dd>
          </div>
          <div>
            <dt className="text-cdl-muted">Integrante</dt>
            <dd className="font-medium">{confirmation.person_name}</dd>
          </div>
        </dl>

        {status === 'confirmed' ? (
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            Participação confirmada. Obrigado!
          </p>
        ) : null}
        {status === 'declined' ? (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Indisponibilidade registrada.
          </p>
        ) : null}
        {status === 'cancelled' ? (
          <p className="rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-700">
            Este convite foi cancelado.
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
              Confirmar participação
            </button>
            <button
              type="button"
              disabled={busy}
              className={glassBtn('ghost')}
              onClick={() => void respond('declined')}
            >
              Não posso participar
            </button>
          </div>
        ) : null}

        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </div>
    </main>
  )
}
