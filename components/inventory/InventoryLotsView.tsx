'use client'

import { useCallback, useEffect, useState } from 'react'
import InventoryPageShell from '@/components/inventory/InventoryPageShell'
import { tCommon } from '@/Lib/i18n/common'
import { tInventoryUi } from '@/Lib/i18n/inventoryUi'
import { useAuthLocaleFromMe } from '@/Lib/i18n/useAuthLocaleFromMe'

type Row = {
  id: string
  lot_number: string
  status: string
  expiration_date: string | null
  item_name: string | null
  branch_name: string | null
  active: boolean
}

export default function InventoryLotsView() {
  const locale = useAuthLocaleFromMe()
  const [rows, setRows] = useState<Row[]>([])
  const [q, setQ] = useState('')
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    const qs = new URLSearchParams()
    if (q.trim()) qs.set('q', q.trim())
    const json = await fetch(`/api/inventory/lots?${qs}`).then((r) => r.json())
    if (json.error) setError(json.error)
    setRows(json.data ?? [])
  }, [q])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <InventoryPageShell
      title={tInventoryUi(locale, 'lotsTitle')}
      subtitle={tInventoryUi(locale, 'lotsHint')}
      error={error}
    >
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-cdl-muted">
          {tCommon(locale, 'search')}
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="rounded-xl border border-cdl-border bg-cdl-surface px-3 py-2 text-sm font-normal normal-case text-cdl-fg"
            placeholder={tCommon(locale, 'searchPlaceholder')}
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
              <th className="px-3 py-3">{tInventoryUi(locale, 'colLot')}</th>
              <th className="px-3 py-3">{tInventoryUi(locale, 'item')}</th>
              <th className="px-3 py-3">{tInventoryUi(locale, 'colBranch')}</th>
              <th className="px-3 py-3">{tCommon(locale, 'status')}</th>
              <th className="px-3 py-3">Expiry</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-cdl-border/60">
                <td className="px-3 py-3 font-medium">{r.lot_number}</td>
                <td className="px-3 py-3">{r.item_name || '—'}</td>
                <td className="px-3 py-3">{r.branch_name || '—'}</td>
                <td className="px-3 py-3">{r.status}</td>
                <td className="px-3 py-3 text-cdl-muted">
                  {r.expiration_date || '—'}
                </td>
              </tr>
            ))}
            {!rows.length ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-cdl-muted">
                  {tInventoryUi(locale, 'emptyLots')}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </InventoryPageShell>
  )
}
