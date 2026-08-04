import {
  rejectSpoofedCompanyId,
  requireApiPermission,
  resolveAuthorizedCompanyId,
} from '@/Lib/auth/requireApi'
import { getSupabaseServerClient } from '@/Lib/supabaseServer'

export const dynamic = 'force-dynamic'
export const revalidate = 0

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

export async function GET(request: Request) {
  const auth = await requireApiPermission('agenda.view')
  if (!auth.ok) return auth.response

  const companyId = resolveAuthorizedCompanyId(auth.session)
  const url = new URL(request.url)
  const from = url.searchParams.get('from')
  const to = url.searchParams.get('to')
  const teamId = url.searchParams.get('team_id')

  let query = getSupabaseServerClient()
    .from('agenda_events')
    .select('*')
    .eq('company_id', companyId)
    .order('event_date', { ascending: true })
    .order('start_time', { ascending: true })

  if (from) query = query.gte('event_date', from)
  if (to) query = query.lte('event_date', to)
  if (teamId) query = query.eq('team_id', teamId)

  const { data, error } = await query
  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }
  return Response.json(
    { data: data ?? [] },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}

export async function POST(request: Request) {
  const auth = await requireApiPermission('agenda.manage')
  if (!auth.ok) return auth.response

  const companyId = resolveAuthorizedCompanyId(auth.session)
  let body: {
    team_id?: string
    title?: string
    client_name?: string | null
    event_date?: string
    start_time?: string
    end_time?: string
    status?: string
    notes?: string | null
    company_id?: string
  }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Payload inválido.' }, { status: 400 })
  }

  const spoof = rejectSpoofedCompanyId(auth.session, body.company_id)
  if (spoof) return spoof

  const teamId = typeof body.team_id === 'string' ? body.team_id : ''
  const title = typeof body.title === 'string' ? body.title.trim() : ''
  const eventDate = typeof body.event_date === 'string' ? body.event_date : ''
  const startTime = typeof body.start_time === 'string' ? body.start_time : ''
  const endTime = typeof body.end_time === 'string' ? body.end_time : ''

  if (!teamId || !title || !eventDate || !startTime || !endTime) {
    return Response.json(
      { error: 'Equipe, título, data e horários são obrigatórios.' },
      { status: 400 },
    )
  }

  const { data: team } = await getSupabaseServerClient()
    .from('operational_teams')
    .select('id')
    .eq('id', teamId)
    .eq('company_id', companyId)
    .eq('active', true)
    .maybeSingle()

  if (!team) {
    return Response.json({ error: 'Equipe inválida ou inativa.' }, { status: 400 })
  }

  const code = await nextEventCode(companyId)
  const { data, error } = await getSupabaseServerClient()
    .from('agenda_events')
    .insert({
      company_id: companyId,
      team_id: teamId,
      code,
      title,
      client_name:
        typeof body.client_name === 'string' && body.client_name.trim()
          ? body.client_name.trim()
          : null,
      event_date: eventDate,
      start_time: startTime.length === 5 ? `${startTime}:00` : startTime,
      end_time: endTime.length === 5 ? `${endTime}:00` : endTime,
      status: body.status === 'completed' ? 'completed' : 'scheduled',
      notes:
        typeof body.notes === 'string' && body.notes.trim()
          ? body.notes.trim()
          : null,
    })
    .select('*')
    .single()

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }
  return Response.json({ data }, { status: 201 })
}
