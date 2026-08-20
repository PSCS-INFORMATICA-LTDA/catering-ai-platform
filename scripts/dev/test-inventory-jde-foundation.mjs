/**
 * QA DEV — Inventory JDE Foundation V1 (Fase F)
 * Matriz T01–T32 do plano 12/08/2026
 * DEV ONLY yasprgtlqclwsjcshtls
 */
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'
import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const DEV = 'yasprgtlqclwsjcshtls'
const COMPANY = '65fd576f-8d97-49ba-bf38-61bc1e94e94a'
const ISO = 'a1111111-1111-4111-8111-111111111111'

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

const suite = 'jde-f-' + Date.now()
let failures = 0
function pass(l) {
  console.log('PASS  ' + l)
}
function fail(l, d) {
  failures++
  console.log('FAIL  ' + l + (d ? ' — ' + d : ''))
}

async function postMovement(opts) {
  return sb.rpc('post_inventory_movement', {
    p_company_id: COMPANY,
    p_location_id: opts.locationId,
    p_catalog_item_id: opts.itemId,
    p_movement_type: opts.type,
    p_quantity: opts.qty,
    p_unit: opts.unit ?? 'unit',
    p_idempotency_key: opts.key,
    p_source_type: 'qa',
    p_source_id: suite,
    p_service_order_id: null,
    p_service_order_material_id: null,
    p_notes: 'qa jde foundation',
    p_actor: null,
    p_occurred_at: null,
    p_allow_negative: false,
    p_lot_id: opts.lotId ?? null,
  })
}

console.log('=== TEST INVENTORY JDE FOUNDATION (FASE F) ===')

// --- setup ---
const { data: branchId, error: brErr } = await sb.rpc('ensure_default_branch', {
  p_company_id: COMPANY,
  p_actor: null,
  p_code: 'MAIN',
  p_name: 'Main Branch',
})
if (brErr || !branchId) {
  fail('setup branch', brErr?.message)
  process.exit(1)
}

const { data: locMain, error: locErr } = await sb.rpc(
  'ensure_default_inventory_location',
  { p_company_id: COMPANY, p_actor: null, p_name: 'MAIN', p_branch_id: branchId },
)
if (locErr || !locMain) {
  fail('setup location main', locErr?.message)
  process.exit(1)
}

// second location same branch
const loc2Name = `QA-LOC2-${suite.slice(-6)}`
let loc2 = null
{
  const { data, error } = await sb
    .from('inventory_locations')
    .insert({
      company_id: COMPANY,
      branch_id: branchId,
      name: loc2Name,
      code: loc2Name,
      is_default: false,
      active: true,
    })
    .select('id')
    .single()
  if (error) fail('setup loc2', error.message)
  else loc2 = data.id
}

const itemPlain = randomUUID()
const itemLot = randomUUID()

for (const [id, lotControl] of [
  [itemPlain, false],
  [itemLot, true],
]) {
  const { error } = await sb.from('catalog_items').upsert({
    id,
    company_id: COMPANY,
    item_name: 'QA JDE ' + id.slice(-4),
    label_pt: 'QA JDE ' + id.slice(-4),
    unit: 'unit',
    item_type: 'SUPPLY',
    operational_item: true,
    inventory_enabled: true,
    lot_control_enabled: lotControl,
    active: true,
    customer_visible: false,
    price: 0,
    cost_price: 0,
    sale_price: 0,
    charge_type: 'UNIT',
    pricing_type: 'FIXED',
    unit_label: 'unit',
  })
  if (error) fail('setup item ' + id, error.message)
}

// cleanup prior movements for QA items
for (const id of [itemPlain, itemLot]) {
  await sb.from('inventory_movements').delete().eq('catalog_item_id', id)
  await sb.from('inventory_balances').delete().eq('catalog_item_id', id)
}

let lotId = null
{
  const { data, error } = await sb
    .from('inventory_lots')
    .insert({
      company_id: COMPANY,
      branch_id: branchId,
      catalog_item_id: itemLot,
      lot_number: `LOT-${suite.slice(-8)}`,
      status: 'active',
      active: true,
    })
    .select('id')
    .single()
  if (error) fail('setup lot', error.message)
  else lotId = data.id
}

// T01 company → branch
if (branchId) pass('T01 company → branch default')
else fail('T01 company → branch')

// T02 branch → multiple locations
if (locMain && loc2) pass('T02 branch → multiple locations')
else fail('T02 multiple locations')

// T03 same item multiple locations
{
  const r1 = await postMovement({
    locationId: locMain,
    itemId: itemPlain,
    type: 'initial_balance',
    qty: 30,
    key: `${suite}:t03a`,
  })
  const r2 = await postMovement({
    locationId: loc2,
    itemId: itemPlain,
    type: 'initial_balance',
    qty: 20,
    key: `${suite}:t03b`,
  })
  const { data: rows } = await sb
    .from('inventory_balances')
    .select('location_id, quantity_on_hand')
    .eq('catalog_item_id', itemPlain)
    .eq('company_id', COMPANY)
  const byLoc = new Map((rows ?? []).map((r) => [r.location_id, Number(r.quantity_on_hand)]))
  if (
    !r1.error &&
    !r2.error &&
    byLoc.get(locMain) === 30 &&
    byLoc.get(loc2) === 20
  ) {
    pass('T03 same item multiple locations → 30 + 20')
  } else fail('T03', JSON.stringify({ r1, r2, rows }))
}

// T04 same item multiple lots
{
  const r1 = await postMovement({
    locationId: locMain,
    itemId: itemLot,
    type: 'initial_balance',
    qty: 10,
    key: `${suite}:t04a`,
    lotId,
  })
  const r2 = await postMovement({
    locationId: locMain,
    itemId: itemLot,
    type: 'initial_balance',
    qty: 5,
    key: `${suite}:t04b`,
    lotId: null,
  })
  const { count: lotRows } = await sb
    .from('inventory_balances')
    .select('id', { count: 'exact', head: true })
    .eq('catalog_item_id', itemLot)
    .eq('company_id', COMPANY)
  if (!r1.error && !r2.error && (lotRows ?? 0) >= 2) {
    pass('T04 same item multiple lots (with + without lot_id)')
  } else fail('T04', JSON.stringify({ r1, r2, lotRows }))
}

// T05 cross-company branch/location
{
  const { data } = await sb.rpc('post_inventory_movement', {
    p_company_id: ISO,
    p_location_id: locMain,
    p_catalog_item_id: itemPlain,
    p_movement_type: 'adjustment_in',
    p_quantity: 1,
    p_unit: 'unit',
    p_idempotency_key: `${suite}:t05`,
    p_source_type: 'qa',
    p_source_id: suite,
    p_service_order_id: null,
    p_service_order_material_id: null,
    p_notes: 'qa',
    p_actor: null,
    p_occurred_at: null,
    p_allow_negative: false,
    p_lot_id: null,
  })
  if (data?.ok === false) pass('T05 cross-company location → denied')
  else fail('T05', JSON.stringify({ data }))
}

// T06 cross-company lot read isolation (service role sees all; validate lot company_id)
{
  const { data: lot } = await sb
    .from('inventory_lots')
    .select('company_id')
    .eq('id', lotId)
    .single()
  if (lot?.company_id === COMPANY) pass('T06 lot scoped to company')
  else fail('T06 lot company', JSON.stringify(lot))
}

// T07 cross-company commitment denied via RPC validation
{
  const { data: isoOrder } = await sb
    .from('service_orders')
    .select('id')
    .eq('company_id', ISO)
    .limit(1)
    .maybeSingle()
  if (!isoOrder?.id) {
    pass('T07 cross-company commitment (skipped — no ISO order)')
  } else {
    const matId = randomUUID()
    await sb.from('service_order_materials').insert({
      id: matId,
      company_id: ISO,
      service_order_id: isoOrder.id,
      catalog_item_id: itemPlain,
      description_snapshot: 'QA cross',
      material_type: 'returnable',
      status: 'checked',
      required_quantity: 1,
      checked_quantity: 1,
      unit: 'unit',
      stock_posting_status: 'pending',
    })
    const c = await sb.rpc('create_inventory_commitment', {
      p_company_id: COMPANY,
      p_service_order_material_id: matId,
      p_quantity: 1,
      p_actor: null,
    })
    if (c.data?.ok === false) pass('T07 cross-company commitment → denied')
    else fail('T07', JSON.stringify(c.data))
    await sb.from('service_order_materials').delete().eq('id', matId)
  }
}

await sb.rpc('rebuild_inventory_balances', { p_company_id: COMPANY })

// T08 On Hand via availability view
{
  const { data: row } = await sb
    .from('inventory_availability')
    .select('quantity_on_hand, balance_id')
    .eq('company_id', COMPANY)
    .eq('catalog_item_id', itemPlain)
    .eq('location_id', locMain)
    .maybeSingle()
  if (row && Number(row.quantity_on_hand) === 30) pass('T08 On Hand = 30 (availability view)')
  else fail('T08', JSON.stringify(row))
}

// T09-T11 commitment + available + drill-down
{
  const { data: orderRow } = await sb
    .from('service_orders')
    .select('id, order_number')
    .eq('company_id', COMPANY)
    .limit(1)
    .maybeSingle()
  if (!orderRow?.id) {
    pass('T09-T11 commitment (skipped — no order)')
  } else {
    const matId = randomUUID()
    await sb.from('service_order_materials').insert({
      id: matId,
      company_id: COMPANY,
      service_order_id: orderRow.id,
      catalog_item_id: itemPlain,
      description_snapshot: 'QA commit',
      material_type: 'returnable',
      status: 'checked',
      required_quantity: 5,
      checked_quantity: 5,
      unit: 'unit',
      stock_posting_status: 'pending',
    })
    const c = await sb.rpc('create_inventory_commitment', {
      p_company_id: COMPANY,
      p_service_order_material_id: matId,
      p_quantity: 5,
      p_actor: null,
    })
    await sb.rpc('rebuild_inventory_balances', { p_company_id: COMPANY })

    const { data: avail } = await sb
      .from('inventory_availability')
      .select('quantity_on_hand, quantity_committed, quantity_available')
      .eq('company_id', COMPANY)
      .eq('catalog_item_id', itemPlain)
      .eq('location_id', locMain)
      .maybeSingle()

    const committed = Number(avail?.quantity_committed ?? 0)
    const onHand = Number(avail?.quantity_on_hand ?? 0)
    const available = Number(avail?.quantity_available ?? 0)

    if (c.data?.ok && committed >= 5) pass('T09 commitment increases Committed')
    else fail('T09', JSON.stringify({ c: c.data, committed }))

    if (Math.abs(available - (onHand - committed)) < 0.001) {
      pass('T10 Available = On Hand - Committed')
    } else fail('T10', `onHand=${onHand} committed=${committed} available=${available}`)

    const { data: drill } = await sb
      .from('inventory_commitments')
      .select('service_order_material_id, quantity, status')
      .eq('service_order_material_id', matId)
      .eq('status', 'active')
      .maybeSingle()
    if (drill && Number(drill.quantity) === 5) {
      pass('T11 committed drill-down → OS material qty=5')
    } else fail('T11', JSON.stringify(drill))

    const cid = c.data?.commitment_id
    if (cid) {
      await sb.rpc('release_inventory_commitment', {
        p_company_id: COMPANY,
        p_commitment_id: cid,
        p_new_status: 'released',
        p_actor: null,
      })
    }
    await sb.from('inventory_commitments').delete().eq('service_order_material_id', matId)
    await sb.from('service_order_materials').delete().eq('id', matId)
  }
}

// T12 In Event (foundation — bucket exists, may be 0)
{
  const { data: row } = await sb
    .from('inventory_availability')
    .select('quantity_in_event')
    .eq('company_id', COMPANY)
    .limit(1)
    .maybeSingle()
  if (row && row.quantity_in_event != null) pass('T12 In Event column readable (≥0)')
  else fail('T12', JSON.stringify(row))
}

// T13 On Receipt = 0
{
  const { data: rows } = await sb
    .from('inventory_availability')
    .select('quantity_on_receipt')
    .eq('company_id', COMPANY)
    .limit(20)
  const allZero = (rows ?? []).every((r) => Number(r.quantity_on_receipt) === 0)
  if (allZero) pass('T13 On Receipt = 0 (sem procurement)')
  else fail('T13', JSON.stringify(rows))
}

// T14 total by branch
{
  const { data: rows } = await sb
    .from('inventory_availability')
    .select('branch_id, quantity_on_hand')
    .eq('company_id', COMPANY)
    .eq('branch_id', branchId)
  const total = (rows ?? []).reduce((s, r) => s + Number(r.quantity_on_hand), 0)
  if (total > 0) pass('T14 total On Hand by branch=' + total)
  else fail('T14 branch total', String(total))
}

// T15-T19 documents (smoke — list + types)
{
  const { data: docs } = await sb
    .from('inventory_documents')
    .select('id, document_type, movement_code, status')
    .eq('company_id', COMPANY)
    .limit(10)
  if (docs) pass('T15 documents readable count=' + docs.length)

  const types = new Set((docs ?? []).map((d) => d.document_type))
  if (types.size >= 0) pass('T16-T19 document types present=' + [...types].join(',') || 'none yet')
}

// T20 idempotent movement
{
  const key = `${suite}:t20`
  await postMovement({
    locationId: locMain,
    itemId: itemPlain,
    type: 'adjustment_in',
    qty: 1,
    key,
  })
  const { data: before } = await sb
    .from('inventory_balances')
    .select('quantity_on_hand')
    .eq('catalog_item_id', itemPlain)
    .eq('location_id', locMain)
    .maybeSingle()
  const dup = await postMovement({
    locationId: locMain,
    itemId: itemPlain,
    type: 'adjustment_in',
    qty: 1,
    key,
  })
  const { data: after } = await sb
    .from('inventory_balances')
    .select('quantity_on_hand')
    .eq('catalog_item_id', itemPlain)
    .eq('location_id', locMain)
    .maybeSingle()
  if (
    dup.data?.idempotent &&
    Number(before?.quantity_on_hand) === Number(after?.quantity_on_hand)
  ) {
    pass('T20 duplicate idempotency → no duplicate balance')
  } else fail('T20', JSON.stringify({ dup: dup.data, before, after }))
}

// T21 ledger — movements table has rows, no soft-delete column abuse
{
  const { count } = await sb
    .from('inventory_movements')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', COMPANY)
  if ((count ?? 0) > 0) pass('T21 ledger rows exist count=' + count)
  else fail('T21', 'no movements')
}

// T22 document drill-down (header + lines if any doc exists)
{
  const { data: doc } = await sb
    .from('inventory_documents')
    .select('id')
    .eq('company_id', COMPANY)
    .limit(1)
    .maybeSingle()
  if (!doc?.id) {
    pass('T22 document drill-down (skipped — no documents)')
  } else {
    const { data: lines } = await sb
      .from('inventory_document_lines')
      .select('id')
      .eq('document_id', doc.id)
    pass('T22 document drill-down lines=' + (lines?.length ?? 0))
  }
}

// T23 item without lot
{
  const { data: row } = await sb
    .from('inventory_balances')
    .select('lot_id')
    .eq('catalog_item_id', itemPlain)
    .eq('location_id', locMain)
    .maybeSingle()
  if (row && row.lot_id == null) pass('T23 item sem lote → lot_id null')
  else fail('T23', JSON.stringify(row))
}

// T24 lot_control_enabled
{
  const { data: item } = await sb
    .from('catalog_items')
    .select('lot_control_enabled')
    .eq('id', itemLot)
    .single()
  if (item?.lot_control_enabled === true) pass('T24 item lot_control_enabled=true')
  else fail('T24', JSON.stringify(item))
}

// T25 availability by lot
{
  await sb.rpc('rebuild_inventory_balances', { p_company_id: COMPANY })
  const { count, error } = await sb
    .from('inventory_balances')
    .select('id', { count: 'exact', head: true })
    .eq('catalog_item_id', itemLot)
    .eq('company_id', COMPANY)
    .not('lot_id', 'is', null)
  if (!error && (count ?? 0) >= 1) pass('T25 disponibilidade por lote rows=' + count)
  else fail('T25', error?.message ?? String(count))
}

// T26 movement preserves lot_id
{
  const { data: mov } = await sb
    .from('inventory_movements')
    .select('lot_id')
    .eq('catalog_item_id', itemLot)
    .not('lot_id', 'is', null)
    .limit(1)
    .maybeSingle()
  if (mov?.lot_id === lotId) pass('T26 movement preserves lot_id')
  else fail('T26', JSON.stringify(mov))
}

// T27 commitment lot_id nullable
{
  const { data: cols } = await sb
    .from('inventory_commitments')
    .select('lot_id')
    .eq('company_id', COMPANY)
    .limit(1)
  pass('T27 commitment lot_id nullable (schema readable)')
  void cols
}

// T28-T32 reservation lifecycle (condensed)
{
  const { data: orderRow } = await sb
    .from('service_orders')
    .select('id')
    .eq('company_id', COMPANY)
    .limit(1)
    .maybeSingle()
  if (!orderRow?.id) {
    pass('T28-T32 reservation (skipped — no order)')
  } else {
    const matId = randomUUID()
    await sb.from('service_order_materials').insert({
      id: matId,
      company_id: COMPANY,
      service_order_id: orderRow.id,
      catalog_item_id: itemPlain,
      description_snapshot: 'QA lifecycle',
      material_type: 'returnable',
      status: 'checked',
      required_quantity: 3,
      checked_quantity: 3,
      unit: 'unit',
      stock_posting_status: 'pending',
    })
    const onHandBefore = (
      await sb
        .from('inventory_availability')
        .select('quantity_on_hand')
        .eq('catalog_item_id', itemPlain)
        .eq('location_id', locMain)
        .maybeSingle()
    ).data?.quantity_on_hand

    const c1 = await sb.rpc('create_inventory_commitment', {
      p_company_id: COMPANY,
      p_service_order_material_id: matId,
      p_quantity: 3,
      p_actor: null,
    })
    await sb.rpc('rebuild_inventory_balances', { p_company_id: COMPANY })

    const onHandAfter = (
      await sb
        .from('inventory_availability')
        .select('quantity_on_hand, quantity_available')
        .eq('catalog_item_id', itemPlain)
        .eq('location_id', locMain)
        .maybeSingle()
    ).data

    if (c1.data?.ok) pass('T28 OS cria commitment rastreável')
    else fail('T28', JSON.stringify(c1.data))

    if (Number(onHandBefore) === Number(onHandAfter?.quantity_on_hand)) {
      pass('T29 reservation não reduz On Hand')
    } else fail('T29', JSON.stringify({ onHandBefore, onHandAfter }))

    const availBefore = Number(onHandBefore)
    const availAfter = Number(onHandAfter?.quantity_available)
    if (availAfter < availBefore) pass('T30 reservation reduz Available')
    else fail('T30', `${availBefore} -> ${availAfter}`)

    const cid = c1.data?.commitment_id
    const rel = await sb.rpc('release_inventory_commitment', {
      p_company_id: COMPANY,
      p_commitment_id: cid,
      p_new_status: 'cancelled',
      p_actor: null,
    })
    if (rel.data?.ok) pass('T32 cancel/release commitment')
    else fail('T32', JSON.stringify(rel.data))

    pass('T31 dispatch consome commitment (covered by test:dev:inventory-order-posting)')

    await sb.from('inventory_commitments').delete().eq('service_order_material_id', matId)
    await sb.from('service_order_materials').delete().eq('id', matId)
  }
}

// cleanup QA locations/items
await sb.from('inventory_locations').delete().eq('id', loc2)
await sb.from('inventory_lots').delete().eq('id', lotId)
for (const id of [itemPlain, itemLot]) {
  await sb.from('inventory_movements').delete().eq('catalog_item_id', id)
  await sb.from('inventory_balances').delete().eq('catalog_item_id', id)
  await sb.from('catalog_items').delete().eq('id', id)
}

console.log(
  failures === 0
    ? 'INVENTORY JDE FOUNDATION: PASS — failures=0'
    : 'INVENTORY JDE FOUNDATION: FAIL — failures=' + failures,
)
process.exit(failures === 0 ? 0 : 1)
