/**
 * Seed DEV — Inventory v1
 * Location default + itens inventariáveis + saldos iniciais.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const DEV = 'yasprgtlqclwsjcshtls'
const COMPANY = '65fd576f-8d97-49ba-bf38-61bc1e94e94a'
const APPLY = process.argv.includes('--apply')

const env = readFileSync(join(ROOT, '.env.local'), 'utf8')
const get = (k) => ((env.match(new RegExp(`^${k}=(.*)$`, 'm')) || [])[1] || '').trim()
const url = get('NEXT_PUBLIC_SUPABASE_URL')
const service = get('SUPABASE_SERVICE_ROLE_KEY')
const ref = (url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/) || [])[1]
if (ref !== DEV) {
  console.error('BLOQUEADO_REF=' + ref)
  process.exit(2)
}

const sb = createClient(url, service, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const ITEMS = [
  {
    id: 'c1000000-0000-4000-8000-000000000101',
    item_name: 'QA INV Cooler',
    label_pt: 'QA INV Cooler',
    unit: 'unit',
    item_type: 'EQUIPMENT',
    qty: 10,
  },
  {
    id: 'c1000000-0000-4000-8000-000000000102',
    item_name: 'QA INV Carne',
    label_pt: 'QA INV Carne',
    unit: 'lb',
    item_type: 'SUPPLY',
    qty: 100,
  },
  {
    id: 'c1000000-0000-4000-8000-000000000103',
    item_name: 'QA INV Gelo',
    label_pt: 'QA INV Gelo',
    unit: 'bag',
    item_type: 'SUPPLY',
    qty: 40,
  },
  {
    id: 'c1000000-0000-4000-8000-000000000104',
    item_name: 'QA INV Pegador',
    label_pt: 'QA INV Pegador',
    unit: 'unit',
    item_type: 'EQUIPMENT',
    qty: 20,
  },
]

console.log('=== SEED INVENTORY V1 ===')
console.log('mode=' + (APPLY ? 'apply' : 'dry'))

const { data: locId, error: locErr } = await sb.rpc(
  'ensure_default_inventory_location',
  { p_company_id: COMPANY, p_actor: null, p_name: 'Main Stock' },
)
if (locErr) {
  console.error(locErr)
  process.exit(1)
}
console.log('location_default=' + locId)

for (const it of ITEMS) {
  console.log(`item ${it.label_pt} unit=${it.unit} initial=${it.qty}`)
  if (!APPLY) continue

  const { error: upErr } = await sb.from('catalog_items').upsert(
    {
      id: it.id,
      company_id: COMPANY,
      item_name: it.item_name,
      label_pt: it.label_pt,
      unit: it.unit,
      item_type: it.item_type,
      operational_item: true,
      inventory_enabled: true,
      active: true,
      customer_visible: false,
      category_key: 'qa_inventory',
      category_pt: 'QA Estoque',
      price: 0,
      cost_price: 0,
      sale_price: 0,
      charge_type: 'UNIT',
      pricing_type: 'FIXED',
      unit_label: it.unit,
      can_be_additional: false,
      customer_visible: false,
    },
    { onConflict: 'id' },
  )
  if (upErr) {
    console.error(upErr)
    process.exit(1)
  }

  const { data: post, error: postErr } = await sb.rpc('post_inventory_movement', {
    p_company_id: COMPANY,
    p_location_id: locId,
    p_catalog_item_id: it.id,
    p_movement_type: 'initial_balance',
    p_quantity: it.qty,
    p_unit: it.unit,
    p_idempotency_key: `seed:initial:${it.id}`,
    p_source_type: 'seed',
    p_source_id: 'inventory-v1',
    p_service_order_id: null,
    p_service_order_material_id: null,
    p_notes: 'Seed DEV inventory v1',
    p_actor: null,
    p_occurred_at: null,
    p_allow_negative: false,
  })
  if (postErr) {
    console.error(postErr)
    process.exit(1)
  }
  console.log('  post', JSON.stringify(post))
}

console.log(APPLY ? 'SEED INVENTORY V1: APPLIED' : 'SEED INVENTORY V1: DRY (use --apply)')
