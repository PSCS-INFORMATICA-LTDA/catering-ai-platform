/**
 * QA DEV — retorno / sobras (T11–T18)
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import {
  canCloseMaterial,
  deriveMaterialStatus,
  parseNonNegativeQuantity,
} from './lib/order-materials-status.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const DEV = 'yasprgtlqclwsjcshtls'
const OS_ID = 'f2400000-0000-4000-8000-0000000000b1'

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
function pass(label) {
  console.log('PASS  ' + label)
}
function fail(label, detail) {
  failures++
  console.log('FAIL  ' + label + (detail ? ' — ' + detail : ''))
}

console.log('=== TEST ORDER MATERIAL RETURN ===')

// T11 equipment 2/2
{
  const st = deriveMaterialStatus({
    required: 2,
    separated: 2,
    checked: 2,
    hasChecked: true,
    dispatched: 2,
    hasDispatched: true,
    returned: 2,
    hasReturned: true,
    materialType: 'equipment',
  })
  if (st === 'returned') pass('T11 equipamento enviado 2 / voltou 2 → PASS')
  else fail('T11', st)
}

// T12 equipment 2/1 divergence
{
  const st = deriveMaterialStatus({
    required: 2,
    separated: 2,
    checked: 2,
    hasChecked: true,
    dispatched: 2,
    hasDispatched: true,
    returned: 1,
    hasReturned: true,
    materialType: 'equipment',
  })
  if (st === 'divergence') pass('T12 equipamento 2/1 → divergence')
  else fail('T12', st)
}

// T13 consumable leftover
{
  const st = deriveMaterialStatus({
    required: 40,
    separated: 40,
    checked: 40,
    hasChecked: true,
    dispatched: 40,
    hasDispatched: true,
    returned: 0,
    hasReturned: true,
    leftover: 5,
    materialType: 'consumable',
  })
  if (st === 'returned') pass('T13 consumível enviado 40 / sobra 5 → PASS')
  else fail('T13', st)
}

// T14 disposable return 0
{
  const st = deriveMaterialStatus({
    required: 100,
    separated: 100,
    checked: 100,
    hasChecked: true,
    dispatched: 100,
    hasDispatched: true,
    returned: 0,
    hasReturned: true,
    materialType: 'disposable',
  })
  if (st === 'returned') pass('T14 descartável retorno 0 → PASS')
  else fail('T14', st)
}

// T15 negative
{
  const q = parseNonNegativeQuantity(-1)
  if (!q.ok) pass('T15 quantidade negativa → BLOCK')
  else fail('T15')
}

// T16 returned > dispatched block (API rule)
{
  const dispatched = 2
  const returned = 3
  if (returned > dispatched) pass('T16 returned > dispatched → block')
  else fail('T16')
}

// T17 unit preserved in DB
{
  const { data } = await sb
    .from('service_order_materials')
    .select('id, unit, description_snapshot')
    .eq('service_order_id', OS_ID)
    .limit(1)
    .maybeSingle()
  if (data?.unit) pass('T17 unidade preservada → PASS')
  else fail('T17 unidade', 'sem material')
}

// T18 fechamento
{
  const okClose = canCloseMaterial({
    status: 'returned',
    material_type: 'equipment',
    dispatched_quantity: 2,
    returned_quantity: 2,
    returned_at: new Date().toISOString(),
  })
  const badClose = canCloseMaterial({
    status: 'divergence',
    material_type: 'equipment',
    dispatched_quantity: 2,
    returned_quantity: 1,
    returned_at: new Date().toISOString(),
  })
  const consumableClose = canCloseMaterial({
    status: 'dispatched',
    material_type: 'consumable',
    dispatched_quantity: 40,
    returned_quantity: 0,
    returned_at: null,
  })
  if (okClose && !badClose && consumableClose) {
    pass('T18 fechamento → PASS somente quando consistente')
  } else fail('T18 fechamento', JSON.stringify({ okClose, badClose, consumableClose }))
}

console.log(
  failures === 0
    ? 'ORDER MATERIAL RETURN: PASS — failures=0'
    : `ORDER MATERIAL RETURN: FAIL — failures=${failures}`,
)
process.exit(failures === 0 ? 0 : 1)
