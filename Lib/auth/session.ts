import { createClient } from '@/Lib/supabase/server'
import { getSupabaseServerClient } from '@/Lib/supabaseServer'
import { fallbackPermissionsForRole } from '@/Lib/auth/permissions'
import type {
  AuthAppUser,
  AuthMembership,
  AuthSessionContext,
  MembershipStatus,
} from '@/Lib/auth/types'
import type { CompanyRole } from '@/Lib/tenant/types'

function asRole(value: string | null | undefined): CompanyRole {
  const allowed: CompanyRole[] = [
    'owner',
    'admin',
    'manager',
    'sales',
    'operator',
    'kitchen',
    'finance',
    'viewer',
  ]
  if (value && (allowed as string[]).includes(value)) return value as CompanyRole
  return 'viewer'
}

export async function getAuthSession(): Promise<AuthSessionContext | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const admin = getSupabaseServerClient()

  let { data: appUserRow } = await admin
    .from('app_users')
    .select(
      'id, auth_user_id, email, full_name, display_name, preferred_language, is_pscs_master, active, company_id',
    )
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (!appUserRow) {
    const display =
      (user.user_metadata?.full_name as string | undefined) ||
      user.email?.split('@')[0] ||
      'User'
    const { data: created } = await admin
      .from('app_users')
      .insert({
        auth_user_id: user.id,
        email: user.email,
        full_name: display,
        display_name: display,
        preferred_language: 'pt',
        is_pscs_master: false,
        active: true,
      })
      .select(
        'id, auth_user_id, email, full_name, display_name, preferred_language, is_pscs_master, active, company_id',
      )
      .maybeSingle()
    appUserRow = created
  }

  const appUser = (appUserRow as AuthAppUser | null) ?? null
  const isPlatformAdmin = Boolean(appUser?.is_pscs_master && appUser.active !== false)

  const { data: membershipRows } = await admin
    .from('company_memberships')
    .select('id, company_id, branch_id, user_id, role, active, status, companies(company_name)')
    .eq('user_id', user.id)

  const memberships: AuthMembership[] = (membershipRows ?? []).map((row) => {
    const r = row as Record<string, unknown>
    const companies = r.companies as { company_name?: string } | null
    const status = (r.status as MembershipStatus | null) ?? (r.active ? 'active' : 'inactive')
    return {
      id: String(r.id),
      company_id: String(r.company_id),
      branch_id: (r.branch_id as string | null) ?? null,
      user_id: String(r.user_id),
      role: asRole(r.role as string),
      active: Boolean(r.active),
      status,
      company_name: companies?.company_name ?? null,
    }
  })

  let supportSession: AuthSessionContext['supportSession'] = null
  if (isPlatformAdmin) {
    const { data: support } = await admin
      .from('support_access_sessions')
      .select('id, target_company_id, reason, started_at')
      .eq('actor_user_id', user.id)
      .eq('active', true)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (support) {
      supportSession = {
        id: support.id as string,
        target_company_id: support.target_company_id as string,
        reason: support.reason as string,
        started_at: support.started_at as string,
      }
    }
  }

  const activeMembership =
    memberships.find((m) => m.status === 'active') ??
    memberships.find((m) => m.active) ??
    null

  let permissions = fallbackPermissionsForRole(activeMembership?.role ?? null)
  if (isPlatformAdmin) {
    permissions = Array.from(
      new Set([
        ...permissions,
        ...fallbackPermissionsForRole('owner'),
        'support.access',
        'users.view',
        'users.manage',
        'users.invite',
        'audit.view',
      ]),
    )
    const { data: ownerPerms } = await admin
      .from('role_permissions')
      .select('permission_key')
      .eq('role_key', 'owner')
    if (ownerPerms?.length) {
      permissions = Array.from(
        new Set([
          ...permissions,
          ...ownerPerms.map((x) => x.permission_key as string),
        ]),
      )
    }
  } else if (activeMembership) {
    const { data: rp } = await admin
      .from('role_permissions')
      .select('permission_key')
      .eq('role_key', activeMembership.role)
    if (rp?.length) {
      const fromDb = rp.map((x) => x.permission_key as string)
      const fallbackMedia = fallbackPermissionsForRole(activeMembership.role).filter(
        (key) => key.startsWith('media.'),
      )
      const dbHasMedia = fromDb.some((key) => key.startsWith('media.'))
      permissions = dbHasMedia
        ? fromDb
        : Array.from(new Set([...fromDb, ...fallbackMedia]))
    }
  }

  return {
    userId: user.id,
    email: user.email ?? appUser?.email ?? null,
    appUser,
    isPlatformAdmin,
    memberships,
    activeMembership,
    permissions,
    supportSession,
  }
}

export async function requireAuthSession(): Promise<AuthSessionContext> {
  const session = await getAuthSession()
  if (!session) {
    throw new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  return session
}

export async function writeAdminAudit(input: {
  companyId?: string | null
  actorUserId: string
  action: string
  entityType: string
  entityId?: string | null
  metadata?: Record<string, unknown>
}) {
  const admin = getSupabaseServerClient()
  await admin.from('admin_audit_events').insert({
    company_id: input.companyId ?? null,
    actor_user_id: input.actorUserId,
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId ?? null,
    metadata: input.metadata ?? {},
  })
}
