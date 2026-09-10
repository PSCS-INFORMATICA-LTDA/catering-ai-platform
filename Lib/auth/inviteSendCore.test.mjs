import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  AUTH_INVITE_FAILURE_HTTP_STATUS,
  isPendingInviteActionable,
  pendingInviteAuthFailureRevokeFields,
  resolveAuthInviteSendHttpStatus,
} from './inviteSendCore.ts'

describe('auth invite send failure', () => {
  it('returns non-2xx when Supabase Auth invite fails', () => {
    assert.equal(resolveAuthInviteSendHttpStatus('smtp unavailable'), 502)
    assert.equal(
      resolveAuthInviteSendHttpStatus('smtp unavailable'),
      AUTH_INVITE_FAILURE_HTTP_STATUS,
    )
  })

  it('returns 200 when Supabase Auth invite succeeds', () => {
    assert.equal(resolveAuthInviteSendHttpStatus(null), 200)
  })

  it('marks failed auth invite as non-actionable pending', () => {
    const now = '2026-08-28T18:30:00.000Z'
    const patch = pendingInviteAuthFailureRevokeFields(now)
    assert.equal(patch.status, 'revoked')
    assert.equal(patch.revoked_at, now)
    assert.equal(
      isPendingInviteActionable({ status: patch.status, revoked_at: patch.revoked_at }),
      false,
    )
  })

  it('keeps actionable pending invite before auth failure handling', () => {
    assert.equal(
      isPendingInviteActionable({ status: 'pending', revoked_at: null }),
      true,
    )
  })
})
