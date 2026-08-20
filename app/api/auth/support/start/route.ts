import { getAuthSession, writeAdminAudit } from '@/Lib/auth/session'
import { getSupabaseServerClient } from '@/Lib/supabaseServer'

export async function POST(request: Request) {
  const session = await getAuthSession()
  if (!session?.isPlatformAdmin) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: { companyId?: string; reason?: string }
  try {
    body = (await request.json()) as { companyId?: string; reason?: string }
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const companyId = body.companyId?.trim()
  const reason = body.reason?.trim() ?? ''
  if (!companyId || reason.length < 8) {
    return Response.json(
      { error: 'companyId e reason (>= 8 chars) são obrigatórios' },
      { status: 400 },
    )
  }

  const admin = getSupabaseServerClient()
  await admin
    .from('support_access_sessions')
    .update({ active: false, ended_at: new Date().toISOString() })
    .eq('actor_user_id', session.userId)
    .eq('active', true)

  const { data, error } = await admin
    .from('support_access_sessions')
    .insert({
      actor_user_id: session.userId,
      target_company_id: companyId,
      reason,
      active: true,
    })
    .select('id, target_company_id, reason, started_at')
    .single()

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  await writeAdminAudit({
    companyId,
    actorUserId: session.userId,
    action: 'support.start',
    entityType: 'support_access_sessions',
    entityId: data.id,
    metadata: { reason },
  })

  return Response.json({ data })
}
