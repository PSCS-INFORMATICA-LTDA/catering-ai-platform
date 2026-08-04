'use client'

import { useCallback, useState } from 'react'
import BackofficeTableShell from '@/components/BackofficeTableShell'
import {
  BackofficeBtnPrimary,
  BackofficeBtnSecondary,
  BackofficeCardGrid,
  BackofficeEmptyState,
  BackofficeEntityCard,
  BackofficeField,
  BackofficeFormCard,
  BackofficeInput,
  BackofficeMetaRow,
  BackofficeStatusBadge,
} from '@/components/backoffice/BackofficeCardPrimitives'
import type { OperationalTeam } from '@/Lib/agenda/types'
import { glassField } from '@/Lib/liquidGlass'

type TeamForm = {
  name: string
  color: string
  notes: string
  active: boolean
}

const EMPTY: TeamForm = {
  name: '',
  color: '#e21b1b',
  notes: '',
  active: true,
}

export default function TeamsDashboard({
  initialTeams,
}: {
  initialTeams: OperationalTeam[]
}) {
  const [teams, setTeams] = useState(initialTeams)
  const [draft, setDraft] = useState<TeamForm>(EMPTY)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState<'active' | 'all'>('active')

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (activeFilter === 'all') params.set('active', 'all')
      const res = await fetch(`/api/teams?${params}`, { cache: 'no-store' })
      const json = (await res.json()) as { data?: OperationalTeam[]; error?: string }
      if (!res.ok) throw new Error(json.error ?? 'Falha ao carregar equipes')
      setTeams(json.data ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro')
    } finally {
      setLoading(false)
    }
  }, [activeFilter])

  async function saveCreate() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      })
      const json = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(json.error ?? 'Falha ao criar')
      setDraft(EMPTY)
      setCreating(false)
      await reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro')
    } finally {
      setSaving(false)
    }
  }

  async function saveEdit(id: string) {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/teams/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      })
      const json = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(json.error ?? 'Falha ao salvar')
      setEditingId(null)
      setDraft(EMPTY)
      await reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro')
    } finally {
      setSaving(false)
    }
  }

  const visible = teams.filter((t) => {
    if (activeFilter === 'active' && !t.active) return false
    if (!search.trim()) return true
    const q = search.trim().toLowerCase()
    return t.name.toLowerCase().includes(q) || (t.notes ?? '').toLowerCase().includes(q)
  })

  return (
    <BackofficeTableShell
      title="Equipes"
      subtitle="Cadastre as equipes que aparecem na Agenda de eventos (no lugar da frota do Logistics)."
      search={search}
      onSearchChange={setSearch}
      searchPlaceholder="Buscar equipe…"
      activeFilter={activeFilter}
      onActiveFilterChange={(v) => {
        setActiveFilter(v)
        void (async () => {
          setLoading(true)
          const params = new URLSearchParams()
          if (v === 'all') params.set('active', 'all')
          const res = await fetch(`/api/teams?${params}`, { cache: 'no-store' })
          const json = (await res.json()) as { data?: OperationalTeam[] }
          setTeams(json.data ?? [])
          setLoading(false)
        })()
      }}
      onRefresh={() => void reload()}
      loading={loading}
      error={error}
      actions={
        <BackofficeBtnPrimary
          onClick={() => {
            setCreating(true)
            setEditingId(null)
            setDraft(EMPTY)
          }}
        >
          Nova equipe
        </BackofficeBtnPrimary>
      }
    >
      {creating ? (
        <div className="mb-5">
          <BackofficeFormCard
            title="Nova equipe"
            actions={
              <>
                <BackofficeBtnPrimary
                  disabled={saving || !draft.name.trim()}
                  onClick={() => void saveCreate()}
                >
                  {saving ? 'Salvando…' : 'Cadastrar'}
                </BackofficeBtnPrimary>
                <BackofficeBtnSecondary
                  onClick={() => {
                    setCreating(false)
                    setDraft(EMPTY)
                  }}
                >
                  Cancelar
                </BackofficeBtnSecondary>
              </>
            }
          >
            <BackofficeField label="Nome">
              <BackofficeInput
                value={draft.name}
                onChange={(v) => setDraft((d) => ({ ...d, name: v }))}
              />
            </BackofficeField>
            <BackofficeField label="Cor na agenda">
              <input
                type="color"
                value={draft.color}
                onChange={(e) => setDraft((d) => ({ ...d, color: e.target.value }))}
                className={glassField(false, 'h-11 max-w-[6rem] cursor-pointer !p-1')}
              />
            </BackofficeField>
            <BackofficeField label="Notas" className="sm:col-span-2 lg:col-span-1">
              <BackofficeInput
                value={draft.notes}
                onChange={(v) => setDraft((d) => ({ ...d, notes: v }))}
              />
            </BackofficeField>
          </BackofficeFormCard>
        </div>
      ) : null}

      {visible.length === 0 ? (
        <BackofficeEmptyState message="Nenhuma equipe cadastrada. Cadastre a primeira para usar na agenda." />
      ) : (
        <BackofficeCardGrid>
          {visible.map((team) => {
            const editing = editingId === team.id
            if (editing) {
              return (
                <BackofficeFormCard
                  key={team.id}
                  title={`Editar · ${team.name}`}
                  actions={
                    <>
                      <BackofficeBtnPrimary
                        disabled={saving || !draft.name.trim()}
                        onClick={() => void saveEdit(team.id)}
                      >
                        {saving ? 'Salvando…' : 'Salvar'}
                      </BackofficeBtnPrimary>
                      <BackofficeBtnSecondary
                        onClick={() => {
                          setEditingId(null)
                          setDraft(EMPTY)
                        }}
                      >
                        Cancelar
                      </BackofficeBtnSecondary>
                    </>
                  }
                >
                  <BackofficeField label="Nome">
                    <BackofficeInput
                      value={draft.name}
                      onChange={(v) => setDraft((d) => ({ ...d, name: v }))}
                    />
                  </BackofficeField>
                  <BackofficeField label="Cor">
                    <input
                      type="color"
                      value={draft.color}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, color: e.target.value }))
                      }
                      className={glassField(false, 'h-11 max-w-[6rem] !p-1')}
                    />
                  </BackofficeField>
                  <BackofficeField label="Notas">
                    <BackofficeInput
                      value={draft.notes}
                      onChange={(v) => setDraft((d) => ({ ...d, notes: v }))}
                    />
                  </BackofficeField>
                  <label className="flex items-center gap-2 text-sm text-neutral-700">
                    <input
                      type="checkbox"
                      checked={draft.active}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, active: e.target.checked }))
                      }
                    />
                    Ativa
                  </label>
                </BackofficeFormCard>
              )
            }

            return (
              <BackofficeEntityCard
                key={team.id}
                inactive={!team.active}
                actions={
                  <BackofficeBtnSecondary
                    onClick={() => {
                      setCreating(false)
                      setEditingId(team.id)
                      setDraft({
                        name: team.name,
                        color: team.color,
                        notes: team.notes ?? '',
                        active: team.active,
                      })
                    }}
                  >
                    Editar
                  </BackofficeBtnSecondary>
                }
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="inline-flex items-center gap-2 text-lg font-bold text-neutral-900">
                    <span
                      className="inline-block h-3.5 w-3.5 rounded-full"
                      style={{ background: team.color }}
                      aria-hidden
                    />
                    {team.name}
                  </h3>
                  <BackofficeStatusBadge active={team.active} />
                </div>
                <BackofficeMetaRow label="Notas" value={team.notes || '—'} />
              </BackofficeEntityCard>
            )
          })}
        </BackofficeCardGrid>
      )}
    </BackofficeTableShell>
  )
}
