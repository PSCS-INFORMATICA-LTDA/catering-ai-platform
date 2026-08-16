/**
 * Upsert commercial_rules.schedule_turnaround_buffer para CDL (DEV).
 *
 * Arquitetura: reutiliza commercial_rules (JSON por company_id), mesmo padrão
 * de supplier_garnish_kit_packing — não é regra de preço, mas é o store
 * genérico existente. Sem regra → fallback gap=0 (não herda CDL).
 *
 * Uso:
 *   node scripts/dev/seed-schedule-turnaround-rule.mjs
 *   node scripts/dev/seed-schedule-turnaround-rule.mjs --apply
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const apply = process.argv.includes('--apply')
const DEV_REF = 'yasprgtlqclwsjcshtls'
const COMPANY = '65fd576f-8d97-49ba-bf38-61bc1e94e94a'
const RULE_KEY = 'schedule_turnaround_buffer'

const CONFIG = {
  enabled: true,
  base_radius_miles: 20,
  min_gap_minutes: 120,
  outside_radius_policy: 'manual_review',
}

function loadEnv() {
  const env = readFileSync(join(ROOT, '.env.local'), 'utf8')
  const get = (k) => {
    const m = env.match(new RegExp(`^${k}=(.*)$`, 'm'))
    return m ? m[1].trim().replace(/^["']|["']$/g, '') : ''
  }
  return {
    url: get('NEXT_PUBLIC_SUPABASE_URL'),
    key: get('SUPABASE_SERVICE_ROLE_KEY'),
  }
}

const { url, key } = loadEnv()
if (!url.includes(DEV_REF)) {
  console.error('Abort: só DEV')
  process.exit(1)
}

const ruleValue = {
  value: JSON.stringify(CONFIG),
  type: 'json',
  label_pt: 'Janela operacional entre eventos (minutos / raio mi)',
}

console.log(`mode=${apply ? 'apply' : 'dry-run'}`)
console.log(`company=${COMPANY}`)
console.log(`rule_key=${RULE_KEY}`)
console.log(`config=${JSON.stringify(CONFIG)}`)

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
  console.log(`UPDATED id=${existing.id}`)
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
  console.log(`INSERTED id=${data.id}`)
}

console.log('SEED SCHEDULE TURNAROUND: PASS')
