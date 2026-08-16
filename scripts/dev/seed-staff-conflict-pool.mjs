/**
 * Seed DEV — pool de Pessoas para conflito de agenda.
 * 12 churrasqueiros + 12 ajudantes + 12 líderes (mín. 10 cada).
 *
 * Uso:
 *   node scripts/dev/seed-staff-conflict-pool.mjs
 *   node scripts/dev/seed-staff-conflict-pool.mjs --apply
 *   node scripts/dev/seed-staff-conflict-pool.mjs --verify
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..', '..')
const FIXTURE = join(__dirname, 'fixtures', 'staff-conflict-pool-v1.json')
const DEV_REF = 'yasprgtlqclwsjcshtls'
const PROD_REF = 'eapwtirhevxrqinytans'
const apply = process.argv.includes('--apply')
const verify = process.argv.includes('--verify')

function loadEnv() {
  const env = readFileSync(join(ROOT, '.env.local'), 'utf8')
  const get = (k) => {
    const m = env.match(new RegExp(`^${k}=(.*)$`, 'm'))
    return m ? m[1].trim().replace(/^["']|["']$/g, '') : ''
  }
  return {
    url: get('NEXT_PUBLIC_SUPABASE_URL'),
    key: get('SUPABASE_SERVICE_ROLE_KEY'),
  }
}

function assertDev(url) {
  const ref = (url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/) || [])[1] || 'none'
  if (ref === PROD_REF) process.exit(2)
  if (ref !== DEV_REF) {
    console.error(`BLOQUEADO — ref ${ref}`)
    process.exit(2)
  }
  return ref
}

function fail(msg) {
  console.error(`STAFF CONFLICT POOL: FAIL — ${msg}`)
  process.exit(1)
}

function buildPeople(fx) {
  const people = []
  for (const role of ['grill_master', 'assistant', 'team_leader']) {
    const n = fx.counts[role]
    const names = fx.names[role]
    const base = fx.idBase[role]
    const phoneBase = fx.phoneBase[role]
    for (let i = 0; i < n; i++) {
      const num = String(i + 1).padStart(2, '0')
      people.push({
        id: `${base}${num}`,
        role_key: role,
        full_name: `TEST DEV — ${names[i]}`,
        ab_name: names[i],
        phone: `+${phoneBase + i + 1}`,
        index: i + 1,
      })
    }
  }
  return people
}

async function main() {
  const fx = JSON.parse(readFileSync(FIXTURE, 'utf8'))
  const { url, key } = loadEnv()
  if (!url || !key) fail('.env.local incompleto')
  const ref = assertDev(url)
  const sb = createClient(url, key, { auth: { persistSession: false } })
  const people = buildPeople(fx)

  console.log('=== STAFF CONFLICT POOL ===')
  console.log(`mode=${verify ? 'verify' : apply ? 'apply' : 'dry-run'}`)
  console.log(`project_ref=${ref}`)
  console.log(
    `counts grill=${fx.counts.grill_master} assistant=${fx.counts.assistant} leader=${fx.counts.team_leader}`,
  )

  for (const role of ['grill_master', 'assistant', 'team_leader']) {
    const list = people.filter((p) => p.role_key === role)
    console.log(`  ${role}: ${list.map((p) => p.ab_name).join(', ')}`)
  }

  if (!apply && !verify) {
    console.log('DRY-RUN OK. Use --apply')
    process.exit(0)
  }

  if (apply) {
    for (const p of people) {
      const { error: pe } = await sb.from('customers').upsert(
        {
          id: p.id,
          company_id: fx.companyId,
          full_name: p.full_name,
          ab_name: p.ab_name,
          phone: p.phone,
          phone_normalized: p.phone.replace(/\D/g, ''),
          preferred_language: 'pt',
          is_customer: false,
          is_supplier: false,
          is_team: true,
          active: true,
        },
        { onConflict: 'id' },
      )
      if (pe) fail(`person ${p.ab_name}: ${pe.message}`)

      const { error: re } = await sb.from('customer_operational_roles').upsert(
        {
          company_id: fx.companyId,
          person_id: p.id,
          role_key: p.role_key,
          active: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'company_id,person_id,role_key' },
      )
      if (re) fail(`role ${p.ab_name}: ${re.message}`)
    }
    console.log(`SAVED ${people.length} people + roles`)
  }

  // verify counts
  for (const role of ['grill_master', 'assistant', 'team_leader']) {
    const ids = people.filter((p) => p.role_key === role).map((p) => p.id)
    const { data, error } = await sb
      .from('customer_operational_roles')
      .select('person_id')
      .eq('company_id', fx.companyId)
      .eq('role_key', role)
      .eq('active', true)
      .in('person_id', ids)
    if (error) fail(`verify ${role}: ${error.message}`)
    if ((data ?? []).length < 10) {
      fail(`${role}: esperava ≥10, got ${(data ?? []).length}`)
    }
    console.log(`PASS  ${role} ≥10 (found ${(data ?? []).length})`)
  }

  console.log('STAFF CONFLICT POOL: PASS')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
