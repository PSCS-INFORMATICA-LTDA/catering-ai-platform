/**
 * Align package garnish *display copy* with operational sides (ITEM_FEIJAO_PRETO).
 * Does NOT change package_side_items, catalog ITEM_081, or supplier garnish kits.
 *
 * Usage:
 *   node scripts/dev/align-package-garnish-copy.mjs
 *   node scripts/dev/align-package-garnish-copy.mjs --apply
 */
import { createClient } from '@supabase/supabase-js'
import { existsSync, readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const apply = process.argv.includes('--apply')
const DEV_REF = 'yasprgtlqclwsjcshtls'
const COMPANY = '65fd576f-8d97-49ba-bf38-61bc1e94e94a'
const FROM = /Feijão tropeiro/gi
const TO = 'Feijão preto'

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

const sb = createClient(url, key, { auth: { persistSession: false } })
const { data: packages, error } = await sb
  .from('packages')
  .select(
    'id, package_key, garnish_description_pt, sides_description_pt',
  )
  .eq('company_id', COMPANY)

if (error) {
  console.error(error.message)
  process.exit(1)
}

const updates = []
for (const pkg of packages ?? []) {
  const garnish = String(pkg.garnish_description_pt ?? '')
  const sides = String(pkg.sides_description_pt ?? '')
  const nextGarnish = garnish.replace(FROM, TO)
  const nextSides = sides.replace(FROM, TO)
  if (nextGarnish === garnish && nextSides === sides) continue
  updates.push({
    id: pkg.id,
    package_key: pkg.package_key,
    from: { garnish, sides },
    to: { garnish: nextGarnish, sides: nextSides },
  })
}

console.log(`mode=${apply ? 'apply' : 'dry-run'}`)
console.log(`candidates=${updates.length}`)
for (const row of updates) {
  console.log(JSON.stringify(row))
}

if (!apply) {
  console.log('Dry-run OK. Use --apply para gravar no DEV.')
  process.exit(0)
}

for (const row of updates) {
  const { error: updateError } = await sb
    .from('packages')
    .update({
      garnish_description_pt: row.to.garnish,
      sides_description_pt: row.to.sides,
    })
    .eq('id', row.id)
    .eq('company_id', COMPANY)
  if (updateError) {
    console.error(row.package_key, updateError.message)
    process.exit(1)
  }
  console.log(`updated ${row.package_key}`)
}
