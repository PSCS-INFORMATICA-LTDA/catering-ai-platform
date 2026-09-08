import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { executeResendInvite } from './resendInviteCore.ts'

const NOW = new Date('2026-09-08T12:00:00.000Z')
const COMPANY = '65fd576f-8d97-49ba-bf38-61bc1e94e94a'
const REDIRECT = 'https://catering-ai-agenda-dev.vercel.app/auth/callback?next=/quotes'

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

function createMemory(seed = {}) {
  const state = {
    invites: seed.invites ?? [invite(), invite({ id: 'exp-2' })],
    membership: seed.membership ?? null,
    authUser:
      seed.authUser === undefined
        ? { id: 'auth-caio', email: 'caioh381@gmail.com', emailConfirmedAt: null }
        : seed.authUser,
    authError: seed.authError ?? null,
    audits: [],
    authCalls: [],
    nextId: 1,
  }

  const deps = {
    async loadInviteById(id) {
      return state.invites.find((row) => row.id === id) ?? null
    },
    async loadInvitesForCompanyEmail(companyId, email) {
      return state.invites.filter(
        (row) => row.company_id === companyId && row.email === email,
      )
    },
    async loadActiveMembership() {
      return state.membership
    },
    async findAuthUserByEmail() {
      return state.authUser
    },
    async revokeInvites(ids, nowIso) {
      state.invites = state.invites.map((row) =>
        ids.includes(row.id)
          ? { ...row, status: 'revoked', revoked_at: nowIso }
          : row,
      )
    },
    async insertInvite(input) {
      const created = invite({
        id: `new-${state.nextId}`,
        email: input.email,
        role: input.role,
        company_id: input.companyId,
        expires_at: '2026-09-15T12:00:00.000Z',
      })
      state.nextId += 1
      state.invites.push(created)
      return created
    },
    async reissueAuthAccess(input) {
      state.authCalls.push(input)
      return {
        error: state.authError,
        reused: input.strategy === 'generate_invite_link',
        deleted: false,
      }
    },
    async writeAudit(event) {
      state.audits.push(event)
    },
  }

  return { state, deps }
}

const command = {
  inviteId: 'exp-1',
  actorUserId: 'actor-admin',
  actorCompanyId: COMPANY,
  isPlatformAdmin: false,
  redirectTo: REDIRECT,
  now: NOW,
}

describe('executeResendInvite', () => {
  it('A-D: expired pending + existing auth user creates one invite and reuses auth', async () => {
    const { state, deps } = createMemory()
    const first = await executeResendInvite(command, deps)
    assert.equal(first.status, 'resent')
    if (first.status !== 'resent') return
    assert.equal(first.authUserReused, true)
    assert.equal(first.authUserDeleted, false)
    assert.equal(first.createdNewInvite, true)
    assert.equal(first.role, 'admin')
    assert.equal(first.strategy, 'generate_invite_link')
    assert.deepEqual(first.revokedInviteIds.sort(), ['exp-1', 'exp-2'])
    assert.equal(
      state.invites.filter((row) => row.status === 'pending' && !row.revoked_at).length,
      1,
    )
    assert.equal(state.authCalls[0].redirectTo, REDIRECT)
    assert.equal(state.audits.at(-1)?.metadata.authUserDeleted, false)
  })

  it('I: second click is idempotent and does not create another valid invite', async () => {
    const { state, deps } = createMemory()
    const first = await executeResendInvite(command, deps)
    const second = await executeResendInvite(
      { ...command, inviteId: first.status === 'resent' ? first.inviteId : 'exp-1' },
      deps,
    )
    assert.equal(second.status, 'resent')
    if (second.status !== 'resent') return
    assert.equal(second.createdNewInvite, false)
    assert.equal(second.inviteId, first.status === 'resent' ? first.inviteId : null)
    assert.equal(
      state.invites.filter((row) => row.status === 'pending' && !row.revoked_at).length,
      1,
    )
  })

  it('J: auth failure fail-closes the newly created invite', async () => {
    const { state, deps } = createMemory({ authError: 'smtp unavailable' })
    const result = await executeResendInvite(command, deps)
    assert.equal(result.status, 'auth_failed')
    assert.equal(result.httpStatus, 502)
    const created = state.invites.filter((row) => row.id.startsWith('new-'))
    assert.equal(created.length, 1)
    assert.equal(created[0].status, 'revoked')
    assert.equal(
      state.invites.filter(
        (row) =>
          row.status === 'pending' &&
          !row.revoked_at &&
          new Date(row.expires_at) > NOW,
      ).length,
      0,
    )
    assert.equal(
      state.invites.filter(
        (row) =>
          (row.id === 'exp-1' || row.id === 'exp-2') && row.status === 'pending',
      ).length,
      2,
    )
    assert.equal(state.audits.at(-1)?.metadata.result, 'auth_failed')
    assert.equal(state.audits.at(-1)?.metadata.inviteRevoked, true)
  })

  it('G: already_member does not send or insert', async () => {
    const { state, deps } = createMemory({
      membership: { id: 'mem-1', role: 'admin', status: 'active' },
    })
    const result = await executeResendInvite(command, deps)
    assert.equal(result.status, 'already_member')
    assert.equal(state.authCalls.length, 0)
    assert.equal(state.invites.filter((row) => row.id.startsWith('new-')).length, 0)
  })

  it('H: wrong tenant is forbidden before writes', async () => {
    const { state, deps } = createMemory()
    const result = await executeResendInvite(
      { ...command, actorCompanyId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' },
      deps,
    )
    assert.equal(result.status, 'forbidden_tenant')
    assert.equal(state.authCalls.length, 0)
    assert.equal(
      state.invites.filter((row) => row.status === 'revoked').length,
      0,
    )
  })

  it('L: client role is ignored because the command has no role field', async () => {
    const { deps } = createMemory()
    const result = await executeResendInvite(command, deps)
    assert.equal(result.status, 'resent')
    if (result.status === 'resent') assert.equal(result.role, 'admin')
  })
})
