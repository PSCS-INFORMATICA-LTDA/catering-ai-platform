/**
 * QA DEV — Inventory OS posting T09–T18
 */
import { createClient } from '@supabase/supabase-js'
import { createHash, randomBytes } from 'crypto'
import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const DEV = 'yasprgtlqclwsjcshtls'
const COMPANY = '65fd576f-8d97-49ba-bf38-61bc1e94e94a'
const OS_ID = 'f2400000-0000-4000-8000-0000000000b1' // SO-TEST-DEV-BOM (não criar 2ª OS: uq quote_version)
const TEAM = 'a1000000-0000-4000-8000-000000000003'
const LEADER = 'b2800000-0000-4000-8000-000000000091'

const COOLER = 'c1000000-0000-4000-8000-000000000101'
const CARNE = 'c1000000-0000-4000-8000-000000000102'
const OFF = 'c1000000-0000-4000-8000-0000000001c2'

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

let failures = 0
function pass(l) {
  console.log('PASS  ' + l)
}
function fail(l, d) {
  failures++
  console.log('FAIL  ' + l + (d ? ' — ' + d : ''))
}

function token() {
  return randomBytes(32).toString('hex')
}
function hash(t) {
  return createHash('sha256').update(t).digest('hex')
}

async function sumMov(materialId, type) {
  const { data } = await sb
    .from('inventory_movements')
    .select('quantity')
    .eq('company_id', COMPANY)
    .eq('service_order_material_id', materialId)
    .eq('movement_type', type)
  return (data ?? []).reduce((s, r) => s + Number(r.quantity), 0)
}

async function bal(itemId) {
  const { data } = await sb
    .from('inventory_balances')
    .select('quantity_on_hand')
    .eq('company_id', COMPANY)
    .eq('catalog_item_id', itemId)
    .maybeSingle()
  return Number(data?.quantity_on_hand ?? 0)
}

console.log('=== TEST INVENTORY ORDER POSTING ===')

// Ensure seed items + location + fat initial balances
const { data: locId } = await sb.rpc('ensure_default_inventory_location', {
  p_company_id: COMPANY,
  p_actor: null,
  p_name: 'Main Stock',
})

for (const [id, name, unit, qty] of [
  [COOLER, 'QA INV Cooler', 'unit', 50],
  [CARNE, 'QA INV Carne', 'lb', 200],
]) {
  await sb.from('catalog_items').upsert({
    id,
    company_id: COMPANY,
    item_name: name,
    label_pt: name,
    unit,
    item_type: id === COOLER ? 'EQUIPMENT' : 'SUPPLY',
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
    unit_label: unit,
  })
  await sb.rpc('post_inventory_movement', {
    p_company_id: COMPANY,
    p_location_id: locId,
    p_catalog_item_id: id,
    p_movement_type: 'initial_balance',
    p_quantity: qty,
    p_unit: unit,
    p_idempotency_key: `order-posting-seed:${id}:v2`,
    p_source_type: 'qa',
    p_source_id: 'order-posting',
    p_service_order_id: null,
    p_service_order_material_id: null,
    p_notes: 'qa buffer',
    p_actor: null,
    p_occurred_at: null,
    p_allow_negative: false,
  })
}

await sb.from('catalog_items').upsert({
  id: OFF,
  company_id: COMPANY,
  item_name: 'QA INV Off',
  label_pt: 'QA INV Off',
  unit: 'unit',
  inventory_enabled: false,
  operational_item: true,
  active: true,
  customer_visible: false,
  price: 0,
  cost_price: 0,
  sale_price: 0,
  charge_type: 'UNIT',
  pricing_type: 'FIXED',
  unit_label: 'unit',
})

// Usa SO-TEST-DEV-BOM existente. Remove apenas materiais QA INV deste script.
{
  const { data: bom, error: bomErr } = await sb
    .from('service_orders')
    .select('id')
    .eq('id', OS_ID)
    .maybeSingle()
  if (bomErr || !bom) {
    fail(
      'pré-condição OS BOM',
      bomErr?.message || 'ausente — rode seed:dev:materials-bom-order e phase2',
    )
    process.exit(1)
  }
}

const QA_MAT_IDS = [
  'f2500000-0000-4000-8000-0000000000a1',
  'f2500000-0000-4000-8000-0000000000a2',
  'f2500000-0000-4000-8000-0000000000a3',
  'f2500000-0000-4000-8000-0000000000a4',
  'f2500000-0000-4000-8000-0000000000a9',
]

await sb
  .from('service_order_materials')
  .delete()
  .eq('service_order_id', OS_ID)
  .in('id', QA_MAT_IDS)

for (const id of QA_MAT_IDS) {
  await sb
    .from('inventory_movements')
    .delete()
    .eq('company_id', COMPANY)
    .like('idempotency_key', `%${id}%`)
  await sb
    .from('inventory_movements')
    .delete()
    .eq('company_id', COMPANY)
    .eq('service_order_material_id', id)
}

await sb.rpc('rebuild_inventory_balances', { p_company_id: COMPANY })

const mats = [
  {
    id: 'f2500000-0000-4000-8000-0000000000a1',
    catalog_item_id: CARNE,
    description_snapshot: 'QA INV Carne',
    material_type: 'consumable',
    unit: 'lb',
    required_quantity: 40,
    material_key: 'carne',
  },
  {
    id: 'f2500000-0000-4000-8000-0000000000a2',
    catalog_item_id: COOLER,
    description_snapshot: 'QA INV Cooler',
    material_type: 'returnable',
    unit: 'unit',
    required_quantity: 2,
    material_key: 'cooler',
  },
  {
    id: 'f2500000-0000-4000-8000-0000000000a3',
    catalog_item_id: null,
    description_snapshot: 'Manual sem catálogo',
    material_type: 'consumable',
    unit: 'unit',
    required_quantity: 1,
    material_key: 'manual',
  },
  {
    id: 'f2500000-0000-4000-8000-0000000000a4',
    catalog_item_id: OFF,
    description_snapshot: 'Item inventory off',
    material_type: 'consumable',
    unit: 'unit',
    required_quantity: 1,
    material_key: 'off',
  },
]

for (const m of mats) {
  const { error: insErr } = await sb.from('service_order_materials').insert({
    id: m.id,
    company_id: COMPANY,
    service_order_id: OS_ID,
    catalog_item_id: m.catalog_item_id,
    source_type: 'manual',
    description_snapshot: m.description_snapshot,
    material_type: m.material_type,
    unit: m.unit,
    required_quantity: m.required_quantity,
    separated_quantity: m.required_quantity,
    checked_quantity: m.required_quantity,
    separated_at: new Date().toISOString(),
    checked_at: new Date().toISOString(),
    status: 'checked',
    stock_posting_status: m.catalog_item_id ? 'pending' : 'not_applicable',
    dispatched_quantity: 0,
    returned_quantity: 0,
    leftover_quantity: 0,
  })
  if (insErr) {
    fail('insert material ' + m.material_key, insErr.message)
    process.exit(1)
  }
}

const carneBefore = await bal(CARNE)
const coolerBefore = await bal(COOLER)

async function mintAndConfirm(lines) {
  const t = token()
  await sb
    .from('service_order_material_dispatch_confirmations')
    .update({
      status: 'revoked',
      revoked_at: new Date().toISOString(),
    })
    .eq('service_order_id', OS_ID)
    .eq('status', 'pending')

  const { error: insTokErr } = await sb
    .from('service_order_material_dispatch_confirmations')
    .insert({
      company_id: COMPANY,
      service_order_id: OS_ID,
      team_id: TEAM,
      leader_person_id: LEADER,
      status: 'pending',
      token_hash: hash(t),
      expires_at: new Date(Date.now() + 86400000).toISOString(),
    })
  if (insTokErr) {
    return { data: null, error: insTokErr, token: t }
  }
  const { data, error } = await sb.rpc('confirm_public_material_dispatch', {
    p_token: t,
    p_lines: lines,
    p_notes: null,
  })
  return { data, error, token: t }
}

const lines = mats
  .filter((m) => m.material_key === 'carne' || m.material_key === 'cooler')
  .map((m) => ({
    id: m.id,
    dispatched_quantity: m.required_quantity,
  }))

// Also include manual/off so they get dispatched without inventory
const allLines = mats.map((m) => ({
  id: m.id,
  dispatched_quantity: m.required_quantity,
}))

const conf1 = await mintAndConfirm(allLines)
if (!conf1.error && conf1.data?.ok) {
  // continue
} else {
  fail('pré confirm', JSON.stringify(conf1))
}

const carneMid = await bal(CARNE)
const coolerMid = await bal(COOLER)
const carneDisp = await sumMov(mats[0].id, 'event_dispatch')
const coolerDisp = await sumMov(mats[1].id, 'event_dispatch')

if (carneDisp === -40) pass('T09 consumable dispatch 40 → OUT 40')
else fail('T09', `mov=${carneDisp} bal ${carneBefore}->${carneMid}`)

// T10 same dispatch twice (idempotent confirm + idempotent movement)
const conf2 = await mintAndConfirm(allLines)
const carneDisp2 = await sumMov(mats[0].id, 'event_dispatch')
if (carneDisp2 === -40 && (conf2.data?.idempotent || conf2.data?.ok === false || conf2.data?.ok)) {
  // second mint creates new token; materials already dispatched — confirm may process empty set
  const { count } = await sb
    .from('inventory_movements')
    .select('id', { count: 'exact', head: true })
    .eq('service_order_material_id', mats[0].id)
    .eq('movement_type', 'event_dispatch')
  if (count === 1) pass('T10 same dispatch twice → one movement')
  else fail('T10', `count=${count} conf2=${JSON.stringify(conf2.data)}`)
} else fail('T10', JSON.stringify({ carneDisp2, conf2 }))

if (coolerDisp === -2) pass('T11 returnable dispatch 2 → OUT 2')
else fail('T11', String(coolerDisp))

// T12 return 2
{
  const { data: ret } = await sb.rpc('post_inventory_for_material_return', {
    p_company_id: COMPANY,
    p_material_id: mats[1].id,
    p_actor: null,
  })
  // set returned first
  await sb
    .from('service_order_materials')
    .update({
      returned_quantity: 2,
      returned_at: new Date().toISOString(),
      status: 'returned',
    })
    .eq('id', mats[1].id)
  const { data: ret2 } = await sb.rpc('post_inventory_for_material_return', {
    p_company_id: COMPANY,
    p_material_id: mats[1].id,
    p_actor: null,
  })
  const r = await sumMov(mats[1].id, 'event_return')
  if (r === 2 && ret2?.ok) pass('T12 returnable return 2 → IN 2')
  else fail('T12', JSON.stringify({ r, ret, ret2 }))
}

// T13 correction 1→2 already at 2; set to 1 then 2 for delta
{
  await sb
    .from('service_order_materials')
    .update({ returned_quantity: 1 })
    .eq('id', mats[1].id)
  await sb.rpc('post_inventory_for_material_return', {
    p_company_id: COMPANY,
    p_material_id: mats[1].id,
    p_actor: null,
  })
  const mid = await sumMov(mats[1].id, 'event_return')
  await sb
    .from('service_order_materials')
    .update({ returned_quantity: 2 })
    .eq('id', mats[1].id)
  await sb.rpc('post_inventory_for_material_return', {
    p_company_id: COMPANY,
    p_material_id: mats[1].id,
    p_actor: null,
  })
  const end = await sumMov(mats[1].id, 'event_return')
  if (Number(mid) === 1 && Number(end) === 2) pass('T13 return correction 1→2 → only delta')
  else fail('T13', `mid=${mid} end=${end}`)
}

// T14 leftover 5 on carne
{
  await sb
    .from('service_order_materials')
    .update({
      leftover_quantity: 5,
      returned_quantity: 0,
      returned_at: new Date().toISOString(),
      status: 'returned',
    })
    .eq('id', mats[0].id)
  const { data } = await sb.rpc('post_inventory_for_material_return', {
    p_company_id: COMPANY,
    p_material_id: mats[0].id,
    p_actor: null,
  })
  const left = await sumMov(mats[0].id, 'event_leftover_return')
  if (left === 5 && data?.ok) pass('T14 consumable leftover 5 → IN 5')
  else fail('T14', JSON.stringify({ left, data }))
}

// T15 manual
{
  const { data: row } = await sb
    .from('service_order_materials')
    .select('stock_posting_status')
    .eq('id', mats[2].id)
    .single()
  const movs = await sumMov(mats[2].id, 'event_dispatch')
  if (movs === 0 && row?.stock_posting_status === 'not_applicable') {
    pass('T15 manual material no catalog → no posting')
  } else fail('T15', JSON.stringify({ row, movs }))
}

// T16 inventory_enabled=false
{
  const { data: row } = await sb
    .from('service_order_materials')
    .select('stock_posting_status')
    .eq('id', mats[3].id)
    .single()
  const movs = await sumMov(mats[3].id, 'event_dispatch')
  if (movs === 0 && row?.stock_posting_status === 'not_applicable') {
    pass('T16 inventory_enabled=false → no posting')
  } else fail('T16', JSON.stringify({ row, movs }))
}

// T17 posted after success
{
  const { data: row } = await sb
    .from('service_order_materials')
    .select('stock_posting_status')
    .eq('id', mats[0].id)
    .single()
  if (row?.stock_posting_status === 'posted') pass('T17 stock_posting_status → posted após sucesso')
  else fail('T17', JSON.stringify(row))
}

// T18 posting failure → not posted
{
  const failMat = 'f2500000-0000-4000-8000-0000000000a9'
  await sb.from('service_order_materials').upsert({
    id: failMat,
    company_id: COMPANY,
    service_order_id: OS_ID,
    catalog_item_id: COOLER,
    source_type: 'manual',
    description_snapshot: 'Fail negative',
    material_type: 'returnable',
    unit: 'unit',
    required_quantity: 9999,
    separated_quantity: 9999,
    checked_quantity: 9999,
    separated_at: new Date().toISOString(),
    checked_at: new Date().toISOString(),
    status: 'dispatched',
    dispatched_quantity: 9999,
    dispatched_at: new Date().toISOString(),
    stock_posting_status: 'pending',
  })
  const beforeStatus = 'pending'
  const { data } = await sb.rpc('post_inventory_for_order_dispatch', {
    p_company_id: COMPANY,
    p_service_order_id: OS_ID,
    p_actor: null,
  })
  const { data: row } = await sb
    .from('service_order_materials')
    .select('stock_posting_status')
    .eq('id', failMat)
    .single()
  if (
    data?.ok === false &&
    row?.stock_posting_status === beforeStatus
  ) {
    pass('T18 posting failure → status não fica posted')
  } else fail('T18', JSON.stringify({ data, row }))
}

void coolerBefore

await sb
  .from('service_order_materials')
  .delete()
  .eq('service_order_id', OS_ID)
  .in('id', QA_MAT_IDS)

console.log(
  failures === 0
    ? 'INVENTORY ORDER POSTING: PASS — failures=0'
    : 'INVENTORY ORDER POSTING: FAIL — failures=' + failures,
)
process.exit(failures === 0 ? 0 : 1)
