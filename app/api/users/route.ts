import { inviteAuthCallbackUrl } from '@/Lib/auth/appOrigin'
import { canInviteUsers, canManageUsers } from '@/Lib/auth/permissions'
import {
  rejectSpoofedCompanyId,
  requireApiPermission,
  resolveAuthorizedCompanyId,
} from '@/Lib/auth/requireApi'
import { getAuthSession, writeAdminAudit } from '@/Lib/auth/session'
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

const MAX_PAGE_SIZE = 50
const DEFAULT_PAGE_SIZE = 20

function normalizeQuery(raw: string | null): string {
  return (raw ?? '').trim().replace(/\s+/g, ' ').slice(0, 120)
}

export async function GET(request: Request) {
  const auth = await requireApiPermission('users.view')
  if (!auth.ok) return auth.response
  const session = auth.session

  const url = new URL(request.url)
  const spoof = rejectSpoofedCompanyId(session, url.searchParams.get('company_id'))
  if (spoof) return spoof

  const companyId = resolveAuthorizedCompanyId(session)
  const q = normalizeQuery(url.searchParams.get('q')).toLowerCase()
  const roleFilter = (url.searchParams.get('role') ?? '').trim()
  const statusFilter = (url.searchParams.get('status') ?? '').trim()
  const page = Math.max(1, Number(url.searchParams.get('page') || 1) || 1)
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(
      1,
      Number(url.searchParams.get('pageSize') || DEFAULT_PAGE_SIZE) || DEFAULT_PAGE_SIZE,
    ),
  )

  if (roleFilter && !ROLES.includes(roleFilter as CompanyRole)) {
    return Response.json({ error: 'role inválido' }, { status: 400 })
  }
  if (statusFilter && !['active', 'inactive', 'suspended'].includes(statusFilter)) {
    return Response.json({ error: 'status inválido' }, { status: 400 })
  }

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
    .in(
      'auth_user_id',
      userIds.length ? userIds : ['00000000-0000-0000-0000-000000000000'],
    )

  const byAuth = new Map(
    (profiles ?? []).map((p) => [p.auth_user_id as string, p]),
  )

  let rows = (data ?? []).map((m) => {
    const p = byAuth.get(m.user_id as string)
    const status = (m.status as string) ?? (m.active ? 'active' : 'inactive')
    return {
      id: m.id as string,
      userId: m.user_id as string,
      role: m.role as string,
      status,
      active: Boolean(m.active),
      email: (p?.email as string | null) ?? null,
      name: ((p?.display_name || p?.full_name) as string | null) ?? null,
      isPlatformAdmin: Boolean(p?.is_pscs_master),
      createdAt: m.created_at as string,
    }
  })

  if (roleFilter) rows = rows.filter((r) => r.role === roleFilter)
  if (statusFilter) rows = rows.filter((r) => r.status === statusFilter)
  if (q) {
    rows = rows.filter((r) => {
      const hay = `${r.name ?? ''} ${r.email ?? ''}`.toLowerCase()
      return hay.includes(q)
    })
  }

  const total = rows.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const safePage = Math.min(page, totalPages)
  const start = (safePage - 1) * pageSize
  const pageRows = rows.slice(start, start + pageSize)

  return Response.json({
    companyId,
    canManage: canManageUsers(session.permissions) || session.isPlatformAdmin,
    canInvite: canInviteUsers(session.permissions) || session.isPlatformAdmin,
    page: safePage,
    pageSize,
    total,
    totalPages,
    filters: { q, role: roleFilter || null, status: statusFilter || null },
    data: pageRows,
  })
}

export async function POST(request: Request) {
  const session = await getAuthSession()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  if (
    !canInviteUsers(session.permissions) &&
    !canManageUsers(session.permissions) &&
    !session.isPlatformAdmin
  ) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: { email?: string; role?: string; company_id?: string }
  try {
    body = (await request.json()) as { email?: string; role?: string; company_id?: string }
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const spoof = rejectSpoofedCompanyId(session, body.company_id)
  if (spoof) return spoof

  const email = body.email?.trim().toLowerCase()
  const role = (body.role?.trim() || 'operator') as CompanyRole
  if (!email || !ROLES.includes(role)) {
    return Response.json({ error: 'email/role inválidos' }, { status: 400 })
  }

  const companyId = resolveAuthorizedCompanyId(session)
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

  const redirectTo = inviteAuthCallbackUrl(request)
  const { error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo,
    data: { invited_company_id: companyId, invited_role: role },
  })

  await writeAdminAudit({
    companyId,
    actorUserId: session.userId,
    action: 'users.invite',
    entityType: 'user_invites',
    entityId: invite.id,
    metadata: {
      email,
      role,
      redirectTo,
      inviteError: inviteErr?.message ?? null,
    },
  })

  return Response.json({ data: invite })
}
