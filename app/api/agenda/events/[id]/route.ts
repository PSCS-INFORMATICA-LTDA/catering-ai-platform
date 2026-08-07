import { findTeamTimeConflict } from '@/Lib/agenda/scheduleConflicts'
import { TEAM_DAY_BUSY_MESSAGE } from '@/Lib/agenda/teamAvailability'
import {
  rejectSpoofedCompanyId,
  requireApiPermission,
  resolveAuthorizedCompanyId,
} from '@/Lib/auth/requireApi'
import { getSupabaseServerClient } from '@/Lib/supabaseServer'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, context: Ctx) {
  const auth = await requireApiPermission('agenda.manage')
  if (!auth.ok) return auth.response

  const { id } = await context.params
  const companyId = resolveAuthorizedCompanyId(auth.session)

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Payload inválido.' }, { status: 400 })
  }

  const spoof = rejectSpoofedCompanyId(auth.session, body.company_id)
  if (spoof) return spoof

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (typeof body.team_id === 'string') patch.team_id = body.team_id
  if (typeof body.title === 'string') {
    const title = body.title.trim()
    if (!title) {
      return Response.json({ error: 'Título obrigatório.' }, { status: 400 })
    }
    patch.title = title
  }
  if (body.client_name !== undefined) {
    patch.client_name =
      typeof body.client_name === 'string' && body.client_name.trim()
        ? body.client_name.trim()
        : null
  }
  if (typeof body.event_date === 'string') patch.event_date = body.event_date
  if (typeof body.start_time === 'string') {
    patch.start_time =
      body.start_time.length === 5 ? `${body.start_time}:00` : body.start_time
  }
  if (typeof body.end_time === 'string') {
    patch.end_time =
      body.end_time.length === 5 ? `${body.end_time}:00` : body.end_time
  }
  if (
    body.status === 'scheduled' ||
    body.status === 'completed' ||
    body.status === 'cancelled'
  ) {
    patch.status = body.status
  }
  if (body.notes !== undefined) {
    patch.notes =
      typeof body.notes === 'string' && body.notes.trim()
        ? body.notes.trim()
        : null
  }

  const db = getSupabaseServerClient()
  const { data: current } = await db
    .from('agenda_events')
    .select('id, team_id, event_date, start_time, end_time, status')
    .eq('id', id)
    .eq('company_id', companyId)
    .maybeSingle()

  if (!current) {
    return Response.json({ error: 'Evento não encontrado.' }, { status: 404 })
  }

  const nextTeamId =
    typeof patch.team_id === 'string' ? patch.team_id : current.team_id
  const nextDate =
    typeof patch.event_date === 'string' ? patch.event_date : current.event_date
  const nextStatus =
    typeof patch.status === 'string' ? patch.status : current.status
  const nextStart =
    typeof patch.start_time === 'string' ? patch.start_time : current.start_time
  const nextEnd =
    typeof patch.end_time === 'string' ? patch.end_time : current.end_time

  if (nextStatus === 'scheduled' || nextStatus === 'completed') {
    const { data: sameDay } = await db
      .from('agenda_events')
      .select('id, team_id, event_date, start_time, end_time, status')
      .eq('company_id', companyId)
      .eq('team_id', nextTeamId)
      .eq('event_date', nextDate)
      .in('status', ['scheduled', 'completed'])
      .neq('id', id)

    const conflict = findTeamTimeConflict(
      (sameDay ?? []).map((e) => ({
        id: e.id,
        team_id: e.team_id,
        event_date: e.event_date,
        start_time: e.start_time,
        end_time: e.end_time,
        status: e.status,
      })),
      nextTeamId,
      nextDate,
      String(nextStart),
      String(nextEnd),
      id,
    )

    if (conflict) {
      return Response.json(
        {
          error: TEAM_DAY_BUSY_MESSAGE,
          conflict: {
            eventId: conflict.id,
            event_date: nextDate,
            start_time: conflict.start_time,
            end_time: conflict.end_time,
          },
        },
        { status: 409 },
      )
    }
  }

  const { data, error } = await db
    .from('agenda_events')
    .update(patch)
    .eq('id', id)
    .eq('company_id', companyId)
    .select('*')
    .maybeSingle()

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }
  if (!data) {
    return Response.json({ error: 'Evento não encontrado.' }, { status: 404 })
  }
  return Response.json({ data })
}
