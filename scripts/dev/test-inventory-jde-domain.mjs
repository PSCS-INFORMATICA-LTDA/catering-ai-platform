/**
 * QA DEV — Inventory JDE domain services (Fase C)
 * availability, commitments, documents, reconciliation
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
const testItem = 'c1000000-0000-4000-8000-000000000101'

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

console.log('=== TEST INVENTORY JDE DOMAIN (FASE C) ===')

// C1 — availability view readable
{
  const { data, error } = await sb
    .from('inventory_availability')
    .select('balance_id, quantity_on_hand, quantity_committed, quantity_available')
    .eq('company_id', COMPANY)
    .limit(5)
  if (error || !data?.length) fail('C1 availability view', error?.message)
  else {
    const row = data[0]
    const expected = Number(row.quantity_on_hand) - Number(row.quantity_committed)
    if (Math.abs(Number(row.quantity_available) - expected) > 0.0001) {
      fail('C1 available formula', `got ${row.quantity_available} expected ${expected}`)
    } else pass('C1 availability view + formula')
  }
}

// C2 — commitment create idempotent (uses existing OS or skips)
{
  const { data: existingOrder } = await sb
    .from('service_orders')
    .select('id')
    .eq('company_id', COMPANY)
    .limit(1)
    .maybeSingle()

  if (!existingOrder?.id) {
    pass('C2 commitment (skipped — no service order in DEV)')
  } else {
    const testMaterial = randomUUID()
    const { error: matErr } = await sb.from('service_order_materials').insert({
      id: testMaterial,
      company_id: COMPANY,
      service_order_id: existingOrder.id,
      catalog_item_id: testItem,
      description_snapshot: 'QA Domain C Material',
      material_type: 'returnable',
      status: 'pending',
      required_quantity: 2,
      unit: 'unit',
      stock_posting_status: 'pending',
    })
    if (matErr) fail('C2 setup material', matErr.message)
    else {
      const r1 = await sb.rpc('create_inventory_commitment', {
        p_company_id: COMPANY,
        p_service_order_material_id: testMaterial,
        p_quantity: 2,
        p_actor: null,
      })
      const r2 = await sb.rpc('create_inventory_commitment', {
        p_company_id: COMPANY,
        p_service_order_material_id: testMaterial,
        p_quantity: 2,
        p_actor: null,
      })
      if (r1.error || r2.error) fail('C2 commitment rpc', r1.error?.message || r2.error?.message)
      else if (r1.data?.ok !== true || r2.data?.idempotent !== true) {
        fail('C2 commitment idempotency', JSON.stringify({ r1: r1.data, r2: r2.data }))
      } else pass('C2 commitment create + idempotent retry')

      const cid = r1.data.commitment_id
      const rel = await sb.rpc('release_inventory_commitment', {
        p_company_id: COMPANY,
        p_commitment_id: cid,
        p_new_status: 'released',
        p_actor: null,
      })
      if (rel.error || rel.data?.ok !== true) fail('C3 release commitment', rel.error?.message)
      else pass('C3 release commitment')

      await sb.from('inventory_commitments').delete().eq('service_order_material_id', testMaterial)
      await sb.from('service_order_materials').delete().eq('id', testMaterial)
    }
  }
}

// C4 — documents list
{
  const { data, error } = await sb
    .from('inventory_documents')
    .select('id, document_number, document_type, movement_code')
    .eq('company_id', COMPANY)
    .limit(3)
  if (error) fail('C4 documents', error.message)
  else pass('C4 documents readable count=' + (data?.length ?? 0))
}

// C5 — reconciliation RPC
{
  const { data, error } = await sb.rpc('rebuild_inventory_balances', {
    p_company_id: COMPANY,
  })
  if (error || data?.ok !== true) fail('C5 rebuild', error?.message || JSON.stringify(data))
  else pass('C5 rebuild_inventory_balances')
}

console.log('=== RESULT failures=' + failures + ' ===')
process.exit(failures > 0 ? 1 : 0)
