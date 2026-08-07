import { TEAM_DAY_BUSY_MESSAGE } from '@/Lib/agenda/teamAvailability'
import {
  requireApiPermission,
  resolveAuthorizedCompanyId,
} from '@/Lib/auth/requireApi'
import {
  buildPublicTeamAssignmentUrl,
  normalizeTimeForDb,
  newTeamAssignmentToken,
} from '@/Lib/teamAssignment'
import { hydrateTeamsWithContacts } from '@/Lib/teamContacts'
import { getSupabaseServerClient } from '@/Lib/supabaseServer'
import { writeOperationalAudit } from '@/Lib/orders/writeOperationalAudit'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type Params = { params: Promise<{ id: string }> }

async function nextEventCode(companyId: string): Promise<string> {
  const { data } = await getSupabaseServerClient()
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

function assignmentPayload(event: Record<string, unknown> | null) {
  if (!event) return null
  const token =
    typeof event.team_assignment_token === 'string'
      ? event.team_assignment_token
      : null
  return {
    event_id: event.id,
    code: event.code,
    team_id: event.team_id,
    event_date: event.event_date,
    start_time: event.start_time,
    end_time: event.end_time,
    presentation_time: event.presentation_time,
    status: event.status,
    team_assignment_token: token,
    team_assignment_response: event.team_assignment_response ?? 'pending',
    team_assignment_sent_at: event.team_assignment_sent_at ?? null,
    team_assignment_accepted_at: event.team_assignment_accepted_at ?? null,
    team_assignment_rejected_at: event.team_assignment_rejected_at ?? null,
    public_url: token ? buildPublicTeamAssignmentUrl(token) : null,
  }
}

export async function GET(_request: Request, { params }: Params) {
  const auth = await requireApiPermission('quotes.view')
  if (!auth.ok) return auth.response

  const { id } = await params
  const companyId = resolveAuthorizedCompanyId(auth.session)
  const db = getSupabaseServerClient()

  const { data: quote, error } = await db
    .from('quotes')
    .select(
      'id, company_id, quote_number, quote_status, proposal_response, team_presentation_time, designated_team_id, event_id, customer_id, active, reservation_confirmed_at',
    )
    .eq('id', id)
    .eq('company_id', companyId)
    .maybeSingle()

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }
  if (!quote) {
    return Response.json({ error: 'Cotação não encontrada' }, { status: 404 })
  }

  const { data: agendaEvent } = await db
    .from('agenda_events')
    .select('*')
    .eq('company_id', companyId)
    .eq('quote_id', id)
    .neq('status', 'cancelled')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const [teamsRes, eventRes, customerRes] = await Promise.all([
    db
      .from('operational_teams')
      .select(
        'id, name, color, notes, preferred_language, contact_person_id, active',
      )
      .eq('company_id', companyId)
      .eq('active', true)
      .order('name'),
    quote.event_id
      ? db
          .from('events')
          .select(
            'event_date, start_time, end_time, event_name, address_line, city, state',
          )
          .eq('id', quote.event_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    quote.customer_id
      ? db
          .from('customers')
          .select('full_name, ab_name, contact_name, company_name, phone')
          .eq('id', quote.customer_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const teams = await hydrateTeamsWithContacts(teamsRes.data ?? [], companyId)
  const event = eventRes.data
  const customer = customerRes.data
  const clientName =
    customer?.full_name ||
    customer?.ab_name ||
    customer?.contact_name ||
    customer?.company_name ||
    null

  const eventDate = event?.event_date ?? null
  let dayBusy: Array<{ team_id: string; id: string }> = []
  if (eventDate) {
    const { data: dayRows } = await db
      .from('agenda_events')
      .select('id, team_id, event_date, status, quote_id')
      .eq('company_id', companyId)
      .eq('event_date', eventDate)
      .in('status', ['scheduled', 'completed'])
    dayBusy = (dayRows ?? []) as Array<{ team_id: string; id: string }>
  }

  const busyTeamIds = new Set(
    dayBusy
      .filter((e) => !agendaEvent || e.id !== agendaEvent.id)
      .map((e) => e.team_id),
  )

  const availableTeams = teams.filter((t) => !busyTeamIds.has(t.id))

  return Response.json({
    data: {
      quote_id: quote.id,
      quote_number: quote.quote_number,
      quote_status: quote.quote_status,
      proposal_response: quote.proposal_response ?? 'pending',
      team_presentation_time: quote.team_presentation_time,
      designated_team_id: quote.designated_team_id,
      reservation_confirmed_at:
        (quote as { reservation_confirmed_at?: string | null })
          .reservation_confirmed_at ?? null,
      event_date: eventDate,
      start_time: event?.start_time ?? null,
      end_time: event?.end_time ?? null,
      event_name: event?.event_name ?? null,
      address: [event?.address_line, event?.city, event?.state]
        .filter(Boolean)
        .join(', ') || null,
      client_name: clientName,
      customer_phone: customer?.phone ?? null,
      available_teams: availableTeams,
      all_teams: teams,
      assignment: assignmentPayload(agendaEvent),
    },
  })
}

export async function POST(request: Request, { params }: Params) {
  const auth = await requireApiPermission('quotes.manage')
  if (!auth.ok) return auth.response

  const { id } = await params
  const companyId = resolveAuthorizedCompanyId(auth.session)
  let body: {
    action?: string
    team_id?: string
    presentation_time?: string
  }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Payload inválido.' }, { status: 400 })
  }

  const action = body.action ?? 'designate'
  const db = getSupabaseServerClient()

  const { data: quote, error: qErr } = await db
    .from('quotes')
    .select(
      'id, company_id, quote_number, quote_status, proposal_response, team_presentation_time, designated_team_id, event_id, customer_id, package_id, active, reservation_confirmed_at',
    )
    .eq('id', id)
    .eq('company_id', companyId)
    .eq('active', true)
    .maybeSingle()

  if (qErr) {
    return Response.json({ error: qErr.message }, { status: 500 })
  }
  if (!quote) {
    return Response.json({ error: 'Cotação não encontrada' }, { status: 404 })
  }

  const accepted =
    quote.proposal_response === 'accepted' ||
    quote.quote_status === 'approved' ||
    quote.quote_status === 'accepted'
  if (!accepted && action !== 'mark_sent') {
    return Response.json(
      {
        error:
          'A cotação precisa estar aceita/aprovada pelo cliente antes de designar a equipe.',
      },
      { status: 409 },
    )
  }

  const reservationConfirmed = Boolean(
    (quote as { reservation_confirmed_at?: string | null })
      .reservation_confirmed_at,
  )
  if (
    !reservationConfirmed &&
    (action === 'designate' || action == null || action === '')
  ) {
    return Response.json(
      {
        error:
          'Confirme o recebimento do sinal (30%) antes de designar a equipe e fechar a agenda.',
      },
      { status: 409 },
    )
  }

  if (action === 'save_presentation') {
    const presentation =
      typeof body.presentation_time === 'string'
        ? body.presentation_time.trim()
        : ''
    if (!/^\d{2}:\d{2}/.test(presentation)) {
      return Response.json(
        { error: 'Informe o horário de apresentação (HH:MM).' },
        { status: 400 },
      )
    }
    const { error } = await db
      .from('quotes')
      .update({
        team_presentation_time: normalizeTimeForDb(presentation),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
    if (error) {
      return Response.json({ error: error.message }, { status: 500 })
    }
    return Response.json({
      data: { team_presentation_time: normalizeTimeForDb(presentation) },
    })
  }

  if (action === 'mark_sent') {
    const { data: existing } = await db
      .from('agenda_events')
      .select('*')
      .eq('company_id', companyId)
      .eq('quote_id', id)
      .neq('status', 'cancelled')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!existing) {
      return Response.json(
        { error: 'Designe a equipe antes de registrar o envio.' },
        { status: 409 },
      )
    }

    let token = existing.team_assignment_token as string | null
    if (!token) {
      token = newTeamAssignmentToken()
    }

    const { data: updated, error } = await db
      .from('agenda_events')
      .update({
        team_assignment_token: token,
        team_assignment_sent_at:
          existing.team_assignment_sent_at ?? new Date().toISOString(),
        team_assignment_response:
          existing.team_assignment_response === 'accepted'
            ? 'accepted'
            : 'pending',
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .select('*')
      .single()

    if (error) {
      return Response.json({ error: error.message }, { status: 500 })
    }
    return Response.json({ data: { assignment: assignmentPayload(updated) } })
  }

  // designate
  const teamId = typeof body.team_id === 'string' ? body.team_id : ''
  const presentationRaw =
    typeof body.presentation_time === 'string' && body.presentation_time.trim()
      ? body.presentation_time.trim()
      : quote.team_presentation_time
        ? String(quote.team_presentation_time).slice(0, 5)
        : ''

  if (!teamId) {
    return Response.json({ error: 'Selecione a equipe.' }, { status: 400 })
  }
  if (!/^\d{2}:\d{2}/.test(presentationRaw)) {
    return Response.json(
      { error: 'Informe o horário de apresentação no local (HH:MM).' },
      { status: 400 },
    )
  }

  if (!quote.event_id) {
    return Response.json(
      { error: 'Cotação sem evento vinculado (data/horário).' },
      { status: 409 },
    )
  }

  const { data: event } = await db
    .from('events')
    .select('event_date, start_time, end_time, event_name')
    .eq('id', quote.event_id)
    .maybeSingle()

  if (!event?.event_date || !event.start_time || !event.end_time) {
    return Response.json(
      { error: 'Evento sem data ou horário completo.' },
      { status: 409 },
    )
  }

  const { data: team } = await db
    .from('operational_teams')
    .select('id, name')
    .eq('id', teamId)
    .eq('company_id', companyId)
    .eq('active', true)
    .maybeSingle()

  if (!team) {
    return Response.json({ error: 'Equipe inválida ou inativa.' }, { status: 400 })
  }

  const { data: existingForQuote } = await db
    .from('agenda_events')
    .select('*')
    .eq('company_id', companyId)
    .eq('quote_id', id)
    .neq('status', 'cancelled')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data: busy } = await db
    .from('agenda_events')
    .select('id, code')
    .eq('company_id', companyId)
    .eq('team_id', teamId)
    .eq('event_date', event.event_date)
    .in('status', ['scheduled', 'completed'])
    .limit(1)
    .maybeSingle()

  if (busy && (!existingForQuote || busy.id !== existingForQuote.id)) {
    return Response.json(
      {
        error: TEAM_DAY_BUSY_MESSAGE,
        conflict: { eventId: busy.id, code: busy.code },
      },
      { status: 409 },
    )
  }

  let clientName: string | null = null
  if (quote.customer_id) {
    const { data: customer } = await db
      .from('customers')
      .select('full_name, ab_name, contact_name, company_name')
      .eq('id', quote.customer_id)
      .maybeSingle()
    clientName =
      customer?.full_name ||
      customer?.ab_name ||
      customer?.contact_name ||
      customer?.company_name ||
      null
  }

  const presentationDb = normalizeTimeForDb(presentationRaw)
  const startDb =
    String(event.start_time).length === 5
      ? `${event.start_time}:00`
      : String(event.start_time).slice(0, 8)
  const endDb =
    String(event.end_time).length === 5
      ? `${event.end_time}:00`
      : String(event.end_time).slice(0, 8)

  const title =
    event.event_name?.trim() ||
    `Churrasco ${quote.quote_number || ''}`.trim() ||
    'Churrasco BBQ At Home'

  let token =
    (existingForQuote?.team_assignment_token as string | null) ||
    newTeamAssignmentToken()

  // Se trocar de equipe após recusa, reinicia resposta
  const resetResponse =
    !existingForQuote ||
    existingForQuote.team_id !== teamId ||
    existingForQuote.team_assignment_response === 'rejected'

  if (resetResponse && existingForQuote?.team_assignment_response === 'rejected') {
    token = newTeamAssignmentToken()
  }

  await db
    .from('quotes')
    .update({
      team_presentation_time: presentationDb,
      designated_team_id: teamId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  let saved
  if (existingForQuote) {
    const { data, error } = await db
      .from('agenda_events')
      .update({
        team_id: teamId,
        title,
        client_name: clientName,
        event_date: event.event_date,
        start_time: startDb,
        end_time: endDb,
        presentation_time: presentationDb,
        team_assignment_token: token,
        team_assignment_response: resetResponse
          ? 'pending'
          : existingForQuote.team_assignment_response,
        team_assignment_sent_at: resetResponse
          ? null
          : existingForQuote.team_assignment_sent_at,
        team_assignment_accepted_at: resetResponse
          ? null
          : existingForQuote.team_assignment_accepted_at,
        team_assignment_rejected_at: resetResponse
          ? null
          : existingForQuote.team_assignment_rejected_at,
        status: 'scheduled',
        updated_at: new Date().toISOString(),
      })
      .eq('id', existingForQuote.id)
      .select('*')
      .single()
    if (error) {
      return Response.json({ error: error.message }, { status: 500 })
    }
    saved = data
  } else {
    const code = await nextEventCode(companyId)
    const { data, error } = await db
      .from('agenda_events')
      .insert({
        company_id: companyId,
        team_id: teamId,
        code,
        title,
        client_name: clientName,
        event_date: event.event_date,
        start_time: startDb,
        end_time: endDb,
        presentation_time: presentationDb,
        status: 'scheduled',
        quote_id: id,
        team_assignment_token: token,
        team_assignment_response: 'pending',
      })
      .select('*')
      .single()

    if (error) {
      if (/uq_agenda_events_team_day_active|duplicate key/i.test(error.message)) {
        return Response.json({ error: TEAM_DAY_BUSY_MESSAGE }, { status: 409 })
      }
      return Response.json({ error: error.message }, { status: 500 })
    }
    saved = data
  }

  const isSubstitution = Boolean(
    existingForQuote && existingForQuote.team_id && existingForQuote.team_id !== teamId,
  )
  await writeOperationalAudit({
    companyId,
    actorUserId: auth.session.userId,
    entityType: 'agenda_event',
    entityId: saved.id,
    action: isSubstitution ? 'team_assignment_substituted' : 'team_assignment_designated',
    oldData: isSubstitution ? { team_id: existingForQuote?.team_id ?? null } : null,
    newData: {
      quote_id: id,
      team_id: teamId,
      presentation_time: presentationDb,
    },
  })

  return Response.json({
    data: {
      team_presentation_time: presentationDb,
      designated_team_id: teamId,
      assignment: assignmentPayload(saved),
    },
  })
}
