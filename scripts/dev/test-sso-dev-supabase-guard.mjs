import assert from 'node:assert/strict'
import {
  CATERING_DEV_SUPABASE_REF,
  CATERING_PROD_SUPABASE_REF,
  evaluateCateringSsoSupabase,
} from '../../Lib/pscs-one/devSupabaseGuard.ts'

assert.equal(
  evaluateCateringSsoSupabase({ PSCS_ONE_SSO_ENABLED: 'false' }).reason,
  'sso_disabled',
)

assert.equal(
  evaluateCateringSsoSupabase({
    PSCS_ONE_SSO_ENABLED: 'true',
    NEXT_PUBLIC_SUPABASE_URL: `https://${CATERING_PROD_SUPABASE_REF}.supabase.co`,
  }).reason,
  'supabase_prod_forbidden',
)

assert.equal(
  evaluateCateringSsoSupabase({
    PSCS_ONE_SSO_ENABLED: 'true',
    NEXT_PUBLIC_SUPABASE_URL: 'https://jmbajdpkvlrslirwzyze.supabase.co',
  }).reason,
  'supabase_project_denied',
)

assert.deepEqual(
  evaluateCateringSsoSupabase({
    PSCS_ONE_SSO_ENABLED: 'true',
    NEXT_PUBLIC_SUPABASE_URL: `https://${CATERING_DEV_SUPABASE_REF}.supabase.co`,
  }),
  { ok: true, ref: CATERING_DEV_SUPABASE_REF },
)

console.log('sso-dev-supabase-guard: PASS')
