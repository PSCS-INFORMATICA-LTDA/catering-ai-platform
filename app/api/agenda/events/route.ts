import { loadScheduleTurnaroundConfig } from '@/Lib/agenda/loadScheduleTurnaroundConfig'
import { logScheduleConflictAudit } from '@/Lib/agenda/logScheduleConflictAudit'
import { findTeamTimeConflict } from '@/Lib/agenda/scheduleConflicts'
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

  const db = getSupabaseServerClient()
  const startNorm = startTime.length === 5 ? `${startTime}:00` : startTime
  const endNorm = endTime.length === 5 ? `${endTime}:00` : endTime
  const { config } = await loadScheduleTurnaroundConfig(companyId)

  const day = new Date(`${eventDate}T12:00:00`)
  const prevDay = new Date(day)
  prevDay.setDate(prevDay.getDate() - 1)
  const nextDay = new Date(day)
  nextDay.setDate(nextDay.getDate() + 1)
  const from = prevDay.toISOString().slice(0, 10)
  const to = nextDay.toISOString().slice(0, 10)

  const { data: nearby } = await db
    .from('agenda_events')
    .select('id, code, team_id, event_date, start_time, end_time, status')
    .eq('company_id', companyId)
    .eq('team_id', teamId)
    .gte('event_date', from)
    .lte('event_date', to)
    .in('status', ['scheduled', 'completed'])

  const conflict = findTeamTimeConflict(
    (nearby ?? []).map((e) => ({
      id: e.id,
      team_id: e.team_id,
      event_date: e.event_date,
      start_time: e.start_time,
      end_time: e.end_time,
      status: e.status,
    })),
    teamId,
    eventDate,
    startNorm,
    endNorm,
    null,
    config,
  )

  if (conflict) {
    await logScheduleConflictAudit({
      companyId,
      actorUserId: auth.session.userId,
      entityId: conflict.event.id,
      teamId,
      conflictingEventId: conflict.event.id,
      result: conflict.result,
      minGapMinutes: conflict.result.minGapMinutes,
      baseRadiusMiles: config.base_radius_miles,
    })
    return Response.json(
      {
        error: conflict.result.messagePt,
        conflict: {
          code: conflict.result.code,
          eventId: conflict.event.id,
          event_date: conflict.event.event_date,
          start_time: conflict.event.start_time,
          end_time: conflict.event.end_time,
          blocked_until: conflict.result.blockedUntil,
          next_available_start: conflict.result.nextAvailableStart,
          min_gap_minutes: conflict.result.minGapMinutes,
          message_pt: conflict.result.messagePt,
          message_en: conflict.result.messageEn,
          message_es: conflict.result.messageEs,
        },
      },
      { status: 409 },
    )
  }

  const code = await nextEventCode(companyId)
  const { data, error } = await db
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
      start_time: startNorm,
      end_time: endNorm,
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
