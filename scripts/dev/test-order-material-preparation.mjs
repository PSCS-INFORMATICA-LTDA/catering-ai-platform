/**
 * QA DEV — separação de materiais (persistência).
 * DEV only.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { deriveMaterialStatus } from './lib/order-materials-status.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const DEV = 'yasprgtlqclwsjcshtls'
const PROD = 'eapwtirhevxrqinytans'
const COMPANY = '65fd576f-8d97-49ba-bf38-61bc1e94e94a'
const OS_ID = 'f2400000-0000-4000-8000-000000000091'

let failed = 0
function pass(msg) {
  console.log(`PASS  ${msg}`)
}
function fail(msg) {
  failed += 1
  console.log(`FAIL  ${msg}`)
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

console.log('=== TEST ORDER MATERIAL PREPARATION ===')

const sb = createClient(url, key, { auth: { persistSession: false } })
const idFull = 'f2691000-0000-4000-8000-000000000001'
const idPartial = 'f2691000-0000-4000-8000-000000000002'

await sb.from('service_order_materials').delete().in('id', [idFull, idPartial])

async function seedRow(id, required) {
  const { error } = await sb.from('service_order_materials').insert({
    id,
    company_id: COMPANY,
    service_order_id: OS_ID,
    source_type: 'manual',
    description_snapshot: `Prep ${required}`,
    material_type: 'consumable',
    unit: 'unit',
    required_quantity: required,
    separated_quantity: 0,
    checked_quantity: 0,
    status: 'pending',
  })
  if (error) throw new Error(error.message)
}

await seedRow(idFull, 10)
await seedRow(idPartial, 10)

{
  const separated = 10
  const status = deriveMaterialStatus({
    required: 10,
    separated,
    checked: 0,
    hasChecked: false,
  })
  const { data, error } = await sb
    .from('service_order_materials')
    .update({
      separated_quantity: separated,
      status,
      separated_at: new Date().toISOString(),
    })
    .eq('id', idFull)
    .select('status,separated_quantity')
    .single()
  if (error) fail(`full: ${error.message}`)
  else if (data.status === 'separated' && Number(data.separated_quantity) === 10) {
    pass('prep full 10/10 → separated')
  } else fail(`prep full got ${data?.status}`)
}

{
  const separated = 8
  const status = deriveMaterialStatus({
    required: 10,
    separated,
    checked: 0,
    hasChecked: false,
  })
  const { data, error } = await sb
    .from('service_order_materials')
    .update({
      separated_quantity: separated,
      status,
      separated_at: new Date().toISOString(),
    })
    .eq('id', idPartial)
    .select('status,separated_quantity')
    .single()
  if (error) fail(`partial: ${error.message}`)
  else if (data.status === 'partial' && Number(data.separated_quantity) === 8) {
    pass('prep partial 8/10 → partial')
  } else fail(`prep partial got ${data?.status}`)
}

{
  const { error } = await sb
    .from('service_order_materials')
    .update({ separated_quantity: -1 })
    .eq('id', idFull)
  if (error) pass('prep negative qty → DB constraint block')
  else fail('prep negative should fail')
}

await sb.from('service_order_materials').delete().in('id', [idFull, idPartial])

console.log(
  `ORDER MATERIAL PREPARATION: ${failed === 0 ? 'PASS' : 'FAIL'} — failures=${failed}`,
)
process.exit(failed === 0 ? 0 : 1)
