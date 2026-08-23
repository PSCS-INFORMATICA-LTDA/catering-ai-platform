import { createClient } from '@/Lib/supabase/server'
import { getAuthSession, writeAdminAudit } from '@/Lib/auth/session'
import { getSupabaseServerClient } from '@/Lib/supabaseServer'

export async function POST() {
  const session = await getAuthSession()
  if (session?.supportSession) {
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
  }

  const supabase = await createClient()
  await supabase.auth.signOut()
  return Response.json({ ok: true })
}
