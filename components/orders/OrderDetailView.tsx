'use client'

import Link from 'next/link'
import { useCallback, useState } from 'react'
import {
  checklistCategoryLabel,
  orderStatusLabel,
  tQuotesOrders,
} from '@/Lib/i18n/quotesOrders'
import { useAuthLocaleFromMe } from '@/Lib/i18n/useAuthLocaleFromMe'
import { resolveCatalogItemDisplayLabel } from '@/Lib/cdlPackageItemI18n'
import { toBcp47Locale } from '@/Lib/i18n/locales'
import { glassBtn, glassField } from '@/Lib/liquidGlass'
import type { ServiceOrderDetail } from '@/Lib/orders/fetchServiceOrderDetail'
import {
  nextServiceOrderStatuses,
  serviceOrderStatusRequiresReason,
} from '@/Lib/orders/statusMachine'
import OrderMaterialsPanel from '@/components/orders/OrderMaterialsPanel'
import OrderTeamConfirmationsPanel from '@/components/orders/OrderTeamConfirmationsPanel'
import SupplierGarnishSharePanel from '@/components/orders/SupplierGarnishSharePanel'

function formatMoney(value: number | null | undefined) {
  if (value == null) return '—'
  return `$${Number(value).toFixed(2)}`
}

function formatDate(
  value: string | null | undefined,
  locale?: string | null,
) {
  if (!value) return '—'
  const normalized = value.includes('T') ? value : `${value}T00:00:00`
  const date = new Date(normalized)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString(toBcp47Locale(locale), {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

function formatDateTime(
  value: string | null | undefined,
  locale?: string | null,
) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString(toBcp47Locale(locale))
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
  canViewFinancial = false,
  canMaterialsView = false,
  canMaterialsPrepare = false,
  canMaterialsCheck = false,
  canMaterialsDispatch = false,
  canMaterialsReturn = false,
}: {
  initialOrder: ServiceOrderDetail
  canManage: boolean
  /** Totais/preços — não exibir para operação/equipe. */
  canViewFinancial?: boolean
  canMaterialsView?: boolean
  canMaterialsPrepare?: boolean
  canMaterialsCheck?: boolean
  canMaterialsDispatch?: boolean
  canMaterialsReturn?: boolean
}) {
  const locale = useAuthLocaleFromMe()
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
      setError(tQuotesOrders(locale, 'cancelReasonRequired'))
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
      if (!response.ok) {
        throw new Error(result.error ?? tQuotesOrders(locale, 'updateStatusError'))
      }
      setHint(tQuotesOrders(locale, 'statusUpdatedHint'))
      setNextStatus('')
      setCancelReason('')
      await refresh()
    } catch (statusError) {
      setError(
        statusError instanceof Error
          ? statusError.message
          : tQuotesOrders(locale, 'updateStatusError'),
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
      if (!response.ok) {
        throw new Error(result.error ?? tQuotesOrders(locale, 'checklistUpdateError'))
      }
      await refresh()
    } catch (checklistError) {
      setError(
        checklistError instanceof Error
          ? checklistError.message
          : tQuotesOrders(locale, 'checklistUpdateError'),
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
      if (!response.ok) {
        throw new Error(result.error ?? tQuotesOrders(locale, 'checklistAddError'))
      }
      setNewChecklistTitle('')
      await refresh()
    } catch (addError) {
      setError(
        addError instanceof Error
          ? addError.message
          : tQuotesOrders(locale, 'checklistAddError'),
      )
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
            ← {tQuotesOrders(locale, 'ordersTitle')}
          </Link>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-[var(--brand-primary)] sm:text-3xl">
            {order.service_order_number}
          </h1>
          <p className="text-sm text-neutral-500">
            {order.customer_name}
            {order.quote_number
              ? ` · ${tQuotesOrders(locale, 'linkedQuote')} ${order.quote_number}`
              : ''}
          </p>
        </div>
        <span className="inline-flex items-center rounded-full border border-cdl-accent-border bg-cdl-accent/15 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-cdl-brand">
          {orderStatusLabel(order.status, locale)}
        </span>
      </div>

      <div
        className={`grid gap-4 ${canViewFinancial ? 'lg:grid-cols-3' : ''}`}
      >
        <section
          className={`liquid-glass-card space-y-3 p-5 ${canViewFinancial ? 'lg:col-span-2' : ''}`}
        >
          <h2 className="text-lg font-bold text-cdl-fg">
            {tQuotesOrders(locale, 'eventSection')}
          </h2>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-cdl-muted">{tQuotesOrders(locale, 'docDateLabel')}</dt>
              <dd className="font-medium text-cdl-fg">
                {formatDate(order.event_date, locale)}
              </dd>
            </div>
            <div>
              <dt className="text-cdl-muted">{tQuotesOrders(locale, 'timeLabel')}</dt>
              <dd className="font-medium text-cdl-fg">
                {formatTime(order.start_time)} – {formatTime(order.end_time)}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-cdl-muted">{tQuotesOrders(locale, 'locationLabel')}</dt>
              <dd className="font-medium text-cdl-fg">
                {[order.venue_name, order.address_line, order.city, order.state]
                  .filter(Boolean)
                  .join(', ') || '—'}
              </dd>
            </div>
            <div>
              <dt className="text-cdl-muted">{tQuotesOrders(locale, 'guestCount')}</dt>
              <dd className="font-medium text-cdl-fg">
                {order.billable_guest_count ?? order.physical_guest_count ?? '—'}
              </dd>
            </div>
            {order.agenda_event || order.team_name ? (
              <div>
                <dt className="text-cdl-muted">
                  {tQuotesOrders(locale, 'teamDesignatedField')}
                </dt>
                <dd className="font-medium text-cdl-fg">
                  {order.team_name ||
                    (order.agenda_event?.team_id
                      ? tQuotesOrders(locale, 'viewInAgenda')
                      : '—')}
                </dd>
              </div>
            ) : null}
          </dl>
        </section>

        {canViewFinancial ? (
          <section className="liquid-glass-card space-y-2 p-5">
            <h2 className="text-lg font-bold text-cdl-fg">
              {tQuotesOrders(locale, 'financialSection')}
            </h2>
            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-cdl-muted">
                  {tQuotesOrders(locale, 'packageLabel')}
                </dt>
                <dd className="font-medium text-cdl-fg">
                  {formatMoney(order.package_total)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-cdl-muted">
                  {tQuotesOrders(locale, 'additionalsLabel')}
                </dt>
                <dd className="font-medium text-cdl-fg">
                  {formatMoney(order.additional_total)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-cdl-muted">
                  {tQuotesOrders(locale, 'mileageLabel')}
                </dt>
                <dd className="font-medium text-cdl-fg">
                  {formatMoney(order.mileage_fee)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-cdl-muted">
                  {tQuotesOrders(locale, 'reservationLabel')}
                </dt>
                <dd className="font-medium text-cdl-fg">
                  {formatMoney(order.reservation_amount)}
                </dd>
              </div>
              <div className="flex justify-between border-t border-cdl-border pt-1.5 text-base font-black">
                <dt>{tQuotesOrders(locale, 'total')}</dt>
                <dd>{formatMoney(order.service_order_total)}</dd>
              </div>
            </dl>
          </section>
        ) : null}
      </div>

      {order.has_garnish_order || (order.garnish_items?.length ?? 0) > 0 ? (
        <SupplierGarnishSharePanel
          orderId={order.id}
          orderNumber={order.service_order_number}
          eventDate={order.event_date}
          eventStartTime={order.start_time}
          eventEndTime={order.end_time}
          teamName={order.team_name}
          garnishItems={order.garnish_items ?? []}
          guestCount={order.billable_guest_count ?? order.physical_guest_count}
          adultCount={order.adult_count}
          hasGarnish={order.has_garnish_order}
          garnishKitConfig={order.supplier_garnish_kit_config}
          language={locale}
        />
      ) : null}

      <OrderTeamConfirmationsPanel orderId={order.id} canManage={canManage} />

      <section className="liquid-glass-card space-y-3 p-5">
        <h2 className="text-lg font-bold text-cdl-fg">
          {tQuotesOrders(locale, 'commercialItemsSection')}
        </h2>
        {order.items.length === 0 ? (
          <p className="text-sm text-cdl-muted">
            {tQuotesOrders(locale, 'commercialItemsEmpty')}
          </p>
        ) : (
          <ul className="divide-y divide-cdl-border text-sm">
            {order.items.map((item) => (
              <li key={item.id} className="py-2">
                <p className="font-medium text-cdl-fg">
                  {resolveCatalogItemDisplayLabel(
                    {
                      pt: item.label_pt,
                      en: item.label_en,
                      es: item.label_es,
                    },
                    locale,
                  ) || item.label_pt}
                </p>
                <p className="text-xs text-cdl-muted">
                  {item.item_type === 'package'
                    ? tQuotesOrders(locale, 'commercialItemPackage')
                    : item.item_type === 'additional'
                      ? tQuotesOrders(locale, 'commercialItemAdditional')
                      : item.item_type}
                  {item.quantity != null ? ` · qty ${item.quantity}` : ''}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {canManage ? (
        <section className="liquid-glass-card space-y-3 p-5">
          <h2 className="text-lg font-bold text-cdl-fg">
            {tQuotesOrders(locale, 'statusChangeSection')}
          </h2>
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-cdl-muted">
                {tQuotesOrders(locale, 'newStatusLabel')}
              </span>
              <select
                className={glassField()}
                value={nextStatus}
                onChange={(e) => setNextStatus(e.target.value)}
                disabled={availableTransitions.length === 0}
              >
                <option value="">{tQuotesOrders(locale, 'selectPlaceholder')}</option>
                {availableTransitions.map((status) => (
                  <option key={status} value={status}>
                    {orderStatusLabel(status, locale)}
                  </option>
                ))}
              </select>
            </label>
            {serviceOrderStatusRequiresReason(nextStatus) ? (
              <label className="flex flex-1 flex-col gap-1.5">
                <span className="text-xs font-medium text-cdl-muted">
                  {tQuotesOrders(locale, 'cancelReasonLabel')}
                </span>
                <input
                  className={glassField()}
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder={tQuotesOrders(locale, 'cancelReasonPlaceholder')}
                />
              </label>
            ) : null}
            <button
              type="button"
              className={glassBtn('primary')}
              disabled={busy || !nextStatus}
              onClick={() => void handleStatusChange()}
            >
              {busy
                ? tQuotesOrders(locale, 'updating')
                : tQuotesOrders(locale, 'updateStatusAction')}
            </button>
          </div>
        </section>
      ) : null}

      {canMaterialsView ? (
        <OrderMaterialsPanel
          orderId={order.id}
          canPrepare={canMaterialsPrepare}
          canCheck={canMaterialsCheck}
          canDispatch={canMaterialsDispatch}
          canReturn={canMaterialsReturn}
        />
      ) : null}

      <section className="liquid-glass-card space-y-3 p-5">
        <h2 className="text-lg font-bold text-cdl-fg">
          {tQuotesOrders(locale, 'checklist')}
        </h2>
        {order.checklist.length === 0 ? (
          <p className="text-sm text-cdl-muted">
            {tQuotesOrders(locale, 'checklistEmpty')}
          </p>
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
                    {checklistCategoryLabel(item.category, locale)}
                    {item.is_required
                      ? ` · ${tQuotesOrders(locale, 'requiredSuffix')}`
                      : ''}
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
                        {tQuotesOrders(locale, 'markDone')}
                      </button>
                    ) : (
                      <button
                        type="button"
                        className={glassBtn('ghost')}
                        disabled={busy}
                        onClick={() => void handleChecklistToggle(item.id, 'pending')}
                      >
                        {tQuotesOrders(locale, 'markPending')}
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
              placeholder={tQuotesOrders(locale, 'newChecklistItemPlaceholder')}
            />
            <button
              type="button"
              className={glassBtn('secondary')}
              disabled={busy || !newChecklistTitle.trim()}
              onClick={() => void handleAddChecklistItem()}
            >
              {tQuotesOrders(locale, 'addAction')}
            </button>
          </div>
        ) : null}
      </section>

      {order.status_history.length > 0 ? (
        <section className="liquid-glass-card space-y-2 p-5">
          <h2 className="text-lg font-bold text-cdl-fg">
            {tQuotesOrders(locale, 'statusHistorySection')}
          </h2>
          <ul className="space-y-1.5 text-sm">
            {order.status_history.map((entry) => (
              <li key={entry.id} className="flex items-center justify-between gap-2">
                <span className="text-cdl-fg">
                  {entry.from_status
                    ? `${orderStatusLabel(entry.from_status, locale)} → `
                    : ''}
                  {orderStatusLabel(entry.to_status, locale)}
                  {entry.reason ? ` (${entry.reason})` : ''}
                </span>
                <span className="text-xs text-cdl-muted">
                  {formatDateTime(entry.created_at, locale)}
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
