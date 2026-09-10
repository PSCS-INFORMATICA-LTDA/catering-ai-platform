import type { CompanyRole } from '@/Lib/tenant/types'

export type UserInviteRow = {
  id: string
  company_id: string
  email: string
  role: string
  status: string
  expires_at: string
  revoked_at?: string | null
  accepted_by?: string | null
}

export type InviteValidationResult =
  | { ok: true; invite: UserInviteRow }
  | { ok: false; reason: 'no_pending_invite' | 'email_mismatch' | 'expired' | 'revoked' }

export type SelectPendingInviteResult =
  | { status: 'selected'; invite: UserInviteRow }
  | { status: 'none' }
  | { status: 'ambiguous'; companyIds: string[] }

export type MembershipInviteRoleResult =
  | { status: 'no_existing' }
  | { status: 'match'; role: CompanyRole }
  | { status: 'conflict'; existingRole: CompanyRole; inviteRole: CompanyRole }

const ALLOWED_ROLES: CompanyRole[] = [
  'owner',
  'admin',
  'manager',
  'sales',
  'operator',
  'kitchen',
  'finance',
  'viewer',
]

export function normalizeInviteEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function isAllowedInviteRole(role: string): role is CompanyRole {
  return (ALLOWED_ROLES as string[]).includes(role)
}

function filterActivePendingInvites(
  invites: UserInviteRow[],
  authEmail: string,
  now: Date,
): UserInviteRow[] {
  const normalized = normalizeInviteEmail(authEmail)
  return invites
    .filter((invite) => invite.status === 'pending')
    .filter((invite) => normalizeInviteEmail(invite.email) === normalized)
    .filter((invite) => !invite.revoked_at)
    .filter((invite) => new Date(invite.expires_at) > now)
}

function sortPendingInvites(invites: UserInviteRow[]): UserInviteRow[] {
  return [...invites].sort((a, b) => {
    const byExpiry =
      new Date(b.expires_at).getTime() - new Date(a.expires_at).getTime()
    if (byExpiry !== 0) return byExpiry
    return a.id.localeCompare(b.id)
  })
}

/**
 * Selects a single pending invite when unambiguous.
 * Fails closed when multiple active invites span different companies.
 */
export function selectPendingInviteResult(
  invites: UserInviteRow[],
  authEmail: string,
  now: Date = new Date(),
): SelectPendingInviteResult {
  const pending = sortPendingInvites(filterActivePendingInvites(invites, authEmail, now))

  if (pending.length === 0) return { status: 'none' }

  const companyIds = [...new Set(pending.map((invite) => invite.company_id))]
  if (companyIds.length > 1) {
    return { status: 'ambiguous', companyIds }
  }

  return { status: 'selected', invite: pending[0] }
}

export function selectPendingInvite(
  invites: UserInviteRow[],
  authEmail: string,
  now: Date = new Date(),
): UserInviteRow | null {
  const result = selectPendingInviteResult(invites, authEmail, now)
  return result.status === 'selected' ? result.invite : null
}

export function validateInviteForUser(
  invite: UserInviteRow,
  authEmail: string,
  now: Date = new Date(),
): InviteValidationResult {
  if (invite.status !== 'pending') {
    return { ok: false, reason: 'no_pending_invite' }
  }

  if (invite.revoked_at) {
    return { ok: false, reason: 'revoked' }
  }

  if (normalizeInviteEmail(invite.email) !== normalizeInviteEmail(authEmail)) {
    return { ok: false, reason: 'email_mismatch' }
  }

  if (new Date(invite.expires_at) <= now) {
    return { ok: false, reason: 'expired' }
  }

  if (!isAllowedInviteRole(invite.role)) {
    return { ok: false, reason: 'no_pending_invite' }
  }

  return { ok: true, invite }
}

export function resolveMembershipInviteRole(
  existingRole: string | null | undefined,
  inviteRole: CompanyRole,
): MembershipInviteRoleResult {
  if (!existingRole) return { status: 'no_existing' }
  if (!isAllowedInviteRole(existingRole)) {
    return { status: 'conflict', existingRole: 'viewer', inviteRole }
  }
  if (existingRole === inviteRole) {
    return { status: 'match', role: inviteRole }
  }
  return {
    status: 'conflict',
    existingRole,
    inviteRole,
  }
}

export function shouldAttemptInviteRecovery(input: {
  membershipsCount: number
  pendingInviteCount: number
}): boolean {
  if (input.pendingInviteCount <= 0) return false
  return input.membershipsCount === 0
}
