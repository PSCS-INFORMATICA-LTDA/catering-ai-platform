'use client'

import { useCallback, useEffect, useState } from 'react'
import InventoryPageShell from '@/components/inventory/InventoryPageShell'
import { tCommon } from '@/Lib/i18n/common'
import { tInventoryUi } from '@/Lib/i18n/inventoryUi'
import { useAuthLocaleFromMe } from '@/Lib/i18n/useAuthLocaleFromMe'

type Row = {
  balance_id: string
  branch_id: string
  location_id: string
  catalog_item_id: string
  lot_id: string | null
  unit: string
  quantity_on_hand: number
  quantity_committed: number
  quantity_available: number
  quantity_in_event: number
  last_movement_at: string | null
  item_name: string | null
  category: string | null
  branch_name: string | null
  location_name: string | null
  lot_number: string | null
}

type CommitmentRow = {
  id: string
  order_number: string | null
  quantity: number
  unit: string
  status: string
  location_name: string | null
}

type BranchOpt = { id: string; name: string }
type LocOpt = { id: string; name: string }

export default function InventoryAvailabilityView() {
  const locale = useAuthLocaleFromMe()
  const [rows, setRows] = useState<Row[]>([])
  const [branches, setBranches] = useState<BranchOpt[]>([])
  const [locations, setLocations] = useState<LocOpt[]>([])
  const [q, setQ] = useState('')
  const [branchId, setBranchId] = useState('')
  const [locationId, setLocationId] = useState('')
  const [onlyStock, setOnlyStock] = useState(false)
  const [onlyCommitted, setOnlyCommitted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [drillItem, setDrillItem] = useState<Row | null>(null)
  const [drillRows, setDrillRows] = useState<CommitmentRow[]>([])

  const load = useCallback(async () => {
    setError(null)
    const qs = new URLSearchParams()
    if (q.trim()) qs.set('q', q.trim())
    if (branchId) qs.set('branch_id', branchId)
    if (locationId) qs.set('location_id', locationId)
    if (onlyStock) qs.set('only_with_stock', '1')
    if (onlyCommitted) qs.set('only_committed', '1')

    const [a, b, l] = await Promise.all([
      fetch(`/api/inventory/availability?${qs}`).then((r) => r.json()),
      fetch('/api/inventory/branches').then((r) => r.json()),
      fetch('/api/inventory/locations').then((r) => r.json()),
    ])
    if (a.error) setError(a.error)
    setRows(a.data ?? [])
    setBranches(b.data ?? [])
    setLocations(l.data ?? [])
  }, [q, branchId, locationId, onlyStock, onlyCommitted])

  useEffect(() => {
    void load()
  }, [load])

  async function openDrill(row: Row) {
    if (row.quantity_committed <= 0) return
    setDrillItem(row)
    const qs = new URLSearchParams({
      catalog_item_id: row.catalog_item_id,
      drill_down: '1',
    })
    if (row.branch_id) qs.set('branch_id', row.branch_id)
    if (row.location_id) qs.set('location_id', row.location_id)
    if (row.lot_id) qs.set('lot_id', row.lot_id)
    const json = await fetch(`/api/inventory/commitments?${qs}`).then((r) =>
      r.json(),
    )
    setDrillRows(json.data ?? [])
  }

  return (
    <InventoryPageShell
      title={tInventoryUi(locale, 'navAvailability')}
      subtitle={tInventoryUi(locale, 'availabilitySubtitle')}
      error={error}
    >
      <section className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-cdl-muted">
          {tInventoryUi(locale, 'itemCategory')}
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="rounded-xl border border-cdl-border bg-cdl-surface px-3 py-2 text-sm font-normal normal-case text-cdl-fg"
            placeholder={tCommon(locale, 'searchPlaceholder')}
          />
        </label>
        <label className="flex min-w-[10rem] flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-cdl-muted">
          {tInventoryUi(locale, 'colBranch')}
          <select
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
            className="rounded-xl border border-cdl-border bg-cdl-surface px-3 py-2 text-sm font-normal normal-case text-cdl-fg"
          >
            <option value="">{tCommon(locale, 'all')}</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-[10rem] flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-cdl-muted">
          {tInventoryUi(locale, 'colLocation')}
          <select
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
            className="rounded-xl border border-cdl-border bg-cdl-surface px-3 py-2 text-sm font-normal normal-case text-cdl-fg"
          >
            <option value="">{tCommon(locale, 'all')}</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-cdl-muted">
          <input
            type="checkbox"
            checked={onlyStock}
            onChange={(e) => setOnlyStock(e.target.checked)}
          />
          {tInventoryUi(locale, 'filterOnlyStock')}
        </label>
        <label className="flex items-center gap-2 text-sm text-cdl-muted">
          <input
            type="checkbox"
            checked={onlyCommitted}
            onChange={(e) => setOnlyCommitted(e.target.checked)}
          />
          {tInventoryUi(locale, 'filterOnlyCommitted')}
        </label>
        <button
          type="button"
          onClick={() => void load()}
          className="cdl-btn-secondary rounded-xl px-4 py-2 text-sm"
        >
          {tCommon(locale, 'refresh')}
        </button>
      </section>

      <div className="overflow-x-auto rounded-2xl border border-cdl-border">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-cdl-surface text-xs uppercase tracking-wide text-cdl-muted">
            <tr>
              <th className="px-3 py-3">{tInventoryUi(locale, 'item')}</th>
              <th className="px-3 py-3">{tInventoryUi(locale, 'colBranch')}</th>
              <th className="px-3 py-3">{tInventoryUi(locale, 'colLocation')}</th>
              <th className="px-3 py-3">{tInventoryUi(locale, 'colLot')}</th>
              <th className="px-3 py-3">{tInventoryUi(locale, 'colOnHand')}</th>
              <th className="px-3 py-3">{tInventoryUi(locale, 'colCommitted')}</th>
              <th className="px-3 py-3">{tInventoryUi(locale, 'colAvailable')}</th>
              <th className="px-3 py-3">{tInventoryUi(locale, 'colInEvent')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.balance_id} className="border-t border-cdl-border/60">
                <td className="px-3 py-3">
                  <div className="font-medium">{r.item_name}</div>
                  <div className="text-xs text-cdl-muted">{r.category || '—'}</div>
                </td>
                <td className="px-3 py-3">{r.branch_name || '—'}</td>
                <td className="px-3 py-3">{r.location_name || '—'}</td>
                <td className="px-3 py-3">{r.lot_number || '—'}</td>
                <td className="px-3 py-3 tabular-nums font-semibold">
                  {r.quantity_on_hand} {r.unit}
                </td>
                <td className="px-3 py-3 tabular-nums">
                  {r.quantity_committed > 0 ? (
                    <button
                      type="button"
                      className="font-semibold text-amber-400 underline-offset-2 hover:underline"
                      onClick={() => void openDrill(r)}
                    >
                      {r.quantity_committed}
                    </button>
                  ) : (
                    '0'
                  )}
                </td>
                <td className="px-3 py-3 tabular-nums font-semibold text-emerald-400">
                  {r.quantity_available}
                </td>
                <td className="px-3 py-3 tabular-nums text-cdl-muted">
                  {r.quantity_in_event}
                </td>
              </tr>
            ))}
            {!rows.length ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-cdl-muted">
                  {tInventoryUi(locale, 'emptyAvailability')}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {drillItem ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
          <div className="max-h-[80vh] w-full max-w-lg overflow-auto rounded-2xl border border-cdl-border bg-cdl-bg p-4 shadow-xl">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">
                  {tInventoryUi(locale, 'commitmentDrillDown')}
                </h2>
                <p className="text-sm text-cdl-muted">{drillItem.item_name}</p>
              </div>
              <button
                type="button"
                className="text-sm text-cdl-muted"
                onClick={() => setDrillItem(null)}
              >
                {tCommon(locale, 'close')}
              </button>
            </div>
            <ul className="space-y-2 text-sm">
              {drillRows.map((c) => (
                <li
                  key={c.id}
                  className="rounded-xl border border-cdl-border bg-cdl-surface px-3 py-2"
                >
                  <div className="font-medium">
                    {c.order_number || '—'} · {c.quantity} {c.unit}
                  </div>
                  <div className="text-cdl-muted">
                    {c.location_name || '—'} · {c.status}
                  </div>
                </li>
              ))}
              {!drillRows.length ? (
                <li className="text-cdl-muted">{tCommon(locale, 'empty')}</li>
              ) : null}
            </ul>
          </div>
        </div>
      ) : null}
    </InventoryPageShell>
  )
}
