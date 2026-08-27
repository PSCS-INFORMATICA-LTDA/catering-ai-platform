import { cache } from 'react'
import { cookies } from 'next/headers'
import { createClient } from '@/Lib/supabase/server'
import { getSupabaseServerClient } from '@/Lib/supabaseServer'
import { fallbackPermissionsForRole } from '@/Lib/auth/permissions'
import { resolveAuthIdentity } from '@/Lib/auth/resolveAuthIdentity'
import { PSCS_ONE_MAPPED_COMPANY_COOKIE } from '@/Lib/pscs-one/config'
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

const APP_USER_COLUMNS =
  'id, auth_user_id, email, full_name, display_name, preferred_language, is_pscs_master, active, company_id'

async function loadAuthSessionUncached(): Promise<AuthSessionContext | null> {
  const supabase = await createClient()
  const { identity } = await resolveAuthIdentity(supabase)
  if (!identity) return null

  const admin = getSupabaseServerClient()

  const wave1Started = Date.now()
  const [appUserRes, membershipsRes] = await Promise.all([
    admin
      .from('app_users')
      .select(APP_USER_COLUMNS)
      .eq('auth_user_id', identity.id)
      .maybeSingle(),
    admin
      .from('company_memberships')
      .select('id, company_id, branch_id, user_id, role, active, status, companies(company_name)')
      .eq('user_id', identity.id),
  ])

  let appUserRow = appUserRes.data
  if (!appUserRow) {
    const display =
      identity.fullName || identity.email?.split('@')[0] || 'User'
    const { data: created } = await admin
      .from('app_users')
      .insert({
        auth_user_id: identity.id,
        email: identity.email,
        full_name: display,
        display_name: display,
        preferred_language: 'pt',
        is_pscs_master: false,
        active: true,
      })
      .select(APP_USER_COLUMNS)
      .maybeSingle()
    appUserRow = created
  }

  const appUser = (appUserRow as AuthAppUser | null) ?? null
  const isPlatformAdmin = Boolean(appUser?.is_pscs_master && appUser.active !== false)

  const memberships: AuthMembership[] = (membershipsRes.data ?? []).map((row) => {
    const record = row as Record<string, unknown>
    const companies = record.companies as { company_name?: string } | null
    const status =
      (record.status as MembershipStatus | null) ??
      (record.active ? 'active' : 'inactive')
    return {
      id: String(record.id),
      company_id: String(record.company_id),
      branch_id: (record.branch_id as string | null) ?? null,
      user_id: String(record.user_id),
      role: asRole(record.role as string),
      active: Boolean(record.active),
      status,
      company_name: companies?.company_name ?? null,
    }
  })

  const cookieStore = await cookies()
  const mappedCompanyId = cookieStore.get(PSCS_ONE_MAPPED_COMPANY_COOKIE)?.value?.trim()
  const preferredFromSso = mappedCompanyId
    ? memberships.find(
        (membership) =>
          membership.company_id === mappedCompanyId &&
          (membership.status === 'active' || membership.active),
      )
    : undefined

  const activeMembership =
    preferredFromSso ||
    memberships.find((membership) => membership.status === 'active') ||
    memberships.find((membership) => membership.active) ||
    null

  const roleKey = isPlatformAdmin ? 'owner' : activeMembership?.role ?? null

  const wave2Started = Date.now()
  const [supportRes, permissionsRes] = await Promise.all([
    isPlatformAdmin
      ? admin
          .from('support_access_sessions')
          .select('id, target_company_id, reason, started_at')
          .eq('actor_user_id', identity.id)
          .eq('active', true)
          .order('started_at', { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    roleKey
      ? admin
          .from('role_permissions')
          .select('permission_key')
          .eq('role_key', roleKey)
      : Promise.resolve({ data: [] as Array<{ permission_key: string }> }),
  ])

  let supportSession: AuthSessionContext['supportSession'] = null
  if (supportRes.data) {
    supportSession = {
      id: supportRes.data.id as string,
      target_company_id: supportRes.data.target_company_id as string,
      reason: supportRes.data.reason as string,
      started_at: supportRes.data.started_at as string,
    }
  }

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
    if (permissionsRes.data?.length) {
      permissions = Array.from(
        new Set([
          ...permissions,
          ...permissionsRes.data.map((row) => row.permission_key as string),
        ]),
      )
    }
  } else if (activeMembership && permissionsRes.data?.length) {
    const fromDb = permissionsRes.data.map((row) => row.permission_key as string)
    const fallbackMedia = fallbackPermissionsForRole(activeMembership.role).filter(
      (key) => key.startsWith('media.'),
    )
    permissions = Array.from(
      new Set([...fromDb, ...fallbackMedia.filter((key) => !fromDb.includes(key))]),
    )
  }

  if (process.env.NODE_ENV !== 'production') {
    console.info('[auth-timing]', {
      step: 'session-waves',
      wave1Ms: wave2Started - wave1Started,
      wave2Ms: Date.now() - wave2Started,
    })
  }

  return {
    userId: identity.id,
    email: identity.email ?? appUser?.email ?? null,
    appUser,
    isPlatformAdmin,
    memberships,
    activeMembership,
    permissions,
    supportSession,
  }
}

/** Request-memoized. Never a cross-user or process-wide session cache. */
export const getAuthSession = cache(loadAuthSessionUncached)

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
