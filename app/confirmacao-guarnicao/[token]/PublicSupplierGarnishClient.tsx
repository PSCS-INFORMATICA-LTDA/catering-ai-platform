'use client'

import { useState } from 'react'

type OrderInfo = {
  service_order_number?: string | null
  event_date?: string | null
  start_time?: string | null
  end_time?: string | null
  pickup_time?: string | null
  address?: string | null
  team_name?: string | null
  supplier_name?: string | null
  guest_count?: number | null
  package_label?: string | null
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

export default function PublicSupplierGarnishClient({
  token,
  companyName,
  initialResponse,
  canRespond,
  order,
}: {
  token: string
  companyName: string
  initialResponse: string
  canRespond: boolean
  order: OrderInfo
}) {
  const [response, setResponse] = useState(initialResponse)
  const [allowed, setAllowed] = useState(canRespond)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function confirm() {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/public/confirmacao-guarnicao/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'confirm' }),
      })
      const json = (await res.json()) as {
        data?: { supplier_garnish_response?: string }
        error?: string
      }
      if (!res.ok) throw new Error(json.error ?? 'Falha ao confirmar')
      setResponse(json.data?.supplier_garnish_response ?? 'confirmed')
      setAllowed(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro')
    } finally {
      setBusy(false)
    }
  }

  const statusLabel =
    response === 'confirmed'
      ? 'Recebimento confirmado. Obrigado!'
      : 'Aguardando confirmação de recebimento do pedido.'

  return (
    <main className="mx-auto min-h-screen max-w-lg bg-cdl-bg px-4 py-10 text-cdl-fg">
      <div className="liquid-glass-card space-y-5 p-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-cdl-muted">
            Pedido de guarnição
          </p>
          <h1 className="mt-1 text-2xl font-bold text-red-600">
            {companyName || 'BBQ At Home'}
          </h1>
          <p className="mt-1 text-sm text-cdl-muted">
            OS {order.service_order_number || '—'}
          </p>
        </div>

        <dl className="grid gap-3 text-sm">
          {order.supplier_name ? (
            <div>
              <dt className="text-cdl-muted">Fornecedor</dt>
              <dd className="font-semibold">{order.supplier_name}</dd>
            </div>
          ) : null}
          <div>
            <dt className="text-cdl-muted">Data do evento</dt>
            <dd className="font-semibold">{formatDate(order.event_date)}</dd>
          </div>
          <div>
            <dt className="text-cdl-muted">Horário de retirada</dt>
            <dd className="text-lg font-bold text-red-600">
              {formatTime(order.pickup_time)}
            </dd>
          </div>
          <div>
            <dt className="text-cdl-muted">Horário do evento</dt>
            <dd className="font-semibold">
              {formatTime(order.start_time)} – {formatTime(order.end_time)}
            </dd>
          </div>
          {order.team_name ? (
            <div>
              <dt className="text-cdl-muted">Equipe</dt>
              <dd className="font-semibold">{order.team_name}</dd>
            </div>
          ) : null}
          {order.guest_count != null ? (
            <div>
              <dt className="text-cdl-muted">Convidados</dt>
              <dd className="font-semibold">{order.guest_count}</dd>
            </div>
          ) : null}
          {order.package_label ? (
            <div>
              <dt className="text-cdl-muted">Pacote</dt>
              <dd className="font-semibold">{order.package_label}</dd>
            </div>
          ) : null}
          {order.address ? (
            <div>
              <dt className="text-cdl-muted">Local</dt>
              <dd className="font-semibold">{order.address}</dd>
            </div>
          ) : null}
        </dl>

        <p className="text-sm text-cdl-muted">{statusLabel}</p>

        {allowed ? (
          <button
            type="button"
            disabled={busy}
            className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            onClick={() => void confirm()}
          >
            Confirmar recebimento
          </button>
        ) : null}

        {error ? <p className="text-sm text-red-500">{error}</p> : null}
      </div>
    </main>
  )
}
