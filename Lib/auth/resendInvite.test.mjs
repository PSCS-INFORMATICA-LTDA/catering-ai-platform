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
    revokeErrorOnCall: seed.revokeErrorOnCall ?? 0,
    loadError: seed.loadError ?? null,
    injectSiblingAfterInsert: seed.injectSiblingAfterInsert ?? false,
    audits: [],
    authCalls: [],
    revokeCalls: 0,
    nextId: 1,
  }

  const deps = {
    async loadInviteById(id) {
      if (state.loadError === 'byId') throw new Error('loadInviteById failed')
      return state.invites.find((row) => row.id === id) ?? null
    },
    async loadInvitesForCompanyEmail(companyId, email) {
      if (state.loadError === 'companyEmail') throw new Error('loadInvitesForCompanyEmail failed')
      const rows = state.invites.filter(
        (row) => row.company_id === companyId && row.email === email,
      )
      if (
        state.injectSiblingAfterInsert &&
        rows.some((row) => row.id.startsWith('new-') && row.status === 'pending')
      ) {
        return [
          ...rows,
          invite({
            id: 'sibling-valid',
            expires_at: '2026-09-16T12:00:00.000Z',
          }),
        ]
      }
      return rows
    },
    async loadActiveMembership() {
      if (state.loadError === 'membership') throw new Error('loadActiveMembership failed')
      return state.membership
    },
    async findAuthUserByEmail() {
      return state.authUser
    },
    async revokeInvites(ids, nowIso) {
      state.revokeCalls += 1
      if (state.revokeErrorOnCall === state.revokeCalls) {
        throw new Error('revoke failed')
      }
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
    assert.equal(result.inviteStatus, 'revoked')
    assert.equal(result.inviteRevoked, true)
  })

  it('reused valid invite + send failure reports pending, not revoked', async () => {
    const { state, deps } = createMemory({
      invites: [
        invite({
          id: 'fresh-1',
          expires_at: '2026-09-15T12:00:00.000Z',
        }),
      ],
      authError: 'smtp unavailable',
    })
    const result = await executeResendInvite(
      { ...command, inviteId: 'fresh-1' },
      deps,
    )
    assert.equal(result.status, 'auth_failed')
    assert.equal(result.inviteStatus, 'pending')
    assert.equal(result.inviteRevoked, false)
    assert.equal(state.invites.find((row) => row.id === 'fresh-1')?.status, 'pending')
    assert.equal(state.audits.some((event) => event.metadata.result === 'resent'), false)
  })

  it('A: revoke DB error before auth/email send fails closed', async () => {
    const { state, deps } = createMemory({
      invites: [
        invite({
          id: 'keep-valid',
          expires_at: '2026-09-20T12:00:00.000Z',
        }),
        invite({
          id: 'extra-valid',
          expires_at: '2026-09-18T12:00:00.000Z',
        }),
      ],
      revokeErrorOnCall: 1,
    })
    const result = await executeResendInvite(
      { ...command, inviteId: 'keep-valid' },
      deps,
    )
    assert.equal(result.status, 'db_failed')
    assert.equal(result.httpStatus, 500)
    assert.equal(state.authCalls.length, 0)
    assert.equal(state.audits.some((event) => event.metadata.result === 'resent'), false)
  })

  it('B/C/D: revoke DB error after insert does not send or audit success', async () => {
    const { state, deps } = createMemory({
      injectSiblingAfterInsert: true,
      revokeErrorOnCall: 1,
    })
    const result = await executeResendInvite(command, deps)
    assert.equal(result.status, 'db_failed')
    assert.equal(state.invites.some((row) => row.id.startsWith('new-')), true)
    assert.equal(state.authCalls.length, 0)
    assert.equal(state.audits.some((event) => event.metadata.result === 'resent'), false)
  })

  it('read DB error propagates as 500 and does not send', async () => {
    const { state, deps } = createMemory({ loadError: 'companyEmail' })
    const result = await executeResendInvite(command, deps)
    assert.equal(result.status, 'db_failed')
    assert.equal(state.authCalls.length, 0)
    assert.equal(state.audits.some((event) => event.metadata.result === 'resent'), false)
  })

  it('auth-fail revoke error surfaces instead of claiming revoked', async () => {
    const { state, deps } = createMemory({
      authError: 'smtp unavailable',
      revokeErrorOnCall: 1,
    })
    const result = await executeResendInvite(command, deps)
    assert.equal(result.status, 'db_failed')
    assert.equal(state.authCalls.length, 1)
    assert.equal(state.invites.find((row) => row.id.startsWith('new-'))?.status, 'pending')
    assert.equal(state.audits.some((event) => event.metadata.result === 'resent'), false)
    assert.notEqual(result.inviteStatus, 'revoked')
  })

  it('concurrent double-insert reconciles to one actionable pending', async () => {
    const shared = {
      invites: [invite(), invite({ id: 'exp-2' })],
      nextId: 1,
      insertWaiters: [],
      inserts: 0,
      authCalls: 0,
    }
    function sharedDeps() {
      return {
        async loadInviteById(id) {
          return shared.invites.find((row) => row.id === id) ?? shared.invites.at(-1) ?? null
        },
        async loadInvitesForCompanyEmail() {
          return [...shared.invites]
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
          for (const row of shared.invites) {
            if (ids.includes(row.id)) {
              row.status = 'revoked'
              row.revoked_at = nowIso
            }
          }
        },
        async insertInvite(input) {
          shared.inserts += 1
          const row = invite({
            id: `race-${shared.inserts}`,
            role: input.role,
            expires_at:
              shared.inserts === 1
                ? '2026-09-15T12:00:00.000Z'
                : '2026-09-16T12:00:00.000Z',
          })
          shared.invites.push(row)
          if (shared.inserts < 2) {
            await new Promise((resolve) => shared.insertWaiters.push(resolve))
          } else {
            for (const resolve of shared.insertWaiters) resolve()
          }
          return row
        },
        async reissueAuthAccess() {
          shared.authCalls += 1
          return { error: null, reused: true, deleted: false }
        },
        async writeAudit() {},
      }
    }
    const [first, second] = await Promise.all([
      executeResendInvite(command, sharedDeps()),
      executeResendInvite(command, sharedDeps()),
    ])
    assert.equal(first.status, 'resent')
    assert.equal(second.status, 'resent')
    const actionable = shared.invites.filter(
      (row) =>
        row.status === 'pending' &&
        !row.revoked_at &&
        new Date(row.expires_at) > NOW,
    )
    assert.equal(actionable.length, 1)
    assert.equal(actionable[0].id, 'race-2')
    assert.equal(shared.inserts, 2)
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
