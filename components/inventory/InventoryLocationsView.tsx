'use client'

import { useCallback, useEffect, useState } from 'react'
import InventoryPageShell from '@/components/inventory/InventoryPageShell'
import { tCommon } from '@/Lib/i18n/common'
import { tInventoryUi } from '@/Lib/i18n/inventoryUi'
import { useAuthLocaleFromMe } from '@/Lib/i18n/useAuthLocaleFromMe'

type LocationRow = {
  id: string
  branch_id?: string
  name: string
  code: string | null
  location_type?: string | null
  is_default: boolean
  active: boolean
}

export default function InventoryLocationsView({
  canManage,
}: {
  canManage: boolean
}) {
  const locale = useAuthLocaleFromMe()
  const [rows, setRows] = useState<LocationRow[]>([])
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setError(null)
    const json = await fetch('/api/inventory/locations').then((r) => r.json())
    if (json.error) setError(json.error)
    setRows(json.data ?? [])
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function createLocation() {
    const n = name.trim()
    if (!n) return
    setBusy(true)
    const res = await fetch('/api/inventory/locations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: n }),
    })
    setBusy(false)
    const json = await res.json()
    if (!res.ok) {
      setError(json.error || tInventoryUi(locale, 'createLocationFailed'))
      return
    }
    setName('')
    await load()
  }

  async function ensureDefault() {
    setBusy(true)
    const res = await fetch('/api/inventory/locations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ensure_default: true, name: 'Main Stock' }),
    })
    setBusy(false)
    if (!res.ok) {
      const json = await res.json()
      setError(json.error || tInventoryUi(locale, 'createLocationFailed'))
      return
    }
    await load()
  }

  return (
    <InventoryPageShell
      title={tInventoryUi(locale, 'locationsTitle')}
      subtitle={tInventoryUi(locale, 'subtitle')}
      error={error}
      actions={
        canManage ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void ensureDefault()}
            className="cdl-btn-secondary rounded-xl px-4 py-2 text-sm"
          >
            {tInventoryUi(locale, 'ensureDefaultLocation')}
          </button>
        ) : null
      }
    >
      {canManage ? (
        <section className="flex flex-col gap-2 rounded-2xl border border-cdl-border bg-cdl-surface p-4 sm:flex-row sm:items-end">
          <label className="flex flex-1 flex-col gap-1 text-xs font-semibold text-cdl-muted">
            {tCommon(locale, 'name')}
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-xl border border-cdl-border bg-cdl-bg px-3 py-2 text-sm text-cdl-fg"
            />
          </label>
          <button
            type="button"
            disabled={busy}
            onClick={() => void createLocation()}
            className="cdl-btn-primary rounded-xl px-4 py-2 text-sm font-bold"
          >
            {tCommon(locale, 'add')}
          </button>
        </section>
      ) : null}

      <div className="overflow-x-auto rounded-2xl border border-cdl-border">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-cdl-surface text-xs uppercase tracking-wide text-cdl-muted">
            <tr>
              <th className="px-3 py-3">{tCommon(locale, 'name')}</th>
              <th className="px-3 py-3">Code</th>
              <th className="px-3 py-3">{tCommon(locale, 'status')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((l) => (
              <tr key={l.id} className="border-t border-cdl-border/60">
                <td className="px-3 py-3 font-medium">
                  {l.name}
                  {l.is_default
                    ? ` ${tInventoryUi(locale, 'defaultSuffix')}`
                    : ''}
                </td>
                <td className="px-3 py-3">{l.code || '—'}</td>
                <td className="px-3 py-3">
                  {l.active ? tCommon(locale, 'active') : tCommon(locale, 'inactive')}
                </td>
              </tr>
            ))}
            {!rows.length ? (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-cdl-muted">
                  {tCommon(locale, 'empty')}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </InventoryPageShell>
  )
}
