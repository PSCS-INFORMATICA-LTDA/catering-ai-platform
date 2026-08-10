'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

type BalanceRow = {
  id: string
  location_id: string
  catalog_item_id: string
  quantity_on_hand: number
  unit: string
  last_movement_at: string | null
  item_name: string | null
  category: string | null
  location_name: string | null
}

type MovementRow = {
  id: string
  occurred_at: string
  movement_type: string
  quantity: number
  unit: string
  item_name: string | null
  location_name: string | null
  order_number: string | null
  notes: string | null
  created_by: string | null
  catalog_item_id: string
}

type LocationRow = {
  id: string
  name: string
  code: string | null
  is_default: boolean
}

type CatalogOption = {
  id: string
  label: string
  unit: string
}

const TYPE_LABEL: Record<string, string> = {
  initial_balance: 'Saldo inicial',
  event_dispatch: 'Saída OS',
  event_return: 'Retorno OS',
  event_leftover_return: 'Sobra OS',
  adjustment_in: 'Ajuste entrada',
  adjustment_out: 'Ajuste saída',
}

export default function InventoryDashboard({
  canManage,
  canAdjust,
}: {
  canManage: boolean
  canAdjust: boolean
}) {
  const [balances, setBalances] = useState<BalanceRow[]>([])
  const [movements, setMovements] = useState<MovementRow[]>([])
  const [locations, setLocations] = useState<LocationRow[]>([])
  const [catalog, setCatalog] = useState<CatalogOption[]>([])
  const [q, setQ] = useState('')
  const [locationFilter, setLocationFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [postType, setPostType] = useState<
    'initial_balance' | 'adjustment_in' | 'adjustment_out'
  >('initial_balance')
  const [postItemId, setPostItemId] = useState('')
  const [postQty, setPostQty] = useState('1')
  const [postNotes, setPostNotes] = useState('')

  const load = useCallback(async () => {
    setError(null)
    const balQs = new URLSearchParams()
    if (q.trim()) balQs.set('q', q.trim())
    if (locationFilter) balQs.set('location_id', locationFilter)
    const movQs = new URLSearchParams()
    if (locationFilter) movQs.set('location_id', locationFilter)
    if (typeFilter) movQs.set('movement_type', typeFilter)
    if (selectedItemId) movQs.set('catalog_item_id', selectedItemId)

    const [b, m, l, c] = await Promise.all([
      fetch(`/api/inventory/balances?${balQs}`).then((r) => r.json()),
      fetch(`/api/inventory/movements?${movQs}`).then((r) => r.json()),
      fetch('/api/inventory/locations').then((r) => r.json()),
      fetch('/api/additional-items').then((r) => r.json()).catch(() => ({ data: [] })),
    ])
    if (b.error) setError(b.error)
    setBalances(b.data ?? [])
    setMovements(m.data ?? [])
    setLocations(l.data ?? [])
    const opts: CatalogOption[] = (c.data ?? c.items ?? [])
      .map((it: Record<string, unknown>) => ({
        id: String(it.id),
        label: String(it.label_pt || it.item_name || it.id),
        unit: String(it.unit || it.stock_unit || 'unit'),
      }))
      .slice(0, 400)
    setCatalog(opts)
  }, [q, locationFilter, typeFilter, selectedItemId])

  useEffect(() => {
    void load()
  }, [load])

  const selectedName = useMemo(() => {
    if (!selectedItemId) return null
    return (
      balances.find((b) => b.catalog_item_id === selectedItemId)?.item_name ||
      catalog.find((c) => c.id === selectedItemId)?.label ||
      selectedItemId
    )
  }, [selectedItemId, balances, catalog])

  async function submitPost() {
    if (!postItemId) {
      setError('Selecione um item.')
      return
    }
    setBusy(true)
    setError(null)
    const res = await fetch('/api/inventory/post', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        movement_type: postType,
        catalog_item_id: postItemId,
        quantity: Number(postQty),
        notes: postNotes,
        location_id: locationFilter || undefined,
      }),
    })
    const json = await res.json()
    setBusy(false)
    if (!res.ok) {
      setError(json.error || 'Falha no posting.')
      return
    }
    setPostNotes('')
    setPostQty('1')
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
      const j = await res.json()
      setError(j.error || 'Falha ao criar local.')
      return
    }
    await load()
  }

  async function rebuild() {
    setBusy(true)
    const res = await fetch('/api/inventory/rebuild', { method: 'POST' })
    setBusy(false)
    if (!res.ok) {
      const j = await res.json()
      setError(j.error || 'Falha no rebuild.')
      return
    }
    await load()
  }

  return (
    <main className="mx-auto max-w-6xl space-y-8 px-4 py-8 text-cdl-fg sm:px-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Estoque</h1>
        <p className="max-w-2xl text-sm text-cdl-muted">
          Saldos físicos por local. Ledger é a fonte de verdade — sem custo ou
          valuation nesta versão.
        </p>
      </header>

      {error ? (
        <p className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      ) : null}

      <section className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-cdl-muted">
          Item / categoria
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="rounded-xl border border-cdl-border bg-cdl-surface px-3 py-2 text-sm font-normal normal-case text-cdl-fg"
            placeholder="Buscar…"
          />
        </label>
        <label className="flex min-w-[10rem] flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-cdl-muted">
          Local
          <select
            value={locationFilter}
            onChange={(e) => setLocationFilter(e.target.value)}
            className="rounded-xl border border-cdl-border bg-cdl-surface px-3 py-2 text-sm font-normal normal-case text-cdl-fg"
          >
            <option value="">Todos</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
                {l.is_default ? ' (padrão)' : ''}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-[10rem] flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-cdl-muted">
          Tipo movimento
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded-xl border border-cdl-border bg-cdl-surface px-3 py-2 text-sm font-normal normal-case text-cdl-fg"
          >
            <option value="">Todos</option>
            {Object.entries(TYPE_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        {canManage ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void ensureDefault()}
              className="cdl-btn-secondary rounded-xl px-4 py-2 text-sm"
            >
              Garantir local padrão
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void rebuild()}
              className="cdl-btn-secondary rounded-xl px-4 py-2 text-sm"
            >
              Rebuild saldos
            </button>
          </div>
        ) : null}
      </section>

      {(canManage || canAdjust) && (
        <section className="space-y-3 rounded-2xl border border-cdl-border bg-cdl-surface p-4">
          <h2 className="text-lg font-semibold">Lançamento manual</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="flex flex-col gap-1 text-xs font-semibold text-cdl-muted">
              Tipo
              <select
                value={postType}
                onChange={(e) =>
                  setPostType(e.target.value as typeof postType)
                }
                className="rounded-xl border border-cdl-border bg-cdl-bg px-3 py-2 text-sm text-cdl-fg"
              >
                {canManage ? (
                  <option value="initial_balance">Saldo inicial</option>
                ) : null}
                {canAdjust ? (
                  <>
                    <option value="adjustment_in">Ajuste entrada</option>
                    <option value="adjustment_out">Ajuste saída</option>
                  </>
                ) : null}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold text-cdl-muted sm:col-span-2">
              Item
              <select
                value={postItemId}
                onChange={(e) => setPostItemId(e.target.value)}
                className="rounded-xl border border-cdl-border bg-cdl-bg px-3 py-2 text-sm text-cdl-fg"
              >
                <option value="">Selecione…</option>
                {catalog.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label} ({c.unit})
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold text-cdl-muted">
              Quantidade
              <input
                type="number"
                min={0.0001}
                step="any"
                value={postQty}
                onChange={(e) => setPostQty(e.target.value)}
                className="rounded-xl border border-cdl-border bg-cdl-bg px-3 py-2 text-sm text-cdl-fg"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold text-cdl-muted sm:col-span-2 lg:col-span-3">
              Motivo / notas
              <input
                value={postNotes}
                onChange={(e) => setPostNotes(e.target.value)}
                className="rounded-xl border border-cdl-border bg-cdl-bg px-3 py-2 text-sm text-cdl-fg"
                placeholder={
                  postType.startsWith('adjustment')
                    ? 'Obrigatório para ajuste'
                    : 'Opcional'
                }
              />
            </label>
            <div className="flex items-end">
              <button
                type="button"
                disabled={busy}
                onClick={() => void submitPost()}
                className="cdl-btn-primary w-full rounded-xl px-4 py-2 text-sm font-bold"
              >
                Postar
              </button>
            </div>
          </div>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Resumo de saldo</h2>
        <div className="hidden overflow-x-auto rounded-2xl border border-cdl-border md:block">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-cdl-surface text-xs uppercase tracking-wide text-cdl-muted">
              <tr>
                <th className="px-4 py-3">Item</th>
                <th className="px-4 py-3">Categoria</th>
                <th className="px-4 py-3">Unidade</th>
                <th className="px-4 py-3">Local</th>
                <th className="px-4 py-3">Saldo</th>
                <th className="px-4 py-3">Último movimento</th>
              </tr>
            </thead>
            <tbody>
              {balances.map((b) => (
                <tr
                  key={b.id}
                  className={`cursor-pointer border-t border-cdl-border/60 hover:bg-cdl-surface/80 ${
                    selectedItemId === b.catalog_item_id ? 'bg-cdl-surface' : ''
                  }`}
                  onClick={() => setSelectedItemId(b.catalog_item_id)}
                >
                  <td className="px-4 py-3 font-medium">{b.item_name}</td>
                  <td className="px-4 py-3 text-cdl-muted">{b.category || '—'}</td>
                  <td className="px-4 py-3">{b.unit}</td>
                  <td className="px-4 py-3">{b.location_name}</td>
                  <td className="px-4 py-3 font-semibold tabular-nums">
                    {b.quantity_on_hand}
                  </td>
                  <td className="px-4 py-3 text-cdl-muted">
                    {b.last_movement_at
                      ? new Date(b.last_movement_at).toLocaleString()
                      : '—'}
                  </td>
                </tr>
              ))}
              {!balances.length ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-cdl-muted">
                    Nenhum saldo. Lance um saldo inicial ou rode o seed DEV.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="grid gap-3 md:hidden">
          {balances.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => setSelectedItemId(b.catalog_item_id)}
              className="rounded-2xl border border-cdl-border bg-cdl-surface p-4 text-left"
            >
              <div className="font-semibold">{b.item_name}</div>
              <div className="mt-1 text-sm text-cdl-muted">
                {b.category || '—'} · {b.location_name}
              </div>
              <div className="mt-2 text-lg font-bold tabular-nums">
                {b.quantity_on_hand} {b.unit}
              </div>
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">
            Movimentos
            {selectedName ? (
              <span className="ml-2 text-sm font-normal text-cdl-muted">
                · {selectedName}
              </span>
            ) : null}
          </h2>
          {selectedItemId ? (
            <button
              type="button"
              className="text-sm text-cdl-muted underline"
              onClick={() => setSelectedItemId(null)}
            >
              Limpar filtro item
            </button>
          ) : null}
        </div>
        <div className="overflow-x-auto rounded-2xl border border-cdl-border">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-cdl-surface text-xs uppercase tracking-wide text-cdl-muted">
              <tr>
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Qtd</th>
                <th className="px-4 py-3">Item</th>
                <th className="px-4 py-3">Origem / OS</th>
                <th className="px-4 py-3">Notas</th>
              </tr>
            </thead>
            <tbody>
              {movements.map((m) => (
                <tr key={m.id} className="border-t border-cdl-border/60">
                  <td className="px-4 py-3 whitespace-nowrap text-cdl-muted">
                    {new Date(m.occurred_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    {TYPE_LABEL[m.movement_type] || m.movement_type}
                  </td>
                  <td className="px-4 py-3 font-semibold tabular-nums">
                    {m.quantity > 0 ? '+' : ''}
                    {m.quantity} {m.unit}
                  </td>
                  <td className="px-4 py-3">{m.item_name}</td>
                  <td className="px-4 py-3 text-cdl-muted">
                    {m.order_number || m.location_name || '—'}
                  </td>
                  <td className="px-4 py-3 text-cdl-muted">{m.notes || '—'}</td>
                </tr>
              ))}
              {!movements.length ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-cdl-muted">
                    Sem movimentos para o filtro atual.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  )
}
