/**
 * Upsert commercial_rules.supplier_garnish_kit_packing for CDL (DEV).
 * Run: node --experimental-strip-types scripts/dev/seed-supplier-garnish-kit-rule.mjs [--apply]
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath, pathToFileURL } from 'url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const apply = process.argv.includes('--apply')

const env = Object.fromEntries(
  readFileSync(join(ROOT, '.env.local'), 'utf8')
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i), l.slice(i + 1)]
    }),
)

const url = env.NEXT_PUBLIC_SUPABASE_URL || ''
const key = env.SUPABASE_SERVICE_ROLE_KEY || ''
if (!url.includes('yasprgtlqclwsjcshtls')) {
  console.error('Abort: só DEV (yasprgtlqclwsjcshtls).')
  process.exit(1)
}

const kitMod = await import(
  pathToFileURL(join(ROOT, 'Lib/supplierGarnishKitRule.ts')).href
)

const companyId = '65fd576f-8d97-49ba-bf38-61bc1e94e94a'
const ruleKey = kitMod.SUPPLIER_GARNISH_KIT_RULE_KEY
const ruleValue = kitMod.buildSupplierGarnishKitRuleValue()

console.log(`mode=${apply ? 'apply' : 'dry-run'} company=${companyId}`)
console.log(`rule_key=${ruleKey}`)
console.log(`type=${ruleValue.type}`)
console.log(`label=${ruleValue.label_pt}`)
console.log(`value_preview=${String(ruleValue.value).slice(0, 120)}…`)

if (!apply) {
  console.log('Dry-run OK. Use --apply para gravar no DEV.')
  process.exit(0)
}

const sb = createClient(url, key, { auth: { persistSession: false } })
const { data: existing, error: findErr } = await sb
  .from('commercial_rules')
  .select('id, active')
  .eq('company_id', companyId)
  .eq('rule_key', ruleKey)
  .maybeSingle()

if (findErr) {
  console.error(findErr.message)
  process.exit(1)
}

const now = new Date().toISOString()
if (existing?.id) {
  const { error } = await sb
    .from('commercial_rules')
    .update({
      rule_value: ruleValue,
      active: true,
      updated_at: now,
    })
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
      company_id: companyId,
      rule_key: ruleKey,
      rule_value: ruleValue,
      active: true,
      created_at: now,
      updated_at: now,
    })
    .select('id')
    .single()
  if (error) {
    console.error(error.message)
    process.exit(1)
  }
  console.log(`INSERTED id=${data.id}`)
}

console.log('PASS  supplier_garnish_kit_packing seeded for CDL DEV')
