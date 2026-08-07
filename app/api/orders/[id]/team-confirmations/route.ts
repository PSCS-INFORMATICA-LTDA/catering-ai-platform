import { loadScheduleTurnaroundConfig } from '@/Lib/agenda/loadScheduleTurnaroundConfig'
import { logScheduleConflictAudit } from '@/Lib/agenda/logScheduleConflictAudit'
import { findPersonTimeConflict } from '@/Lib/agenda/scheduleConflicts'
import {
  rejectSpoofedCompanyId,
  requireApiPermission,
  resolveAuthorizedCompanyId,
} from '@/Lib/auth/requireApi'
import { writeOperationalAudit } from '@/Lib/orders/writeOperationalAudit'
import { getSupabaseServerClient } from '@/Lib/supabaseServer'
import {
  buildPublicTeamMemberConfirmationUrl,
  buildTeamMemberConfirmationWhatsAppText,
  defaultConfirmationExpiryIso,
  hashTeamMemberConfirmationToken,
  newTeamMemberConfirmationToken,
} from '@/Lib/teamMemberConfirmation'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_request: Request, context: Ctx) {
  const auth = await requireApiPermission('orders.view')
  if (!auth.ok) return auth.response

  const { id: orderId } = await context.params
  const companyId = resolveAuthorizedCompanyId(auth.session)
  const db = getSupabaseServerClient()

  const { data: order } = await db
    .from('service_orders')
    .select('id, company_id')
    .eq('id', orderId)
    .eq('company_id', companyId)
    .maybeSingle()
  if (!order) {
    return Response.json({ error: 'OS não encontrada.' }, { status: 404 })
  }

  const { data: evt } = await db
    .from('agenda_events')
    .select('id, team_id, event_date, start_time, end_time, title, client_name, status')
    .eq('company_id', companyId)
    .eq('service_order_id', orderId)
    .maybeSingle()

  if (!evt) {
    return Response.json({ data: { event: null, members: [], confirmations: [], summary: null } })
  }

  const { data: members } = await db
    .from('operational_team_members')
    .select(
      'id, person_id, role_key, customers:person_id(id, full_name, ab_name, phone, preferred_language)',
    )
    .eq('company_id', companyId)
    .eq('team_id', evt.team_id)
    .eq('active', true)

  const { data: confirmations } = await db
    .from('agenda_event_member_confirmations')
    .select(
      'id, person_id, role_key, status, sent_at, responded_at, token_expires_at, token_revoked_at',
    )
    .eq('company_id', companyId)
    .eq('agenda_event_id', evt.id)
    .order('created_at', { ascending: true })

  const list = confirmations ?? []
  const summary = {
    confirmed: list.filter((c) => c.status === 'confirmed').length,
    pending: list.filter((c) => c.status === 'pending').length,
    declined: list.filter((c) => c.status === 'declined').length,
    cancelled: list.filter((c) => c.status === 'cancelled').length,
  }

  return Response.json({
    data: { event: evt, members: members ?? [], confirmations: list, summary },
  })
}

/** Gera/reenvia confirmações individuais para membros ativos da equipe. */
export async function POST(request: Request, context: Ctx) {
  const auth = await requireApiPermission('orders.manage')
  if (!auth.ok) return auth.response

  const { id: orderId } = await context.params
  const companyId = resolveAuthorizedCompanyId(auth.session)

  let body: { company_id?: string; action?: string } = {}
  try {
    body = await request.json()
  } catch {
    body = {}
  }
  const spoof = rejectSpoofedCompanyId(auth.session, body.company_id)
  if (spoof) return spoof

  const db = getSupabaseServerClient()
  const { data: order } = await db
    .from('service_orders')
    .select('id, company_id')
    .eq('id', orderId)
    .eq('company_id', companyId)
    .maybeSingle()
  if (!order) {
    return Response.json({ error: 'OS não encontrada.' }, { status: 404 })
  }

  const { data: evt } = await db
    .from('agenda_events')
    .select(
      'id, team_id, event_date, start_time, end_time, title, client_name, status, quote_id',
    )
    .eq('company_id', companyId)
    .eq('service_order_id', orderId)
    .maybeSingle()

  if (!evt || evt.status !== 'scheduled') {
    return Response.json(
      { error: 'Evento da agenda não encontrado ou não agendado.' },
      { status: 400 },
    )
  }

  const { data: team } = await db
    .from('operational_teams')
    .select('id, name')
    .eq('id', evt.team_id)
    .eq('company_id', companyId)
    .maybeSingle()

  const { data: company } = await db
    .from('companies')
    .select('company_name, trade_name')
    .eq('id', companyId)
    .maybeSingle()

  const { data: members } = await db
    .from('operational_team_members')
    .select(
      'person_id, role_key, customers:person_id(id, full_name, ab_name, phone, preferred_language)',
    )
    .eq('company_id', companyId)
    .eq('team_id', evt.team_id)
    .eq('active', true)

  if (!members?.length) {
    return Response.json(
      { error: 'Equipe sem integrantes ativos. Adicione Pessoas à equipe.' },
      { status: 400 },
    )
  }

  // Conflito de pessoa com outros eventos
  const personIds = [...new Set(members.map((m) => m.person_id))]
  const { data: otherConfs } = await db
    .from('agenda_event_member_confirmations')
    .select('person_id, team_id, agenda_event_id, status')
    .eq('company_id', companyId)
    .in('person_id', personIds)
    .in('status', ['pending', 'confirmed'])
    .neq('agenda_event_id', evt.id)

  const otherEventIds = [
    ...new Set((otherConfs ?? []).map((c) => c.agenda_event_id)),
  ]
  const eventsById = new Map<
    string,
    {
      id: string
      team_id: string
      event_date: string
      start_time: string
      end_time: string
      status: string
    }
  >()
  if (otherEventIds.length) {
    const { data: otherEvents } = await db
      .from('agenda_events')
      .select('id, team_id, event_date, start_time, end_time, status')
      .eq('company_id', companyId)
      .in('id', otherEventIds)
    for (const e of otherEvents ?? []) eventsById.set(e.id, e)
  }

  const { config: turnaroundConfig } =
    await loadScheduleTurnaroundConfig(companyId)
  const personConflict = findPersonTimeConflict({
    personIds,
    eventDate: evt.event_date,
    startTime: evt.start_time,
    endTime: evt.end_time,
    excludeEventId: evt.id,
    eventsById,
    confirmations: otherConfs ?? [],
    config: turnaroundConfig,
  })
  if (personConflict) {
    await logScheduleConflictAudit({
      companyId,
      actorUserId: auth.session.userId,
      entityId: evt.id,
      teamId: evt.team_id,
      personId: personConflict.personId,
      proposedEventId: evt.id,
      conflictingEventId: personConflict.event.id,
      result: personConflict.result,
      minGapMinutes: personConflict.result.minGapMinutes,
      baseRadiusMiles: turnaroundConfig.base_radius_miles,
    })
    return Response.json(
      {
        error: personConflict.result.messagePt,
        conflict: {
          code: personConflict.result.code,
          person_id: personConflict.personId,
          event_id: personConflict.event.id,
          blocked_until: personConflict.result.blockedUntil,
          next_available_start: personConflict.result.nextAvailableStart,
          min_gap_minutes: personConflict.result.minGapMinutes,
          message_pt: personConflict.result.messagePt,
          message_en: personConflict.result.messageEn,
          message_es: personConflict.result.messageEs,
        },
      },
      { status: 409 },
    )
  }

  let location: string | null = null
  if (evt.quote_id) {
    const { data: q } = await db
      .from('quotes')
      .select('event_id, events:event_id(address_line, city, state)')
      .eq('id', evt.quote_id)
      .maybeSingle()
    const ev = q?.events as
      | { address_line?: string; city?: string; state?: string }
      | null
      | undefined
    if (ev) {
      location =
        [ev.address_line, ev.city, ev.state].filter(Boolean).join(', ') || null
    }
  }

  const shares: Array<{
    person_id: string
    role_key: string
    phone: string | null
    whatsappText: string
    confirmUrl: string
    confirmation_id: string
  }> = []

  for (const member of members) {
    const rawPerson = member.customers as unknown
    const person = (
      Array.isArray(rawPerson) ? rawPerson[0] : rawPerson
    ) as {
      id: string
      full_name?: string
      ab_name?: string
      phone?: string | null
      preferred_language?: string | null
    } | null

    // Cancela pending anterior da mesma pessoa neste evento
    await db
      .from('agenda_event_member_confirmations')
      .update({
        status: 'cancelled',
        token_revoked_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('company_id', companyId)
      .eq('agenda_event_id', evt.id)
      .eq('person_id', member.person_id)
      .eq('status', 'pending')

    const rawToken = newTeamMemberConfirmationToken()
    const tokenHash = hashTeamMemberConfirmationToken(rawToken)
    const confirmUrl = buildPublicTeamMemberConfirmationUrl(rawToken)

    const { data: row, error } = await db
      .from('agenda_event_member_confirmations')
      .insert({
        company_id: companyId,
        agenda_event_id: evt.id,
        team_id: evt.team_id,
        person_id: member.person_id,
        role_key: member.role_key,
        status: 'pending',
        token_hash: tokenHash,
        token_expires_at: defaultConfirmationExpiryIso(14),
        sent_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (error || !row) {
      return Response.json(
        { error: error?.message || 'Falha ao criar confirmação.' },
        { status: 500 },
      )
    }

    const localeRaw = (person?.preferred_language || 'pt').slice(0, 2)
    const locale =
      localeRaw === 'en' || localeRaw === 'es' ? localeRaw : ('pt' as const)

    const whatsappText = buildTeamMemberConfirmationWhatsAppText({
      companyName: company?.trade_name || company?.company_name,
      eventDate: evt.event_date,
      startTime: evt.start_time,
      endTime: evt.end_time,
      eventTitle: evt.title,
      location,
      teamName: team?.name || 'Equipe',
      roleKey: member.role_key,
      confirmUrl,
      locale,
    })

    shares.push({
      person_id: member.person_id,
      role_key: member.role_key,
      phone: person?.phone?.trim() || null,
      whatsappText,
      confirmUrl,
      confirmation_id: row.id,
    })
  }

  await writeOperationalAudit({
    companyId,
    entityType: 'service_order',
    entityId: orderId,
    action: 'team_scale_sent',
    actorUserId: auth.session.userId,
    newData: {
      agenda_event_id: evt.id,
      count: shares.length,
    },
  })

  return Response.json({ data: { shares, event: evt } }, { status: 201 })
}
