/** HTTP status when Supabase Auth invite delivery fails after DB row creation. */
export const AUTH_INVITE_FAILURE_HTTP_STATUS = 502

export function isPendingInviteActionable(invite: {
  status: string
  revoked_at?: string | null
}): boolean {
  return invite.status === 'pending' && !invite.revoked_at
}

/** Fields applied when Auth invite fails — keeps audit row, removes actionable pending state. */
export function pendingInviteAuthFailureRevokeFields(nowIso: string): {
  status: 'revoked'
  revoked_at: string
  updated_at: string
} {
  return {
    status: 'revoked',
    revoked_at: nowIso,
    updated_at: nowIso,
  }
}

export function resolveAuthInviteSendHttpStatus(authInviteError: string | null): number {
  return authInviteError ? AUTH_INVITE_FAILURE_HTTP_STATUS : 200
}
