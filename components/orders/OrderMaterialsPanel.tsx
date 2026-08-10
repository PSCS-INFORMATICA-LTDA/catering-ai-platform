'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  materialStatusLabel,
  materialTypeLabel,
  tQuotesOrders,
} from '@/Lib/i18n/quotesOrders'
import { useAuthLocaleFromMe } from '@/Lib/i18n/useAuthLocaleFromMe'
import { glassBtn, glassField } from '@/Lib/liquidGlass'
import type {
  MaterialStatus,
  MaterialType,
  ServiceOrderMaterialRow,
} from '@/Lib/orders/orderMaterials'
import { MATERIAL_TYPES } from '@/Lib/orders/orderMaterials'

function statusBadgeClass(status: MaterialStatus): string {
  switch (status) {
    case 'checked':
      return 'bg-emerald-50 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-100'
    case 'separated':
      return 'bg-sky-50 text-sky-800 dark:bg-sky-500/15 dark:text-sky-100'
    case 'partial':
      return 'bg-amber-50 text-amber-900 dark:bg-amber-500/15 dark:text-amber-100'
    case 'divergence':
      return 'bg-red-50 text-red-800 dark:bg-red-500/15 dark:text-red-100'
    case 'cancelled':
      return 'bg-neutral-100 text-neutral-600 dark:bg-white/10 dark:text-neutral-300'
    default:
      return 'bg-neutral-50 text-neutral-700 dark:bg-white/5 dark:text-neutral-200'
  }
}

export default function OrderMaterialsPanel({
  orderId,
  canPrepare,
  canCheck,
}: {
  orderId: string
  canPrepare: boolean
  canCheck: boolean
}) {
  const locale = useAuthLocaleFromMe()
  const [rows, setRows] = useState<ServiceOrderMaterialRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [draftSeparate, setDraftSeparate] = useState<Record<string, string>>({})
  const [draftCheck, setDraftCheck] = useState<Record<string, string>>({})
  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState({
    description_snapshot: '',
    material_type: 'consumable' as MaterialType,
    unit: 'unit',
    required_quantity: '1',
    notes: '',
  })

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/orders/${orderId}/materials`, { cache: 'no-store' })
    const json = (await res.json()) as {
      data?: ServiceOrderMaterialRow[]
      error?: string
    }
    if (!res.ok) {
      setError(json.error || 'Falha ao carregar materiais')
      return
    }
    setRows(json.data ?? [])
    setError(null)
  }, [orderId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  async function addMaterial() {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/orders/${orderId}/materials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_type: 'manual',
          description_snapshot: addForm.description_snapshot,
          material_type: addForm.material_type,
          unit: addForm.unit,
          required_quantity: Number(addForm.required_quantity),
          notes: addForm.notes || null,
        }),
      })
      const json = (await res.json()) as { error?: string }
      if (!res.ok) {
        setError(json.error || 'Falha ao adicionar')
        return
      }
      setShowAdd(false)
      setAddForm({
        description_snapshot: '',
        material_type: 'consumable',
        unit: 'unit',
        required_quantity: '1',
        notes: '',
      })
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  async function patchMaterial(
    materialId: string,
    body: Record<string, unknown>,
  ) {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/orders/${orderId}/materials/${materialId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      )
      const json = (await res.json()) as { error?: string }
      if (!res.ok) {
        setError(json.error || 'Falha ao atualizar')
        return
      }
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  const active = rows.filter((r) => r.status !== 'cancelled')

  return (
    <section className="liquid-glass-card space-y-3 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold text-cdl-fg">
          {tQuotesOrders(locale, 'materialsSection')}
        </h2>
        {canPrepare ? (
          <button
            type="button"
            className={glassBtn('primary')}
            disabled={busy}
            onClick={() => setShowAdd((v) => !v)}
          >
            {tQuotesOrders(locale, 'materialAdd')}
          </button>
        ) : null}
      </div>

      {showAdd ? (
        <div className="grid gap-2 rounded-lg border border-cdl-border p-3 sm:grid-cols-2">
          <label className="block space-y-1 sm:col-span-2">
            <span className="text-xs text-cdl-muted">
              {tQuotesOrders(locale, 'materialDescription')}
            </span>
            <input
              className={glassField()}
              value={addForm.description_snapshot}
              onChange={(e) =>
                setAddForm((f) => ({
                  ...f,
                  description_snapshot: e.target.value,
                }))
              }
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-cdl-muted">
              {tQuotesOrders(locale, 'materialTypeLabel')}
            </span>
            <select
              className={glassField()}
              value={addForm.material_type}
              onChange={(e) =>
                setAddForm((f) => ({
                  ...f,
                  material_type: e.target.value as MaterialType,
                }))
              }
            >
              {MATERIAL_TYPES.map((t) => (
                <option key={t} value={t}>
                  {materialTypeLabel(t, locale)}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-cdl-muted">
              {tQuotesOrders(locale, 'materialUnitLabel')}
            </span>
            <input
              className={glassField()}
              value={addForm.unit}
              onChange={(e) =>
                setAddForm((f) => ({ ...f, unit: e.target.value }))
              }
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-cdl-muted">
              {tQuotesOrders(locale, 'materialRequiredLabel')}
            </span>
            <input
              className={glassField()}
              type="number"
              min={0}
              step="any"
              value={addForm.required_quantity}
              onChange={(e) =>
                setAddForm((f) => ({
                  ...f,
                  required_quantity: e.target.value,
                }))
              }
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-cdl-muted">
              {tQuotesOrders(locale, 'materialNotes')}
            </span>
            <input
              className={glassField()}
              value={addForm.notes}
              onChange={(e) =>
                setAddForm((f) => ({ ...f, notes: e.target.value }))
              }
            />
          </label>
          <div className="flex items-end gap-2 sm:col-span-2">
            <button
              type="button"
              className={glassBtn('primary')}
              disabled={busy || !addForm.description_snapshot.trim()}
              onClick={() => void addMaterial()}
            >
              {busy
                ? tQuotesOrders(locale, 'materialSaving')
                : tQuotesOrders(locale, 'materialAdd')}
            </button>
          </div>
        </div>
      ) : null}

      {active.length === 0 ? (
        <p className="text-sm text-cdl-muted">
          {tQuotesOrders(locale, 'materialsEmpty')}
        </p>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="text-xs uppercase text-cdl-muted">
                <tr>
                  <th className="py-2 pr-2">
                    {tQuotesOrders(locale, 'materialLabel')}
                  </th>
                  <th className="py-2 pr-2">
                    {tQuotesOrders(locale, 'materialTypeLabel')}
                  </th>
                  <th className="py-2 pr-2">
                    {tQuotesOrders(locale, 'materialUnitLabel')}
                  </th>
                  <th className="py-2 pr-2">
                    {tQuotesOrders(locale, 'materialRequiredLabel')}
                  </th>
                  <th className="py-2 pr-2">
                    {tQuotesOrders(locale, 'materialSeparatedLabel')}
                  </th>
                  <th className="py-2 pr-2">
                    {tQuotesOrders(locale, 'materialCheckedLabel')}
                  </th>
                  <th className="py-2 pr-2">
                    {tQuotesOrders(locale, 'status')}
                  </th>
                  <th className="py-2">
                    {tQuotesOrders(locale, 'actions')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {active.map((row) => (
                  <tr
                    key={row.id}
                    className="border-t border-black/5 align-top"
                  >
                    <td className="py-2 pr-2 font-medium text-cdl-fg">
                      {row.description_snapshot}
                      <p className="text-xs font-normal text-cdl-muted">
                        {tQuotesOrders(locale, 'materialOrigin')}:{' '}
                        {row.source_type === 'package'
                          ? tQuotesOrders(locale, 'materialOriginPackage')
                          : row.source_type === 'additional'
                            ? tQuotesOrders(locale, 'materialOriginAdditional')
                            : row.source_type === 'rule'
                              ? tQuotesOrders(locale, 'materialOriginRule')
                              : row.source_type === 'supplier'
                                ? tQuotesOrders(locale, 'materialOriginSupplier')
                                : tQuotesOrders(locale, 'materialOriginManual')}
                        {row.source_label_snapshot
                          ? ` ${row.source_label_snapshot}`
                          : ''}
                      </p>
                      {row.status === 'divergence' ? (
                        <p className="text-xs text-red-600">
                          {tQuotesOrders(locale, 'materialDivergenceHint')}
                        </p>
                      ) : null}
                    </td>
                    <td className="py-2 pr-2">
                      {materialTypeLabel(row.material_type, locale)}
                    </td>
                    <td className="py-2 pr-2">{row.unit}</td>
                    <td className="py-2 pr-2">{row.required_quantity}</td>
                    <td className="py-2 pr-2">
                      {canPrepare ? (
                        <div className="flex flex-col gap-1">
                          <input
                            className={glassField()}
                            type="number"
                            min={0}
                            step="any"
                            value={
                              draftSeparate[row.id] ??
                              String(row.separated_quantity)
                            }
                            onChange={(e) =>
                              setDraftSeparate((d) => ({
                                ...d,
                                [row.id]: e.target.value,
                              }))
                            }
                          />
                          <button
                            type="button"
                            className={glassBtn('ghost')}
                            disabled={busy}
                            onClick={() =>
                              void patchMaterial(row.id, {
                                action: 'separate',
                                separated_quantity: Number(
                                  draftSeparate[row.id] ??
                                    row.separated_quantity,
                                ),
                              })
                            }
                          >
                            {tQuotesOrders(locale, 'materialSaveSeparate')}
                          </button>
                        </div>
                      ) : (
                        row.separated_quantity
                      )}
                    </td>
                    <td className="py-2 pr-2">
                      {canCheck ? (
                        <div className="flex flex-col gap-1">
                          <input
                            className={glassField()}
                            type="number"
                            min={0}
                            step="any"
                            value={
                              draftCheck[row.id] ??
                              String(row.checked_quantity)
                            }
                            onChange={(e) =>
                              setDraftCheck((d) => ({
                                ...d,
                                [row.id]: e.target.value,
                              }))
                            }
                          />
                          <button
                            type="button"
                            className={glassBtn('ghost')}
                            disabled={busy}
                            onClick={() =>
                              void patchMaterial(row.id, {
                                action: 'check',
                                checked_quantity: Number(
                                  draftCheck[row.id] ?? row.checked_quantity,
                                ),
                              })
                            }
                          >
                            {tQuotesOrders(locale, 'materialSaveCheck')}
                          </button>
                        </div>
                      ) : (
                        row.checked_quantity
                      )}
                    </td>
                    <td className="py-2 pr-2">
                      <span
                        className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${statusBadgeClass(row.status)}`}
                      >
                        {materialStatusLabel(row.status, locale)}
                      </span>
                    </td>
                    <td className="py-2">
                      {canPrepare ? (
                        <button
                          type="button"
                          className="text-xs text-red-600 underline"
                          disabled={busy}
                          onClick={() =>
                            void patchMaterial(row.id, { action: 'cancel' })
                          }
                        >
                          {tQuotesOrders(locale, 'materialCancel')}
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <ul className="space-y-3 md:hidden">
            {active.map((row) => (
              <li
                key={row.id}
                className="space-y-2 rounded-lg border border-cdl-border p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-cdl-fg">
                      {row.description_snapshot}
                    </p>
                    <p className="text-xs text-cdl-muted">
                      {tQuotesOrders(locale, 'materialOrigin')}:{' '}
                      {row.source_type === 'package'
                        ? tQuotesOrders(locale, 'materialOriginPackage')
                        : row.source_type === 'additional'
                          ? tQuotesOrders(locale, 'materialOriginAdditional')
                          : row.source_type === 'rule'
                            ? tQuotesOrders(locale, 'materialOriginRule')
                            : row.source_type === 'supplier'
                              ? tQuotesOrders(locale, 'materialOriginSupplier')
                              : tQuotesOrders(locale, 'materialOriginManual')}
                      {row.source_label_snapshot
                        ? ` ${row.source_label_snapshot}`
                        : ''}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded px-2 py-0.5 text-xs font-medium ${statusBadgeClass(row.status)}`}
                  >
                    {materialStatusLabel(row.status, locale)}
                  </span>
                </div>
                <p className="text-xs text-cdl-muted">
                  {materialTypeLabel(row.material_type, locale)} · {row.unit} ·{' '}
                  {tQuotesOrders(locale, 'materialRequiredLabel')}:{' '}
                  {row.required_quantity}
                </p>
                {row.status === 'divergence' ? (
                  <p className="text-xs text-red-600">
                    {tQuotesOrders(locale, 'materialDivergenceHint')}
                  </p>
                ) : null}
                {canPrepare ? (
                  <label className="block space-y-1">
                    <span className="text-xs text-cdl-muted">
                      {tQuotesOrders(locale, 'materialSeparatedLabel')}
                    </span>
                    <div className="flex gap-2">
                      <input
                        className={glassField()}
                        type="number"
                        min={0}
                        step="any"
                        value={
                          draftSeparate[row.id] ??
                          String(row.separated_quantity)
                        }
                        onChange={(e) =>
                          setDraftSeparate((d) => ({
                            ...d,
                            [row.id]: e.target.value,
                          }))
                        }
                      />
                      <button
                        type="button"
                        className={glassBtn('secondary')}
                        disabled={busy}
                        onClick={() =>
                          void patchMaterial(row.id, {
                            action: 'separate',
                            separated_quantity: Number(
                              draftSeparate[row.id] ?? row.separated_quantity,
                            ),
                          })
                        }
                      >
                        {tQuotesOrders(locale, 'materialSeparate')}
                      </button>
                    </div>
                  </label>
                ) : (
                  <p className="text-sm">
                    {tQuotesOrders(locale, 'materialSeparatedLabel')}:{' '}
                    {row.separated_quantity}
                  </p>
                )}
                {canCheck ? (
                  <label className="block space-y-1">
                    <span className="text-xs text-cdl-muted">
                      {tQuotesOrders(locale, 'materialCheckedLabel')}
                    </span>
                    <div className="flex gap-2">
                      <input
                        className={glassField()}
                        type="number"
                        min={0}
                        step="any"
                        value={
                          draftCheck[row.id] ?? String(row.checked_quantity)
                        }
                        onChange={(e) =>
                          setDraftCheck((d) => ({
                            ...d,
                            [row.id]: e.target.value,
                          }))
                        }
                      />
                      <button
                        type="button"
                        className={glassBtn('secondary')}
                        disabled={busy}
                        onClick={() =>
                          void patchMaterial(row.id, {
                            action: 'check',
                            checked_quantity: Number(
                              draftCheck[row.id] ?? row.checked_quantity,
                            ),
                          })
                        }
                      >
                        {tQuotesOrders(locale, 'materialCheck')}
                      </button>
                    </div>
                  </label>
                ) : (
                  <p className="text-sm">
                    {tQuotesOrders(locale, 'materialCheckedLabel')}:{' '}
                    {row.checked_quantity}
                  </p>
                )}
                {canPrepare ? (
                  <button
                    type="button"
                    className="text-xs text-red-600 underline"
                    disabled={busy}
                    onClick={() =>
                      void patchMaterial(row.id, { action: 'cancel' })
                    }
                  >
                    {tQuotesOrders(locale, 'materialCancel')}
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </>
      )}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </section>
  )
}
