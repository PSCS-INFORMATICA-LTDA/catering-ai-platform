import {
  CATERING_DEV_SUPABASE_REF,
  CATERING_PROD_SUPABASE_REF,
  evaluateCateringSsoSupabase,
  supabaseProjectRefFromUrl,
} from '../Lib/pscs-one/devSupabaseGuard.ts'

const sso = process.env.PSCS_ONE_SSO_ENABLED === 'true'
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const ref = supabaseProjectRefFromUrl(url)

if (ref === CATERING_PROD_SUPABASE_REF && sso) {
  console.error(
    `FAIL: PSCS One SSO cannot run against Catering PROD project ${CATERING_PROD_SUPABASE_REF}`,
  )
  process.exit(1)
}

if (sso) {
  const decision = evaluateCateringSsoSupabase(process.env)
  if (!decision.ok) {
    console.error(
      `FAIL: PSCS One SSO requires Catering DEV ${CATERING_DEV_SUPABASE_REF} (${decision.reason})`,
    )
    process.exit(1)
  }
}

console.log(
  JSON.stringify({
    ok: true,
    sso_enabled: sso,
    supabase_ref: ref ?? 'absent',
    prod_forbidden: CATERING_PROD_SUPABASE_REF,
  }),
)
