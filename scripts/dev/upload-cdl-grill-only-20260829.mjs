/**
 * DEV-only: replace ITEM_084 default image with tent-free grill.
 * Updates only image_url / image_status / image_notes / updated_at.
 *
 *   node scripts/dev/upload-cdl-grill-only-20260829.mjs
 *   node scripts/dev/upload-cdl-grill-only-20260829.mjs --apply
 */
import { createClient } from '@supabase/supabase-js'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { assertDevUrl, loadDevEnv } from './loadDevEnv.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const COMPANY_ID = '65fd576f-8d97-49ba-bf38-61bc1e94e94a'
const APPLY = process.argv.includes('--apply')
const STAMP = '20260829'
const ITEM_KEY = 'ITEM_084'
const LOCAL_FILE = join(
  ROOT,
  'assets/additionals/missing-20260829',
  `ITEM_084_grill_only_v1_${STAMP}.webp`,
)
const OBJECT_PATH = `${COMPANY_ID}/ITEM_084_grill_only_v1_${STAMP}.webp`

const env = loadDevEnv(ROOT)
assertDevUrl(env.url)
if (!env.service) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY')
  process.exit(2)
}

if (!existsSync(LOCAL_FILE)) {
  console.error('Missing composed grill asset', LOCAL_FILE)
  process.exit(1)
}

const sb = createClient(env.url, env.service, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const { data: items, error } = await sb
  .from('catalog_items')
  .select(
    'id, item_key, label_pt, price, charge_type, pricing_type, image_url, image_status, active, customer_visible',
  )
  .eq('company_id', COMPANY_ID)
  .eq('item_key', ITEM_KEY)
  .limit(1)

if (error) {
  console.error(error.message)
  process.exit(1)
}

const row = items?.[0]
if (!row) {
  console.error('ITEM_084 row missing in DEV catalog')
  process.exit(1)
}

const bytes = readFileSync(LOCAL_FILE)
const entry = {
  id: row.id,
  item_key: ITEM_KEY,
  label_pt: row.label_pt,
  price_unchanged: row.price,
  charge_type_unchanged: row.charge_type,
  pricing_type_unchanged: row.pricing_type,
  local_file: LOCAL_FILE.replace(`${ROOT}/`, ''),
  local_bytes: bytes.length,
  old_image_url: row.image_url,
  old_image_status: row.image_status,
  new_object_path: OBJECT_PATH,
  status: APPLY ? 'UPLOADED' : 'COMPOSED',
}

if (APPLY) {
  const { error: uploadError } = await sb.storage
    .from('additional-item-images')
    .upload(OBJECT_PATH, bytes, {
      contentType: 'image/webp',
      upsert: false,
      cacheControl: '3600',
    })
  if (uploadError) {
    entry.status = `UPLOAD_FAIL:${uploadError.message}`
  } else {
    const { data: urlData } = sb.storage
      .from('additional-item-images')
      .getPublicUrl(OBJECT_PATH)
    const { error: updateError } = await sb
      .from('catalog_items')
      .update({
        image_url: urlData.publicUrl,
        image_status: 'ready',
        image_notes: `Tent-free CDL grill-only catalog asset v1 ${STAMP}`,
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id)
      .eq('company_id', COMPANY_ID)
    if (updateError) {
      entry.status = `UPDATE_FAIL:${updateError.message}`
    } else {
      entry.new_image_url = urlData.publicUrl
      entry.status = 'ASSOCIATED'
    }
  }
}

const report = join(
  ROOT,
  'assets/additionals/missing-20260829',
  `ITEM_084-grill-only-upload-${STAMP}.json`,
)
writeFileSync(report, JSON.stringify(entry, null, 2))
console.log(JSON.stringify(entry, null, 2))
if (String(entry.status).includes('FAIL')) process.exit(1)
if (!APPLY) console.log('dry-run — pass --apply to upload DEV storage')
