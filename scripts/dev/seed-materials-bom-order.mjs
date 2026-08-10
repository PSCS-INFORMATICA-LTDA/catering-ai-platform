/**
 * Seed DEV — OS convertida a partir do pacote/adicional BOM (materiais gerados).
 * Simula pós-conversão: cria OS + aplica regras enabled.
 *
 * Uso: node scripts/dev/seed-materials-bom-order.mjs --apply
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { calculateBomRequiredQuantity } from './lib/materials-bom-calc.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const apply = process.argv.includes('--apply')
const DEV = 'yasprgtlqclwsjcshtls'
const PROD = 'eapwtirhevxrqinytans'
const COMPANY = '65fd576f-8d97-49ba-bf38-61bc1e94e94a'
const CUSTOMER = 'f2000000-0000-4000-8000-000000000001'
const PKG_ID = 'c2600000-0000-4000-8000-0000000000b1'
const ADD_ID = 'c2600000-0000-4000-8000-0000000000b2'

const IDS = {
  event: 'f2100000-0000-4000-8000-0000000000b1',
  quote: 'f2200000-0000-4000-8000-0000000000b1',
  ver: 'f2300000-0000-4000-8000-0000000000b1',
  os: 'f2400000-0000-4000-8000-0000000000b1',
}

const OS_NUMBER = 'SO-TEST-DEV-BOM'
const QUOTE_NUMBER = 'Q-TEST-DEV-BOM'
const DATE = '2027-12-18'
const GUESTS = {
  adult_count: 40,
  children_under_3_count: 0,
  children_4_to_12_count: 0,
  physical_guest_count: 40,
  billable_guest_count: 40,
}

function loadEnv() {
  const env = readFileSync(join(ROOT, '.env.local'), 'utf8')
  const get = (k) => {
    const m = env.match(new RegExp(`^${k}=(.*)$`, 'm'))
    return m ? m[1].trim().replace(/^["']|["']$/g, '') : ''
  }
  return { url: get('NEXT_PUBLIC_SUPABASE_URL'), key: get('SUPABASE_SERVICE_ROLE_KEY') }
}

const { url, key } = loadEnv()
if (url.includes(PROD) || !url.includes(DEV)) {
  console.error('Abort: só DEV')
  process.exit(2)
}

console.log('=== SEED MATERIALS BOM ORDER ===')
console.log(`mode=${apply ? 'apply' : 'dry-run'} os=${OS_NUMBER}`)

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
await sb.from('events').delete().eq('id', IDS.event)

const snap = {
  schema_version: 1,
  package: { id: PKG_ID, total: 1800, label_pt: 'TEST-DEV Pacote BOM' },
  guest_counts: GUESTS,
  additional_items: [
    {
      additional_item_id: ADD_ID,
      quantity: 1,
      unit_price: 25,
      total_price: 25,
      selected: true,
      label_pt: 'TEST-DEV Adicional BOM',
    },
  ],
  quote_total: 1825,
}

await sb.from('events').upsert({
  id: IDS.event,
  company_id: COMPANY,
  customer_id: CUSTOMER,
  event_name: 'TEST-DEV BOM Convert',
  event_date: DATE,
  start_time: '11:00:00',
  end_time: '15:00:00',
  address_line: 'QA BOM',
  city: 'Orlando',
  state: 'FL',
  postal_code: '32801',
  country: 'US',
  adults_count: 40,
  billable_guests: 40,
  total_guests: 40,
  active: true,
})

await sb.from('quotes').upsert({
  id: IDS.quote,
  company_id: COMPANY,
  customer_id: CUSTOMER,
  event_id: IDS.event,
  package_id: PKG_ID,
  quote_number: QUOTE_NUMBER,
  language: 'pt',
  quote_status: 'converted',
  proposal_response: 'accepted',
  source: 'seed-materials-bom-order',
  active: true,
  ...GUESTS,
  package_total: 1800,
  additional_total: 25,
  quote_total: 1825,
  reservation_percentage: 30,
  reservation_amount: 547.5,
  balance_due: 1277.5,
  currency_code: 'USD',
})

await sb.from('quote_versions').insert({
  id: IDS.ver,
  company_id: COMPANY,
  quote_id: IDS.quote,
  version_number: 1,
  language: 'pt',
  currency_code: 'USD',
  quote_total: 1825,
  commercial_snapshot: snap,
  schema_version: 1,
  is_current: true,
  accepted_at: new Date().toISOString(),
})

await sb.from('quotes').update({ accepted_version_id: IDS.ver }).eq('id', IDS.quote)

await sb.from('service_orders').insert({
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
  address_line: 'QA BOM',
  city: 'Orlando',
  state: 'FL',
  postal_code: '32801',
  physical_guest_count: 40,
  billable_guest_count: 40,
  currency_code: 'USD',
  package_total: 1800,
  additional_total: 25,
  mileage_fee: 0,
  discount_amount: 0,
  reservation_amount: 547.5,
  balance_due: 1277.5,
  service_order_total: 1825,
  commercial_snapshot: snap,
  notes: 'TEST-DEV BOM — materiais gerados automaticamente',
})

await sb
  .from('quotes')
  .update({ converted_service_order_id: IDS.os })
  .eq('id', IDS.quote)

const { data: rules, error: rErr } = await sb
  .from('operational_material_rules')
  .select('*')
  .eq('company_id', COMPANY)
  .eq('enabled', true)
  .or(`and(source_type.eq.package,source_id.eq.${PKG_ID}),and(source_type.eq.additional,source_id.eq.${ADD_ID})`)

if (rErr) throw new Error(rErr.message)

const rows = []
for (const rule of rules ?? []) {
  const multiplier = rule.source_type === 'additional' ? 1 : 1
  const qty = calculateBomRequiredQuantity({
    rule: {
      calculation_type: rule.calculation_type,
      fixed_quantity: rule.fixed_quantity,
      quantity_per_guest: rule.quantity_per_guest,
      guest_basis: rule.guest_basis,
      min_guests: rule.min_guests,
      max_guests: rule.max_guests,
      tier_json: rule.tier_json,
      rounding_rule: rule.rounding_rule,
    },
    guests: GUESTS,
    sourceMultiplier: multiplier,
  })
  if (qty == null) continue
  rows.push({
    company_id: COMPANY,
    service_order_id: IDS.os,
    bom_rule_id: rule.id,
    catalog_item_id: rule.material_catalog_item_id,
    source_type: rule.source_type,
    source_id: rule.source_id,
    source_label_snapshot:
      rule.source_type === 'package'
        ? 'TEST-DEV Pacote BOM'
        : 'TEST-DEV Adicional BOM',
    description_snapshot: rule.material_description_snapshot,
    material_type: rule.material_type,
    unit: rule.unit,
    required_quantity: qty,
    separated_quantity: 0,
    checked_quantity: 0,
    status: 'pending',
    notes: rule.notes,
  })
}

if (rows.length) {
  const { error } = await sb.from('service_order_materials').insert(rows)
  if (error) throw new Error(error.message)
}

console.log(`OK ${OS_NUMBER} materials=${rows.length}`)
for (const r of rows) {
  console.log(`  - ${r.description_snapshot}: ${r.required_quantity} ${r.unit} (${r.source_type})`)
}
console.log(`URL ${BASE}/orders/${IDS.os}`)
process.exit(0)
