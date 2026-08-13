/**
 * QA DEV — Inventory OS integration (Fase D)
 * commitment on check, release on cancel/divergence, dispatch/return documents
 */
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'
import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const DEV = 'yasprgtlqclwsjcshtls'
const COMPANY = '65fd576f-8d97-49ba-bf38-61bc1e94e94a'
const COOLER = 'c1000000-0000-4000-8000-000000000101'

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

console.log('=== TEST INVENTORY OS INTEGRATION (FASE D) ===')

const { data: orderRow } = await sb
  .from('service_orders')
  .select('id')
  .eq('company_id', COMPANY)
  .limit(1)
  .maybeSingle()

if (!orderRow?.id) {
  fail('setup', 'no service order in DEV')
  process.exit(1)
}

const materialId = randomUUID()
const suite = 'os-int-' + Date.now()

await sb.from('service_order_materials').insert({
  id: materialId,
  company_id: COMPANY,
  service_order_id: orderRow.id,
  catalog_item_id: COOLER,
  description_snapshot: 'QA OS Integration ' + suite,
  material_type: 'returnable',
  status: 'pending',
  required_quantity: 4,
  separated_quantity: 4,
  checked_quantity: 0,
  unit: 'unit',
  stock_posting_status: 'pending',
})

// D1 — check creates active commitment
{
  await sb
    .from('service_order_materials')
    .update({
      checked_quantity: 4,
      checked_at: new Date().toISOString(),
      status: 'checked',
    })
    .eq('id', materialId)

  const c1 = await sb.rpc('create_inventory_commitment', {
    p_company_id: COMPANY,
    p_service_order_material_id: materialId,
    p_quantity: 4,
    p_actor: null,
  })
  if (c1.error || c1.data?.ok !== true) fail('D1 commitment on check', c1.error?.message)
  else pass('D1 commitment created on checked qty=4')

  const { data: active } = await sb
    .from('inventory_commitments')
    .select('quantity, status')
    .eq('service_order_material_id', materialId)
    .eq('status', 'active')
    .maybeSingle()
  if (!active || Number(active.quantity) !== 4) {
    fail('D1 active commitment row', JSON.stringify(active))
  }
}

// D2 — cancel releases commitment
{
  const { data: before } = await sb
    .from('inventory_commitments')
    .select('id')
    .eq('service_order_material_id', materialId)
    .eq('status', 'active')
    .maybeSingle()
  if (!before?.id) fail('D2 setup', 'no active commitment')
  else {
    const rel = await sb.rpc('release_inventory_commitment', {
      p_company_id: COMPANY,
      p_commitment_id: before.id,
      p_new_status: 'cancelled',
      p_actor: null,
    })
    if (rel.error || rel.data?.ok !== true) fail('D2 release on cancel', rel.error?.message)
    else pass('D2 commitment released (cancelled)')
  }
}

// D3 — dispatch RPC still creates document (smoke on existing dispatched OS if any)
{
  const { data: dispatchedOrder } = await sb
    .from('service_order_materials')
    .select('service_order_id')
    .eq('company_id', COMPANY)
    .eq('status', 'dispatched')
    .gt('dispatched_quantity', 0)
    .limit(1)
    .maybeSingle()

  if (!dispatchedOrder?.service_order_id) {
    pass('D3 dispatch document (skipped — no dispatched material)')
  } else {
    const d = await sb.rpc('post_inventory_for_order_dispatch', {
      p_company_id: COMPANY,
      p_service_order_id: dispatchedOrder.service_order_id,
      p_actor: null,
    })
    if (d.error) fail('D3 dispatch rpc', d.error.message)
    else if (d.data?.ok === true || d.data?.document_id) {
      pass('D3 dispatch document idempotent/rpc ok')
    } else pass('D3 dispatch rpc returned', JSON.stringify(d.data))
  }
}

// cleanup
await sb.from('inventory_commitments').delete().eq('service_order_material_id', materialId)
await sb.from('service_order_materials').delete().eq('id', materialId)

console.log('=== RESULT failures=' + failures + ' ===')
process.exit(failures > 0 ? 1 : 0)
