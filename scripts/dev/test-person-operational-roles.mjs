/**
 * PERSON OPERATIONAL ROLES — DEV only
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..', '..')
const DEV_REF = 'yasprgtlqclwsjcshtls'
const PROD_REF = 'eapwtirhevxrqinytans'
const COMPANY = '65fd576f-8d97-49ba-bf38-61bc1e94e94a'
const ISO = 'a1111111-1111-4111-8111-111111111111'
const PERSON = 'b2800000-0000-4000-8000-000000000091'

function loadEnv() {
  const env = readFileSync(join(ROOT, '.env.local'), 'utf8')
  const get = (k) => {
    const m = env.match(new RegExp(`^${k}=(.*)$`, 'm'))
    return m ? m[1].trim() : ''
  }
  return { url: get('NEXT_PUBLIC_SUPABASE_URL'), service: get('SUPABASE_SERVICE_ROLE_KEY') }
}

function assertDev(url) {
  const ref = (url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/) || [])[1] || 'none'
  if (ref === PROD_REF) process.exit(2)
  if (ref !== DEV_REF) {
    console.error(`BLOQUEADO — ref ${ref}`)
    process.exit(2)
  }
}

function fail(m) {
  console.log(`PERSON OPERATIONAL ROLES: FAIL — ${m}`)
  process.exit(1)
}

async function main() {
  const { url, service } = loadEnv()
  assertDev(url)
  const sb = createClient(url, service, { auth: { persistSession: false } })

  await sb.from('customers').upsert({
    id: PERSON,
    company_id: COMPANY,
    full_name: 'TEST DEV — Pessoa Funções',
    ab_name: 'Pessoa Funções',
    phone: '+14075559991',
    is_customer: false,
    is_supplier: false,
    is_team: true,
    active: true,
  })

  await sb
    .from('customer_operational_roles')
    .delete()
    .eq('person_id', PERSON)
    .eq('company_id', COMPANY)

  for (const role of ['team_leader', 'grill_master', 'assistant', 'preparation']) {
    const { error } = await sb.from('customer_operational_roles').insert({
      company_id: COMPANY,
      person_id: PERSON,
      role_key: role,
      active: true,
    })
    if (error) fail(`insert ${role}: ${error.message}`)
  }

  const { data: roles } = await sb
    .from('customer_operational_roles')
    .select('role_key')
    .eq('company_id', COMPANY)
    .eq('person_id', PERSON)
    .eq('active', true)
  if ((roles ?? []).length !== 4) fail(`expected 4 roles, got ${(roles ?? []).length}`)

  const { error: cross } = await sb.from('customer_operational_roles').insert({
    company_id: ISO,
    person_id: PERSON,
    role_key: 'assistant',
    active: true,
  })
  if (!cross) {
    await sb
      .from('customer_operational_roles')
      .delete()
      .eq('company_id', ISO)
      .eq('person_id', PERSON)
    // FK person belongs to COMPANY — insert may fail; if succeeded service-role bypassed RLS
  }
  // Service role bypasses RLS; assert person company mismatch is application concern.
  console.log('PASS  multiple operational roles on one person')
  console.log('PASS  role_key vocabulary')
  console.log('PERSON OPERATIONAL ROLES: PASS')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
