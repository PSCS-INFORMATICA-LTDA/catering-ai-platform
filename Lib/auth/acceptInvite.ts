import {
  normalizeInviteEmail,
  resolveMembershipInviteRole,
  selectPendingInviteResult,
  validateInviteForUser,
  type UserInviteRow,
} from '@/Lib/auth/acceptInviteCore'
import { getSupabaseServerClient } from '@/Lib/supabaseServer'
import type { CompanyRole } from '@/Lib/tenant/types'

export type AcceptInviteInput = {
  authUserId: string
  email: string
  displayName?: string | null
}

export type AcceptInviteResult =
  | {
      status: 'accepted'
      inviteId: string
      companyId: string
      role: CompanyRole
      appUserId: string
      membershipId: string
    }
  | {
      status: 'already_accepted'
      inviteId: string
      companyId: string
      role: CompanyRole
      appUserId: string | null
      membershipId: string | null
    }
  | { status: 'no_pending_invite' }
  | { status: 'ambiguous_pending_invites'; companyIds: string[] }
  | { status: 'email_mismatch' }
  | { status: 'expired'; inviteId: string }
  | { status: 'revoked'; inviteId: string }
  | {
      status: 'role_conflict'
      inviteId: string
      companyId: string
      existingRole: CompanyRole
      inviteRole: CompanyRole
    }
  | { status: 'error'; message: string }

function displayNameFrom(input: AcceptInviteInput): string {
  return (
    input.displayName?.trim() ||
    input.email.split('@')[0] ||
    'User'
  )
}

async function findPendingInvitesForEmail(email: string): Promise<UserInviteRow[]> {
  const admin = getSupabaseServerClient()
  const normalized = normalizeInviteEmail(email)
  const { data, error } = await admin
    .from('user_invites')
    .select(
      'id, company_id, email, role, status, expires_at, revoked_at, accepted_by',
    )
    .eq('status', 'pending')
    .ilike('email', normalized)

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []) as UserInviteRow[]
}

async function findAcceptedInviteForUser(
  authUserId: string,
  email: string,
): Promise<UserInviteRow | null> {
  const admin = getSupabaseServerClient()
  const normalized = normalizeInviteEmail(email)
  const { data } = await admin
    .from('user_invites')
    .select(
      'id, company_id, email, role, status, expires_at, revoked_at, accepted_by',
    )
    .eq('status', 'accepted')
    .eq('accepted_by', authUserId)
    .ilike('email', normalized)
    .order('accepted_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return (data as UserInviteRow | null) ?? null
}

async function markInviteExpired(inviteId: string): Promise<void> {
  const admin = getSupabaseServerClient()
  await admin
    .from('user_invites')
    .update({
      status: 'expired',
      updated_at: new Date().toISOString(),
    })
    .eq('id', inviteId)
    .eq('status', 'pending')
}

async function ensureAppUser(
  input: AcceptInviteInput,
  companyId: string,
): Promise<string> {
  const admin = getSupabaseServerClient()
  const display = displayNameFrom(input)

  const { data: existing } = await admin
    .from('app_users')
    .select('id, company_id')
    .eq('auth_user_id', input.authUserId)
    .maybeSingle()

  if (existing?.id) {
    if (!existing.company_id) {
      await admin
        .from('app_users')
        .update({ company_id: companyId })
        .eq('id', existing.id)
    }
    return existing.id as string
  }

  const { data: created, error } = await admin
    .from('app_users')
    .insert({
      auth_user_id: input.authUserId,
      email: normalizeInviteEmail(input.email),
      full_name: display,
      display_name: display,
      preferred_language: 'pt',
      is_pscs_master: false,
      active: true,
      company_id: companyId,
    })
    .select('id')
    .single()

  if (error?.code === '23505') {
    const { data: raced } = await admin
      .from('app_users')
      .select('id, company_id')
      .eq('auth_user_id', input.authUserId)
      .maybeSingle()
    if (!raced?.id) throw new Error(error.message)
    if (!raced.company_id) {
      await admin
        .from('app_users')
        .update({ company_id: companyId })
        .eq('id', raced.id)
    }
    return raced.id as string
  }

  if (error || !created?.id) {
    throw new Error(error?.message ?? 'Failed to create app_user')
  }

  return created.id as string
}

type EnsureMembershipResult =
  | { ok: true; membershipId: string }
  | {
      ok: false
      conflict: { existingRole: CompanyRole; inviteRole: CompanyRole }
    }

async function ensureMembership(
  authUserId: string,
  companyId: string,
  role: CompanyRole,
): Promise<EnsureMembershipResult> {
  const admin = getSupabaseServerClient()

  const { data: existing } = await admin
    .from('company_memberships')
    .select('id, role')
    .eq('company_id', companyId)
    .eq('user_id', authUserId)
    .maybeSingle()

  if (existing?.id) {
    const resolution = resolveMembershipInviteRole(existing.role as string, role)
    if (resolution.status === 'conflict') {
      return {
        ok: false,
        conflict: {
          existingRole: resolution.existingRole,
          inviteRole: resolution.inviteRole,
        },
      }
    }
    return { ok: true, membershipId: existing.id as string }
  }

  const { data: created, error } = await admin
    .from('company_memberships')
    .insert({
      company_id: companyId,
      user_id: authUserId,
      role,
      status: 'active',
      active: true,
    })
    .select('id')
    .single()

  if (error?.code === '23505') {
    const { data: raced } = await admin
      .from('company_memberships')
      .select('id, role')
      .eq('company_id', companyId)
      .eq('user_id', authUserId)
      .maybeSingle()
    if (!raced?.id) throw new Error(error.message)
    const resolution = resolveMembershipInviteRole(raced.role as string, role)
    if (resolution.status === 'conflict') {
      return {
        ok: false,
        conflict: {
          existingRole: resolution.existingRole,
          inviteRole: resolution.inviteRole,
        },
      }
    }
    return { ok: true, membershipId: raced.id as string }
  }

  if (error || !created?.id) {
    throw new Error(error?.message ?? 'Failed to create membership')
  }

  return { ok: true, membershipId: created.id as string }
}

async function markInviteAccepted(
  inviteId: string,
  authUserId: string,
): Promise<boolean> {
  const admin = getSupabaseServerClient()
  const now = new Date().toISOString()
  const { data } = await admin
    .from('user_invites')
    .update({
      status: 'accepted',
      accepted_at: now,
      accepted_by: authUserId,
      updated_at: now,
    })
    .eq('id', inviteId)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle()

  return Boolean(data?.id)
}

/**
 * Consumes a pending user_invites row for the authenticated identity.
 * Company and role always come from the invite row (never client metadata).
 *
 * F-003 (transactionality): provisioning steps are intentionally sequential and
 * retry-safe without an RPC/DB transaction in this release. A bounded follow-up
 * may add atomic accept if partial-state frequency warrants it.
 */
export async function acceptPendingInvite(
  input: AcceptInviteInput,
): Promise<AcceptInviteResult> {
  if (!input.authUserId || !input.email?.trim()) {
    return { status: 'error', message: 'auth identity required' }
  }

  try {
    const invites = await findPendingInvitesForEmail(input.email)
    const selection = selectPendingInviteResult(invites, input.email)

    if (selection.status === 'ambiguous') {
      return {
        status: 'ambiguous_pending_invites',
        companyIds: selection.companyIds,
      }
    }

    if (selection.status === 'none') {
      const accepted = await findAcceptedInviteForUser(
        input.authUserId,
        input.email,
      )
      if (accepted) {
        const admin = getSupabaseServerClient()
        const { data: appUser } = await admin
          .from('app_users')
          .select('id')
          .eq('auth_user_id', input.authUserId)
          .maybeSingle()
        const { data: membership } = await admin
          .from('company_memberships')
          .select('id')
          .eq('company_id', accepted.company_id)
          .eq('user_id', input.authUserId)
          .maybeSingle()

        return {
          status: 'already_accepted',
          inviteId: accepted.id,
          companyId: accepted.company_id,
          role: accepted.role as CompanyRole,
          appUserId: (appUser?.id as string | undefined) ?? null,
          membershipId: (membership?.id as string | undefined) ?? null,
        }
      }

      return { status: 'no_pending_invite' }
    }

    const selected = selection.invite
    const validation = validateInviteForUser(selected, input.email)
    if (!validation.ok) {
      if (validation.reason === 'expired') {
        await markInviteExpired(selected.id)
        return { status: 'expired', inviteId: selected.id }
      }
      if (validation.reason === 'revoked') {
        return { status: 'revoked', inviteId: selected.id }
      }
      if (validation.reason === 'email_mismatch') {
        return { status: 'email_mismatch' }
      }
      return { status: 'no_pending_invite' }
    }

    const invite = validation.invite
    const role = invite.role as CompanyRole
    const companyId = invite.company_id

    const appUserId = await ensureAppUser(input, companyId)
    const membershipResult = await ensureMembership(input.authUserId, companyId, role)

    if (!membershipResult.ok) {
      return {
        status: 'role_conflict',
        inviteId: invite.id,
        companyId,
        existingRole: membershipResult.conflict.existingRole,
        inviteRole: membershipResult.conflict.inviteRole,
      }
    }

    const membershipId = membershipResult.membershipId
    const transitioned = await markInviteAccepted(invite.id, input.authUserId)

    if (!transitioned) {
      return {
        status: 'already_accepted',
        inviteId: invite.id,
        companyId,
        role,
        appUserId,
        membershipId,
      }
    }

    return {
      status: 'accepted',
      inviteId: invite.id,
      companyId,
      role,
      appUserId,
      membershipId,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'invite acceptance failed'
    return { status: 'error', message }
  }
}

/**
 * Recovery path for confirmed auth users who still have a pending invite
 * but no company membership (e.g. callback ran without provisioning).
 */
export async function recoverPendingInviteIfNeeded(input: {
  authUserId: string
  email: string
  displayName?: string | null
  membershipsCount: number
}): Promise<AcceptInviteResult | null> {
  if (input.membershipsCount > 0) return null

  const invites = await findPendingInvitesForEmail(input.email)
  const selection = selectPendingInviteResult(invites, input.email)
  if (selection.status !== 'selected') return null

  return acceptPendingInvite({
    authUserId: input.authUserId,
    email: input.email,
    displayName: input.displayName,
  })
}
