import { AppOriginConfigError, inviteAuthCallbackUrl } from '@/Lib/auth/appOrigin'
import { canInviteUsers, canManageUsers } from '@/Lib/auth/permissions'
import { rejectSpoofedCompanyId, resolveAuthorizedCompanyId } from '@/Lib/auth/requireApi'
import { executeResendInvite, type ResendInviteDeps } from '@/Lib/auth/resendInvite'
import { normalizeInviteEmail, type UserInviteRow } from '@/Lib/auth/acceptInviteCore'
import { revokePendingInviteFields } from '@/Lib/auth/resendInviteCore'
import { getAuthSession, writeAdminAudit } from '@/Lib/auth/session'
import { getSupabaseServerClient } from '@/Lib/supabaseServer'

export const dynamic = 'force-dynamic'

function inviteSelect() {
  return 'id, company_id, email, role, status, expires_at, revoked_at, accepted_by'
}

async function findAuthUserByEmail(email: string) {
  const admin = getSupabaseServerClient()
  const normalized = normalizeInviteEmail(email)
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw new Error(error.message)
    const found = (data.users ?? []).find(
      (user) => normalizeInviteEmail(user.email ?? '') === normalized,
    )
    if (found) {
      return {
        id: found.id,
        email: found.email ?? normalized,
        emailConfirmedAt: found.email_confirmed_at ?? null,
      }
    }
    if ((data.users ?? []).length < 200) break
  }
  return null
}

function createResendDeps(): ResendInviteDeps {
  const admin = getSupabaseServerClient()
  return {
    async loadInviteById(id) {
      const { data } = await admin
        .from('user_invites')
        .select(inviteSelect())
        .eq('id', id)
        .maybeSingle()
      return (data as UserInviteRow | null) ?? null
    },
    async loadInvitesForCompanyEmail(companyId, email) {
      const { data } = await admin
        .from('user_invites')
        .select(inviteSelect())
        .eq('company_id', companyId)
        .ilike('email', email)
        .in('status', ['pending', 'expired'])
      return ((data ?? []) as unknown as UserInviteRow[])
    },
    async loadActiveMembership(companyId, email, authUserId) {
      let userId = authUserId
      if (!userId) {
        const { data: profile } = await admin
          .from('app_users')
          .select('auth_user_id')
          .ilike('email', email)
          .maybeSingle()
        userId = (profile?.auth_user_id as string | undefined) ?? null
      }
      if (!userId) return null
      const { data } = await admin
        .from('company_memberships')
        .select('id, role, status, active')
        .eq('company_id', companyId)
        .eq('user_id', userId)
        .maybeSingle()
      return data
        ? {
            id: data.id as string,
            role: data.role as string,
            status: (data.status as string) ?? (data.active ? 'active' : 'inactive'),
            active: Boolean(data.active),
          }
        : null
    },
    findAuthUserByEmail,
    async revokeInvites(ids, nowIso) {
      if (ids.length === 0) return
      await admin
        .from('user_invites')
        .update(revokePendingInviteFields(nowIso))
        .in('id', ids)
        .eq('status', 'pending')
    },
    async insertInvite(input) {
      const { data, error } = await admin
        .from('user_invites')
        .insert({
          company_id: input.companyId,
          email: input.email,
          role: input.role,
          status: 'pending',
          invited_by: input.invitedBy,
        })
        .select(inviteSelect())
        .single()
      if (error || !data) throw new Error(error?.message ?? 'failed to insert invite')
      return data as unknown as UserInviteRow
    },
    async reissueAuthAccess(input) {
      const data = {
        invited_company_id: input.companyId,
        invited_role: input.role,
      }
      if (input.strategy === 'invite_user_by_email') {
        const { error } = await admin.auth.admin.inviteUserByEmail(input.email, {
          redirectTo: input.redirectTo,
          data,
        })
        return { error: error?.message ?? null, reused: false, deleted: false }
      }

      // Documented Admin API: mint/refresh an invite token without deleting the user.
      // generateLink does not send mail; it is for custom delivery or token refresh.
      const generated = await admin.auth.admin.generateLink({
        type: 'invite',
        email: input.email,
        options: {
          redirectTo: input.redirectTo,
          data,
        },
      })
      if (generated.error) {
        return { error: generated.error.message, reused: true, deleted: false }
      }

      // Official invite mailer. Some Auth versions reject this for an existing user.
      const invited = await admin.auth.admin.inviteUserByEmail(input.email, {
        redirectTo: input.redirectTo,
        data,
      })
      if (!invited.error) {
        return { error: null, reused: true, deleted: false }
      }

      // Typed SDK resend is only signup | email_change. For an unconfirmed invited
      // user, signup confirmation still lands on inviteAuthCallbackUrl and
      // acceptPendingInvite — the app invite lifecycle is preserved.
      const resent = await admin.auth.resend({
        type: 'signup',
        email: input.email,
        options: { emailRedirectTo: input.redirectTo },
      })
      return {
        error: resent.error?.message ?? invited.error.message,
        reused: true,
        deleted: false,
      }
    },
    async writeAudit(event) {
      await writeAdminAudit({
        companyId: event.companyId,
        actorUserId: event.actorUserId,
        action: event.action,
        entityType: event.entityType,
        entityId: event.entityId,
        metadata: event.metadata,
      })
    },
  }
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

  let body: { inviteId?: string; company_id?: string; role?: string; auth_user_id?: string }
  try {
    body = (await request.json()) as {
      inviteId?: string
      company_id?: string
      role?: string
      auth_user_id?: string
    }
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const spoof = rejectSpoofedCompanyId(session, body.company_id)
  if (spoof) return spoof

  const inviteId = body.inviteId?.trim()
  if (!inviteId) {
    return Response.json({ error: 'inviteId inválido' }, { status: 400 })
  }

  let redirectTo: string
  try {
    redirectTo = inviteAuthCallbackUrl(request)
  } catch (error) {
    const message =
      error instanceof AppOriginConfigError
        ? error.message
        : 'configured app origin required for invite redirects'
    return Response.json({ error: message }, { status: 500 })
  }

  const outcome = await executeResendInvite(
    {
      inviteId,
      actorUserId: session.userId,
      actorCompanyId: resolveAuthorizedCompanyId(session),
      isPlatformAdmin: session.isPlatformAdmin,
      redirectTo,
    },
    createResendDeps(),
  )

  void body.role
  void body.auth_user_id

  if (outcome.status === 'resent') {
    return Response.json({
      data: {
        inviteId: outcome.inviteId,
        email: outcome.email,
        role: outcome.role,
        authUserReused: outcome.authUserReused,
        createdNewInvite: outcome.createdNewInvite,
      },
    })
  }

  if (outcome.status === 'already_member') {
    return Response.json({ error: 'already_member' }, { status: 409 })
  }
  if (outcome.status === 'forbidden_tenant') {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (outcome.status === 'not_found') {
    return Response.json({ error: 'Convite não encontrado' }, { status: 404 })
  }

  return Response.json(
    {
      error: 'auth invite delivery failed',
      inviteId: outcome.inviteId,
      inviteStatus: 'revoked',
    },
    { status: outcome.httpStatus },
  )
}
