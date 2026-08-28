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

export function selectPendingInvite(
  invites: UserInviteRow[],
  authEmail: string,
  now: Date = new Date(),
): UserInviteRow | null {
  const normalized = normalizeInviteEmail(authEmail)
  const pending = invites
    .filter((invite) => invite.status === 'pending')
    .filter((invite) => normalizeInviteEmail(invite.email) === normalized)
    .filter((invite) => !invite.revoked_at)
    .filter((invite) => new Date(invite.expires_at) > now)
    .sort(
      (a, b) =>
        new Date(b.expires_at).getTime() - new Date(a.expires_at).getTime(),
    )

  return pending[0] ?? null
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

export function shouldAttemptInviteRecovery(input: {
  membershipsCount: number
  pendingInviteCount: number
}): boolean {
  if (input.pendingInviteCount <= 0) return false
  return input.membershipsCount === 0
}
