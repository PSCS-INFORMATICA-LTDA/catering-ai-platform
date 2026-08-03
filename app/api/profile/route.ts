import { getAuthSession, writeAdminAudit } from '@/Lib/auth/session'
import { getSupabaseServerClient } from '@/Lib/supabaseServer'
import { createClient } from '@/Lib/supabase/server'

export async function GET() {
  const session = await getAuthSession()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  return Response.json({
    email: session.email,
    appUser: session.appUser,
    memberships: session.memberships,
    isPlatformAdmin: session.isPlatformAdmin,
  })
}

export async function PATCH(request: Request) {
  const session = await getAuthSession()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  let body: {
    displayName?: string
    preferredLanguage?: string
    newPassword?: string
  }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const admin = getSupabaseServerClient()
  if (session.appUser?.id) {
    const patch: Record<string, unknown> = {}
    if (typeof body.displayName === 'string') {
      patch.display_name = body.displayName.trim()
      patch.full_name = body.displayName.trim()
    }
    if (typeof body.preferredLanguage === 'string') {
      patch.preferred_language = body.preferredLanguage.trim()
    }
    if (Object.keys(patch).length) {
      await admin.from('app_users').update(patch).eq('id', session.appUser.id)
    }
  }

  if (body.newPassword && body.newPassword.length >= 8) {
    const supabase = await createClient()
    const { error } = await supabase.auth.updateUser({ password: body.newPassword })
    if (error) return Response.json({ error: error.message }, { status: 400 })
    await writeAdminAudit({
      companyId: session.activeMembership?.company_id,
      actorUserId: session.userId,
      action: 'auth.password.change',
      entityType: 'auth.users',
      entityId: session.userId,
    })
  }

  return Response.json({ ok: true })
}
