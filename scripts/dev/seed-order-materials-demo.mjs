/**
 * Seed DEV — OS TEST-DEV com materiais operacionais (Fase 1).
 *
 * Uso:
 *   node scripts/dev/seed-order-materials-demo.mjs
 *   node scripts/dev/seed-order-materials-demo.mjs --apply
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
const CUSTOMER = 'f2000000-0000-4000-8000-000000000001'
const PKG = 'c2000000-0000-4000-8000-000000000001'

const IDS = {
  event: 'f2100000-0000-4000-8000-000000000091',
  quote: 'f2200000-0000-4000-8000-000000000091',
  ver: 'f2300000-0000-4000-8000-000000000091',
  os: 'f2400000-0000-4000-8000-000000000091',
}

const OS_NUMBER = 'SO-TEST-DEV-MATERIALS'
const QUOTE_NUMBER = 'Q-TEST-DEV-MATERIALS'
const DATE = '2027-12-15'

/** Materiais demo — misturam tipos e unidades reais. */
const MATERIALS = [
  {
    id: 'f2600000-0000-4000-8000-000000000091',
    description_snapshot: 'Carne',
    material_type: 'consumable',
    unit: 'lb',
    required_quantity: 40,
  },
  {
    id: 'f2600000-0000-4000-8000-000000000092',
    description_snapshot: 'Gelo',
    material_type: 'consumable',
    unit: 'bag',
    required_quantity: 8,
  },
  {
    id: 'f2600000-0000-4000-8000-000000000093',
    description_snapshot: 'Pão de alho',
    material_type: 'consumable',
    unit: 'box',
    required_quantity: 4,
  },
  {
    id: 'f2600000-0000-4000-8000-000000000094',
    description_snapshot: 'Cooler',
    material_type: 'returnable',
    unit: 'unit',
    required_quantity: 2,
  },
  {
    id: 'f2600000-0000-4000-8000-000000000095',
    description_snapshot: 'Mesa',
    material_type: 'equipment',
    unit: 'unit',
    required_quantity: 3,
  },
  {
    id: 'f2600000-0000-4000-8000-000000000096',
    description_snapshot: 'Pegador',
    material_type: 'returnable',
    unit: 'unit',
    required_quantity: 6,
  },
  {
    id: 'f2600000-0000-4000-8000-000000000097',
    description_snapshot: 'Pratos descartáveis',
    material_type: 'disposable',
    unit: 'box',
    required_quantity: 2,
  },
  {
    id: 'f2600000-0000-4000-8000-000000000098',
    description_snapshot: 'Guardanapos',
    material_type: 'disposable',
    unit: 'box',
    required_quantity: 3,
  },
]

function loadEnv() {
  const env = readFileSync(join(ROOT, '.env.local'), 'utf8')
  const get = (k) => {
    const m = env.match(new RegExp(`^${k}=(.*)$`, 'm'))
    return m ? m[1].trim().replace(/^["']|["']$/g, '') : ''
  }
  return { url: get('NEXT_PUBLIC_SUPABASE_URL'), key: get('SUPABASE_SERVICE_ROLE_KEY') }
}

const { url, key } = loadEnv()
if (url.includes(PROD)) {
  console.error('Abort: PROD proibido')
  process.exit(2)
}
if (!url.includes(DEV)) {
  console.error('Abort: só DEV')
  process.exit(2)
}

console.log('=== SEED ORDER MATERIALS DEMO ===')
console.log(`mode=${apply ? 'apply' : 'dry-run'}`)
console.log(`os=${OS_NUMBER}`)
for (const m of MATERIALS) {
  console.log(`  - ${m.description_snapshot} (${m.material_type}, ${m.required_quantity} ${m.unit})`)
}

if (!apply) {
  console.log('Dry-run OK. Use --apply')
  process.exit(0)
}

const sb = createClient(url, key, { auth: { persistSession: false } })
const BASE = 'https://catering-ai-agenda-dev.vercel.app'

await sb.from('service_order_materials').delete().eq('service_order_id', IDS.os)
await sb
  .from('quotes')
  .update({ accepted_version_id: null, converted_service_order_id: null })
  .eq('id', IDS.quote)
await sb.from('service_orders').delete().eq('id', IDS.os)
await sb.from('service_orders').delete().eq('service_order_number', OS_NUMBER)
await sb.from('quote_versions').delete().eq('id', IDS.ver)
await sb.from('quotes').delete().eq('id', IDS.quote)
await sb.from('quotes').delete().eq('quote_number', QUOTE_NUMBER)
await sb.from('events').delete().eq('id', IDS.event)

const { error: evErr } = await sb.from('events').upsert(
  {
    id: IDS.event,
    company_id: COMPANY,
    customer_id: CUSTOMER,
    event_name: 'TEST-DEV Materiais OS',
    event_date: DATE,
    start_time: '11:00:00',
    end_time: '15:00:00',
    address_line: 'QA MATERIALS TEST-DEV',
    city: 'Orlando',
    state: 'FL',
    postal_code: '32801',
    country: 'US',
    adults_count: 40,
    children_count: 0,
    billable_guests: 40,
    total_guests: 40,
    active: true,
    notes: OS_NUMBER,
  },
  { onConflict: 'id' },
)
if (evErr) throw new Error(`events: ${evErr.message}`)

const snap = { schema_version: 1, quote_total: 100, qa: 'materials' }

const { error: qErr } = await sb.from('quotes').upsert(
  {
    id: IDS.quote,
    company_id: COMPANY,
    customer_id: CUSTOMER,
    event_id: IDS.event,
    package_id: PKG,
    quote_number: QUOTE_NUMBER,
    language: 'pt',
    quote_status: 'accepted',
    proposal_response: 'accepted',
    source: 'seed-order-materials-demo',
    active: true,
    adult_count: 40,
    children_under_3_count: 0,
    children_4_to_12_count: 0,
    physical_guest_count: 40,
    billable_guest_count: 40,
    package_total: 100,
    additional_total: 0,
    quote_total: 100,
    reservation_percentage: 30,
    reservation_amount: 30,
    balance_due: 70,
    currency_code: 'USD',
    reservation_confirmed_at: new Date().toISOString(),
  },
  { onConflict: 'id' },
)
if (qErr) throw new Error(`quotes: ${qErr.message}`)

const { error: vErr } = await sb.from('quote_versions').insert({
  id: IDS.ver,
  company_id: COMPANY,
  quote_id: IDS.quote,
  version_number: 1,
  language: 'pt',
  currency_code: 'USD',
  quote_total: 100,
  commercial_snapshot: snap,
  schema_version: 1,
  is_current: true,
  accepted_at: new Date().toISOString(),
})
if (vErr) throw new Error(`versions: ${vErr.message}`)

await sb.from('quotes').update({ accepted_version_id: IDS.ver }).eq('id', IDS.quote)

const { error: osErr } = await sb.from('service_orders').insert({
  id: IDS.os,
  company_id: COMPANY,
  service_order_number: OS_NUMBER,
  quote_id: IDS.quote,
  quote_version_id: IDS.ver,
  event_id: IDS.event,
  customer_id: CUSTOMER,
  status: 'planned',
  event_date: DATE,
  start_time: '11:00:00',
  end_time: '15:00:00',
  address_line: 'QA MATERIALS TEST-DEV',
  city: 'Orlando',
  state: 'FL',
  postal_code: '32801',
  physical_guest_count: 40,
  billable_guest_count: 40,
  currency_code: 'USD',
  package_total: 100,
  additional_total: 0,
  mileage_fee: 0,
  discount_amount: 0,
  reservation_amount: 30,
  balance_due: 70,
  service_order_total: 100,
  commercial_snapshot: snap,
  notes: 'TEST-DEV Materiais — separação e conferência',
})
if (osErr) throw new Error(`OS: ${osErr.message}`)

await sb
  .from('quotes')
  .update({ converted_service_order_id: IDS.os })
  .eq('id', IDS.quote)

for (const m of MATERIALS) {
  const { error: mErr } = await sb.from('service_order_materials').upsert(
    {
      id: m.id,
      company_id: COMPANY,
      service_order_id: IDS.os,
      catalog_item_id: null,
      source_type: 'manual',
      source_id: null,
      description_snapshot: m.description_snapshot,
      material_type: m.material_type,
      unit: m.unit,
      required_quantity: m.required_quantity,
      separated_quantity: 0,
      checked_quantity: 0,
      status: 'pending',
      notes: 'seed-order-materials-demo',
    },
    { onConflict: 'id' },
  )
  if (mErr) throw new Error(`material ${m.description_snapshot}: ${mErr.message}`)
}

const { count } = await sb
  .from('service_order_materials')
  .select('id', { count: 'exact', head: true })
  .eq('service_order_id', IDS.os)

console.log(`OK ${OS_NUMBER} materials=${count}`)
console.log(`URL ${BASE}/orders/${IDS.os}`)
process.exit(0)
