/**
 * QA DEV — conferência de materiais (persistência).
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

console.log('=== TEST ORDER MATERIAL CHECK ===')

const sb = createClient(url, key, { auth: { persistSession: false } })
const idOk = 'f2692000-0000-4000-8000-000000000001'
const idDiv = 'f2692000-0000-4000-8000-000000000002'

await sb.from('service_order_materials').delete().in('id', [idOk, idDiv])

async function seedSeparated(id) {
  const { error } = await sb.from('service_order_materials').insert({
    id,
    company_id: COMPANY,
    service_order_id: OS_ID,
    source_type: 'manual',
    description_snapshot: 'Check probe',
    material_type: 'consumable',
    unit: 'unit',
    required_quantity: 10,
    separated_quantity: 10,
    checked_quantity: 0,
    status: 'separated',
    separated_at: new Date().toISOString(),
  })
  if (error) throw new Error(error.message)
}

await seedSeparated(idOk)
await seedSeparated(idDiv)

{
  const checked = 10
  const status = deriveMaterialStatus({
    required: 10,
    separated: 10,
    checked,
    hasChecked: true,
  })
  const { data, error } = await sb
    .from('service_order_materials')
    .update({
      checked_quantity: checked,
      status,
      checked_at: new Date().toISOString(),
    })
    .eq('id', idOk)
    .select('status,checked_quantity')
    .single()
  if (error) fail(`check ok: ${error.message}`)
  else if (data.status === 'checked' && Number(data.checked_quantity) === 10) {
    pass('check 10/10 → checked')
  } else fail(`check ok got ${data?.status}`)
}

{
  const checked = 9
  const status = deriveMaterialStatus({
    required: 10,
    separated: 10,
    checked,
    hasChecked: true,
  })
  const { data, error } = await sb
    .from('service_order_materials')
    .update({
      checked_quantity: checked,
      status,
      checked_at: new Date().toISOString(),
    })
    .eq('id', idDiv)
    .select('status,checked_quantity,separated_quantity,required_quantity')
    .single()
  if (error) fail(`divergence: ${error.message}`)
  else if (data.status === 'divergence') {
    const delta = Number(data.separated_quantity) - Number(data.checked_quantity)
    pass(`check 9/10 → divergence (delta=${delta})`)
  } else fail(`divergence got ${data?.status}`)
}

await sb.from('service_order_materials').delete().in('id', [idOk, idDiv])

console.log(`ORDER MATERIAL CHECK: ${failed === 0 ? 'PASS' : 'FAIL'} — failures=${failed}`)
process.exit(failed === 0 ? 0 : 1)
