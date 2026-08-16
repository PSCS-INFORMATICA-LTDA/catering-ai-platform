import type { OperationalTeam, OperationalTeamContact } from '@/Lib/agenda/types'
import { getSupabaseServerClient } from '@/Lib/supabaseServer'

type TeamRow = {
  id: string
  company_id?: string
  name?: string
  color?: string
  notes?: string | null
  preferred_language?: string | null
  contact_person_id?: string | null
  active?: boolean
  created_at?: string
  updated_at?: string
  [key: string]: unknown
}

export async function hydrateTeamsWithContacts(
  teams: TeamRow[],
  companyId: string,
): Promise<OperationalTeam[]> {
  const ids = [
    ...new Set(
      teams
        .map((t) => t.contact_person_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ]
  if (ids.length === 0) {
    return teams.map((t) => ({
      ...(t as unknown as OperationalTeam),
      contact: null,
    }))
  }

  const { data: people } = await getSupabaseServerClient()
    .from('customers')
    .select(
      'id, full_name, ab_name, phone, email, address_line, city, state, preferred_language',
    )
    .eq('company_id', companyId)
    .in('id', ids)

  const map = new Map<string, OperationalTeamContact>()
  for (const p of people ?? []) {
    map.set(p.id, p as OperationalTeamContact)
  }

  return teams.map((t) => ({
    ...(t as unknown as OperationalTeam),
    contact_person_id: t.contact_person_id ?? null,
    contact: t.contact_person_id
      ? map.get(t.contact_person_id) ?? null
      : null,
  }))
}

export function teamMessageLanguage(team: OperationalTeam): string {
  return (
    team.contact?.preferred_language ||
    team.preferred_language ||
    'pt'
  )
}

export function teamContactPhone(team: OperationalTeam): string | null {
  return team.contact?.phone?.trim() || null
}

export function teamContactEmail(team: OperationalTeam): string | null {
  return team.contact?.email?.trim() || null
}

export function teamContactAddress(team: OperationalTeam): string | null {
  const c = team.contact
  if (!c) return null
  return [c.address_line, c.city, c.state].filter(Boolean).join(', ') || null
}
