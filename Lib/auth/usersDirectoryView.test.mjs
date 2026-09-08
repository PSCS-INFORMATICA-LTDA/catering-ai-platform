import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { buildInviteDirectoryRows } from './resendInviteCore.ts'

const COMPANY = '65fd576f-8d97-49ba-bf38-61bc1e94e94a'
const OTHER_COMPANY = '11111111-1111-1111-1111-111111111111'
const NOW = new Date('2026-09-08T21:00:00.000Z')

function invite(overrides = {}) {
  return {
    id: 'invite-1',
    company_id: COMPANY,
    email: 'caioh381@gmail.com',
    role: 'admin',
    status: 'pending',
    expires_at: '2026-09-01T12:00:00.000Z',
    revoked_at: null,
    accepted_by: null,
    ...overrides,
  }
}

function membershipRow(overrides = {}) {
  return {
    id: 'mem-dani',
    kind: 'membership',
    userId: 'user-dani',
    inviteId: null,
    role: 'admin',
    status: 'active',
    active: true,
    email: 'dani@example.com',
    name: 'Dani',
    isPlatformAdmin: false,
    canResend: false,
    createdAt: '2026-08-01T12:00:00.000Z',
    ...overrides,
  }
}

function showResendAction(row, canInvite) {
  return Boolean(row.canResend && canInvite)
}

describe('/users directory merge (no live data)', () => {
  it('keeps active members and adds searchable invite-directory rows', () => {
    const memberships = [
      membershipRow(),
      membershipRow({
        id: 'mem-other',
        userId: 'user-other',
        email: 'owner@example.com',
        name: 'Owner',
        role: 'owner',
      }),
    ]
    const invites = [
      invite(),
      invite({
        id: 'invite-juninho',
        email: 'juninhoyoshico@gmail.com',
        role: 'operator',
        expires_at: '2026-09-02T12:00:00.000Z',
      }),
      invite({
        id: 'foreign',
        company_id: OTHER_COMPANY,
        email: 'other-tenant@example.com',
      }),
    ]
    const sameCompanyInvites = invites.filter((row) => row.company_id === COMPANY)
    const rows = [
      ...memberships,
      ...buildInviteDirectoryRows({
        membershipEmails: memberships
          .map((row) => row.email)
          .filter((email) => Boolean(email)),
        invites: sameCompanyInvites,
        now: NOW,
      }),
    ]

    const dani = rows.find((row) => row.email === 'dani@example.com')
    const caio = rows.find((row) => row.email === 'caioh381@gmail.com')
    const juninho = rows.find((row) => row.email === 'juninhoyoshico@gmail.com')
    const leaked = rows.find((row) => row.email === 'other-tenant@example.com')
    const q = 'caioh381'
    const searched = rows.filter((row) => {
      const hay = `${row.name ?? ''} ${row.email ?? ''}`.toLowerCase()
      return hay.includes(q)
    })

    assert.equal(dani?.kind, 'membership')
    assert.equal(dani?.role, 'admin')
    assert.equal(dani?.canResend, false)
    assert.equal(showResendAction(dani, true), false)

    assert.equal(caio?.kind, 'invite')
    assert.equal(caio?.status, 'invite_expired')
    assert.equal(caio?.role, 'admin')
    assert.equal(caio?.canResend, true)
    assert.equal(showResendAction(caio, true), true)
    assert.equal(showResendAction(caio, false), false)
    assert.equal(searched.length, 1)
    assert.equal(searched[0].email, 'caioh381@gmail.com')

    assert.equal(juninho?.kind, 'invite')
    assert.equal(juninho?.role, 'operator')
    assert.equal(juninho?.canResend, true)

    assert.equal(leaked, undefined)
  })
})
