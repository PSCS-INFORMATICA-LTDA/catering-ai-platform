/**
 * DEV-only: replace ITEM_061 (GOIABADA) image.
 * Updates only image_url / image_status / image_notes / updated_at.
 *
 *   node scripts/dev/upload-cdl-goiabada-item-061-20260830.mjs
 *   node scripts/dev/upload-cdl-goiabada-item-061-20260830.mjs --apply
 */
import { createClient } from '@supabase/supabase-js'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { assertDevUrl, loadDevEnv } from './loadDevEnv.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const COMPANY_ID = '65fd576f-8d97-49ba-bf38-61bc1e94e94a'
const ITEM_KEY = 'ITEM_061'
const APPLY = process.argv.includes('--apply')
const STAMP = '20260830'
const COMPOSE = join(ROOT, 'scripts/dev/compose-additional-clean-asset.py')
const RAW_CANDIDATES = [
  join('/opt/cursor/artifacts/assets', 'ITEM_061_goiabada_raw.png'),
  join(ROOT, 'assets/additionals/goiabada-20260830', 'ITEM_061_goiabada_raw.png'),
]
const OUT_DIR = join(ROOT, 'assets/additionals/goiabada-20260830')

const env = loadDevEnv(ROOT)
assertDevUrl(env.url)
if (!env.service) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY')
  process.exit(2)
}

const rawPath = RAW_CANDIDATES.find((path) => existsSync(path))
if (!rawPath) {
  console.error('Missing goiabada raw photo')
  process.exit(2)
}

const sb = createClient(env.url, env.service, {
  auth: { persistSession: false, autoRefreshToken: false },
})

mkdirSync(OUT_DIR, { recursive: true })
const localFile = join(OUT_DIR, `ITEM_061_clean_v2_${STAMP}.webp`)
execFileSync('python3', [COMPOSE, rawPath, localFile], { stdio: 'pipe' })
const bytes = readFileSync(localFile)

const { data: rows, error } = await sb
  .from('catalog_items')
  .select(
    'id, item_key, label_pt, label_en, price, category_key, pricing_type, charge_type, image_url, image_status, image_notes, active, customer_visible',
  )
  .eq('company_id', COMPANY_ID)
  .eq('item_key', ITEM_KEY)

if (error) {
  console.error(error.message)
  process.exit(1)
}
const row = rows?.[0]
if (!row) {
  console.error('ITEM_061 missing')
  process.exit(1)
}

const objectPath = `${COMPANY_ID}/ITEM_061_clean_v2_${STAMP}.webp`
const report = {
  item_key: ITEM_KEY,
  id: row.id,
  label_pt: row.label_pt,
  price_before: row.price,
  category_key: row.category_key,
  pricing_type: row.pricing_type,
  charge_type: row.charge_type,
  old_image_url: row.image_url,
  old_image_status: row.image_status,
  local_file: localFile.replace(`${ROOT}/`, ''),
  local_bytes: bytes.length,
  new_object_path: objectPath,
  status: APPLY ? 'PENDING' : 'COMPOSED',
}

if (APPLY) {
  const { error: uploadError } = await sb.storage
    .from('additional-item-images')
    .upload(objectPath, bytes, {
      contentType: 'image/webp',
      upsert: true,
      cacheControl: '3600',
    })
  if (uploadError) {
    report.status = `UPLOAD_FAIL:${uploadError.message}`
  } else {
    const { data: urlData } = sb.storage
      .from('additional-item-images')
      .getPublicUrl(objectPath)
    const { error: updateError } = await sb
      .from('catalog_items')
      .update({
        image_url: urlData.publicUrl,
        image_status: 'ready',
        image_notes:
          'Brazilian goiabada / guava paste block, sliced, language-neutral CDL catalog photo v2 20260830',
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id)
      .eq('company_id', COMPANY_ID)
      .eq('item_key', ITEM_KEY)
    if (updateError) {
      report.status = `UPDATE_FAIL:${updateError.message}`
    } else {
      const { data: after, error: afterError } = await sb
        .from('catalog_items')
        .select(
          'item_key, label_pt, price, category_key, pricing_type, charge_type, image_url, image_status, image_notes',
        )
        .eq('id', row.id)
        .single()
      if (afterError) {
        report.status = `VERIFY_FAIL:${afterError.message}`
      } else {
        report.new_image_url = after.image_url
        report.image_status = after.image_status
        report.image_notes = after.image_notes
        report.price_after = after.price
        report.label_after = after.label_pt
        report.price_changed = Number(after.price) !== Number(row.price)
        report.label_changed = after.label_pt !== row.label_pt
        report.status = 'ASSOCIATED'
      }
    }
  }
}

const reportPath = join(OUT_DIR, `upload-map-${STAMP}.json`)
writeFileSync(reportPath, JSON.stringify(report, null, 2))
console.log(JSON.stringify(report, null, 2))
if (String(report.status).includes('FAIL')) process.exit(1)
