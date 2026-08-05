'use client'

import Link from 'next/link'
import { useCallback, useState } from 'react'
import { checklistCategoryLabel, orderStatusLabel } from '@/Lib/i18n/quotesOrders'
import { glassBtn, glassField } from '@/Lib/liquidGlass'
import type { ServiceOrderDetail } from '@/Lib/orders/fetchServiceOrderDetail'
import {
  nextServiceOrderStatuses,
  serviceOrderStatusRequiresReason,
} from '@/Lib/orders/statusMachine'

function formatMoney(value: number | null | undefined) {
  if (value == null) return '—'
  return `$${Number(value).toFixed(2)}`
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  const normalized = value.includes('T') ? value : `${value}T00:00:00`
  const date = new Date(normalized)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('pt-BR')
}

function formatTime(value: string | null | undefined) {
  if (!value) return '—'
  const parts = value.split(':')
  if (parts.length < 2) return value
  return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`
}

export default function OrderDetailView({
  initialOrder,
  canManage,
}: {
  initialOrder: ServiceOrderDetail
  canManage: boolean
}) {
  const [order, setOrder] = useState(initialOrder)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hint, setHint] = useState<string | null>(null)
  const [nextStatus, setNextStatus] = useState('')
  const [cancelReason, setCancelReason] = useState('')
  const [newChecklistTitle, setNewChecklistTitle] = useState('')

  const refresh = useCallback(async () => {
    const response = await fetch(`/api/orders/${order.id}`, { cache: 'no-store' })
    const result = (await response.json()) as { data?: ServiceOrderDetail }
    if (response.ok && result.data) setOrder(result.data)
  }, [order.id])

  async function handleStatusChange() {
    if (!nextStatus) return
    if (serviceOrderStatusRequiresReason(nextStatus) && !cancelReason.trim()) {
      setError('Informe o motivo do cancelamento.')
      return
    }
    setBusy(true)
    setError(null)
    setHint(null)
    try {
      const response = await fetch(`/api/orders/${order.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: nextStatus,
          cancel_reason: cancelReason.trim() || undefined,
        }),
      })
      const result = (await response.json()) as {
        data?: ServiceOrderDetail
        error?: string
      }
      if (!response.ok) throw new Error(result.error ?? 'Falha ao atualizar status.')
      setHint('Status atualizado.')
      setNextStatus('')
      setCancelReason('')
      await refresh()
    } catch (statusError) {
      setError(
        statusError instanceof Error ? statusError.message : 'Falha ao atualizar status.',
      )
    } finally {
      setBusy(false)
    }
  }

  async function handleChecklistToggle(itemId: string, status: string) {
    setBusy(true)
    setError(null)
    try {
      const response = await fetch(`/api/orders/${order.id}/checklist`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_id: itemId, status }),
      })
      const result = (await response.json()) as { error?: string }
      if (!response.ok) throw new Error(result.error ?? 'Falha ao atualizar item.')
      await refresh()
    } catch (checklistError) {
      setError(
        checklistError instanceof Error
          ? checklistError.message
          : 'Falha ao atualizar item.',
      )
    } finally {
      setBusy(false)
    }
  }

  async function handleAddChecklistItem() {
    const title = newChecklistTitle.trim()
    if (!title) return
    setBusy(true)
    setError(null)
    try {
      const response = await fetch(`/api/orders/${order.id}/checklist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      })
      const result = (await response.json()) as { error?: string }
      if (!response.ok) throw new Error(result.error ?? 'Falha ao adicionar item.')
      setNewChecklistTitle('')
      await refresh()
    } catch (addError) {
      setError(addError instanceof Error ? addError.message : 'Falha ao adicionar item.')
    } finally {
      setBusy(false)
    }
  }

  const availableTransitions = nextServiceOrderStatuses(order.status)

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-6 sm:px-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            href="/orders"
            className="text-xs font-bold uppercase tracking-wider text-[var(--brand-primary-2)] hover:underline"
          >
            ← Ordens de Serviço
          </Link>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-[var(--brand-primary)] sm:text-3xl">
            {order.service_order_number}
          </h1>
          <p className="text-sm text-neutral-500">
            {order.customer_name}
            {order.quote_number ? ` · Cotação ${order.quote_number}` : ''}
          </p>
        </div>
        <span className="inline-flex items-center rounded-full border border-cdl-accent-border bg-cdl-accent/15 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-cdl-brand">
          {orderStatusLabel(order.status)}
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="liquid-glass-card space-y-3 p-5 lg:col-span-2">
          <h2 className="text-lg font-bold text-cdl-fg">Evento</h2>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-cdl-muted">Data</dt>
              <dd className="font-medium text-cdl-fg">{formatDate(order.event_date)}</dd>
            </div>
            <div>
              <dt className="text-cdl-muted">Horário</dt>
              <dd className="font-medium text-cdl-fg">
                {formatTime(order.start_time)} – {formatTime(order.end_time)}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-cdl-muted">Local</dt>
              <dd className="font-medium text-cdl-fg">
                {[order.venue_name, order.address_line, order.city, order.state]
                  .filter(Boolean)
                  .join(', ') || '—'}
              </dd>
            </div>
            <div>
              <dt className="text-cdl-muted">Convidados</dt>
              <dd className="font-medium text-cdl-fg">
                {order.billable_guest_count ?? order.physical_guest_count ?? '—'}
              </dd>
            </div>
            {order.agenda_event ? (
              <div>
                <dt className="text-cdl-muted">Equipe designada</dt>
                <dd className="font-medium text-cdl-fg">
                  {order.agenda_event.team_id ? 'Ver na Agenda' : '—'}
                </dd>
              </div>
            ) : null}
          </dl>
        </section>

        <section className="liquid-glass-card space-y-2 p-5">
          <h2 className="text-lg font-bold text-cdl-fg">Financeiro</h2>
          <dl className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-cdl-muted">Pacote</dt>
              <dd className="font-medium text-cdl-fg">{formatMoney(order.package_total)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-cdl-muted">Adicionais</dt>
              <dd className="font-medium text-cdl-fg">
                {formatMoney(order.additional_total)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-cdl-muted">Milhagem</dt>
              <dd className="font-medium text-cdl-fg">{formatMoney(order.mileage_fee)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-cdl-muted">Reserva</dt>
              <dd className="font-medium text-cdl-fg">
                {formatMoney(order.reservation_amount)}
              </dd>
            </div>
            <div className="flex justify-between border-t border-cdl-border pt-1.5 text-base font-black">
              <dt>Total</dt>
              <dd>{formatMoney(order.service_order_total)}</dd>
            </div>
          </dl>
        </section>
      </div>

      {canManage ? (
        <section className="liquid-glass-card space-y-3 p-5">
          <h2 className="text-lg font-bold text-cdl-fg">Alterar status</h2>
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-cdl-muted">Novo status</span>
              <select
                className={glassField()}
                value={nextStatus}
                onChange={(e) => setNextStatus(e.target.value)}
                disabled={availableTransitions.length === 0}
              >
                <option value="">Selecione…</option>
                {availableTransitions.map((status) => (
                  <option key={status} value={status}>
                    {orderStatusLabel(status)}
                  </option>
                ))}
              </select>
            </label>
            {serviceOrderStatusRequiresReason(nextStatus) ? (
              <label className="flex flex-1 flex-col gap-1.5">
                <span className="text-xs font-medium text-cdl-muted">
                  Motivo do cancelamento *
                </span>
                <input
                  className={glassField()}
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Motivo"
                />
              </label>
            ) : null}
            <button
              type="button"
              className={glassBtn('primary')}
              disabled={busy || !nextStatus}
              onClick={() => void handleStatusChange()}
            >
              {busy ? 'Atualizando…' : 'Atualizar status'}
            </button>
          </div>
        </section>
      ) : null}

      <section className="liquid-glass-card space-y-3 p-5">
        <h2 className="text-lg font-bold text-cdl-fg">Checklist</h2>
        {order.checklist.length === 0 ? (
          <p className="text-sm text-cdl-muted">Nenhum item de checklist.</p>
        ) : (
          <ul className="space-y-2">
            {order.checklist.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-cdl-border bg-cdl-inset px-3 py-2"
              >
                <div>
                  <p
                    className={`text-sm font-medium ${item.status === 'done' ? 'text-cdl-muted line-through' : 'text-cdl-fg'}`}
                  >
                    {item.title}
                  </p>
                  <p className="text-xs text-cdl-muted">
                    {checklistCategoryLabel(item.category)}
                    {item.is_required ? ' · obrigatório' : ''}
                  </p>
                </div>
                {canManage ? (
                  <div className="flex gap-1.5">
                    {item.status !== 'done' ? (
                      <button
                        type="button"
                        className={glassBtn('secondary')}
                        disabled={busy}
                        onClick={() => void handleChecklistToggle(item.id, 'done')}
                      >
                        Concluir
                      </button>
                    ) : (
                      <button
                        type="button"
                        className={glassBtn('ghost')}
                        disabled={busy}
                        onClick={() => void handleChecklistToggle(item.id, 'pending')}
                      >
                        Reabrir
                      </button>
                    )}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {canManage ? (
          <div className="flex gap-2">
            <input
              className={glassField()}
              value={newChecklistTitle}
              onChange={(e) => setNewChecklistTitle(e.target.value)}
              placeholder="Novo item de checklist"
            />
            <button
              type="button"
              className={glassBtn('secondary')}
              disabled={busy || !newChecklistTitle.trim()}
              onClick={() => void handleAddChecklistItem()}
            >
              Adicionar
            </button>
          </div>
        ) : null}
      </section>

      {order.status_history.length > 0 ? (
        <section className="liquid-glass-card space-y-2 p-5">
          <h2 className="text-lg font-bold text-cdl-fg">Histórico de status</h2>
          <ul className="space-y-1.5 text-sm">
            {order.status_history.map((entry) => (
              <li key={entry.id} className="flex items-center justify-between gap-2">
                <span className="text-cdl-fg">
                  {entry.from_status ? `${orderStatusLabel(entry.from_status)} → ` : ''}
                  {orderStatusLabel(entry.to_status)}
                  {entry.reason ? ` (${entry.reason})` : ''}
                </span>
                <span className="text-xs text-cdl-muted">
                  {formatDateTime(entry.created_at)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {hint ? <p className="text-sm text-emerald-700">{hint}</p> : null}
      {error ? <p className="text-sm text-red-500">{error}</p> : null}
    </div>
  )
}
