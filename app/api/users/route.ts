import { canInviteUsers, canManageUsers, hasPermission } from '@/Lib/auth/permissions'
import { getAuthSession, writeAdminAudit } from '@/Lib/auth/session'
import { getCdlCompanyId } from '@/Lib/cdlCompany'
import { getSupabaseServerClient } from '@/Lib/supabaseServer'
import type { CompanyRole } from '@/Lib/tenant/types'

export const dynamic = 'force-dynamic'

const ROLES: CompanyRole[] = [
  'owner',
  'admin',
  'manager',
  'sales',
  'operator',
  'kitchen',
  'finance',
  'viewer',
]

export async function GET() {
  const session = await getAuthSession()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(session.permissions, 'users.view') && !session.isPlatformAdmin) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const companyId =
    session.supportSession?.target_company_id ||
    session.activeMembership?.company_id ||
    getCdlCompanyId()

  const admin = getSupabaseServerClient()
  const { data, error } = await admin
    .from('company_memberships')
    .select('id, company_id, user_id, role, active, status, created_at')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })

  if (error) return Response.json({ error: error.message }, { status: 500 })

  const userIds = [...new Set((data ?? []).map((m) => m.user_id as string))]
  const { data: profiles } = await admin
    .from('app_users')
    .select('auth_user_id, email, display_name, full_name, active, is_pscs_master')
    .in('auth_user_id', userIds.length ? userIds : ['00000000-0000-0000-0000-000000000000'])

  const byAuth = new Map(
    (profiles ?? []).map((p) => [p.auth_user_id as string, p]),
  )

  return Response.json({
    companyId,
    canManage: canManageUsers(session.permissions) || session.isPlatformAdmin,
    canInvite: canInviteUsers(session.permissions) || session.isPlatformAdmin,
    data: (data ?? []).map((m) => {
      const p = byAuth.get(m.user_id as string)
      return {
        id: m.id,
        userId: m.user_id,
        role: m.role,
        status: m.status ?? (m.active ? 'active' : 'inactive'),
        active: m.active,
        email: p?.email ?? null,
        name: p?.display_name || p?.full_name || null,
        isPlatformAdmin: Boolean(p?.is_pscs_master),
      }
    }),
  })
}

export async function POST(request: Request) {
  const session = await getAuthSession()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canInviteUsers(session.permissions) && !session.isPlatformAdmin) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: { email?: string; role?: string }
  try {
    body = (await request.json()) as { email?: string; role?: string }
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const email = body.email?.trim().toLowerCase()
  const role = (body.role?.trim() || 'operator') as CompanyRole
  if (!email || !ROLES.includes(role)) {
    return Response.json({ error: 'email/role inválidos' }, { status: 400 })
  }
  if (role === 'owner' && !session.isPlatformAdmin) {
    // company admin may invite admin but not invent platform concepts; owner allowed for company
  }

  const companyId =
    session.supportSession?.target_company_id ||
    session.activeMembership?.company_id ||
    getCdlCompanyId()

  const admin = getSupabaseServerClient()
  const { data: invite, error } = await admin
    .from('user_invites')
    .insert({
      company_id: companyId,
      email,
      role,
      status: 'pending',
      invited_by: session.userId,
    })
    .select('id, email, role, status, expires_at')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })

  // Try Supabase invite (requires Auth email configured)
  const { error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { invited_company_id: companyId, invited_role: role },
  })

  await writeAdminAudit({
    companyId,
    actorUserId: session.userId,
    action: 'users.invite',
    entityType: 'user_invites',
    entityId: invite.id,
    metadata: { email, role, authInviteError: inviteErr?.message ?? null },
  })

  return Response.json({
    data: invite,
    authInvite: inviteErr ? { ok: false, message: inviteErr.message } : { ok: true },
  })
}
