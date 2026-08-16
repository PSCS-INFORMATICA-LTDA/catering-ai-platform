import { createClient } from '@supabase/supabase-js'
import { createHash, randomBytes } from 'crypto'
import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const env = readFileSync(join(ROOT, '.env.local'), 'utf8')
const get = (k) => ((env.match(new RegExp(`^${k}=(.*)$`, 'm')) || [])[1] || '').trim()
const url = get('NEXT_PUBLIC_SUPABASE_URL')
const service = get('SUPABASE_SERVICE_ROLE_KEY')
const ref = (url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/) || [])[1]
if (ref !== 'yasprgtlqclwsjcshtls') {
  console.error('BLOQUEADO')
  process.exit(2)
}
const sb = createClient(url, service, { auth: { persistSession: false } })
const t = randomBytes(32).toString('hex')
const h = createHash('sha256').update(t).digest('hex')
const { error } = await sb.from('service_order_material_dispatch_confirmations').insert({
  company_id: '65fd576f-8d97-49ba-bf38-61bc1e94e94a',
  service_order_id: 'f2400000-0000-4000-8000-0000000000b1',
  team_id: 'a1000000-0000-4000-8000-000000000003',
  leader_person_id: 'b2800000-0000-4000-8000-000000000091',
  status: 'pending',
  token_hash: h,
  expires_at: new Date(Date.now() + 86400000).toISOString(),
})
if (error) {
  console.error(error)
  process.exit(1)
}
console.log('TOKEN=' + t)
console.log(
  'URL=https://catering-ai-agenda-dev.vercel.app/conferencia-saida/' + t,
)
