/**
 * DEV-only: compose + upload missing public catalog images.
 * Updates only image_url / image_status / image_notes / updated_at.
 *
 *   node scripts/dev/upload-cdl-missing-catalog-media-20260829.mjs
 *   node scripts/dev/upload-cdl-missing-catalog-media-20260829.mjs --apply
 */
import { createClient } from '@supabase/supabase-js'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { assertDevUrl, loadDevEnv } from './loadDevEnv.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const COMPANY_ID = '65fd576f-8d97-49ba-bf38-61bc1e94e94a'
const APPLY = process.argv.includes('--apply')
const STAMP = '20260829'
const RAW_DIR = '/opt/cursor/artifacts/assets'
const COMPOSE = join(ROOT, 'scripts/dev/compose-additional-clean-asset.py')
const OUT_DIR = join(ROOT, 'assets/additionals/missing-20260829')
const GRILL_SOURCE = join(
  ROOT,
  'public/cdl/additionals/cdl-operational-grill.webp',
)

const GENERATED = [
  'ITEM_CARANGUEJO_REI',
  'ITEM_CHIMICHURRI',
  'ITEM_FILE_MIGNON_BOVINO',
  'ITEM_FILE_MIGNON_PORCO',
  'CDL_WAITER_SERVICE',
  'ITEM_067',
  'ITEM_061',
  'KIT_DESCARTAVEIS',
  'ITEM_060',
  'ITEM_066',
  'ITEM_PURE_DE_BATATA',
]

const env = loadDevEnv(ROOT)
assertDevUrl(env.url)
if (!env.service) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY')
  process.exit(2)
}

const sb = createClient(env.url, env.service, {
  auth: { persistSession: false, autoRefreshToken: false },
})

mkdirSync(OUT_DIR, { recursive: true })

const keys = [...GENERATED, 'ITEM_084']
const { data: items, error } = await sb
  .from('catalog_items')
  .select(
    'id, item_key, label_pt, price, charge_type, pricing_type, image_url, image_status, active, customer_visible',
  )
  .eq('company_id', COMPANY_ID)
  .in('item_key', keys)

if (error) {
  console.error(error.message)
  process.exit(1)
}

const byKey = Object.fromEntries((items ?? []).map((row) => [row.item_key, row]))
const map = []

function composeLocal(rawPath, localFile) {
  execFileSync('python3', [COMPOSE, rawPath, localFile], { stdio: 'pipe' })
  return readFileSync(localFile)
}

for (const itemKey of GENERATED) {
  const row = byKey[itemKey]
  if (!row) {
    map.push({ item_key: itemKey, status: 'MISSING_ROW' })
    continue
  }
  const rawPath = join(RAW_DIR, `${itemKey}_raw.png`)
  if (!existsSync(rawPath)) {
    map.push({ item_key: itemKey, status: 'MISSING_RAW', id: row.id })
    continue
  }
  const localFile = join(OUT_DIR, `${itemKey}_clean_v1_${STAMP}.webp`)
  const bytes = composeLocal(rawPath, localFile)
  const objectPath = `${COMPANY_ID}/${itemKey}_clean_v1_${STAMP}.webp`
  const entry = {
    id: row.id,
    item_key: itemKey,
    label_pt: row.label_pt,
    price_unchanged: row.price,
    local_file: localFile.replace(`${ROOT}/`, ''),
    local_bytes: bytes.length,
    old_image_url: row.image_url,
    old_image_status: row.image_status,
    new_object_path: objectPath,
    status: APPLY ? 'UPLOADED' : 'COMPOSED',
  }

  if (APPLY) {
    const { error: uploadError } = await sb.storage
      .from('additional-item-images')
      .upload(objectPath, bytes, {
        contentType: 'image/webp',
        upsert: false,
        cacheControl: '3600',
      })
    if (uploadError) {
      entry.status = `UPLOAD_FAIL:${uploadError.message}`
      map.push(entry)
      continue
    }
    const { data: urlData } = sb.storage
      .from('additional-item-images')
      .getPublicUrl(objectPath)
    const { error: updateError } = await sb
      .from('catalog_items')
      .update({
        image_url: urlData.publicUrl,
        image_status: 'ready',
        image_notes: `Clean CDL extras asset v1 ${STAMP} (official emblem overlay)`,
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

  map.push(entry)
  console.log(entry.status, itemKey, entry.local_bytes)
}

const grillRow = byKey.ITEM_084
if (!grillRow) {
  map.push({ item_key: 'ITEM_084', status: 'MISSING_ROW' })
} else if (!existsSync(GRILL_SOURCE)) {
  map.push({ item_key: 'ITEM_084', status: 'MISSING_REAL_SOURCE' })
} else {
  const localFile = join(OUT_DIR, `ITEM_084_grill_tent_real_v1_${STAMP}.webp`)
  const bytes = composeLocal(GRILL_SOURCE, localFile)
  const objectPath = `${COMPANY_ID}/ITEM_084_grill_tent_real_v1_${STAMP}.webp`
  const entry = {
    id: grillRow.id,
    item_key: 'ITEM_084',
    label_pt: grillRow.label_pt,
    price_unchanged: grillRow.price,
    real_source: GRILL_SOURCE.replace(`${ROOT}/`, ''),
    local_file: localFile.replace(`${ROOT}/`, ''),
    local_bytes: bytes.length,
    old_image_url: grillRow.image_url,
    old_image_status: grillRow.image_status,
    new_object_path: objectPath,
    status: APPLY ? 'UPLOADED' : 'COMPOSED',
  }
  if (APPLY) {
    const { error: uploadError } = await sb.storage
      .from('additional-item-images')
      .upload(objectPath, bytes, {
        contentType: 'image/webp',
        upsert: false,
        cacheControl: '3600',
      })
    if (uploadError) {
      entry.status = `UPLOAD_FAIL:${uploadError.message}`
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
            'Real CDL grill/tent asset approved for rental item.',
          updated_at: new Date().toISOString(),
        })
        .eq('id', grillRow.id)
        .eq('company_id', COMPANY_ID)
      if (updateError) {
        entry.status = `UPDATE_FAIL:${updateError.message}`
      } else {
        entry.new_image_url = urlData.publicUrl
        entry.status = 'ASSOCIATED'
      }
    }
  }
  map.push(entry)
  console.log(entry.status, 'ITEM_084', entry.local_bytes)
}

const report = join(OUT_DIR, `upload-map-${STAMP}.json`)
writeFileSync(report, JSON.stringify(map, null, 2))
console.log('wrote', report)
const failed = map.filter((row) => String(row.status).includes('FAIL') || row.status.startsWith('MISSING'))
if (failed.length) {
  console.error('failed', failed)
  process.exit(1)
}
if (!APPLY) console.log('dry-run — pass --apply to upload DEV storage')
