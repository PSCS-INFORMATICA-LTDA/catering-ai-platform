/**
 * DEV-only: overlay official CDL emblem and upload new additional-item
 * images. Does not overwrite previous storage objects. Updates only
 * image_url / image_status / image_notes / updated_at by catalog item id.
 *
 *   node scripts/dev/upload-cdl-additional-clean-assets.mjs
 *   node scripts/dev/upload-cdl-additional-clean-assets.mjs --apply
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
const STAMP = '20260820'
const RAW_DIR = '/opt/cursor/artifacts/assets'
const COMPOSE = join(ROOT, 'scripts/dev/compose-additional-clean-asset.py')
const OUT_DIR = join(ROOT, 'assets/additionals')

const CATEGORY_DIRS = {
  BOVINO_TRADICIONAL: 'bovino-tradicional',
  LINGUICAS: 'linguicas',
  FRANGO: 'frango',
  PORCO: 'porco',
  CORDEIRO: 'cordeiro',
  PEIXES: 'peixes',
  ACOMPANHAMENTOS: 'acompanhamentos',
  GUARNICOES: 'guarnicoes',
  LEGUMES_E_VEGETAIS: 'legumes',
  FRUTAS: 'frutas',
  EQUIPAMENTOS: 'equipamentos',
}

const env = loadDevEnv(ROOT)
assertDevUrl(env.url)
if (!env.service) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY')
  process.exit(2)
}

const sb = createClient(env.url, env.service, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const { data: items, error } = await sb
  .from('catalog_items')
  .select(
    'id, item_key, label_pt, category_key, image_url, image_status, price, charge_type, pricing_type, unit_label, can_be_additional, customer_visible, active',
  )
  .eq('company_id', COMPANY_ID)
  .eq('active', true)
  .eq('customer_visible', true)
  .eq('can_be_additional', true)

if (error) {
  console.error(error.message)
  process.exit(1)
}

const map = []

for (const row of items ?? []) {
  const current = row.image_url || ''
  if (current.includes('_clean_') || current.includes('additional-item-images')) {
    continue
  }
  const rawCandidates = [
    join(RAW_DIR, `${row.item_key}_raw.png`),
    ...[
      'picanha_angus',
      'alcatra',
      'costela_bovina',
      'fraldinha_angus',
      'hamburguer',
      'assado_tiras',
    ].map((slug) => join(RAW_DIR, `${row.item_key}_${slug}_raw.png`)),
  ]
  // Prefer files that start with the exact item_key.
  const matches = []
  try {
    const { readdirSync } = await import('node:fs')
    for (const name of readdirSync(RAW_DIR)) {
      if (name.startsWith(`${row.item_key}_`) && name.endsWith('_raw.png')) {
        matches.push(join(RAW_DIR, name))
      }
    }
  } catch {
    /* ignore */
  }
  const rawPath = matches[0] || rawCandidates.find((path) => existsSync(path))
  if (!rawPath || !existsSync(rawPath)) {
    map.push({
      id: row.id,
      item_key: row.item_key,
      status: 'MISSING_RAW',
      old_image_url: row.image_url,
    })
    continue
  }

  const catDir = CATEGORY_DIRS[row.category_key] || 'misc'
  const localDir = join(OUT_DIR, catDir)
  mkdirSync(localDir, { recursive: true })
  const slug = String(row.item_key)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
  const localFile = join(localDir, `${slug}-clean.webp`)
  execFileSync('python3', [COMPOSE, rawPath, localFile], { stdio: 'pipe' })
  const bytes = readFileSync(localFile)
  const objectPath = `${COMPANY_ID}/${row.item_key}_clean_v1_${STAMP}.webp`

  const entry = {
    id: row.id,
    item_key: row.item_key,
    category: row.category_key,
    label_pt: row.label_pt,
    kind: 'generated',
    local_file: localFile.replace(`${ROOT}/`, ''),
    local_bytes: bytes.length,
    old_image_url: row.image_url,
    new_object_path: objectPath,
    price_unchanged: row.price,
    charge_type_unchanged: row.charge_type,
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
    const publicUrl = urlData.publicUrl
    const { error: updateError } = await sb
      .from('catalog_items')
      .update({
        image_url: publicUrl,
        image_status: 'ready',
        image_notes: 'Clean CDL extras asset v1 20260820 (official emblem overlay)',
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id)
      .eq('company_id', COMPANY_ID)
    if (updateError) {
      entry.status = `UPDATE_FAIL:${updateError.message}`
    } else {
      entry.new_image_url = publicUrl
      entry.status = 'ASSOCIATED'
    }
  }

  map.push(entry)
  console.log(entry.status, row.item_key, entry.local_bytes)
}

const outPath = join(ROOT, 'assets/additionals/clean-upload-map-20260820.json')
writeFileSync(outPath, JSON.stringify(map, null, 2))
console.log(`wrote ${outPath} rows=${map.length}`)
const missing = map.filter((row) => row.status === 'MISSING_RAW')
const failed = map.filter((row) => String(row.status).includes('FAIL'))
if (missing.length || failed.length) {
  console.error('missing', missing.length, 'failed', failed.length)
  process.exit(1)
}
if (!APPLY) console.log('dry-run — pass --apply to upload DEV storage')
