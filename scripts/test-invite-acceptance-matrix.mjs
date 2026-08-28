/**
 * Invite acceptance matrix — pure logic + idempotency expectations (no DB).
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  resolveMembershipInviteRole,
  selectPendingInvite,
  selectPendingInviteResult,
  shouldAttemptInviteRecovery,
  validateInviteForUser,
} from '../Lib/auth/acceptInviteCore.ts'
import { resolveAppOrigin } from '../Lib/auth/appOrigin.ts'
import {
  isPendingInviteActionable,
  pendingInviteAuthFailureRevokeFields,
  resolveAuthInviteSendHttpStatus,
} from '../Lib/auth/inviteSendCore.ts'

const NOW = new Date('2026-08-28T12:00:00.000Z')

describe('invite acceptance matrix', () => {
  it('A: new invited user — admin role preserved', () => {
    const invite = {
      id: 'inv-admin',
      company_id: 'co-1',
      email: 'new.admin@example.com',
      role: 'admin',
      status: 'pending',
      expires_at: '2026-09-10T12:00:00.000Z',
      revoked_at: null,
    }
    const selected = selectPendingInvite([invite], 'new.admin@example.com', NOW)
    assert.ok(selected)
    const validation = validateInviteForUser(selected, 'new.admin@example.com', NOW)
    assert.equal(validation.ok, true)
    if (validation.ok) assert.equal(validation.invite.role, 'admin')
  })

  it('D: operator role preserved', () => {
    const invite = {
      id: 'inv-op',
      company_id: 'co-1',
      email: 'juninho@example.com',
      role: 'operator',
      status: 'pending',
      expires_at: '2026-09-10T12:00:00.000Z',
      revoked_at: null,
    }
    const validation = validateInviteForUser(invite, 'juninho@example.com', NOW)
    assert.equal(validation.ok, true)
    if (validation.ok) assert.equal(validation.invite.role, 'operator')
  })

  it('E: wrong email cannot consume invite', () => {
    const invite = {
      id: 'inv-1',
      company_id: 'co-1',
      email: 'danielle@example.com',
      role: 'admin',
      status: 'pending',
      expires_at: '2026-09-10T12:00:00.000Z',
      revoked_at: null,
    }
    const validation = validateInviteForUser(invite, 'attacker@example.com', NOW)
    assert.equal(validation.ok, false)
    if (!validation.ok) assert.equal(validation.reason, 'email_mismatch')
  })

  it('F: expired invite rejected', () => {
    const invite = {
      id: 'inv-exp',
      company_id: 'co-1',
      email: 'user@example.com',
      role: 'admin',
      status: 'pending',
      expires_at: '2026-08-01T12:00:00.000Z',
      revoked_at: null,
    }
    const validation = validateInviteForUser(invite, 'user@example.com', NOW)
    assert.equal(validation.ok, false)
    if (!validation.ok) assert.equal(validation.reason, 'expired')
  })

  it('B: existing confirmed auth user + pending invite — recovery eligible', () => {
    assert.equal(
      shouldAttemptInviteRecovery({ membershipsCount: 0, pendingInviteCount: 1 }),
      true,
    )
  })

  it('H: duplicate membership guard — recovery skipped when membership exists', () => {
    assert.equal(
      shouldAttemptInviteRecovery({ membershipsCount: 1, pendingInviteCount: 1 }),
      false,
    )
  })

  it('G: replay/idempotency — selecting same pending invite twice is stable', () => {
    const invite = {
      id: 'inv-replay',
      company_id: 'co-1',
      email: 'user@example.com',
      role: 'admin',
      status: 'pending',
      expires_at: '2026-09-10T12:00:00.000Z',
      revoked_at: null,
    }
    const first = selectPendingInvite([invite], 'user@example.com', NOW)
    const second = selectPendingInvite([invite], 'user@example.com', NOW)
    assert.deepEqual(first, second)
  })

  it('auth invite failure returns non-2xx', () => {
    assert.equal(resolveAuthInviteSendHttpStatus('delivery failed'), 502)
  })

  it('failed auth invite is not left actionable as pending', () => {
    const patch = pendingInviteAuthFailureRevokeFields('2026-08-28T18:30:00.000Z')
    assert.equal(
      isPendingInviteActionable({ status: patch.status, revoked_at: patch.revoked_at }),
      false,
    )
  })

  it('deployed canonical origin ignores untrusted request host', () => {
    const result = resolveAppOrigin({
      nextPublicAppUrl: 'https://catering-ai-agenda-dev.vercel.app',
      requestOrigin: 'https://evil.example.com',
      isDeployed: true,
    })
    assert.equal(result.ok, true)
    if (result.ok) {
      assert.equal(result.origin, 'https://catering-ai-agenda-dev.vercel.app')
    }
  })

  it('same-role membership is idempotent', () => {
    const result = resolveMembershipInviteRole('operator', 'operator')
    assert.equal(result.status, 'match')
  })

  it('different-role membership is explicit conflict', () => {
    const result = resolveMembershipInviteRole('operator', 'admin')
    assert.equal(result.status, 'conflict')
  })

  it('multi-company pending invites fail closed', () => {
    const result = selectPendingInviteResult(
      [
        {
          id: 'inv-a',
          company_id: 'co-a',
          email: 'danielle@example.com',
          role: 'admin',
          status: 'pending',
          expires_at: '2026-09-10T12:00:00.000Z',
          revoked_at: null,
        },
        {
          id: 'inv-b',
          company_id: 'co-b',
          email: 'danielle@example.com',
          role: 'admin',
          status: 'pending',
          expires_at: '2026-09-11T12:00:00.000Z',
          revoked_at: null,
        },
      ],
      'danielle@example.com',
      NOW,
    )
    assert.equal(result.status, 'ambiguous')
  })
})
