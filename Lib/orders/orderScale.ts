import { isOperationalRoleKey } from '@/Lib/agenda/operationalRoles'
import { getCustomerDisplayName } from '@/Lib/getCustomerDisplayName'
import type { SupabaseClient } from '@supabase/supabase-js'

export type ScalePerson = {
  id: string
  full_name?: string | null
  ab_name?: string | null
  phone?: string | null
  preferred_language?: string | null
  is_team?: boolean | null
  active?: boolean | null
}

export type ScaleCandidate = {
  id: string
  full_name: string | null
  ab_name: string | null
  phone: string | null
  preferred_language: string | null
  display_name: string
  role_keys: string[]
}

type AgendaEventRow = {
  id: string
  team_id: string
  event_date: string
  start_time: string
  end_time: string
  title: string
  client_name: string | null
  status: string
  quote_id?: string | null
  service_order_id?: string | null
}

function asPerson(raw: unknown): ScalePerson | null {
  if (!raw) return null
  return (Array.isArray(raw) ? raw[0] : raw) as ScalePerson
}

/** Pessoas da escala: flag Equipe, papéis operacionais ou membros de qualquer equipe. */
export async function loadOrderScaleCandidates(
  db: SupabaseClient,
  companyId: string,
  eventTeamId?: string | null,
): Promise<{
  candidates: ScaleCandidate[]
  members: Array<{
    person_id: string
    role_key: string
    customers?: unknown
  }>
}> {
  const [roleRes, peopleRes, allMembersRes, eventMembersRes] = await Promise.all([
    db
      .from('customer_operational_roles')
      .select('person_id, role_key')
      .eq('company_id', companyId)
      .eq('active', true),
    db
      .from('customers')
      .select('id, full_name, ab_name, phone, preferred_language, is_team, active')
      .eq('company_id', companyId)
      .eq('active', true),
    db
      .from('operational_team_members')
      .select('person_id, role_key, team_id')
      .eq('company_id', companyId)
      .eq('active', true),
    eventTeamId
      ? db
          .from('operational_team_members')
          .select(
            'id, person_id, role_key, customers:person_id(id, full_name, ab_name, phone, preferred_language)',
          )
          .eq('company_id', companyId)
          .eq('team_id', eventTeamId)
          .eq('active', true)
      : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
  ])

  const rolesByPerson = new Map<string, string[]>()
  const addRole = (personId: string, roleKey: string) => {
    if (!isOperationalRoleKey(roleKey)) return
    const cur = rolesByPerson.get(personId) ?? []
    if (!cur.includes(roleKey)) cur.push(roleKey)
    rolesByPerson.set(personId, cur)
  }

  for (const row of roleRes.data ?? []) addRole(row.person_id, row.role_key)
  for (const row of allMembersRes.data ?? []) addRole(row.person_id, row.role_key)

  const memberPersonIds = new Set(
    (allMembersRes.data ?? []).map((m) => m.person_id),
  )
  const peopleById = new Map<string, ScalePerson>()
  for (const p of peopleRes.data ?? []) {
    if (p.is_team || rolesByPerson.has(p.id) || memberPersonIds.has(p.id)) {
      peopleById.set(p.id, p)
    }
  }
  for (const m of eventMembersRes.data ?? []) {
    const person = asPerson((m as { customers?: unknown }).customers)
    if (person?.id) peopleById.set(person.id, person)
  }

  const candidates = [...peopleById.values()]
    .filter((p) => p.active !== false)
    .map((p) => ({
      id: p.id,
      full_name: p.full_name ?? null,
      ab_name: p.ab_name ?? null,
      phone: p.phone?.trim() || null,
      preferred_language: p.preferred_language ?? null,
      display_name: getCustomerDisplayName(p),
      role_keys: rolesByPerson.get(p.id) ?? [],
    }))
    .sort((a, b) => a.display_name.localeCompare(b.display_name, 'pt'))

  return {
    candidates,
    members: (eventMembersRes.data ?? []) as Array<{
      person_id: string
      role_key: string
      customers?: unknown
    }>,
  }
}

export async function resolveAgendaEventForOrder(
  db: SupabaseClient,
  companyId: string,
  order: { id: string; quote_id?: string | null },
): Promise<AgendaEventRow | null> {
  const { data: byOrder } = await db
    .from('agenda_events')
    .select(
      'id, team_id, event_date, start_time, end_time, title, client_name, status, quote_id, service_order_id',
    )
    .eq('company_id', companyId)
    .eq('service_order_id', order.id)
    .neq('status', 'cancelled')
    .maybeSingle()
  if (byOrder) return byOrder as AgendaEventRow

  const quoteId = order.quote_id?.trim()
  if (!quoteId) return null

  const { data: byQuoteRows } = await db
    .from('agenda_events')
    .select(
      'id, team_id, event_date, start_time, end_time, title, client_name, status, quote_id, service_order_id',
    )
    .eq('company_id', companyId)
    .eq('quote_id', quoteId)
    .neq('status', 'cancelled')
    .order('created_at', { ascending: false })
    .limit(1)

  const byQuote = (byQuoteRows ?? [])[0] as AgendaEventRow | undefined
  if (!byQuote) return null

  await db
    .from('agenda_events')
    .update({
      service_order_id: order.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', byQuote.id)
    .eq('company_id', companyId)

  return { ...byQuote, service_order_id: order.id }
}

async function nextEventCode(
  db: SupabaseClient,
  companyId: string,
): Promise<string> {
  const { data } = await db
    .from('agenda_events')
    .select('code')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(50)

  let max = 0
  for (const row of data ?? []) {
    const m = String(row.code ?? '').match(/EVT-(\d+)/i)
    if (m) max = Math.max(max, Number(m[1]))
  }
  return `EVT-${String(max + 1).padStart(4, '0')}`
}

export async function ensureAgendaEventForOrder(
  db: SupabaseClient,
  companyId: string,
  order: {
    id: string
    quote_id?: string | null
    event_date?: string | null
    start_time?: string | null
    end_time?: string | null
    service_order_number?: string | null
  },
  personIds: string[] = [],
): Promise<AgendaEventRow | null> {
  const existing = await resolveAgendaEventForOrder(db, companyId, order)
  if (existing) return existing

  let teamId: string | null = null
  if (personIds.length) {
    const { data: memberships } = await db
      .from('operational_team_members')
      .select('team_id, person_id')
      .eq('company_id', companyId)
      .eq('active', true)
      .in('person_id', personIds)
    teamId = memberships?.[0]?.team_id ?? null
  }
  if (!teamId) {
    const { data: teams } = await db
      .from('operational_teams')
      .select('id')
      .eq('company_id', companyId)
      .eq('active', true)
      .order('created_at', { ascending: true })
      .limit(1)
    teamId = teams?.[0]?.id ?? null
  }
  if (!teamId) return null

  const eventDate = order.event_date?.trim() || new Date().toISOString().slice(0, 10)
  const startTime = order.start_time?.trim() || '10:00:00'
  const endTime = order.end_time?.trim() || '18:00:00'
  const title = order.service_order_number
    ? `OS ${order.service_order_number}`
    : 'Ordem de Serviço'
  const code = await nextEventCode(db, companyId)

  const { data: created, error } = await db
    .from('agenda_events')
    .insert({
      company_id: companyId,
      team_id: teamId,
      code,
      title,
      event_date: eventDate,
      start_time: startTime,
      end_time: endTime,
      status: 'scheduled',
      quote_id: order.quote_id || null,
      service_order_id: order.id,
    })
    .select(
      'id, team_id, event_date, start_time, end_time, title, client_name, status, quote_id, service_order_id',
    )
    .single()

  if (error || !created) return null
  return created as AgendaEventRow
}

export async function linkAgendaEventToServiceOrder(
  db: SupabaseClient,
  companyId: string,
  quoteId: string,
  serviceOrderId: string,
) {
  // Idempotente: vincula OS ao evento já reservado no sinal.
  // reserved → scheduled; não cria segundo agenda_event.
  await db
    .from('agenda_events')
    .update({
      service_order_id: serviceOrderId,
      status: 'scheduled',
      updated_at: new Date().toISOString(),
    })
    .eq('company_id', companyId)
    .eq('quote_id', quoteId)
    .in('status', ['reserved', 'scheduled'])
}
