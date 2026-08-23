/**
 * QA DEV — segurança pública conferência de saída
 */
import { createClient } from '@supabase/supabase-js'
import { createHash, randomBytes } from 'crypto'
import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const DEV = 'yasprgtlqclwsjcshtls'
const COMPANY = '65fd576f-8d97-49ba-bf38-61bc1e94e94a'
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

console.log('=== TEST ORDER MATERIAL PUBLIC SECURITY ===')

const t = randomBytes(32).toString('hex')
const tokenHash = createHash('sha256').update(t).digest('hex')

await sb.from('service_order_material_dispatch_confirmations').insert({
  company_id: COMPANY,
  service_order_id: OS_ID,
  status: 'pending',
  token_hash: tokenHash,
  expires_at: new Date(Date.now() + 86400000).toISOString(),
})

const { data } = await sb.rpc('get_public_material_dispatch_confirmation', {
  p_token: t,
})

const raw = JSON.stringify(data ?? {})
const forbidden = [
  'unit_price',
  'total_price',
  '"price"',
  'discount',
  'deposit',
  'balance',
  'cost',
  'margin',
  'markup',
  'token_hash',
  'eyJ',
  'service_role',
  'password',
]

if (!data?.found) {
  fail('payload found', JSON.stringify(data))
} else {
  pass('public payload found')
}

for (const key of forbidden) {
  if (raw.toLowerCase().includes(key.toLowerCase())) {
    fail('no ' + key, 'present in payload')
  } else {
    pass('no ' + key)
  }
}

const cross = await sb.rpc('get_public_material_dispatch_confirmation', {
  p_token: randomBytes(32).toString('hex'),
})
if (cross.data?.found === false) pass('cross tenant / unknown token denied')
else fail('cross tenant')

console.log(
  failures === 0
    ? 'ORDER MATERIAL PUBLIC SECURITY: PASS — failures=0'
    : `ORDER MATERIAL PUBLIC SECURITY: FAIL — failures=${failures}`,
)
process.exit(failures === 0 ? 0 : 1)
