'use client'

import { useCallback, useEffect, useState } from 'react'
import InventoryPageShell from '@/components/inventory/InventoryPageShell'
import { tCommon } from '@/Lib/i18n/common'
import { tInventoryUi } from '@/Lib/i18n/inventoryUi'
import { useAuthLocaleFromMe } from '@/Lib/i18n/useAuthLocaleFromMe'

type Row = {
  id: string
  item_name: string | null
  branch_name: string | null
  location_name: string | null
  order_number: string | null
  quantity: number
  unit: string
  status: string
  committed_at: string
}

export default function InventoryCommitmentsView() {
  const locale = useAuthLocaleFromMe()
  const [rows, setRows] = useState<Row[]>([])
  const [status, setStatus] = useState('active')
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    const qs = new URLSearchParams()
    if (status) qs.set('status', status)
    const json = await fetch(`/api/inventory/commitments?${qs}`).then((r) =>
      r.json(),
    )
    if (json.error) setError(json.error)
    setRows(json.data ?? [])
  }, [status])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <InventoryPageShell
      title={tInventoryUi(locale, 'navCommitments')}
      subtitle={tInventoryUi(locale, 'availabilitySubtitle')}
      error={error}
    >
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-cdl-muted">
          {tCommon(locale, 'status')}
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-xl border border-cdl-border bg-cdl-surface px-3 py-2 text-sm font-normal normal-case text-cdl-fg"
          >
            <option value="active">active</option>
            <option value="released">released</option>
            <option value="consumed">consumed</option>
            <option value="cancelled">cancelled</option>
            <option value="">{tCommon(locale, 'all')}</option>
          </select>
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
              <th className="px-3 py-3">{tInventoryUi(locale, 'item')}</th>
              <th className="px-3 py-3">{tInventoryUi(locale, 'colOrder')}</th>
              <th className="px-3 py-3">{tInventoryUi(locale, 'colBranch')}</th>
              <th className="px-3 py-3">{tInventoryUi(locale, 'colLocation')}</th>
              <th className="px-3 py-3">{tCommon(locale, 'quantity')}</th>
              <th className="px-3 py-3">{tCommon(locale, 'status')}</th>
              <th className="px-3 py-3">{tCommon(locale, 'date')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-cdl-border/60">
                <td className="px-3 py-3 font-medium">{r.item_name || '—'}</td>
                <td className="px-3 py-3">{r.order_number || '—'}</td>
                <td className="px-3 py-3">{r.branch_name || '—'}</td>
                <td className="px-3 py-3">{r.location_name || '—'}</td>
                <td className="px-3 py-3 tabular-nums">
                  {r.quantity} {r.unit}
                </td>
                <td className="px-3 py-3">{r.status}</td>
                <td className="px-3 py-3 text-cdl-muted">
                  {new Date(r.committed_at).toLocaleString()}
                </td>
              </tr>
            ))}
            {!rows.length ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-cdl-muted">
                  {tInventoryUi(locale, 'emptyCommitments')}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </InventoryPageShell>
  )
}
