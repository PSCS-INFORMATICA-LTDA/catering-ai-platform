import { getSupabaseServerClient } from '@/Lib/supabaseServer'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type Params = { params: Promise<{ token: string }> }

function invalidToken(token: string) {
  return !token || token.trim().length < 32
}

export async function GET(_request: Request, { params }: Params) {
  const { token } = await params
  if (invalidToken(token)) {
    return Response.json({ found: false })
  }

  const db = getSupabaseServerClient()
  const rpc = await db.rpc('get_public_team_assignment', {
    p_token: token.trim(),
  })
  if (!rpc.error && rpc.data) {
    return Response.json(rpc.data)
  }

  const { data: evt, error } = await db
    .from('agenda_events')
    .select(
      'id, company_id, team_id, code, title, client_name, event_date, start_time, end_time, presentation_time, status, quote_id, team_assignment_response, team_assignment_sent_at',
    )
    .eq('team_assignment_token', token.trim())
    .maybeSingle()

  if (error) {
    if (/team_assignment_token|column/i.test(error.message)) {
      return Response.json({ found: false, error: 'migration_required' })
    }
    return Response.json({ found: false, error: error.message }, { status: 500 })
  }
  if (!evt) return Response.json({ found: false })

  const [companyRes, teamRes, quoteRes] = await Promise.all([
    db
      .from('companies')
      .select('name, trade_name')
      .eq('id', evt.company_id)
      .maybeSingle(),
    db
      .from('operational_teams')
      .select('name')
      .eq('id', evt.team_id)
      .maybeSingle(),
    evt.quote_id
      ? db
          .from('quotes')
          .select('quote_number, event_id')
          .eq('id', evt.quote_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  let address: string | null = null
  const eventId = quoteRes.data?.event_id
  if (eventId) {
    const { data: ev } = await db
      .from('events')
      .select('address_line, city, state')
      .eq('id', eventId)
      .maybeSingle()
    address =
      [ev?.address_line, ev?.city, ev?.state].filter(Boolean).join(', ') || null
  }

  return Response.json({
    found: true,
    company_name:
      companyRes.data?.trade_name || companyRes.data?.name || 'BBQ At Home',
    team_assignment_response: evt.team_assignment_response ?? 'pending',
    team_assignment_sent_at: evt.team_assignment_sent_at,
    can_respond:
      (evt.team_assignment_response ?? 'pending') === 'pending' &&
      Boolean(evt.team_assignment_sent_at) &&
      evt.status === 'scheduled',
    assignment: {
      event_id: evt.id,
      code: evt.code,
      title: evt.title,
      client_name: evt.client_name,
      team_name: teamRes.data?.name ?? null,
      event_date: evt.event_date,
      start_time: evt.start_time,
      end_time: evt.end_time,
      presentation_time: evt.presentation_time,
      address,
      quote_number: quoteRes.data?.quote_number ?? null,
      status: evt.status,
    },
  })
}

export async function POST(request: Request, { params }: Params) {
  const { token } = await params
  if (invalidToken(token)) {
    return Response.json({ error: 'Token inválido' }, { status: 400 })
  }

  let body: { action?: string }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Payload inválido' }, { status: 400 })
  }

  if (body.action !== 'accept' && body.action !== 'reject') {
    return Response.json({ error: 'Ação inválida' }, { status: 400 })
  }

  const db = getSupabaseServerClient()
  const rpc = await db.rpc('respond_to_team_assignment', {
    p_token: token.trim(),
    p_action: body.action,
  })

  if (!rpc.error && rpc.data) {
    return Response.json({ data: rpc.data })
  }

  const { data: evt, error } = await db
    .from('agenda_events')
    .select(
      'id, team_assignment_response, team_assignment_sent_at, status',
    )
    .eq('team_assignment_token', token.trim())
    .maybeSingle()

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }
  if (!evt) {
    return Response.json({ error: 'Designação não encontrada' }, { status: 404 })
  }
  if (!evt.team_assignment_sent_at) {
    return Response.json(
      { error: 'Designação ainda não foi enviada à equipe' },
      { status: 409 },
    )
  }
  if (evt.team_assignment_response !== 'pending') {
    return Response.json({ error: 'Designação já respondida' }, { status: 409 })
  }
  if (evt.status !== 'scheduled') {
    return Response.json(
      { error: 'Evento não está mais agendado' },
      { status: 409 },
    )
  }

  const now = new Date().toISOString()
  const patch =
    body.action === 'accept'
      ? {
          team_assignment_response: 'accepted',
          team_assignment_accepted_at: now,
          updated_at: now,
        }
      : {
          team_assignment_response: 'rejected',
          team_assignment_rejected_at: now,
          status: 'cancelled',
          updated_at: now,
        }

  const { data, error: updErr } = await db
    .from('agenda_events')
    .update(patch)
    .eq('id', evt.id)
    .select('team_assignment_response, status')
    .single()

  if (updErr) {
    return Response.json({ error: updErr.message }, { status: 500 })
  }

  return Response.json({ data })
}
