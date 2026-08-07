'use client'

import { useCallback, useEffect, useState } from 'react'
import { operationalRoleLabel } from '@/Lib/agenda/operationalRoles'
import { glassBtn } from '@/Lib/liquidGlass'

type Summary = {
  confirmed: number
  pending: number
  declined: number
  cancelled: number
}

type Share = {
  person_id: string
  role_key: string
  phone: string | null
  whatsappText: string
  confirmUrl: string
  confirmation_id: string
}

type Confirmation = {
  id: string
  person_id: string
  role_key: string
  status: string
}

export default function OrderTeamConfirmationsPanel({
  orderId,
  canManage,
}: {
  orderId: string
  canManage: boolean
}) {
  const [summary, setSummary] = useState<Summary | null>(null)
  const [confirmations, setConfirmations] = useState<Confirmation[]>([])
  const [shares, setShares] = useState<Share[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [alert, setAlert] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/orders/${orderId}/team-confirmations`, {
      cache: 'no-store',
    })
    const json = (await res.json()) as {
      data?: {
        summary?: Summary | null
        confirmations?: Confirmation[]
        event?: { id: string } | null
      }
      error?: string
    }
    if (!res.ok) {
      setError(json.error || 'Falha ao carregar escala')
      return
    }
    setSummary(json.data?.summary ?? null)
    setConfirmations(json.data?.confirmations ?? [])
    if (!json.data?.event) setAlert('SEM EQUIPE')
    else if (!(json.data.confirmations ?? []).length) setAlert('EQUIPE INCOMPLETA')
    else if ((json.data.summary?.declined ?? 0) > 0) setAlert('INTEGRANTE RECUSOU')
    else if ((json.data.summary?.pending ?? 0) > 0) setAlert('AGUARDANDO CONFIRMAÇÕES')
    else if ((json.data.summary?.confirmed ?? 0) > 0) setAlert('EQUIPE CONFIRMADA')
    else setAlert(null)
  }, [orderId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  async function sendScale() {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/orders/${orderId}/team-confirmations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const json = (await res.json()) as {
        data?: { shares?: Share[] }
        error?: string
      }
      if (!res.ok) {
        setError(json.error || 'Falha ao enviar escala')
        return
      }
      setShares(json.data?.shares ?? [])
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="liquid-glass-card space-y-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-cdl-fg">Equipe / Escala</h2>
        {canManage ? (
          <button
            type="button"
            className={glassBtn('primary')}
            disabled={busy}
            onClick={() => void sendScale()}
          >
            Enviar confirmações WhatsApp
          </button>
        ) : null}
      </div>

      {alert ? (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">{alert}</p>
      ) : null}

      {summary ? (
        <p className="text-sm text-cdl-muted">
          {summary.confirmed} confirmados · {summary.pending} aguardando ·{' '}
          {summary.declined} indisponíveis
        </p>
      ) : null}

      <ul className="space-y-1 text-sm">
        {confirmations.map((c) => (
          <li key={c.id} className="flex justify-between gap-2 border-b border-black/5 py-1">
            <span>
              {operationalRoleLabel(c.role_key, 'pt')} · {c.person_id.slice(0, 8)}…
            </span>
            <span className="font-medium">{c.status}</span>
          </li>
        ))}
      </ul>

      {shares.length ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase text-cdl-muted">
            Mensagens prontas (não enviadas automaticamente)
          </p>
          {shares.map((s) => (
            <div key={s.confirmation_id || s.person_id + s.role_key} className="rounded-md bg-black/5 p-2 text-xs">
              <p className="font-medium">
                {operationalRoleLabel(s.role_key, 'pt')} · {s.phone || 'sem telefone'}
              </p>
              <a
                className="text-[var(--brand-primary)] underline"
                href={
                  s.phone
                    ? `https://wa.me/${s.phone.replace(/\D/g, '')}?text=${encodeURIComponent(s.whatsappText)}`
                    : s.confirmUrl
                }
                target="_blank"
                rel="noreferrer"
              >
                Abrir WhatsApp / link
              </a>
            </div>
          ))}
        </div>
      ) : null}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </section>
  )
}
