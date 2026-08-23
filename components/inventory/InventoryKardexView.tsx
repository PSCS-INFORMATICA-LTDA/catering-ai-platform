'use client'

import { useCallback, useEffect, useState } from 'react'
import InventoryPageShell from '@/components/inventory/InventoryPageShell'
import {
  INVENTORY_MOVEMENT_TYPE_KEYS,
  inventoryMovementTypeLabel,
  tInventoryUi,
} from '@/Lib/i18n/inventoryUi'
import { tCommon } from '@/Lib/i18n/common'
import { useAuthLocaleFromMe } from '@/Lib/i18n/useAuthLocaleFromMe'

type Row = {
  id: string
  occurred_at: string
  movement_type: string
  movement_code: string | null
  document_number: string | null
  quantity: number
  unit: string
  item_name: string | null
  branch_name: string | null
  location_name: string | null
  lot_number: string | null
  order_number: string | null
  notes: string | null
}

export default function InventoryKardexView() {
  const locale = useAuthLocaleFromMe()
  const [rows, setRows] = useState<Row[]>([])
  const [typeFilter, setTypeFilter] = useState('')
  const [codeFilter, setCodeFilter] = useState('')
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    const qs = new URLSearchParams({ limit: '200' })
    if (typeFilter) qs.set('movement_type', typeFilter)
    if (codeFilter) qs.set('movement_code', codeFilter)
    const json = await fetch(`/api/inventory/movements?${qs}`).then((r) =>
      r.json(),
    )
    if (json.error) setError(json.error)
    setRows(json.data ?? [])
  }, [typeFilter, codeFilter])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <InventoryPageShell
      title={tInventoryUi(locale, 'navKardex')}
      subtitle={tInventoryUi(locale, 'kardexSubtitle')}
      error={error}
    >
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-[10rem] flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-cdl-muted">
          {tInventoryUi(locale, 'movementType')}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded-xl border border-cdl-border bg-cdl-surface px-3 py-2 text-sm font-normal normal-case text-cdl-fg"
          >
            <option value="">{tCommon(locale, 'all')}</option>
            {INVENTORY_MOVEMENT_TYPE_KEYS.map((k) => (
              <option key={k} value={k}>
                {inventoryMovementTypeLabel(locale, k)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-[8rem] flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-cdl-muted">
          {tInventoryUi(locale, 'colMovementCode')}
          <input
            value={codeFilter}
            onChange={(e) => setCodeFilter(e.target.value.toUpperCase())}
            placeholder="ED"
            className="rounded-xl border border-cdl-border bg-cdl-surface px-3 py-2 text-sm font-normal normal-case text-cdl-fg"
          />
        </label>
        <button
          type="button"
          onClick={() => void load()}
          className="cdl-btn-secondary rounded-xl px-4 py-2 text-sm"
        >
          {tCommon(locale, 'refresh')}
        </button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-cdl-border">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-cdl-surface text-xs uppercase tracking-wide text-cdl-muted">
            <tr>
              <th className="px-3 py-3">{tCommon(locale, 'date')}</th>
              <th className="px-3 py-3">{tInventoryUi(locale, 'colDocument')}</th>
              <th className="px-3 py-3">{tInventoryUi(locale, 'type')}</th>
              <th className="px-3 py-3">{tInventoryUi(locale, 'colMovementCode')}</th>
              <th className="px-3 py-3">{tInventoryUi(locale, 'item')}</th>
              <th className="px-3 py-3">{tInventoryUi(locale, 'colBranch')}</th>
              <th className="px-3 py-3">{tInventoryUi(locale, 'colLocation')}</th>
              <th className="px-3 py-3">{tInventoryUi(locale, 'colLot')}</th>
              <th className="px-3 py-3">{tInventoryUi(locale, 'colQty')}</th>
              <th className="px-3 py-3">{tInventoryUi(locale, 'colOrder')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => (
              <tr key={m.id} className="border-t border-cdl-border/60">
                <td className="px-3 py-3 whitespace-nowrap text-cdl-muted">
                  {new Date(m.occurred_at).toLocaleString()}
                </td>
                <td className="px-3 py-3">{m.document_number || '—'}</td>
                <td className="px-3 py-3">
                  {inventoryMovementTypeLabel(locale, m.movement_type)}
                </td>
                <td className="px-3 py-3">{m.movement_code || '—'}</td>
                <td className="px-3 py-3">{m.item_name || '—'}</td>
                <td className="px-3 py-3">{m.branch_name || '—'}</td>
                <td className="px-3 py-3">{m.location_name || '—'}</td>
                <td className="px-3 py-3">{m.lot_number || '—'}</td>
                <td className="px-3 py-3 tabular-nums font-semibold">
                  {m.quantity > 0 ? '+' : ''}
                  {m.quantity} {m.unit}
                </td>
                <td className="px-3 py-3">{m.order_number || '—'}</td>
              </tr>
            ))}
            {!rows.length ? (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-cdl-muted">
                  {tInventoryUi(locale, 'emptyMovements')}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </InventoryPageShell>
  )
}
