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
    currentPassword?: string
    newPassword?: string
    role?: unknown
    company_id?: unknown
    is_pscs_master?: unknown
  }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Ignore privilege-escalation fields from client payloads.
  void body.role
  void body.company_id
  void body.is_pscs_master

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

  if (body.newPassword) {
    if (body.newPassword.length < 8) {
      return Response.json({ error: 'Senha fraca (mín. 8)' }, { status: 400 })
    }
    if (!body.currentPassword) {
      return Response.json({ error: 'Senha atual obrigatória' }, { status: 400 })
    }
    if (!session.email) {
      return Response.json({ error: 'E-mail da sessão ausente' }, { status: 400 })
    }

    const verifier = await createClient()
    const { error: reauthError } = await verifier.auth.signInWithPassword({
      email: session.email,
      password: body.currentPassword,
    })
    if (reauthError) {
      return Response.json({ error: 'Senha atual inválida' }, { status: 400 })
    }

    const { error } = await verifier.auth.updateUser({ password: body.newPassword })
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
