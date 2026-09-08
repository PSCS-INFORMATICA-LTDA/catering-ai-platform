import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  buildInviteDirectoryRows,
  canShowResendAction,
  countActionablePendingInvites,
  expectedActiveInviteCountAfterResend,
  planResendInvite,
  reconcileActivePendingInvites,
  resolveAuthReissueStrategy,
  sanitizeResendAuditMetadata,
  selectInvitesToRevoke,
  selectReusableActiveInvite,
} from './resendInviteCore.ts'

const NOW = new Date('2026-09-08T12:00:00.000Z')
const COMPANY = '65fd576f-8d97-49ba-bf38-61bc1e94e94a'
const OTHER_COMPANY = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

function invite(overrides = {}) {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    company_id: COMPANY,
    email: 'caioh381@gmail.com',
    role: 'admin',
    status: 'pending',
    expires_at: '2026-09-04T12:00:00.000Z',
    revoked_at: null,
    ...overrides,
  }
}

describe('canShowResendAction', () => {
  it('hides resend for active members', () => {
    assert.equal(
      canShowResendAction({ hasActiveMembership: true, hasInviteRecord: true }),
      false,
    )
  })

  it('shows resend for invite-only rows', () => {
    assert.equal(
      canShowResendAction({ hasActiveMembership: false, hasInviteRecord: true }),
      true,
    )
  })
})

describe('resolveAuthReissueStrategy', () => {
  it('reuses existing unconfirmed auth user via generateLink', () => {
    const result = resolveAuthReissueStrategy({
      id: 'auth-caio',
      email: 'caioh381@gmail.com',
      emailConfirmedAt: null,
    })
    assert.equal(result.strategy, 'generate_invite_link')
    assert.equal(result.reused, true)
  })

  it('invites a new auth user when none exists', () => {
    const result = resolveAuthReissueStrategy(null)
    assert.equal(result.strategy, 'invite_user_by_email')
    assert.equal(result.reused, false)
  })
})

describe('planResendInvite', () => {
  it('A: expired invites + unconfirmed auth user → resend and reuse auth', () => {
    const first = invite({ id: 'exp-1' })
    const second = invite({ id: 'exp-2', expires_at: '2026-09-03T12:00:00.000Z' })
    const plan = planResendInvite({
      sourceInvite: first,
      actorCompanyId: COMPANY,
      isPlatformAdmin: false,
      companyEmailInvites: [first, second],
      activeMembership: null,
      authUser: {
        id: 'auth-caio',
        email: 'caioh381@gmail.com',
        emailConfirmedAt: null,
      },
      now: NOW,
    })
    assert.equal(plan.status, 'resend')
    if (plan.status !== 'resend') return
    assert.equal(plan.email, 'caioh381@gmail.com')
    assert.equal(plan.role, 'admin')
    assert.equal(plan.createNewInvite, true)
    assert.deepEqual(plan.revokeInviteIds.sort(), ['exp-1', 'exp-2'])
    assert.equal(plan.authUserReused, true)
    assert.equal(plan.authStrategy, 'generate_invite_link')
    assert.equal(expectedActiveInviteCountAfterResend(), 1)
  })

  it('E: preserves admin role from server invite, not a client decoy', () => {
    const source = invite({ role: 'admin' })
    const plan = planResendInvite({
      sourceInvite: source,
      actorCompanyId: COMPANY,
      isPlatformAdmin: false,
      companyEmailInvites: [source],
      activeMembership: null,
      authUser: null,
      now: NOW,
    })
    assert.equal(plan.status, 'resend')
    if (plan.status === 'resend') assert.equal(plan.role, 'admin')
  })

  it('F: preserves operator role from server invite', () => {
    const source = invite({ email: 'op@example.com', role: 'operator' })
    const plan = planResendInvite({
      sourceInvite: source,
      actorCompanyId: COMPANY,
      isPlatformAdmin: false,
      companyEmailInvites: [source],
      activeMembership: null,
      authUser: null,
      now: NOW,
    })
    assert.equal(plan.status, 'resend')
    if (plan.status === 'resend') assert.equal(plan.role, 'operator')
  })

  it('G: active member → already_member', () => {
    const source = invite()
    const plan = planResendInvite({
      sourceInvite: source,
      actorCompanyId: COMPANY,
      isPlatformAdmin: false,
      companyEmailInvites: [source],
      activeMembership: { id: 'mem-1', role: 'admin', status: 'active' },
      authUser: {
        id: 'auth-caio',
        email: 'caioh381@gmail.com',
        emailConfirmedAt: '2026-01-01T00:00:00.000Z',
      },
      now: NOW,
    })
    assert.equal(plan.status, 'already_member')
    if (plan.status === 'already_member') assert.equal(plan.role, 'admin')
  })

  it('H: wrong tenant cannot resend', () => {
    const plan = planResendInvite({
      sourceInvite: invite(),
      actorCompanyId: OTHER_COMPANY,
      isPlatformAdmin: false,
      companyEmailInvites: [invite()],
      activeMembership: null,
      authUser: null,
      now: NOW,
    })
    assert.equal(plan.status, 'forbidden_tenant')
  })

  it('I: second click reuses the still-valid invite', () => {
    const fresh = invite({
      id: 'fresh-1',
      expires_at: '2026-09-15T12:00:00.000Z',
    })
    const expired = invite({ id: 'old-1' })
    const plan = planResendInvite({
      sourceInvite: expired,
      actorCompanyId: COMPANY,
      isPlatformAdmin: false,
      companyEmailInvites: [expired, fresh],
      activeMembership: null,
      authUser: {
        id: 'auth-caio',
        email: 'caioh381@gmail.com',
        emailConfirmedAt: null,
      },
      now: NOW,
    })
    assert.equal(plan.status, 'resend')
    if (plan.status !== 'resend') return
    assert.equal(plan.createNewInvite, false)
    assert.equal(plan.keepInviteId, 'fresh-1')
    assert.deepEqual(plan.revokeInviteIds, ['old-1'])
  })

  it('K: plan never includes a client-supplied origin', () => {
    const plan = planResendInvite({
      sourceInvite: invite(),
      actorCompanyId: COMPANY,
      isPlatformAdmin: false,
      companyEmailInvites: [invite()],
      activeMembership: null,
      authUser: null,
      now: NOW,
    })
    assert.equal(plan.status, 'resend')
    if (plan.status === 'resend') {
      assert.equal('redirectTo' in plan, false)
    }
  })
})

describe('invite directory rows', () => {
  it('collapses multiple expired pending invites into one resendable row', () => {
    const rows = buildInviteDirectoryRows({
      membershipEmails: [],
      invites: [
        invite({ id: 'exp-1' }),
        invite({ id: 'exp-2', expires_at: '2026-09-01T12:00:00.000Z' }),
      ],
      now: NOW,
    })
    assert.equal(rows.length, 1)
    assert.equal(rows[0].canResend, true)
    assert.equal(rows[0].status, 'invite_expired')
    assert.equal(rows[0].role, 'admin')
  })

  it('does not show an invite row when the email already has membership', () => {
    const rows = buildInviteDirectoryRows({
      membershipEmails: ['caioh381@gmail.com'],
      invites: [invite()],
      now: NOW,
    })
    assert.equal(rows.length, 0)
  })
})

describe('reconcile and revoke', () => {
  it('keeps exactly one valid pending invite', () => {
    const result = reconcileActivePendingInvites(
      [
        invite({
          id: 'keep',
          expires_at: '2026-09-20T12:00:00.000Z',
        }),
        invite({
          id: 'drop',
          expires_at: '2026-09-18T12:00:00.000Z',
        }),
      ],
      NOW,
    )
    assert.equal(result.keepId, 'keep')
    assert.deepEqual(result.revokeIds, ['drop'])
    assert.equal(expectedActiveInviteCountAfterResend(), 1)
    assert.equal(
      countActionablePendingInvites(
        [
          invite({
            id: 'keep',
            expires_at: '2026-09-20T12:00:00.000Z',
          }),
          invite({
            id: 'drop',
            expires_at: '2026-09-18T12:00:00.000Z',
          }),
        ],
        NOW,
      ),
      2,
    )
  })

  it('revokes leftover pending rows except the reusable one', () => {
    const reusable = selectReusableActiveInvite(
      [
        invite({ id: 'fresh', expires_at: '2026-09-20T12:00:00.000Z' }),
        invite({ id: 'stale' }),
      ],
      NOW,
    )
    const revoke = selectInvitesToRevoke(
      [
        invite({ id: 'fresh', expires_at: '2026-09-20T12:00:00.000Z' }),
        invite({ id: 'stale' }),
      ],
      reusable?.id ?? null,
    )
    assert.equal(reusable?.id, 'fresh')
    assert.deepEqual(revoke.map((row) => row.id), ['stale'])
  })
})

describe('audit sanitization', () => {
  it('strips tokens and secrets', () => {
    const sanitized = sanitizeResendAuditMetadata({
      email: 'caioh381@gmail.com',
      action_link: 'https://secret',
      token: 'abc',
      hashed_token: 'def',
      email_otp: '123456',
      result: 'resent',
    })
    assert.equal(sanitized.email, 'caioh381@gmail.com')
    assert.equal(sanitized.result, 'resent')
    assert.equal('action_link' in sanitized, false)
    assert.equal('token' in sanitized, false)
    assert.equal('hashed_token' in sanitized, false)
    assert.equal('email_otp' in sanitized, false)
  })
})
