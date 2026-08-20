import assert from 'node:assert/strict'
import { publicPscsOneSsoReason } from '../../Lib/pscs-one/errors.ts'

assert.equal(publicPscsOneSsoReason(new Error('null value in column "company_id" of relation "app_users"')), 'identity_company_missing')
assert.equal(publicPscsOneSsoReason(new Error("Could not find the 'pscs_one_user_id' column of 'app_users' in the schema cache")), 'identity_schema_mismatch')
assert.equal(publicPscsOneSsoReason(new Error('Redirect URL not allowed')), 'session_redirect_denied')
assert.equal(publicPscsOneSsoReason(new Error('fetch failed')), 'sso_failed')
assert.equal(publicPscsOneSsoReason(new Error('invalid_client')), 'invalid_client')
console.log('pscs-one sso reason map: PASS')
