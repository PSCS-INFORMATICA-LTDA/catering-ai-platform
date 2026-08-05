'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
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
import { getCustomerDisplayName } from '@/Lib/getCustomerDisplayName'
import { glassField } from '@/Lib/liquidGlass'
import type { CustomerSearchRecord } from '@/Lib/searchCustomers'

type PersonOption = CustomerSearchRecord & { id: string }

type TeamForm = {
  name: string
  color: string
  notes: string
  preferred_language: 'pt' | 'en' | 'es'
  contact_person_id: string
  active: boolean
}

const EMPTY: TeamForm = {
  name: '',
  color: '#e21b1b',
  notes: '',
  preferred_language: 'pt',
  contact_person_id: '',
  active: true,
}

function langLabel(code: string | null | undefined) {
  if (code === 'en') return 'English'
  if (code === 'es') return 'Español'
  return 'Português'
}

export default function TeamsDashboard({
  initialTeams,
}: {
  initialTeams: OperationalTeam[]
}) {
  const [teams, setTeams] = useState(initialTeams)
  const [people, setPeople] = useState<PersonOption[]>([])
  const [draft, setDraft] = useState<TeamForm>(EMPTY)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState<'active' | 'all'>('active')

  const loadPeople = useCallback(async () => {
    try {
      const res = await fetch('/api/customers?active=all', { cache: 'no-store' })
      const json = (await res.json()) as { data?: PersonOption[] }
      if (res.ok) setPeople(json.data ?? [])
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    void loadPeople()
  }, [loadPeople])

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (activeFilter === 'all') params.set('active', 'all')
      const res = await fetch(`/api/teams?${params}`, { cache: 'no-store' })
      const json = (await res.json()) as {
        data?: OperationalTeam[]
        error?: string
      }
      if (!res.ok) throw new Error(json.error ?? 'Falha ao carregar equipes')
      setTeams(json.data ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro')
    } finally {
      setLoading(false)
    }
  }, [activeFilter])

  function selectedPerson(id: string) {
    return people.find((p) => p.id === id) ?? null
  }

  function applyPersonToDraft(personId: string) {
    const person = selectedPerson(personId)
    const lang = (person?.preferred_language ?? 'pt').toLowerCase()
    setDraft((d) => ({
      ...d,
      contact_person_id: personId,
      preferred_language: lang === 'en' || lang === 'es' ? lang : 'pt',
    }))
  }

  async function saveCreate() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...draft,
          contact_person_id: draft.contact_person_id || null,
        }),
      })
      const json = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(json.error ?? 'Falha ao criar')
      setDraft(EMPTY)
      setCreating(false)
      await reload()
      await loadPeople()
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
        body: JSON.stringify({
          ...draft,
          contact_person_id: draft.contact_person_id || null,
        }),
      })
      const json = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(json.error ?? 'Falha ao salvar')
      setEditingId(null)
      setDraft(EMPTY)
      await reload()
      await loadPeople()
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
    const contactName = t.contact
      ? getCustomerDisplayName(t.contact).toLowerCase()
      : ''
    return (
      t.name.toLowerCase().includes(q) ||
      (t.notes ?? '').toLowerCase().includes(q) ||
      contactName.includes(q) ||
      (t.contact?.phone ?? '').includes(q)
    )
  })

  function TeamFormFields() {
    const person = selectedPerson(draft.contact_person_id)
    return (
      <>
        <BackofficeField label="Nome da equipe">
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
        <BackofficeField label="Pessoa de contato *" className="sm:col-span-2">
          <select
            className={glassField()}
            value={draft.contact_person_id}
            onChange={(e) => applyPersonToDraft(e.target.value)}
          >
            <option value="">Selecione a pessoa (cadastro único)…</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {getCustomerDisplayName(p)}
                {p.phone ? ` · ${p.phone}` : ''}
                {p.is_team ? ' · Equipe' : ''}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-neutral-500">
            Cadastre telefone, e-mail, endereço e idioma em{' '}
            <Link href="/customers" className="underline">
              Pessoas
            </Link>{' '}
            (marque a flag Equipe). Sem pessoa vinculada não há WhatsApp/SMS/e-mail.
          </p>
        </BackofficeField>
        {person ? (
          <>
            <BackofficeField label="Telefone">
              <BackofficeInput value={person.phone ?? '—'} onChange={() => {}} disabled />
            </BackofficeField>
            <BackofficeField label="E-mail">
              <BackofficeInput value={person.email ?? '—'} onChange={() => {}} disabled />
            </BackofficeField>
            <BackofficeField label="Endereço" className="sm:col-span-2">
              <BackofficeInput
                value={
                  [person.address_line, person.city, person.state]
                    .filter(Boolean)
                    .join(', ') || '—'
                }
                onChange={() => {}}
                disabled
              />
            </BackofficeField>
          </>
        ) : null}
        <BackofficeField label="Idioma das mensagens">
          <select
            className={glassField()}
            value={draft.preferred_language}
            onChange={(e) =>
              setDraft((d) => ({
                ...d,
                preferred_language: e.target.value as 'pt' | 'en' | 'es',
              }))
            }
          >
            <option value="pt">Português</option>
            <option value="en">English</option>
            <option value="es">Español</option>
          </select>
        </BackofficeField>
        <BackofficeField label="Notas" className="sm:col-span-2">
          <BackofficeInput
            value={draft.notes}
            onChange={(v) => setDraft((d) => ({ ...d, notes: v }))}
          />
        </BackofficeField>
      </>
    )
  }

  return (
    <BackofficeTableShell
      title="Equipes"
      subtitle="Recurso da agenda. O contato (telefone, e-mail, endereço, idioma) vem do cadastro único de Pessoas."
      search={search}
      onSearchChange={setSearch}
      searchPlaceholder="Buscar equipe ou contato…"
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
            <TeamFormFields />
          </BackofficeFormCard>
        </div>
      ) : null}

      {visible.length === 0 ? (
        <BackofficeEmptyState message="Nenhuma equipe cadastrada. Cadastre a primeira e vincule uma pessoa." />
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
                    </>
                  }
                >
                  <TeamFormFields />
                </BackofficeFormCard>
              )
            }

            const contactLabel = team.contact
              ? getCustomerDisplayName(team.contact)
              : 'Sem pessoa vinculada'
            const address = team.contact
              ? [team.contact.address_line, team.contact.city, team.contact.state]
                  .filter(Boolean)
                  .join(', ')
              : ''

            return (
              <BackofficeEntityCard
                key={team.id}
                inactive={!team.active}
                actions={
                  <BackofficeBtnSecondary
                    onClick={() => {
                      setCreating(false)
                      setEditingId(team.id)
                      const lang = (
                        team.contact?.preferred_language ||
                        team.preferred_language ||
                        'pt'
                      ).toLowerCase()
                      setDraft({
                        name: team.name,
                        color: team.color,
                        notes: team.notes ?? '',
                        preferred_language:
                          lang === 'en' || lang === 'es' ? lang : 'pt',
                        contact_person_id: team.contact_person_id ?? '',
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
                <BackofficeMetaRow label="Pessoa" value={contactLabel} />
                <BackofficeMetaRow
                  label="Telefone"
                  value={team.contact?.phone || '—'}
                />
                <BackofficeMetaRow
                  label="E-mail"
                  value={team.contact?.email || '—'}
                />
                <BackofficeMetaRow label="Endereço" value={address || '—'} />
                <BackofficeMetaRow
                  label="Idioma"
                  value={langLabel(
                    team.contact?.preferred_language || team.preferred_language,
                  )}
                />
                <BackofficeMetaRow label="Notas" value={team.notes || '—'} />
              </BackofficeEntityCard>
            )
          })}
        </BackofficeCardGrid>
      )}
    </BackofficeTableShell>
  )
}
