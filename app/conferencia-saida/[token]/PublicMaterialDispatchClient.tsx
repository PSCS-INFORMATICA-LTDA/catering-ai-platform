'use client'

import { useMemo, useState } from 'react'

type MaterialLine = {
  id: string
  description_snapshot: string
  material_type: string
  unit: string
  required_quantity: number
  separated_quantity: number
  checked_quantity: number
  dispatched_quantity: number
  status: string
}

type DispatchInfo = {
  service_order_number?: string
  event_date?: string
  start_time?: string | null
  end_time?: string | null
  venue_name?: string | null
  address_line?: string | null
  city?: string | null
  state?: string | null
  team_name?: string | null
  leader_name?: string | null
  materials?: MaterialLine[]
}

export default function PublicMaterialDispatchClient({
  token,
  companyName,
  initialStatus,
  canConfirm,
  dispatch,
}: {
  token: string
  companyName: string
  initialStatus: string
  canConfirm: boolean
  dispatch: DispatchInfo
}) {
  const materials = dispatch.materials ?? []
  const [status, setStatus] = useState(initialStatus)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(initialStatus === 'confirmed')
  const [qtys, setQtys] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    for (const m of materials) {
      init[m.id] = String(m.checked_quantity ?? 0)
    }
    return init
  })

  const location = useMemo(
    () =>
      [dispatch.address_line, dispatch.city, dispatch.state]
        .filter(Boolean)
        .join(', ') ||
      dispatch.venue_name ||
      '—',
    [dispatch],
  )

  async function confirm() {
    setBusy(true)
    setError(null)
    try {
      const lines = materials.map((m) => ({
        id: m.id,
        dispatched_quantity: Number(qtys[m.id] ?? m.checked_quantity ?? 0),
        justification:
          Number(qtys[m.id] ?? 0) !== Number(m.checked_quantity)
            ? 'Ajuste na retirada'
            : undefined,
      }))
      const res = await fetch(`/api/public/conferencia-saida/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lines }),
      })
      const json = (await res.json()) as {
        ok?: boolean
        error?: string
        status?: string
        idempotent?: boolean
      }
      if (!json.ok) {
        setError(
          json.error === 'divergence_requires_justification'
            ? 'Há divergência — solicite ajuste à operação.'
            : json.error === 'expired'
              ? 'Link expirado.'
              : json.error || 'Falha ao confirmar.',
        )
        return
      }
      setStatus(json.status || 'confirmed')
      setDone(true)
    } finally {
      setBusy(false)
    }
  }

  const start = (dispatch.start_time || '').slice(0, 5)
  const end = (dispatch.end_time || '').slice(0, 5)

  return (
    <main className="mx-auto min-h-screen max-w-lg px-4 py-6">
      <div className="space-y-4">
        <header className="liquid-glass-card space-y-1 p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-cdl-muted">
            {companyName}
          </p>
          <h1 className="text-xl font-black text-cdl-fg">
            Conferência de saída
          </h1>
          <p className="text-sm text-cdl-muted">
            {dispatch.service_order_number}
            {dispatch.leader_name ? ` · ${dispatch.leader_name}` : ''}
          </p>
          <dl className="mt-3 grid gap-1 text-sm text-cdl-fg">
            <div>
              <span className="text-cdl-muted">Data: </span>
              {dispatch.event_date || '—'}
            </div>
            <div>
              <span className="text-cdl-muted">Horário: </span>
              {start && end ? `${start}–${end}` : '—'}
            </div>
            <div>
              <span className="text-cdl-muted">Local: </span>
              {location}
            </div>
            <div>
              <span className="text-cdl-muted">Equipe: </span>
              {dispatch.team_name || '—'}
            </div>
          </dl>
        </header>

        {done || status === 'confirmed' ? (
          <div className="liquid-glass-card p-6 text-center">
            <h2 className="text-lg font-bold text-emerald-700">
              Retirada confirmada
            </h2>
            <p className="mt-2 text-sm text-cdl-muted">
              Materiais registrados como saída. Bom evento!
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {materials.map((m) => (
                <article
                  key={m.id}
                  className="liquid-glass-card space-y-2 p-4"
                >
                  <h2 className="font-bold text-cdl-fg">
                    {m.description_snapshot}
                  </h2>
                  <p className="text-xs text-cdl-muted">
                    Unidade: {m.unit} · Conferido: {m.checked_quantity}
                  </p>
                  <label className="block space-y-1">
                    <span className="text-xs font-medium text-cdl-muted">
                      Qtd a retirar
                    </span>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      disabled={!canConfirm || busy}
                      className="w-full rounded-xl border border-cdl-border bg-white px-3 py-3 text-base text-cdl-fg"
                      value={qtys[m.id] ?? ''}
                      onChange={(e) =>
                        setQtys((prev) => ({
                          ...prev,
                          [m.id]: e.target.value,
                        }))
                      }
                    />
                  </label>
                </article>
              ))}
            </div>

            {error ? (
              <p className="text-sm font-medium text-red-600">{error}</p>
            ) : null}

            <button
              type="button"
              disabled={!canConfirm || busy || materials.length === 0}
              onClick={() => void confirm()}
              className="w-full rounded-2xl bg-[#E85D04] px-4 py-4 text-base font-black text-white disabled:opacity-50"
            >
              {busy ? 'Confirmando…' : 'CONFIRMAR RETIRADA'}
            </button>
          </>
        )}
      </div>
    </main>
  )
}
