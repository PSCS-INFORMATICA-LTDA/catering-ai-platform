import { getAuthSession, writeAdminAudit } from '@/Lib/auth/session'
import { getSupabaseServerClient } from '@/Lib/supabaseServer'

export async function POST() {
  const session = await getAuthSession()
  if (!session?.isPlatformAdmin || !session.supportSession) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admin = getSupabaseServerClient()
  await admin
    .from('support_access_sessions')
    .update({ active: false, ended_at: new Date().toISOString() })
    .eq('id', session.supportSession.id)

  await writeAdminAudit({
    companyId: session.supportSession.target_company_id,
    actorUserId: session.userId,
    action: 'support.end',
    entityType: 'support_access_sessions',
    entityId: session.supportSession.id,
  })

  return Response.json({ ok: true })
}
