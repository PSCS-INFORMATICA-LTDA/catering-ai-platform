/**
 * Resend-invite matrix — pure planner + mocked orchestrator (no live DEV I/O).
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { resolveAppOrigin } from '../Lib/auth/appOrigin.ts'
import {
  buildInviteDirectoryRows,
  canShowResendAction,
  expectedActiveInviteCountAfterResend,
  planResendInvite,
} from '../Lib/auth/resendInviteCore.ts'
import { executeResendInvite } from '../Lib/auth/resendInviteCore.ts'

const NOW = new Date('2026-09-08T12:00:00.000Z')
const COMPANY = '65fd576f-8d97-49ba-bf38-61bc1e94e94a'
const route = readFileSync(new URL('../app/api/users/resend/route.ts', import.meta.url), 'utf8')
const usersRoute = readFileSync(new URL('../app/api/users/route.ts', import.meta.url), 'utf8')
const usersUi = readFileSync(new URL('../app/users/page.tsx', import.meta.url), 'utf8')

function invite(overrides = {}) {
  return {
    id: 'exp-1',
    company_id: COMPANY,
    email: 'caioh381@gmail.com',
    role: 'admin',
    status: 'pending',
    expires_at: '2026-09-04T12:00:00.000Z',
    revoked_at: null,
    ...overrides,
  }
}

describe('resend invite matrix', () => {
  it('A: expired invite + unconfirmed existing auth user plans a resend', () => {
    const plan = planResendInvite({
      sourceInvite: invite(),
      actorCompanyId: COMPANY,
      isPlatformAdmin: false,
      companyEmailInvites: [invite(), invite({ id: 'exp-2' })],
      activeMembership: null,
      authUser: {
        id: 'auth-caio',
        email: 'caioh381@gmail.com',
        emailConfirmedAt: null,
      },
      now: NOW,
    })
    assert.equal(plan.status, 'resend')
    if (plan.status === 'resend') {
      assert.equal(plan.authUserReused, true)
      assert.equal(plan.authStrategy, 'generate_invite_link')
    }
  })

  it('B/C: multiple expired pending invites are revoked and one current invite is expected', () => {
    const plan = planResendInvite({
      sourceInvite: invite(),
      actorCompanyId: COMPANY,
      isPlatformAdmin: false,
      companyEmailInvites: [invite(), invite({ id: 'exp-2' })],
      activeMembership: null,
      authUser: null,
      now: NOW,
    })
    assert.equal(plan.status, 'resend')
    if (plan.status === 'resend') {
      assert.equal(plan.revokeInviteIds.length, 2)
      assert.equal(plan.createNewInvite, true)
      assert.equal(expectedActiveInviteCountAfterResend(), 1)
    }
  })

  it('D: auth user reused, never deleted', () => {
    const plan = planResendInvite({
      sourceInvite: invite(),
      actorCompanyId: COMPANY,
      isPlatformAdmin: false,
      companyEmailInvites: [invite()],
      activeMembership: null,
      authUser: {
        id: 'auth-caio',
        email: 'caioh381@gmail.com',
        emailConfirmedAt: null,
      },
      now: NOW,
    })
    assert.equal(plan.status, 'resend')
    if (plan.status === 'resend') {
      assert.equal(plan.authUserReused, true)
    }
    assert.match(route, /deleted: false/)
    assert.match(route, /generateLink\(/)
    assert.match(route, /type: 'invite'/)
    assert.match(route, /type: 'signup'/)
    assert.doesNotMatch(route, /deleteUser|auth\.admin\.delete/)
    assert.doesNotMatch(route, /resend\(\{\s*type: 'invite'/)
  })

  it('E/F: admin and operator roles come from server invite rows', () => {
    const adminPlan = planResendInvite({
      sourceInvite: invite({ role: 'admin' }),
      actorCompanyId: COMPANY,
      isPlatformAdmin: false,
      companyEmailInvites: [invite({ role: 'admin' })],
      activeMembership: null,
      authUser: null,
      now: NOW,
    })
    const operatorPlan = planResendInvite({
      sourceInvite: invite({ email: 'op@example.com', role: 'operator' }),
      actorCompanyId: COMPANY,
      isPlatformAdmin: false,
      companyEmailInvites: [invite({ email: 'op@example.com', role: 'operator' })],
      activeMembership: null,
      authUser: null,
      now: NOW,
    })
    assert.equal(adminPlan.status === 'resend' && adminPlan.role, 'admin')
    assert.equal(operatorPlan.status === 'resend' && operatorPlan.role, 'operator')
  })

  it('G: active member is not treated as a new invite', () => {
    assert.equal(
      canShowResendAction({ hasActiveMembership: true, hasInviteRecord: true }),
      false,
    )
    const plan = planResendInvite({
      sourceInvite: invite(),
      actorCompanyId: COMPANY,
      isPlatformAdmin: false,
      companyEmailInvites: [invite()],
      activeMembership: { id: 'mem', role: 'admin', status: 'active' },
      authUser: null,
      now: NOW,
    })
    assert.equal(plan.status, 'already_member')
  })

  it('H: wrong tenant cannot resend', () => {
    const plan = planResendInvite({
      sourceInvite: invite(),
      actorCompanyId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      isPlatformAdmin: false,
      companyEmailInvites: [invite()],
      activeMembership: null,
      authUser: null,
      now: NOW,
    })
    assert.equal(plan.status, 'forbidden_tenant')
  })

  it('I: replay keeps a single valid invite', async () => {
    const invites = [invite(), invite({ id: 'exp-2' })]
    let created = 0
    const deps = {
      async loadInviteById(id) {
        return invites.find((row) => row.id === id) ?? invites.at(-1) ?? null
      },
      async loadInvitesForCompanyEmail() {
        return [...invites]
      },
      async loadActiveMembership() {
        return null
      },
      async findAuthUserByEmail() {
        return {
          id: 'auth-caio',
          email: 'caioh381@gmail.com',
          emailConfirmedAt: null,
        }
      },
      async revokeInvites(ids, nowIso) {
        for (const row of invites) {
          if (ids.includes(row.id)) {
            row.status = 'revoked'
            row.revoked_at = nowIso
          }
        }
      },
      async insertInvite(input) {
        created += 1
        const row = invite({
          id: `fresh-${created}`,
          role: input.role,
          expires_at: '2026-09-15T12:00:00.000Z',
        })
        invites.push(row)
        return row
      },
      async reissueAuthAccess() {
        return { error: null, reused: true, deleted: false }
      },
      async writeAudit() {},
    }
    const command = {
      inviteId: 'exp-1',
      actorUserId: 'actor',
      actorCompanyId: COMPANY,
      isPlatformAdmin: false,
      redirectTo: 'https://catering-ai-agenda-dev.vercel.app/auth/callback?next=/quotes',
      now: NOW,
    }
    const first = await executeResendInvite(command, deps)
    const second = await executeResendInvite(
      { ...command, inviteId: first.status === 'resent' ? first.inviteId : 'fresh-1' },
      deps,
    )
    assert.equal(first.status, 'resent')
    assert.equal(second.status, 'resent')
    if (second.status === 'resent') assert.equal(second.createdNewInvite, false)
    assert.equal(created, 1)
  })

  it('J: auth failure fail-closes', async () => {
    const invites = [invite()]
    const result = await executeResendInvite(
      {
        inviteId: 'exp-1',
        actorUserId: 'actor',
        actorCompanyId: COMPANY,
        isPlatformAdmin: false,
        redirectTo: 'https://catering-ai-agenda-dev.vercel.app/auth/callback?next=/quotes',
        now: NOW,
      },
      {
        async loadInviteById() {
          return invites[0]
        },
        async loadInvitesForCompanyEmail() {
          return invites
        },
        async loadActiveMembership() {
          return null
        },
        async findAuthUserByEmail() {
          return null
        },
        async revokeInvites(ids, nowIso) {
          for (const row of invites) {
            if (ids.includes(row.id)) {
              row.status = 'revoked'
              row.revoked_at = nowIso
            }
          }
        },
        async insertInvite() {
          const row = invite({
            id: 'new-1',
            expires_at: '2026-09-15T12:00:00.000Z',
          })
          invites.push(row)
          return row
        },
        async reissueAuthAccess() {
          return { error: 'smtp unavailable', reused: false, deleted: false }
        },
        async writeAudit() {},
      },
    )
    assert.equal(result.status, 'auth_failed')
    assert.equal(result.inviteStatus, 'revoked')
    assert.equal(invites.find((row) => row.id === 'new-1')?.status, 'revoked')
    assert.equal(invites.find((row) => row.id === 'exp-1')?.status, 'pending')
    assert.equal(
      invites.some(
        (row) =>
          row.status === 'pending' &&
          !row.revoked_at &&
          new Date(row.expires_at) > NOW,
      ),
      false,
    )
  })

  it('K: canonical callback is reused and Host is not trusted when deployed', () => {
    assert.match(route, /inviteAuthCallbackUrl\(request\)/)
    const deployed = resolveAppOrigin({
      nextPublicAppUrl: 'https://catering-ai-agenda-dev.vercel.app',
      requestOrigin: 'https://evil.example',
      isDeployed: true,
    })
    assert.equal(deployed.ok, true)
    if (deployed.ok) {
      assert.equal(deployed.origin, 'https://catering-ai-agenda-dev.vercel.app')
    }
  })

  it('L: route ignores client role and auth_user_id as authority', () => {
    assert.match(route, /void body\.role/)
    assert.match(route, /void body\.auth_user_id/)
    assert.match(route, /inviteId/)
    assert.match(route, /inviteStatus: outcome\.inviteStatus/)
    assert.match(usersRoute, /inviteError/)
    assert.match(route, /AUTH_USER_LOOKUP_CAP/)
    assert.doesNotMatch(route, /\.ilike\('email'/)
  })

  it('M: invite directory never duplicates an active membership email', () => {
    const rows = buildInviteDirectoryRows({
      membershipEmails: ['caioh381@gmail.com'],
      invites: [invite()],
      now: NOW,
    })
    assert.equal(rows.length, 0)
    assert.match(usersUi, /resendInvite/)
    assert.match(usersUi, /row\.canResend/)
  })
})
