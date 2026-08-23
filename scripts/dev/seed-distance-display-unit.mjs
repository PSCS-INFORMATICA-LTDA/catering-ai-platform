/**
 * Upsert commercial_rules.distance_display_unit for CDL (DEV).
 *
 * Generic company-scoped presentation preference. Pricing stays in miles.
 * Other tenants without this key keep the legacy `both` (mi + km) display.
 *
 * Usage:
 *   node scripts/dev/seed-distance-display-unit.mjs
 *   node scripts/dev/seed-distance-display-unit.mjs --apply
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const apply = process.argv.includes('--apply')
const DEV_REF = 'yasprgtlqclwsjcshtls'
const COMPANY = '65fd576f-8d97-49ba-bf38-61bc1e94e94a'
const RULE_KEY = 'distance_display_unit'

function loadEnv() {
  const fromProc = {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    key: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  }
  if (fromProc.url && fromProc.key) return fromProc
  const envPath = join(ROOT, '.env.local')
  if (!existsSync(envPath)) return fromProc
  const env = readFileSync(envPath, 'utf8')
  const get = (k) => {
    const m = env.match(new RegExp(`^${k}=(.*)$`, 'm'))
    return m ? m[1].trim().replace(/^["']|["']$/g, '') : ''
  }
  return {
    url: fromProc.url || get('NEXT_PUBLIC_SUPABASE_URL'),
    key: fromProc.key || get('SUPABASE_SERVICE_ROLE_KEY'),
  }
}

const { url, key } = loadEnv()
if (!url.includes(DEV_REF)) {
  console.error('Abort: só DEV')
  process.exit(1)
}

const ruleValue = {
  value: 'miles',
  type: 'text',
  label_pt: 'Unidade de distância na interface',
}

console.log(`mode=${apply ? 'apply' : 'dry-run'}`)
console.log(`company=${COMPANY}`)
console.log(`rule_key=${RULE_KEY}`)
console.log(`value=${ruleValue.value}`)

if (!apply) {
  console.log('Dry-run OK. Use --apply para gravar no DEV.')
  process.exit(0)
}

const sb = createClient(url, key, { auth: { persistSession: false } })
const { data: existing, error: findErr } = await sb
  .from('commercial_rules')
  .select('id')
  .eq('company_id', COMPANY)
  .eq('rule_key', RULE_KEY)
  .maybeSingle()

if (findErr) {
  console.error(findErr.message)
  process.exit(1)
}

const now = new Date().toISOString()
if (existing?.id) {
  const { error } = await sb
    .from('commercial_rules')
    .update({ rule_value: ruleValue, active: true, updated_at: now })
    .eq('id', existing.id)
  if (error) {
    console.error(error.message)
    process.exit(1)
  }
  console.log(`updated id=${existing.id}`)
} else {
  const { data, error } = await sb
    .from('commercial_rules')
    .insert({
      company_id: COMPANY,
      rule_key: RULE_KEY,
      rule_value: ruleValue,
      active: true,
    })
    .select('id')
    .single()
  if (error) {
    console.error(error.message)
    process.exit(1)
  }
  console.log(`inserted id=${data.id}`)
}
