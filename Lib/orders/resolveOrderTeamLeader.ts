import { getCustomerDisplayName } from '@/Lib/getCustomerDisplayName'
import { getSupabaseServerClient } from '@/Lib/supabaseServer'

export type OrderTeamLeaderResolution = {
  agendaEventId: string | null
  teamId: string | null
  teamName: string | null
  leaderPersonId: string | null
  leaderName: string | null
  leaderPhone: string | null
  leaderLocale: 'pt' | 'en' | 'es' | null
  blockedReason: 'no_agenda' | 'no_team' | 'no_leader' | null
}

/**
 * Resolve líder da OS: agenda → equipe → member team_leader ou contact_person_id.
 */
export async function resolveOrderTeamLeader(
  companyId: string,
  serviceOrderId: string,
): Promise<OrderTeamLeaderResolution> {
  const db = getSupabaseServerClient()
  const empty: OrderTeamLeaderResolution = {
    agendaEventId: null,
    teamId: null,
    teamName: null,
    leaderPersonId: null,
    leaderName: null,
    leaderPhone: null,
    leaderLocale: null,
    blockedReason: 'no_agenda',
  }

  const { data: evt } = await db
    .from('agenda_events')
    .select('id, team_id, status')
    .eq('company_id', companyId)
    .eq('service_order_id', serviceOrderId)
    .neq('status', 'cancelled')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!evt?.id) return empty
  if (!evt.team_id) {
    return { ...empty, agendaEventId: evt.id, blockedReason: 'no_team' }
  }

  const { data: team } = await db
    .from('operational_teams')
    .select('id, name, contact_person_id')
    .eq('id', evt.team_id)
    .eq('company_id', companyId)
    .maybeSingle()

  if (!team) {
    return {
      ...empty,
      agendaEventId: evt.id,
      teamId: evt.team_id,
      blockedReason: 'no_team',
    }
  }

  const { data: leaderMember } = await db
    .from('operational_team_members')
    .select('person_id')
    .eq('company_id', companyId)
    .eq('team_id', team.id)
    .eq('role_key', 'team_leader')
    .eq('active', true)
    .limit(1)
    .maybeSingle()

  const leaderPersonId =
    leaderMember?.person_id ?? team.contact_person_id ?? null

  if (!leaderPersonId) {
    return {
      agendaEventId: evt.id,
      teamId: team.id,
      teamName: team.name ?? null,
      leaderPersonId: null,
      leaderName: null,
      leaderPhone: null,
      leaderLocale: null,
      blockedReason: 'no_leader',
    }
  }

  const { data: person } = await db
    .from('customers')
    .select('id, full_name, ab_name, phone, preferred_language')
    .eq('id', leaderPersonId)
    .eq('company_id', companyId)
    .maybeSingle()

  const lang = (person?.preferred_language || '').toLowerCase()
  const leaderLocale =
    lang.startsWith('en') ? 'en' : lang.startsWith('es') ? 'es' : lang ? 'pt' : null

  return {
    agendaEventId: evt.id,
    teamId: team.id,
    teamName: team.name ?? null,
    leaderPersonId,
    leaderName: person ? getCustomerDisplayName(person) : null,
    leaderPhone: person?.phone?.trim() || null,
    leaderLocale,
    blockedReason: null,
  }
}
