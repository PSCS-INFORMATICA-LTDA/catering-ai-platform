'use client'

import { useMemo, useState } from 'react'
import { tQuotesOrders, type AuthLocale } from '@/Lib/i18n/quotesOrders'

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
  locale,
  companyName,
  initialStatus,
  canConfirm,
  dispatch,
}: {
  token: string
  locale: AuthLocale
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
            ? tQuotesOrders(locale, 'publicDispatchAdjustmentJustification')
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
            ? tQuotesOrders(locale, 'publicDispatchErrorDivergence')
            : json.error === 'expired'
              ? tQuotesOrders(locale, 'publicDispatchErrorExpired')
              : json.error || tQuotesOrders(locale, 'publicDispatchErrorGeneric'),
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
            {tQuotesOrders(locale, 'publicDispatchTitle')}
          </h1>
          <p className="text-sm text-cdl-muted">
            {dispatch.service_order_number}
            {dispatch.leader_name ? ` · ${dispatch.leader_name}` : ''}
          </p>
          <dl className="mt-3 grid gap-1 text-sm text-cdl-fg">
            <div>
              <span className="text-cdl-muted">
                {tQuotesOrders(locale, 'publicDispatchDate')}:{' '}
              </span>
              {dispatch.event_date || '—'}
            </div>
            <div>
              <span className="text-cdl-muted">
                {tQuotesOrders(locale, 'publicDispatchTime')}:{' '}
              </span>
              {start && end ? `${start}–${end}` : '—'}
            </div>
            <div>
              <span className="text-cdl-muted">
                {tQuotesOrders(locale, 'publicDispatchLocation')}:{' '}
              </span>
              {location}
            </div>
            <div>
              <span className="text-cdl-muted">
                {tQuotesOrders(locale, 'publicDispatchTeam')}:{' '}
              </span>
              {dispatch.team_name || '—'}
            </div>
          </dl>
        </header>

        {done || status === 'confirmed' ? (
          <div className="liquid-glass-card p-6 text-center">
            <h2 className="text-lg font-bold text-emerald-700">
              {tQuotesOrders(locale, 'publicDispatchPickupConfirmed')}
            </h2>
            <p className="mt-2 text-sm text-cdl-muted">
              {tQuotesOrders(locale, 'publicDispatchPickupConfirmedHint')}
            </p>
          </div>
        ) : (
          <>
            <p className="text-sm font-semibold text-cdl-fg">
              {tQuotesOrders(locale, 'publicDispatchMaterials')}
            </p>
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
                    {tQuotesOrders(locale, 'publicDispatchUnitLabel')}: {m.unit}{' '}
                    · {tQuotesOrders(locale, 'publicDispatchCheckedQty')}:{' '}
                    {m.checked_quantity}
                  </p>
                  <label className="block space-y-1">
                    <span className="text-xs font-medium text-cdl-muted">
                      {tQuotesOrders(locale, 'publicDispatchPickupQty')}
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
              className="w-full rounded-2xl bg-[#E85D04] px-4 py-4 text-base font-black uppercase text-white disabled:opacity-50"
            >
              {busy
                ? tQuotesOrders(locale, 'publicDispatchConfirming')
                : tQuotesOrders(locale, 'publicDispatchConfirmPickup')}
            </button>
          </>
        )}
      </div>
    </main>
  )
}
