'use client'

import { useCallback, useEffect, useState } from 'react'
import InventoryPageShell from '@/components/inventory/InventoryPageShell'
import { tCommon } from '@/Lib/i18n/common'
import { tInventoryUi } from '@/Lib/i18n/inventoryUi'
import { useAuthLocaleFromMe } from '@/Lib/i18n/useAuthLocaleFromMe'

type DocRow = {
  id: string
  document_number: string
  document_type: string
  movement_code: string
  document_date: string
  status: string
  branch_name: string | null
  from_location_name: string | null
  to_location_name: string | null
  order_number: string | null
  line_count: number
  posted_at: string | null
}

type DocDetail = DocRow & {
  lines: Array<{
    line_number: number
    item_name: string | null
    quantity: number
    unit: string
    location_name: string | null
  }>
  movements: Array<{
    movement_type: string
    movement_code: string | null
    quantity: number
    unit: string
  }>
}

export default function InventoryDocumentsView() {
  const locale = useAuthLocaleFromMe()
  const [rows, setRows] = useState<DocRow[]>([])
  const [docType, setDocType] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [detail, setDetail] = useState<DocDetail | null>(null)

  const load = useCallback(async () => {
    setError(null)
    const qs = new URLSearchParams()
    if (docType) qs.set('document_type', docType)
    const json = await fetch(`/api/inventory/documents?${qs}`).then((r) =>
      r.json(),
    )
    if (json.error) setError(json.error)
    setRows(json.data ?? [])
  }, [docType])

  useEffect(() => {
    void load()
  }, [load])

  async function openDetail(id: string) {
    const json = await fetch(`/api/inventory/documents/${id}`).then((r) =>
      r.json(),
    )
    if (json.data) setDetail(json.data as DocDetail)
  }

  return (
    <InventoryPageShell
      title={tInventoryUi(locale, 'navDocuments')}
      subtitle={tInventoryUi(locale, 'kardexSubtitle')}
      error={error}
    >
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-[12rem] flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-cdl-muted">
          {tInventoryUi(locale, 'colDocType')}
          <select
            value={docType}
            onChange={(e) => setDocType(e.target.value)}
            className="rounded-xl border border-cdl-border bg-cdl-surface px-3 py-2 text-sm font-normal normal-case text-cdl-fg"
          >
            <option value="">{tCommon(locale, 'all')}</option>
            <option value="EVENT_DISPATCH">EVENT_DISPATCH</option>
            <option value="EVENT_RETURN">EVENT_RETURN</option>
            <option value="LEFTOVER_RETURN">LEFTOVER_RETURN</option>
            <option value="INITIAL_BALANCE">INITIAL_BALANCE</option>
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
              <th className="px-3 py-3">{tInventoryUi(locale, 'colDocument')}</th>
              <th className="px-3 py-3">{tInventoryUi(locale, 'colDocType')}</th>
              <th className="px-3 py-3">{tInventoryUi(locale, 'colMovementCode')}</th>
              <th className="px-3 py-3">{tCommon(locale, 'date')}</th>
              <th className="px-3 py-3">{tInventoryUi(locale, 'colBranch')}</th>
              <th className="px-3 py-3">{tInventoryUi(locale, 'colFrom')}</th>
              <th className="px-3 py-3">{tInventoryUi(locale, 'colTo')}</th>
              <th className="px-3 py-3">{tInventoryUi(locale, 'colOrder')}</th>
              <th className="px-3 py-3">{tCommon(locale, 'status')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.id} className="border-t border-cdl-border/60">
                <td className="px-3 py-3">
                  <button
                    type="button"
                    className="font-semibold text-cdl-fg underline-offset-2 hover:underline"
                    onClick={() => void openDetail(d.id)}
                  >
                    {d.document_number}
                  </button>
                </td>
                <td className="px-3 py-3">{d.document_type}</td>
                <td className="px-3 py-3">{d.movement_code}</td>
                <td className="px-3 py-3">{d.document_date}</td>
                <td className="px-3 py-3">{d.branch_name || '—'}</td>
                <td className="px-3 py-3">{d.from_location_name || '—'}</td>
                <td className="px-3 py-3">{d.to_location_name || '—'}</td>
                <td className="px-3 py-3">{d.order_number || '—'}</td>
                <td className="px-3 py-3">{d.status}</td>
              </tr>
            ))}
            {!rows.length ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-cdl-muted">
                  {tInventoryUi(locale, 'emptyDocuments')}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {detail ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
          <div className="max-h-[85vh] w-full max-w-2xl overflow-auto rounded-2xl border border-cdl-border bg-cdl-bg p-4 shadow-xl">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">
                  {tInventoryUi(locale, 'documentDetail')}
                </h2>
                <p className="text-sm text-cdl-muted">
                  {detail.document_number} · {detail.document_type} ·{' '}
                  {detail.movement_code}
                </p>
              </div>
              <button
                type="button"
                className="text-sm text-cdl-muted"
                onClick={() => setDetail(null)}
              >
                {tCommon(locale, 'close')}
              </button>
            </div>
            <h3 className="mb-2 text-sm font-semibold uppercase text-cdl-muted">
              {tInventoryUi(locale, 'colLines')}
            </h3>
            <ul className="mb-4 space-y-2 text-sm">
              {detail.lines.map((line) => (
                <li
                  key={line.line_number}
                  className="rounded-xl border border-cdl-border bg-cdl-surface px-3 py-2"
                >
                  #{line.line_number} {line.item_name} · {line.quantity}{' '}
                  {line.unit} @ {line.location_name || '—'}
                </li>
              ))}
            </ul>
            <h3 className="mb-2 text-sm font-semibold uppercase text-cdl-muted">
              {tInventoryUi(locale, 'movements')}
            </h3>
            <ul className="space-y-2 text-sm">
              {detail.movements.map((m, i) => (
                <li
                  key={i}
                  className="rounded-xl border border-cdl-border/60 px-3 py-2"
                >
                  {m.movement_code || m.movement_type} · {m.quantity}{' '}
                  {m.unit}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </InventoryPageShell>
  )
}
