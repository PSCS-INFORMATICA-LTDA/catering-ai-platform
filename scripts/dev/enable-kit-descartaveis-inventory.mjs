/**
 * DEV-only: mark KIT_DESCARTAVEIS as inventory-backed.
 * Does not create a stock decrement rule — kits-per-person consumption
 * is not implemented in the current inventory posting model.
 *
 *   node scripts/dev/enable-kit-descartaveis-inventory.mjs
 *   node scripts/dev/enable-kit-descartaveis-inventory.mjs --apply
 */
import { createClient } from '@supabase/supabase-js'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { writeFileSync } from 'node:fs'
import { assertDevUrl, loadDevEnv } from './loadDevEnv.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const COMPANY_ID = '65fd576f-8d97-49ba-bf38-61bc1e94e94a'
const APPLY = process.argv.includes('--apply')

const env = loadDevEnv(ROOT)
const ref = assertDevUrl(env.url)
if (!env.service) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY')
  process.exit(2)
}

const sb = createClient(env.url, env.service, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const { data: rows, error } = await sb
  .from('catalog_items')
  .select(
    'id, item_key, label_pt, price, pricing_type, inventory_enabled, image_url',
  )
  .eq('company_id', COMPANY_ID)
  .eq('item_key', 'KIT_DESCARTAVEIS')

if (error) {
  console.error(error.message)
  process.exit(1)
}
if (!rows?.length) {
  console.error('KIT_DESCARTAVEIS missing')
  process.exit(1)
}
if (rows.length !== 1) {
  console.error(`KIT_DESCARTAVEIS duplicate rows=${rows.length}`)
  process.exit(1)
}

const row = rows[0]
const report = {
  project_ref: ref,
  item_key: row.item_key,
  catalog_item_id: row.id,
  price: row.price,
  pricing_type: row.pricing_type,
  inventory_enabled_before: row.inventory_enabled,
  image_url: row.image_url,
  stock_decrement: 'NOT_IMPLEMENTED — catalog linkage only',
  status: APPLY ? 'PENDING' : 'DRY_RUN',
}

if (APPLY && row.inventory_enabled !== true) {
  const { error: updateError } = await sb
    .from('catalog_items')
    .update({
      inventory_enabled: true,
      updated_at: new Date().toISOString(),
    })
    .eq('id', row.id)
    .eq('company_id', COMPANY_ID)
    .eq('item_key', 'KIT_DESCARTAVEIS')
  report.status = updateError
    ? `UPDATE_FAIL:${updateError.message}`
    : 'ENABLED'
} else if (row.inventory_enabled === true) {
  report.status = 'ALREADY_ENABLED'
}

writeFileSync(
  join(ROOT, 'assets/additionals/kit-inventory-link.json'),
  JSON.stringify(report, null, 2),
)
console.log(JSON.stringify(report, null, 2))
if (String(report.status).includes('FAIL')) process.exit(1)
