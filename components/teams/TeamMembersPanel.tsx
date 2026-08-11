'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  OPERATIONAL_ROLE_KEYS,
  operationalRoleLabel,
  type OperationalRoleKey,
} from '@/Lib/agenda/operationalRoles'
import {
  evaluateTeamScale,
  type ScaleMember,
} from '@/Lib/agenda/teamScale'
import { getCustomerDisplayName } from '@/Lib/getCustomerDisplayName'
import type { AuthLocale } from '@/Lib/i18n/authUsers'
import { tCommon } from '@/Lib/i18n/common'
import { tTeams } from '@/Lib/i18n/teams'
import { glassBtn, glassField } from '@/Lib/liquidGlass'
import type { CustomerSearchRecord } from '@/Lib/searchCustomers'

type MemberRow = {
  id: string
  person_id: string
  role_key: string
  active: boolean
  customers?:
    | {
        id: string
        full_name?: string | null
        ab_name?: string | null
        phone?: string | null
      }
    | Array<{
        id: string
        full_name?: string | null
        ab_name?: string | null
        phone?: string | null
      }>
    | null
}

function personFromJoin(raw: MemberRow['customers']) {
  if (!raw) return null
  return Array.isArray(raw) ? raw[0] ?? null : raw
}

export default function TeamMembersPanel({
  teamId,
  locale,
}: {
  teamId: string
  locale: AuthLocale
}) {
  const [members, setMembers] = useState<MemberRow[]>([])
  const [people, setPeople] = useState<CustomerSearchRecord[]>([])
  const [personId, setPersonId] = useState('')
  const [roleKey, setRoleKey] = useState<OperationalRoleKey>('grill_master')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const reload = useCallback(async () => {
    const res = await fetch(`/api/teams/${teamId}/members`, { cache: 'no-store' })
    const json = (await res.json()) as { data?: MemberRow[]; error?: string }
    if (!res.ok) {
      setError(json.error || tTeams(locale, 'loadMembersError'))
      return
    }
    setMembers(json.data ?? [])
  }, [teamId, locale])

  useEffect(() => {
    void reload()
    void (async () => {
      const res = await fetch('/api/customers?active=all', { cache: 'no-store' })
      const json = (await res.json()) as { data?: CustomerSearchRecord[] }
      if (res.ok) setPeople(json.data ?? [])
    })()
  }, [reload])

  const scaleMembers: ScaleMember[] = members.map((m) => {
    const p = personFromJoin(m.customers)
    return {
      person_id: m.person_id,
      role_key: m.role_key,
      active: m.active,
      person_name: p ? getCustomerDisplayName(p) : null,
    }
  })
  const scale = evaluateTeamScale(scaleMembers, undefined, locale)

  useEffect(() => {
    if (scale.nextRole) setRoleKey(scale.nextRole)
  }, [scale.nextRole])

  async function addMember() {
    if (!personId) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/teams/${teamId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ person_id: personId, role_key: roleKey }),
      })
      const json = (await res.json()) as { error?: string }
      if (!res.ok) {
        setError(json.error || tTeams(locale, 'addMemberError'))
        return
      }
      setPersonId('')
      await reload()
    } finally {
      setBusy(false)
    }
  }

  async function removeMember(memberId: string) {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/teams/${teamId}/members/${memberId}`, {
        method: 'DELETE',
      })
      const json = (await res.json()) as { error?: string }
      if (!res.ok) {
        setError(json.error || tTeams(locale, 'removeMemberError'))
        return
      }
      await reload()
    } finally {
      setBusy(false)
    }
  }

  const teamPeople = people.filter((p) => p.is_team || !p.is_supplier)
  const scaleStatus =
    scale.members.length === 0
      ? tTeams(locale, 'scaleNoTeam')
      : scale.closed
        ? tTeams(locale, 'scaleClosed')
        : tTeams(locale, 'scaleIncomplete')

  return (
    <div className="mt-3 space-y-2 border-t border-black/5 pt-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-neutral-800">
          {tTeams(locale, 'composition')}
        </p>
        <span
          className={`rounded px-2 py-0.5 text-xs font-medium ${
            scale.closed
              ? 'bg-emerald-50 text-emerald-800'
              : 'bg-amber-50 text-amber-900'
          }`}
        >
          {scaleStatus}
          {scale.nextRoleLabel
            ? ` · ${tTeams(locale, 'nextRole', { label: scale.nextRoleLabel })}`
            : ''}
        </span>
      </div>

      <ul className="space-y-1 text-sm">
        {members.length === 0 ? (
          <li className="text-neutral-500">{tTeams(locale, 'noMembers')}</li>
        ) : (
          members.map((m) => {
            const p = personFromJoin(m.customers)
            return (
              <li
                key={m.id}
                className="flex items-center justify-between gap-2 rounded bg-black/[0.03] px-2 py-1"
              >
                <span>
                  <strong>{operationalRoleLabel(m.role_key, locale)}</strong>
                  {' · '}
                  {p ? getCustomerDisplayName(p) : m.person_id.slice(0, 8)}
                  {p?.phone ? ` · ${p.phone}` : ''}
                </span>
                <button
                  type="button"
                  className="text-xs text-red-600 underline"
                  disabled={busy}
                  onClick={() => void removeMember(m.id)}
                >
                  {tCommon(locale, 'remove')}
                </button>
              </li>
            )
          })
        )}
      </ul>

      <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
        <select
          className={glassField()}
          value={personId}
          onChange={(e) => setPersonId(e.target.value)}
        >
          <option value="">{tTeams(locale, 'selectPersonShort')}</option>
          {teamPeople.map((p) => (
            <option key={p.id} value={p.id}>
              {getCustomerDisplayName(p)}
              {p.phone ? ` · ${p.phone}` : ''}
            </option>
          ))}
        </select>
        <select
          className={glassField()}
          value={roleKey}
          onChange={(e) => setRoleKey(e.target.value as OperationalRoleKey)}
        >
          {OPERATIONAL_ROLE_KEYS.map((k) => (
            <option key={k} value={k}>
              {operationalRoleLabel(k, locale)}
            </option>
          ))}
        </select>
        <button
          type="button"
          className={glassBtn('primary')}
          disabled={busy || !personId}
          onClick={() => void addMember()}
        >
          {tTeams(locale, 'designate')}
        </button>
      </div>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  )
}
