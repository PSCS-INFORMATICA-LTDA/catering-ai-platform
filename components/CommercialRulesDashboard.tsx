'use client'

import { useCallback, useMemo, useState } from 'react'
import BackofficeTableShell from '@/components/BackofficeTableShell'
import {
  BackofficeBtnPrimary,
  BackofficeBtnSecondary,
  BackofficeFormCard,
} from '@/components/backoffice/BackofficeCardPrimitives'
import {
  PremiumMetricCard,
  RuleGroupAccordion,
  SectionHeader,
} from '@/components/premium/PremiumPrimitives'
import RuleCard from '@/components/rules/RuleCard'
import type {
  CommercialRuleRow,
  CommercialRuleValue,
} from '@/Lib/commercialRulesTableSchema'
import {
  getCommercialRuleCategory,
  groupCommercialRulesByCategory,
} from '@/Lib/commercialRuleGroups'
import type { CommercialRulesSnapshot } from '@/Lib/supabaseCommercialRules'

type ActiveFilter = 'active' | 'all'

type RulesApiResponse = {
  rules: CommercialRulesSnapshot
  rows: CommercialRuleRow[]
  editable: boolean
  table: string | null
  fallback: CommercialRulesSnapshot
}

type RuleDraft = {
  rule_key: string
  rule_value: CommercialRuleValue
  active: boolean
}

const EMPTY_RULE_VALUE: CommercialRuleValue = {
  value: '',
  type: 'text',
  label_pt: '',
}

const EMPTY_RULE: RuleDraft = {
  rule_key: '',
  rule_value: { ...EMPTY_RULE_VALUE },
  active: true,
}

export default function CommercialRulesDashboard({
  initialData,
}: {
  initialData: RulesApiResponse
}) {
  const [data, setData] = useState(initialData)
  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>('active')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | 'new' | null>(null)
  const [draft, setDraft] = useState(EMPTY_RULE)
  const [saving, setSaving] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({})

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    let rows = data.rows
    if (activeFilter === 'active') {
      rows = rows.filter((row) => row.active !== false)
    }
    if (categoryFilter !== 'all') {
      rows = rows.filter(
        (row) => getCommercialRuleCategory(row.rule_key) === categoryFilter,
      )
    }
    if (typeFilter !== 'all') {
      rows = rows.filter((row) => (row.rule_value?.type ?? 'text') === typeFilter)
    }
    if (!q) return rows
    return rows.filter((row) => {
      const label = row.rule_value?.label_pt ?? ''
      return (
        row.rule_key.toLowerCase().includes(q) ||
        label.toLowerCase().includes(q) ||
        String(row.rule_value?.value ?? '').toLowerCase().includes(q)
      )
    })
  }, [data.rows, search, activeFilter, categoryFilter, typeFilter])

  const grouped = useMemo(
    () => groupCommercialRulesByCategory(filteredRows),
    [filteredRows],
  )

  const metrics = useMemo(() => {
    const categories = new Set(
      data.rows.map((row) => getCommercialRuleCategory(row.rule_key)),
    )
    const active = data.rows.filter((row) => row.active !== false).length
    return {
      total: data.rows.length,
      active,
      inactive: data.rows.length - active,
      categories: categories.size,
    }
  }, [data.rows])

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        _: String(Date.now()),
        active: activeFilter === 'all' ? 'all' : 'true',
      })
      const response = await fetch(`/api/commercial-rules?${params}`, {
        cache: 'no-store',
      })
      const result = (await response.json()) as RulesApiResponse & { error?: string }
      if (!response.ok) {
        throw new Error(result.error ?? 'Não foi possível carregar regras.')
      }
      setData(result)
    } catch (refreshError) {
      setError(
        refreshError instanceof Error
          ? refreshError.message
          : 'Erro ao atualizar regras.',
      )
    } finally {
      setLoading(false)
    }
  }, [activeFilter])

  function startNew() {
    setEditingId('new')
    setDraft({ ...EMPTY_RULE, rule_value: { ...EMPTY_RULE_VALUE } })
  }

  function startEdit(row: CommercialRuleRow) {
    setEditingId(row.id)
    setDraft({
      rule_key: row.rule_key,
      rule_value: row.rule_value ?? { ...EMPTY_RULE_VALUE },
      active: row.active !== false,
    })
  }

  function duplicateRule(row: CommercialRuleRow) {
    setEditingId('new')
    setDraft({
      rule_key: `${row.rule_key}_copy`,
      rule_value: row.rule_value ?? { ...EMPTY_RULE_VALUE },
      active: true,
    })
  }

  function cancelEdit() {
    setEditingId(null)
    setDraft({ ...EMPTY_RULE, rule_value: { ...EMPTY_RULE_VALUE } })
  }

  function updateDraftValue(value: string) {
    setDraft((current) => ({
      ...current,
      rule_value: {
        ...current.rule_value,
        value:
          current.rule_value.type === 'number' ? Number(value) : value,
      },
    }))
  }

  async function saveRow() {
    setSaving(true)
    setError(null)
    try {
      const response = await fetch('/api/commercial-rules', {
        method: editingId === 'new' ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          editingId === 'new' ? draft : { id: editingId, ...draft },
        ),
      })
      const result = (await response.json()) as { error?: string }
      if (!response.ok) {
        throw new Error(result.error ?? 'Não foi possível salvar regra.')
      }
      cancelEdit()
      await refresh()
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : 'Erro ao salvar regra.',
      )
    } finally {
      setSaving(false)
    }
  }

  async function seedDefaults() {
    setSeeding(true)
    setError(null)
    try {
      const response = await fetch('/api/commercial-rules/seed', {
        method: 'POST',
      })
      const result = (await response.json()) as { error?: string }
      if (!response.ok) {
        throw new Error(result.error ?? 'Não foi possível criar regras padrão.')
      }
      await refresh()
    } catch (seedError) {
      setError(
        seedError instanceof Error
          ? seedError.message
          : 'Erro ao criar regras padrão.',
      )
    } finally {
      setSeeding(false)
    }
  }

  async function deactivate(row: CommercialRuleRow) {
    if (!window.confirm(`Inativar regra "${row.rule_key}"?`)) return
    const response = await fetch('/api/commercial-rules', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: row.id, active: false }),
    })
    const result = (await response.json()) as { error?: string }
    if (!response.ok) {
      setError(result.error ?? 'Não foi possível inativar regra.')
      return
    }
    await refresh()
  }

  const categories = useMemo(
    () => [...new Set(data.rows.map((row) => getCommercialRuleCategory(row.rule_key)))],
    [data.rows],
  )

  return (
    <BackofficeTableShell
      title="Regras comerciais"
      subtitle="Dashboard operacional · Catering AI"
      search={search}
      onSearchChange={setSearch}
      searchPlaceholder="rule_key, rótulo ou valor"
      activeFilter={activeFilter}
      onActiveFilterChange={setActiveFilter}
      onRefresh={() => void refresh()}
      loading={loading}
      error={error}
      actions={
        <>
          {data.editable && data.rows.length === 0 ? (
            <button
              type="button"
              onClick={() => void seedDefaults()}
              disabled={seeding}
              className="cdl-btn-primary inline-flex min-h-[44px] items-center justify-center rounded-xl px-5 py-3 text-sm font-bold disabled:opacity-50"
            >
              {seeding ? 'Criando…' : 'Criar regras padrão'}
            </button>
          ) : null}
          <button
            type="button"
            onClick={startNew}
            disabled={!data.editable}
            className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-neutral-200 bg-white px-5 py-3 text-sm font-bold text-neutral-800 shadow-sm disabled:opacity-50"
          >
            Nova regra
          </button>
        </>
      }
    >
      {!data.editable ? (
        <div className="rounded-2xl border border-neutral-200 bg-white p-6 text-sm text-neutral-600 shadow-sm">
          Tabela <code className="text-neutral-900">commercial_rules</code> não encontrada.
          Execute <code className="text-neutral-900">scripts/sql/commercial-rules-key-value.sql</code> no
          Supabase. Valores atuais vêm do fallback em código.
        </div>
      ) : null}

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <PremiumMetricCard label="Total de regras" value={metrics.total} accent="red" />
        <PremiumMetricCard label="Ativas" value={metrics.active} accent="green" />
        <PremiumMetricCard label="Inativas" value={metrics.inactive} />
        <PremiumMetricCard label="Categorias" value={metrics.categories} accent="gold" />
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold text-neutral-800"
        >
          <option value="all">Todas as categorias</option>
          {categories.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold text-neutral-800"
        >
          <option value="all">Todos os tipos</option>
          <option value="text">text</option>
          <option value="number">number</option>
          <option value="long_text">long_text</option>
          <option value="json">json</option>
          <option value="boolean">boolean</option>
        </select>
      </div>

      {editingId === 'new' ? (
        <div className="mb-6">
          <BackofficeFormCard
            title="Nova regra"
            actions={
              <>
                <BackofficeBtnPrimary onClick={() => void saveRow()} disabled={saving}>
                  {saving ? 'Salvando…' : 'Salvar'}
                </BackofficeBtnPrimary>
                <BackofficeBtnSecondary onClick={cancelEdit}>
                  Cancelar
                </BackofficeBtnSecondary>
              </>
            }
          >
            <input
              value={draft.rule_key}
              onChange={(e) => setDraft((c) => ({ ...c, rule_key: e.target.value }))}
              className="col-span-full rounded-xl border border-neutral-200 px-3 py-2 text-sm font-mono"
              placeholder="rule_key"
            />
            <textarea
              rows={2}
              value={String(draft.rule_value.value ?? '')}
              onChange={(e) => updateDraftValue(e.target.value)}
              className="col-span-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
            />
          </BackofficeFormCard>
        </div>
      ) : null}

      <SectionHeader
        title="Regras por categoria"
        subtitle="Cards expansíveis para leitura e manutenção"
      />

      {filteredRows.length === 0 ? (
        <p className="rounded-2xl border border-neutral-200 bg-white p-8 text-center text-sm text-neutral-500 shadow-sm">
          {loading ? 'Carregando…' : 'Nenhuma regra encontrada.'}
        </p>
      ) : (
        <div className="space-y-6">
          {grouped.map(({ category, items }) => {
            const open = expandedGroups[category] ?? true
            return (
              <RuleGroupAccordion
                key={category}
                category={category}
                count={items.length}
                open={open}
                onToggle={() =>
                  setExpandedGroups((current) => ({
                    ...current,
                    [category]: !open,
                  }))
                }
              >
                <div className="space-y-3">
                  {items.map((row) => (
                    <RuleCard
                      key={row.id}
                      row={row}
                      editing={editingId === row.id}
                      draft={draft}
                      saving={saving}
                      onStartEdit={() => startEdit(row)}
                      onCancelEdit={cancelEdit}
                      onSave={() => void saveRow()}
                      onDeactivate={() => void deactivate(row)}
                      onDuplicate={() => duplicateRule(row)}
                      onDraftChange={(patch) =>
                        setDraft((current) => ({ ...current, ...patch }))
                      }
                      onDraftValueChange={updateDraftValue}
                    />
                  ))}
                </div>
              </RuleGroupAccordion>
            )
          })}
        </div>
      )}

      <p className="mt-6 text-xs text-neutral-500">
        Fonte: {data.rules.source === 'supabase' ? 'Supabase' : 'fallback em código'} · Reserva{' '}
        {data.rules.reservationPercentage}% · Base {data.rules.mileageBaseLocation}
      </p>
    </BackofficeTableShell>
  )
}
