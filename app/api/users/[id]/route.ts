import { canManageUsers } from '@/Lib/auth/permissions'
import { getAuthSession, writeAdminAudit } from '@/Lib/auth/session'
import { getCdlCompanyId } from '@/Lib/cdlCompany'
import { getSupabaseServerClient } from '@/Lib/supabaseServer'
import type { CompanyRole } from '@/Lib/tenant/types'

type Params = { params: Promise<{ id: string }> }

async function countActiveOwnersAdmins(companyId: string) {
  const admin = getSupabaseServerClient()
  const { data } = await admin
    .from('company_memberships')
    .select('id, role, status, active')
    .eq('company_id', companyId)
  return (data ?? []).filter((m) => {
    const status = (m.status as string) ?? (m.active ? 'active' : 'inactive')
    return status === 'active' && (m.role === 'owner' || m.role === 'admin')
  }).length
}

export async function PATCH(request: Request, { params }: Params) {
  const session = await getAuthSession()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canManageUsers(session.permissions) && !session.isPlatformAdmin) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  let body: { role?: string; status?: string }
  try {
    body = (await request.json()) as { role?: string; status?: string }
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const admin = getSupabaseServerClient()
  const { data: current, error: curErr } = await admin
    .from('company_memberships')
    .select('id, company_id, user_id, role, status, active')
    .eq('id', id)
    .maybeSingle()

  if (curErr || !current) {
    return Response.json({ error: 'Membership não encontrada' }, { status: 404 })
  }

  const companyId = current.company_id as string
  const expectedCompany =
    session.supportSession?.target_company_id ||
    session.activeMembership?.company_id ||
    getCdlCompanyId()
  if (companyId !== expectedCompany && !session.isPlatformAdmin) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const nextRole = (body.role as CompanyRole | undefined) ?? (current.role as CompanyRole)
  const nextStatus =
    body.status ??
    ((current.status as string) || (current.active ? 'active' : 'inactive'))

  if (
    current.user_id === session.userId &&
    body.role &&
    body.role !== current.role &&
    !session.isPlatformAdmin
  ) {
    return Response.json({ error: 'self_role_change_blocked' }, { status: 409 })
  }

  const wasPrivileged =
    current.role === 'owner' || current.role === 'admin'
  const willBePrivileged = nextRole === 'owner' || nextRole === 'admin'
  const willBeActive = nextStatus === 'active'

  if (wasPrivileged && (!willBePrivileged || !willBeActive)) {
    const count = await countActiveOwnersAdmins(companyId)
    if (count <= 1) {
      return Response.json(
        { error: 'last_owner_protected' },
        { status: 409 },
      )
    }
  }

  // Company admin cannot grant platform master via membership roles (no field here).
  // Prevent elevating to owner if actor is not owner/platform — soft rule
  if (
    nextRole === 'owner' &&
    session.activeMembership?.role !== 'owner' &&
    !session.isPlatformAdmin
  ) {
    return Response.json({ error: 'Somente owner pode conceder owner' }, { status: 403 })
  }

  const { data, error } = await admin
    .from('company_memberships')
    .update({
      role: nextRole,
      status: nextStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('id, role, status, active, user_id')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })

  await writeAdminAudit({
    companyId,
    actorUserId: session.userId,
    action: 'users.membership.update',
    entityType: 'company_memberships',
    entityId: id,
    metadata: { role: nextRole, status: nextStatus },
  })

  return Response.json({ data })
}

export async function DELETE(request: Request, { params }: Params) {
  const session = await getAuthSession()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canManageUsers(session.permissions) && !session.isPlatformAdmin) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  let reason = ''
  try {
    const body = (await request.json()) as { reason?: string }
    reason = body.reason?.trim() ?? ''
  } catch {
    reason = ''
  }
  if (reason.length < 8) {
    return Response.json({ error: 'Motivo obrigatório (>= 8 caracteres)' }, { status: 400 })
  }

  const admin = getSupabaseServerClient()
  const { data: current } = await admin
    .from('company_memberships')
    .select('id, company_id, user_id, role, status, active')
    .eq('id', id)
    .maybeSingle()

  if (!current) return Response.json({ error: 'Não encontrado' }, { status: 404 })

  if (current.user_id === session.userId) {
    return Response.json({ error: 'self_delete_blocked' }, { status: 409 })
  }

  const privileged = current.role === 'owner' || current.role === 'admin'
  const status = (current.status as string) ?? (current.active ? 'active' : 'inactive')
  if (privileged && status === 'active') {
    const count = await countActiveOwnersAdmins(current.company_id as string)
    if (count <= 1) {
      return Response.json({ error: 'last_owner_protected' }, { status: 409 })
    }
  }

  const { error } = await admin
    .from('company_memberships')
    .update({
      status: 'inactive',
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) return Response.json({ error: error.message }, { status: 500 })

  await writeAdminAudit({
    companyId: current.company_id as string,
    actorUserId: session.userId,
    action: 'users.membership.remove',
    entityType: 'company_memberships',
    entityId: id,
    metadata: { reason },
  })

  return Response.json({ ok: true })
}
