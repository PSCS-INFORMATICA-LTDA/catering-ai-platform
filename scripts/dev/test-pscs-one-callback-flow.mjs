import assert from 'node:assert/strict'
import { executePscsOneCallback, identityFromTokenPayload } from '../../Lib/pscs-one/callbackFlow.ts'
import { publicPscsOneSsoReason } from '../../Lib/pscs-one/errors.ts'

const identity = {
  version: '1',
  user_id: '11111111-1111-4111-8111-111111111111',
  email: 'qa@example.com',
  company_id: 'c0a00000-0000-4000-8000-00000000000a',
  product_key: 'catering_ai',
  external_company_id: '65fd576f-8d97-49ba-bf38-61bc1e94e94a',
  environment: 'development',
}

function deps(overrides = {}) {
  return {
    exchangeAuthorizationCode: async () => identity,
    ensureLocalUser: async () => ({
      authUserId: '22222222-2222-4222-8222-222222222222',
      email: identity.email,
      tokenHash: 'hash',
    }),
    ensureMembership: async () => undefined,
    verifySession: async () => ({ accessTokenPresent: true, refreshTokenPresent: true }),
    writeCookies: () => undefined,
    ...overrides,
  }
}

assert.equal(
  publicPscsOneSsoReason(new Error('column app_users.auth_user_id does not exist')),
  'identity_schema_mismatch',
)

assert.deepEqual(
  identityFromTokenPayload({ ok: true, identity }),
  identity,
)
assert.throws(() => identityFromTokenPayload({ ok: false }), /token_payload_invalid/)

{
  const missing = await executePscsOneCallback({ code: null, origin: 'https://example.test' }, deps())
  assert.equal(missing.ok, false)
  assert.equal(missing.stage, 'callback_params')
  assert.equal(missing.reason, 'missing_code')
}

{
  const invalidToken = await executePscsOneCallback(
    { code: 'abc', origin: 'https://example.test' },
    deps({
      exchangeAuthorizationCode: async () => {
        throw new Error('invalid_client')
      },
    }),
  )
  assert.equal(invalidToken.ok, false)
  assert.equal(invalidToken.stage, 'token_exchange')
  assert.equal(invalidToken.reason, 'invalid_client')
}

{
  const mapping = await executePscsOneCallback(
    { code: 'abc', origin: 'https://example.test' },
    deps({
      ensureLocalUser: async () => {
        throw new Error('column app_users.auth_user_id does not exist')
      },
    }),
  )
  assert.equal(mapping.ok, false)
  assert.equal(mapping.stage, 'user_mapping')
  assert.equal(mapping.reason, 'identity_schema_mismatch')
}

{
  const membership = await executePscsOneCallback(
    { code: 'abc', origin: 'https://example.test' },
    deps({
      ensureMembership: async () => {
        throw new Error('mapped_company_missing')
      },
    }),
  )
  assert.equal(membership.ok, false)
  assert.equal(membership.stage, 'membership')
  assert.equal(membership.reason, 'mapped_company_missing')
}

{
  const otp = await executePscsOneCallback(
    { code: 'abc', origin: 'https://example.test' },
    deps({
      verifySession: async () => {
        throw new Error('Token has expired or is invalid')
      },
    }),
  )
  assert.equal(otp.ok, false)
  assert.equal(otp.stage, 'session')
}

{
  const noAccess = await executePscsOneCallback(
    { code: 'abc', origin: 'https://example.test' },
    deps({
      verifySession: async () => ({ accessTokenPresent: false, refreshTokenPresent: true }),
    }),
  )
  assert.equal(noAccess.ok, false)
  assert.equal(noAccess.reason, 'session_creation_failed')
}

{
  const cookieFail = await executePscsOneCallback(
    { code: 'abc', origin: 'https://example.test' },
    deps({
      writeCookies: () => {
        throw new Error('session_cookie_failed')
      },
    }),
  )
assert.equal(cookieFail.reason, 'session_cookie_failed')
}

{
  const ok = await executePscsOneCallback({ code: 'abc', origin: 'https://example.test' }, deps())
  assert.equal(ok.ok, true)
  if (ok.ok) {
    assert.equal(ok.location, 'https://example.test/quotes')
    assert.equal(ok.cookieNames.includes('pscs_one_mapped_company_id'), true)
  }
}

{
  const valid = await executePscsOneCallback(
    { code: 'abc', origin: 'https://example.test' },
    deps({
      verifySession: async () => ({ accessTokenPresent: true, refreshTokenPresent: true }),
    }),
  )
  assert.equal(valid.ok, true)
}

console.log('pscs-one callback flow: PASS')
