/**
 * QA DEV — reconciliação SUM(movements) = balance
 * Dimensões JDE: company + branch + location + item + lot (nullable)
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const DEV = 'yasprgtlqclwsjcshtls'
const COMPANY = '65fd576f-8d97-49ba-bf38-61bc1e94e94a'

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

function dimKey(branchId, locationId, catalogItemId, lotId) {
  return [branchId ?? '', locationId, catalogItemId, lotId ?? ''].join('|')
}

console.log('=== TEST INVENTORY RECONCILIATION ===')

// Rebuild antes de comparar — corrige cache desatualizado
const rebuild = await sb.rpc('rebuild_inventory_balances', {
  p_company_id: COMPANY,
})
if (rebuild.error || rebuild.data?.ok !== true) {
  console.error('rebuild failed', rebuild.error || rebuild.data)
  process.exit(1)
}
console.log('rebuild ok')

const { data: movs, error: mErr } = await sb
  .from('inventory_movements')
  .select('branch_id, location_id, catalog_item_id, lot_id, quantity')
  .eq('company_id', COMPANY)

if (mErr) {
  console.error(mErr)
  process.exit(1)
}

const sums = new Map()
for (const m of movs ?? []) {
  const k = dimKey(m.branch_id, m.location_id, m.catalog_item_id, m.lot_id)
  sums.set(k, (sums.get(k) || 0) + Number(m.quantity))
}

const { data: bals, error: bErr } = await sb
  .from('inventory_balances')
  .select('branch_id, location_id, catalog_item_id, lot_id, quantity_on_hand')
  .eq('company_id', COMPANY)

if (bErr) {
  console.error(bErr)
  process.exit(1)
}

let diffs = 0
const balMap = new Map()
for (const b of bals ?? []) {
  const k = dimKey(b.branch_id, b.location_id, b.catalog_item_id, b.lot_id)
  balMap.set(k, Number(b.quantity_on_hand))
  const expected = sums.get(k) || 0
  if (Math.abs(expected - Number(b.quantity_on_hand)) > 1e-6) {
    diffs++
    console.log(
      'DIFF  ' +
        k +
        ' ledger=' +
        expected +
        ' balance=' +
        b.quantity_on_hand,
    )
  }
}

for (const [k, v] of sums.entries()) {
  if (!balMap.has(k) && Math.abs(v) > 1e-6) {
    diffs++
    console.log('DIFF  missing balance for ' + k + ' ledger=' + v)
  }
}

if (diffs === 0) {
  console.log(
    'PASS  reconciliação 0 diferenças (' +
      (bals?.length || 0) +
      ' saldos, dims branch/location/item/lot)',
  )
  console.log('INVENTORY RECONCILIATION: PASS — failures=0')
  process.exit(0)
}

console.log('INVENTORY RECONCILIATION: FAIL — diffs=' + diffs)
process.exit(1)
