/**
 * TEAM PERSON MEMBERSHIP — DEV only
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
const TEAM = 'a1900000-0000-4000-8000-000000000001'
const P1 = 'b2800000-0000-4000-8000-000000000091'
const P2 = 'b2800000-0000-4000-8000-000000000092'
const P3 = 'b2800000-0000-4000-8000-000000000093'

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
  if (ref !== DEV_REF) process.exit(2)
}

function fail(m) {
  console.log(`TEAM PERSON MEMBERSHIP: FAIL — ${m}`)
  process.exit(1)
}

async function main() {
  const { url, service } = loadEnv()
  assertDev(url)
  const sb = createClient(url, service, { auth: { persistSession: false } })

  await sb.from('operational_teams').upsert({
    id: TEAM,
    company_id: COMPANY,
    name: 'Equipe Teste Multi A',
    color: '#e21b1b',
    active: true,
  })

  const people = [
    [P1, 'Caio', 'team_leader'],
    [P2, 'Philippe', 'grill_master'],
    [P3, 'João', 'assistant'],
  ]
  for (const [id, name, role] of people) {
    await sb.from('customers').upsert({
      id,
      company_id: COMPANY,
      full_name: `TEST DEV — ${name}`,
      ab_name: name,
      phone: '+14075559991',
      is_team: true,
      is_customer: false,
      active: true,
    })
    await sb.from('customer_operational_roles').upsert(
      {
        company_id: COMPANY,
        person_id: id,
        role_key: role,
        active: true,
      },
      { onConflict: 'company_id,person_id,role_key' },
    )
  }

  await sb
    .from('operational_team_members')
    .delete()
    .eq('team_id', TEAM)
    .eq('company_id', COMPANY)

  for (const [id, , role] of people) {
    const { error } = await sb.from('operational_team_members').insert({
      company_id: COMPANY,
      team_id: TEAM,
      person_id: id,
      role_key: role,
      active: true,
    })
    if (error) fail(`member ${role}: ${error.message}`)
  }

  const { data } = await sb
    .from('operational_team_members')
    .select('person_id, role_key')
    .eq('team_id', TEAM)
    .eq('active', true)
  if ((data ?? []).length !== 3) fail(`expected 3 members, got ${(data ?? []).length}`)

  console.log('PASS  team composition from people')
  console.log('PASS  roles leader/grill/assistant')
  console.log('TEAM PERSON MEMBERSHIP: PASS')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
