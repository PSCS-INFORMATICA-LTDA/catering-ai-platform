import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  normalizeInviteEmail,
  resolveMembershipInviteRole,
  selectPendingInvite,
  selectPendingInviteResult,
  shouldAttemptInviteRecovery,
  validateInviteForUser,
} from './acceptInviteCore.ts'

const NOW = new Date('2026-08-28T12:00:00.000Z')

function invite(overrides = {}) {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    company_id: '22222222-2222-4222-8222-222222222222',
    email: 'user@example.com',
    role: 'admin',
    status: 'pending',
    expires_at: '2026-09-01T12:00:00.000Z',
    revoked_at: null,
    ...overrides,
  }
}

describe('normalizeInviteEmail', () => {
  it('lowercases and trims', () => {
    assert.equal(normalizeInviteEmail('  User@Example.COM '), 'user@example.com')
  })
})

describe('selectPendingInvite', () => {
  it('selects newest valid pending invite for email', () => {
    const selected = selectPendingInvite(
      [
        invite({ id: 'a', expires_at: '2026-09-02T12:00:00.000Z' }),
        invite({ id: 'b', expires_at: '2026-09-03T12:00:00.000Z' }),
      ],
      'user@example.com',
      NOW,
    )
    assert.equal(selected?.id, 'b')
  })

  it('ignores expired invites', () => {
    const selected = selectPendingInvite(
      [invite({ expires_at: '2026-08-01T12:00:00.000Z' })],
      'user@example.com',
      NOW,
    )
    assert.equal(selected, null)
  })

  it('ignores revoked invites', () => {
    const selected = selectPendingInvite(
      [invite({ revoked_at: '2026-08-20T12:00:00.000Z' })],
      'user@example.com',
      NOW,
    )
    assert.equal(selected, null)
  })

  it('ignores other email invites', () => {
    const selected = selectPendingInvite(
      [invite({ email: 'other@example.com' })],
      'user@example.com',
      NOW,
    )
    assert.equal(selected, null)
  })

  it('uses id tie-breaker for same-company duplicate invites', () => {
    const selected = selectPendingInvite(
      [
        invite({
          id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          expires_at: '2026-09-03T12:00:00.000Z',
        }),
        invite({
          id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          expires_at: '2026-09-03T12:00:00.000Z',
        }),
      ],
      'user@example.com',
      NOW,
    )
    assert.equal(selected?.id, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
  })

  it('fails closed for multiple active invites across companies', () => {
    const result = selectPendingInviteResult(
      [
        invite({
          id: 'co-a',
          company_id: '11111111-1111-4111-8111-111111111111',
        }),
        invite({
          id: 'co-b',
          company_id: '22222222-2222-4222-8222-222222222222',
        }),
      ],
      'user@example.com',
      NOW,
    )
    assert.equal(result.status, 'ambiguous')
    if (result.status === 'ambiguous') {
      assert.deepEqual(result.companyIds.sort(), [
        '11111111-1111-4111-8111-111111111111',
        '22222222-2222-4222-8222-222222222222',
      ])
    }
    assert.equal(selectPendingInvite(
      [
        invite({ company_id: '11111111-1111-4111-8111-111111111111' }),
        invite({ company_id: '22222222-2222-4222-8222-222222222222' }),
      ],
      'user@example.com',
      NOW,
    ), null)
  })
})

describe('resolveMembershipInviteRole', () => {
  it('treats same role as idempotent match', () => {
    const result = resolveMembershipInviteRole('operator', 'operator')
    assert.equal(result.status, 'match')
    if (result.status === 'match') assert.equal(result.role, 'operator')
  })

  it('reports explicit conflict for different roles', () => {
    const result = resolveMembershipInviteRole('operator', 'admin')
    assert.equal(result.status, 'conflict')
    if (result.status === 'conflict') {
      assert.equal(result.existingRole, 'operator')
      assert.equal(result.inviteRole, 'admin')
    }
  })

  it('does not escalate operator to admin implicitly', () => {
    const result = resolveMembershipInviteRole('operator', 'admin')
    assert.equal(result.status, 'conflict')
  })
})

describe('validateInviteForUser', () => {
  it('accepts valid pending invite', () => {
    const result = validateInviteForUser(invite(), 'user@example.com', NOW)
    assert.equal(result.ok, true)
    if (result.ok) assert.equal(result.invite.role, 'admin')
  })

  it('rejects wrong email', () => {
    const result = validateInviteForUser(invite(), 'wrong@example.com', NOW)
    assert.equal(result.ok, false)
    if (!result.ok) assert.equal(result.reason, 'email_mismatch')
  })

  it('rejects expired invite', () => {
    const result = validateInviteForUser(
      invite({ expires_at: '2026-08-01T12:00:00.000Z' }),
      'user@example.com',
      NOW,
    )
    assert.equal(result.ok, false)
    if (!result.ok) assert.equal(result.reason, 'expired')
  })

  it('rejects revoked invite', () => {
    const result = validateInviteForUser(
      invite({ revoked_at: '2026-08-20T12:00:00.000Z' }),
      'user@example.com',
      NOW,
    )
    assert.equal(result.ok, false)
    if (!result.ok) assert.equal(result.reason, 'revoked')
  })

  it('preserves operator role', () => {
    const result = validateInviteForUser(
      invite({ role: 'operator' }),
      'user@example.com',
      NOW,
    )
    assert.equal(result.ok, true)
    if (result.ok) assert.equal(result.invite.role, 'operator')
  })
})

describe('shouldAttemptInviteRecovery', () => {
  it('recovers when pending invite exists and no memberships', () => {
    assert.equal(
      shouldAttemptInviteRecovery({ membershipsCount: 0, pendingInviteCount: 1 }),
      true,
    )
  })

  it('skips when memberships already exist', () => {
    assert.equal(
      shouldAttemptInviteRecovery({ membershipsCount: 1, pendingInviteCount: 1 }),
      false,
    )
  })
})
