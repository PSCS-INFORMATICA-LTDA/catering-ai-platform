import { CDL_DEV_COMPANY_ID } from './constants'
import { getAdminClient } from './supabaseAdmin'
import type { QaUserIdentity } from './testIdentity'

export type AssertionResult = 'PASS' | 'FAIL'

export type UserAssertions = {
  authUser: AssertionResult
  appUser: AssertionResult
  membership: AssertionResult
  role: AssertionResult
  inviteLifecycle: AssertionResult
  details: string[]
}

export async function findAuthUserByEmail(email: string) {
  const admin = getAdminClient()
  const normalized = email.trim().toLowerCase()

  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw new Error(`listUsers: ${error.message}`)
    const found = (data.users ?? []).find(
      (u) => (u.email ?? '').toLowerCase() === normalized,
    )
    if (found) return found
    if ((data.users ?? []).length < 200) break
  }
  return null
}

export async function assertPostInviteAcceptance(
  identity: QaUserIdentity,
): Promise<UserAssertions> {
  const admin = getAdminClient()
  const details: string[] = []
  let authUser: AssertionResult = 'FAIL'
  let appUser: AssertionResult = 'FAIL'
  let membership: AssertionResult = 'FAIL'
  let role: AssertionResult = 'FAIL'
  let inviteLifecycle: AssertionResult = 'FAIL'

  const auth = await findAuthUserByEmail(identity.email)
  if (auth?.id && auth.email_confirmed_at) {
    authUser = 'PASS'
    details.push('auth.users exists and confirmed')
  } else {
    details.push(`auth.users missing or unconfirmed: ${auth ? 'unconfirmed' : 'not found'}`)
  }

  if (auth?.id) {
    const { data: appRow } = await admin
      .from('app_users')
      .select('id, auth_user_id, email, company_id, active')
      .eq('auth_user_id', auth.id)
      .maybeSingle()

    if (appRow?.id && appRow.auth_user_id === auth.id) {
      appUser = 'PASS'
      details.push('app_users linked')
    } else {
      details.push('app_users missing or mislinked')
    }

    const { data: memberships } = await admin
      .from('company_memberships')
      .select('id, company_id, role, status, active')
      .eq('user_id', auth.id)
      .eq('company_id', CDL_DEV_COMPANY_ID)

    const activeMemberships = (memberships ?? []).filter((m) => m.active && m.status === 'active')

    if (activeMemberships.length === 1) {
      membership = 'PASS'
      details.push('single active membership for CDL DEV')
    } else {
      details.push(`membership count=${activeMemberships.length}`)
    }

    const mem = activeMemberships[0]
    if (mem?.role === identity.role) {
      role = 'PASS'
      details.push(`role=${mem.role}`)
    } else {
      details.push(`role mismatch expected=${identity.role} got=${mem?.role}`)
    }

    const { data: invites } = await admin
      .from('user_invites')
      .select('id, status, accepted_at, accepted_by, revoked_at')
      .eq('company_id', CDL_DEV_COMPANY_ID)
      .ilike('email', identity.email)

    const accepted = (invites ?? []).filter((i) => i.status === 'accepted')
    const actionablePending = (invites ?? []).filter(
      (i) => i.status === 'pending' && !i.revoked_at,
    )

    if (accepted.length >= 1 && accepted.some((i) => i.accepted_at && i.accepted_by === auth.id)) {
      if (actionablePending.length === 0) {
        inviteLifecycle = 'PASS'
        details.push('invite accepted, no actionable pending')
      } else {
        details.push(`stale pending invites=${actionablePending.length}`)
      }
    } else {
      details.push('invite not accepted properly')
    }
  }

  return { authUser, appUser, membership, role, inviteLifecycle, details }
}

export async function assertPreInvite(email: string, expectedRole: string) {
  const admin = getAdminClient()
  const { data: invite } = await admin
    .from('user_invites')
    .select('id, email, role, status, expires_at, revoked_at')
    .eq('company_id', CDL_DEV_COMPANY_ID)
    .ilike('email', email)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const auth = await findAuthUserByEmail(email)

  return {
    inviteExists: Boolean(invite?.id),
    inviteRole: invite?.role ?? null,
    roleMatches: invite?.role === expectedRole,
    inviteStatus: invite?.status ?? null,
    authUserExists: Boolean(auth?.id),
    authConfirmed: Boolean(auth?.email_confirmed_at),
    authInvited: Boolean(auth?.invited_at),
  }
}

export async function assertResendInviteState(email: string) {
  const admin = getAdminClient()
  const { data: invites } = await admin
    .from('user_invites')
    .select('id, status, revoked_at, expires_at, role')
    .eq('company_id', CDL_DEV_COMPANY_ID)
    .ilike('email', email)

  const actionable = (invites ?? []).filter(
    (i) => i.status === 'pending' && !i.revoked_at,
  )
  const stalePending = (invites ?? []).filter(
    (i) => i.status === 'pending' && i.revoked_at,
  )

  const auth = await findAuthUserByEmail(email)

  return {
    actionablePendingCount: actionable.length,
    staleReconciled: stalePending.length === 0 || actionable.length <= 1,
    authUserReused: Boolean(auth?.id),
    rolePreserved: actionable[0]?.role === 'operator' || (invites ?? []).some((i) => i.role === 'operator'),
    inviteIds: (invites ?? []).map((i) => i.id),
  }
}

export async function cleanupQaUser(email: string): Promise<void> {
  const admin = getAdminClient()
  const normalized = email.trim().toLowerCase()

  if (!normalized.startsWith('pscs.solutions+catering.qa.')) {
    throw new Error(`Cleanup refused for non-QA email`)
  }

  const auth = await findAuthUserByEmail(normalized)
  if (!auth?.id) return

  await admin.from('user_invites').delete().ilike('email', normalized)
  await admin.from('company_memberships').delete().eq('user_id', auth.id)
  await admin.from('app_users').delete().eq('auth_user_id', auth.id)
  await admin.auth.admin.deleteUser(auth.id)
}
