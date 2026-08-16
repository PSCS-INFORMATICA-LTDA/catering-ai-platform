/**
 * Seed DEV — Materiais Fase 2 (saída/retorno) sobre SO-TEST-DEV-BOM.
 * Garante agenda + Equipe Caio + líder + materiais conferidos.
 *
 * Uso: node scripts/dev/seed-order-materials-phase2.mjs --apply
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const apply = process.argv.includes('--apply')
const DEV = 'yasprgtlqclwsjcshtls'
const PROD = 'eapwtirhevxrqinytans'
const COMPANY = '65fd576f-8d97-49ba-bf38-61bc1e94e94a'
const OS_ID = 'f2400000-0000-4000-8000-0000000000b1'
const OS_NUMBER = 'SO-TEST-DEV-BOM'
const TEAM_CAIO = 'a1000000-0000-4000-8000-000000000003'
const AGENDA_ID = 'f2500000-0000-4000-8000-0000000000b1'
const DATE = '2027-12-18'

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

const { url, key } = loadEnv()
if (url.includes(PROD) || !url.includes(DEV)) {
  console.error('Abort: só DEV')
  process.exit(2)
}

console.log('=== SEED ORDER MATERIALS PHASE 2 ===')
console.log(`mode=${apply ? 'apply' : 'dry-run'} os=${OS_NUMBER}`)

if (!apply) {
  console.log('Dry-run OK. Use --apply')
  process.exit(0)
}

const sb = createClient(url, key, { auth: { persistSession: false } })

const { data: os, error: osErr } = await sb
  .from('service_orders')
  .select('id, service_order_number, event_date, start_time, end_time, venue_name, address_line, city, state')
  .eq('id', OS_ID)
  .maybeSingle()

if (osErr || !os) {
  console.error('OS SO-TEST-DEV-BOM ausente. Rode: npm run seed:dev:materials-bom-order -- --apply')
  process.exit(1)
}

const { data: team } = await sb
  .from('operational_teams')
  .select('id, name, contact_person_id')
  .eq('id', TEAM_CAIO)
  .eq('company_id', COMPANY)
  .maybeSingle()

if (!team) {
  console.error('Equipe Caio ausente')
  process.exit(1)
}

const { data: leaderMember } = await sb
  .from('operational_team_members')
  .select('person_id')
  .eq('team_id', TEAM_CAIO)
  .eq('role_key', 'team_leader')
  .eq('active', true)
  .limit(1)
  .maybeSingle()

const leaderId = leaderMember?.person_id || team.contact_person_id
if (!leaderId) {
  console.error('Líder da Equipe Caio ausente')
  process.exit(1)
}

await sb.from('agenda_events').upsert({
  id: AGENDA_ID,
  company_id: COMPANY,
  service_order_id: OS_ID,
  team_id: TEAM_CAIO,
  title: `${OS_NUMBER} — Fase 2 materiais`,
  event_date: os.event_date || DATE,
  start_time: os.start_time || '11:00:00',
  end_time: os.end_time || '15:00:00',
  client_name: 'TEST-DEV BOM',
  status: 'scheduled',
  code: 'EVT-MAT-PHASE2-BOM',
})

const extras = [
  {
    id: 'f2600000-0000-4000-8000-0000000000b1',
    description_snapshot: 'Mesa',
    material_type: 'equipment',
    unit: 'un',
    required_quantity: 2,
  },
  {
    id: 'f2600000-0000-4000-8000-0000000000b2',
    description_snapshot: 'Pegador',
    material_type: 'returnable',
    unit: 'un',
    required_quantity: 4,
  },
]

for (const e of extras) {
  await sb.from('service_order_materials').upsert({
    id: e.id,
    company_id: COMPANY,
    service_order_id: OS_ID,
    source_type: 'manual',
    description_snapshot: e.description_snapshot,
    material_type: e.material_type,
    unit: e.unit,
    required_quantity: e.required_quantity,
    separated_quantity: e.required_quantity,
    checked_quantity: e.required_quantity,
    dispatched_quantity: 0,
    returned_quantity: 0,
    leftover_quantity: 0,
    status: 'checked',
    separated_at: new Date().toISOString(),
    checked_at: new Date().toISOString(),
    stock_posting_status: 'pending',
  })
}

const { data: mats } = await sb
  .from('service_order_materials')
  .select('id, required_quantity, status')
  .eq('service_order_id', OS_ID)
  .neq('status', 'cancelled')

for (const m of mats ?? []) {
  const req = Number(m.required_quantity)
  await sb
    .from('service_order_materials')
    .update({
      separated_quantity: req,
      checked_quantity: req,
      separated_at: new Date().toISOString(),
      checked_at: new Date().toISOString(),
      status: 'checked',
      dispatched_quantity: 0,
      returned_quantity: 0,
      leftover_quantity: 0,
      returned_at: null,
      dispatched_at: null,
    })
    .eq('id', m.id)
}

// limpa confirmações antigas de teste
await sb
  .from('service_order_material_dispatch_confirmations')
  .delete()
  .eq('service_order_id', OS_ID)

console.log('PASS seed phase2')
console.log(`os=${OS_NUMBER}`)
console.log(`team=${team.name} leader=${leaderId}`)
console.log(`materials=${(mats ?? []).length + extras.length}`)
console.log(`url=https://catering-ai-agenda-dev.vercel.app/orders/${OS_ID}`)
