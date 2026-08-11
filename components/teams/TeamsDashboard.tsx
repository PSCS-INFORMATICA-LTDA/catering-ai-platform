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
import { tCommon } from '@/Lib/i18n/common'
import { tTeams } from '@/Lib/i18n/teams'
import { useAuthLocaleFromMe } from '@/Lib/i18n/useAuthLocaleFromMe'
import { glassField } from '@/Lib/liquidGlass'
import type { CustomerSearchRecord } from '@/Lib/searchCustomers'
import TeamMembersPanel from '@/components/teams/TeamMembersPanel'

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

function langLabel(
  locale: ReturnType<typeof useAuthLocaleFromMe>,
  code: string | null | undefined,
) {
  if (code === 'en') return tCommon(locale, 'english')
  if (code === 'es') return tCommon(locale, 'spanish')
  return tCommon(locale, 'portuguese')
}

export default function TeamsDashboard({
  initialTeams,
}: {
  initialTeams: OperationalTeam[]
}) {
  const locale = useAuthLocaleFromMe()
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
      if (!res.ok) throw new Error(json.error ?? tTeams(locale, 'loadError'))
      setTeams(json.data ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : tTeams(locale, 'genericError'))
    } finally {
      setLoading(false)
    }
  }, [activeFilter, locale])

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
      if (!res.ok) throw new Error(json.error ?? tTeams(locale, 'createError'))
      setDraft(EMPTY)
      setCreating(false)
      await reload()
      await loadPeople()
    } catch (e) {
      setError(e instanceof Error ? e.message : tTeams(locale, 'genericError'))
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
      if (!res.ok) throw new Error(json.error ?? tTeams(locale, 'saveError'))
      setEditingId(null)
      setDraft(EMPTY)
      await reload()
      await loadPeople()
    } catch (e) {
      setError(e instanceof Error ? e.message : tTeams(locale, 'genericError'))
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
        <BackofficeField label={tTeams(locale, 'teamName')}>
          <BackofficeInput
            value={draft.name}
            onChange={(v) => setDraft((d) => ({ ...d, name: v }))}
          />
        </BackofficeField>
        <BackofficeField label={tTeams(locale, 'agendaColor')}>
          <input
            type="color"
            value={draft.color}
            onChange={(e) => setDraft((d) => ({ ...d, color: e.target.value }))}
            className={glassField(false, 'h-11 max-w-[6rem] cursor-pointer !p-1')}
          />
        </BackofficeField>
        <BackofficeField label={tTeams(locale, 'contactPerson')} className="sm:col-span-2">
          <select
            className={glassField()}
            value={draft.contact_person_id}
            onChange={(e) => applyPersonToDraft(e.target.value)}
          >
            <option value="">{tTeams(locale, 'selectPerson')}</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {getCustomerDisplayName(p)}
                {p.phone ? ` · ${p.phone}` : ''}
                {p.is_team ? ` · ${tCommon(locale, 'team')}` : ''}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-neutral-500">
            {tTeams(locale, 'contactHintBefore')}{' '}
            <Link href="/customers" className="underline">
              {tTeams(locale, 'peopleLink')}
            </Link>{' '}
            {tTeams(locale, 'contactHintAfter')}
          </p>
        </BackofficeField>
        {person ? (
          <>
            <BackofficeField label={tCommon(locale, 'phone')}>
              <BackofficeInput value={person.phone ?? '—'} onChange={() => {}} disabled />
            </BackofficeField>
            <BackofficeField label={tCommon(locale, 'email')}>
              <BackofficeInput value={person.email ?? '—'} onChange={() => {}} disabled />
            </BackofficeField>
            <BackofficeField label={tCommon(locale, 'address')} className="sm:col-span-2">
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
        <BackofficeField label={tTeams(locale, 'messageLanguage')}>
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
            <option value="pt">{tCommon(locale, 'portuguese')}</option>
            <option value="en">{tCommon(locale, 'english')}</option>
            <option value="es">{tCommon(locale, 'spanish')}</option>
          </select>
        </BackofficeField>
        <BackofficeField label={tCommon(locale, 'notes')} className="sm:col-span-2">
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
      title={tTeams(locale, 'title')}
      subtitle={tTeams(locale, 'subtitle')}
      search={search}
      onSearchChange={setSearch}
      searchPlaceholder={tTeams(locale, 'searchPlaceholder')}
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
          {tTeams(locale, 'newTeam')}
        </BackofficeBtnPrimary>
      }
    >
      {creating ? (
        <div className="mb-5">
          <BackofficeFormCard
            title={tTeams(locale, 'newTeam')}
            actions={
              <>
                <BackofficeBtnPrimary
                  disabled={saving || !draft.name.trim()}
                  onClick={() => void saveCreate()}
                >
                  {saving ? tCommon(locale, 'saving') : tTeams(locale, 'register')}
                </BackofficeBtnPrimary>
                <BackofficeBtnSecondary
                  onClick={() => {
                    setCreating(false)
                    setDraft(EMPTY)
                  }}
                >
                  {tCommon(locale, 'cancel')}
                </BackofficeBtnSecondary>
              </>
            }
          >
            <TeamFormFields />
          </BackofficeFormCard>
        </div>
      ) : null}

      {visible.length === 0 ? (
        <BackofficeEmptyState message={tTeams(locale, 'empty')} />
      ) : (
        <BackofficeCardGrid>
          {visible.map((team) => {
            const editing = editingId === team.id
            if (editing) {
              return (
                <BackofficeFormCard
                  key={team.id}
                  title={tTeams(locale, 'editTeam', { name: team.name })}
                  actions={
                    <>
                      <BackofficeBtnPrimary
                        disabled={saving || !draft.name.trim()}
                        onClick={() => void saveEdit(team.id)}
                      >
                        {saving ? tCommon(locale, 'saving') : tCommon(locale, 'save')}
                      </BackofficeBtnPrimary>
                      <BackofficeBtnSecondary
                        onClick={() => {
                          setEditingId(null)
                          setDraft(EMPTY)
                        }}
                      >
                        {tCommon(locale, 'cancel')}
                      </BackofficeBtnSecondary>
                      <label className="flex items-center gap-2 text-sm text-neutral-700">
                        <input
                          type="checkbox"
                          checked={draft.active}
                          onChange={(e) =>
                            setDraft((d) => ({ ...d, active: e.target.checked }))
                          }
                        />
                        {tTeams(locale, 'activeTeam')}
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
              : tTeams(locale, 'noContact')
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
                    {tCommon(locale, 'edit')}
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
                <BackofficeMetaRow label={tCommon(locale, 'person')} value={contactLabel} />
                <BackofficeMetaRow
                  label={tCommon(locale, 'phone')}
                  value={team.contact?.phone || '—'}
                />
                <BackofficeMetaRow
                  label={tCommon(locale, 'email')}
                  value={team.contact?.email || '—'}
                />
                <BackofficeMetaRow label={tCommon(locale, 'address')} value={address || '—'} />
                <BackofficeMetaRow
                  label={tCommon(locale, 'language')}
                  value={langLabel(
                    locale,
                    team.contact?.preferred_language || team.preferred_language,
                  )}
                />
                <BackofficeMetaRow label={tCommon(locale, 'notes')} value={team.notes || '—'} />
                <TeamMembersPanel teamId={team.id} locale={locale} />
              </BackofficeEntityCard>
            )
          })}
        </BackofficeCardGrid>
      )}
    </BackofficeTableShell>
  )
}
