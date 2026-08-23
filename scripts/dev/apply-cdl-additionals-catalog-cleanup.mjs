/**
 * DEV-only: snapshot + hide CDL catalog fixtures from the public extras
 * catalog, and correct package_items.additional_item_id identity links.
 *
 * Never touches PROD. Does not change prices, names, UOM, or translations.
 *
 *   node scripts/dev/apply-cdl-additionals-catalog-cleanup.mjs
 *   node scripts/dev/apply-cdl-additionals-catalog-cleanup.mjs --apply
 */
import { createClient } from '@supabase/supabase-js'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { assertDevUrl, loadDevEnv } from './loadDevEnv.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const COMPANY_ID = '65fd576f-8d97-49ba-bf38-61bc1e94e94a'
const APPLY = process.argv.includes('--apply')

const FIXTURE_ITEM_IDS = [
  'd1000000-0000-4000-8000-000000000001', // DEV_PICANHA
  'd1000000-0000-4000-8000-000000000002', // DEV_LINGUICA
  'd1000000-0000-4000-8000-000000000003', // DEV_FAROFA
  'd1000000-0000-4000-8000-000000000004', // DEV_REFRI
  'd2000000-0000-4000-8000-000000000001', // TEST-DEV-ITEM-BEEF
  'd2000000-0000-4000-8000-000000000002', // TEST-DEV-ITEM-CHICKEN
  'd2000000-0000-4000-8000-000000000003', // TEST-DEV-ITEM-RICE
  'd2000000-0000-4000-8000-000000000004', // TEST-DEV-ITEM-SALAD
  'd2000000-0000-4000-8000-000000000005', // TEST-DEV-ITEM-BREAD
  'd2000000-0000-4000-8000-000000000006', // TEST-DEV-ITEM-SETUP
  'd2000000-0000-4000-8000-000000000011', // TEST-DEV-ADD-DESSERT
  'd2000000-0000-4000-8000-000000000012', // TEST-DEV-ADD-TABLE
  'd2000000-0000-4000-8000-000000000013', // TEST-DEV-ADD-TRAVEL
  'd2000000-0000-4000-8000-000000000014', // TEST-DEV-ADD-STAFF
  'c2600000-0000-4000-8000-0000000000b2', // TEST-DEV-ADDITIONAL-BOM
]

const FRALDINHA_WAGYU_ID = '404c667b-0605-48b8-9ca3-07b510be23bc'
const FRALDINHA_ANGUS_ID = '768c6e24-d24c-4cca-9ca3-35e7a789f54b'
const LINGUICA_FRANGO_ID = 'fe25605a-1035-40c8-ba96-e96c8bd6f6cc'
const FRANGO_SOBRECOXA_ID = '19e12f51-fc29-4940-9066-bd93f2d48b30'

const env = loadDevEnv(ROOT)
assertDevUrl(env.url)
if (!env.service) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY')
  process.exit(2)
}

const sb = createClient(env.url, env.service, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const { data: items, error: itemsError } = await sb
  .from('catalog_items')
  .select(
    'id, item_key, item_name, label_pt, category_key, active, customer_visible, can_be_additional, price, charge_type, image_url, image_status',
  )
  .eq('company_id', COMPANY_ID)
  .in('id', FIXTURE_ITEM_IDS)

if (itemsError) {
  console.error(itemsError.message)
  process.exit(1)
}

const { data: fraldinhaRows, error: fraldinhaError } = await sb
  .from('package_items')
  .select('id, package_id, item_key, additional_item_id, blocks_additional_item')
  .eq('company_id', COMPANY_ID)
  .eq('item_key', 'FRALDINHA')
  .eq('additional_item_id', FRALDINHA_WAGYU_ID)

if (fraldinhaError) {
  console.error(fraldinhaError.message)
  process.exit(1)
}

const { data: frangoRows, error: frangoError } = await sb
  .from('package_items')
  .select('id, package_id, item_key, additional_item_id, blocks_additional_item')
  .eq('company_id', COMPANY_ID)
  .eq('item_key', 'FRANGO')
  .eq('additional_item_id', LINGUICA_FRANGO_ID)

if (frangoError) {
  console.error(frangoError.message)
  process.exit(1)
}

const snapshot = {
  at: new Date().toISOString(),
  project: 'yasprgtlqclwsjcshtls',
  company_id: COMPANY_ID,
  apply: APPLY,
  fixtures: items ?? [],
  remaps: {
    fraldinha: {
      from: FRALDINHA_WAGYU_ID,
      to: FRALDINHA_ANGUS_ID,
      rows: fraldinhaRows ?? [],
      reason:
        'package_items.item_key FRALDINHA was linked to catalog ITEM_010 (BOVINO_NOBRE Wagyu). Canonical traditional SKU is ITEM_004.',
    },
    frango: {
      from: LINGUICA_FRANGO_ID,
      to: FRANGO_SOBRECOXA_ID,
      rows: frangoRows ?? [],
      reason:
        'package_items.item_key FRANGO was linked to catalog ITEM_024 (LINGUICAS). The sausage slot is ITEM_LINGUICA_TOSCANA_TRADICIONAL; chicken SKU is ITEM_FRANGO_SOBRECOXA.',
    },
  },
}

const outDir = join(ROOT, 'docs/qa/snapshots')
mkdirSync(outDir, { recursive: true })
const stamp = snapshot.at.replace(/[:.]/g, '-')
const snapshotPath = join(
  outDir,
  `cdl-additionals-cleanup-${stamp}.json`,
)
writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2))
console.log(`snapshot ${snapshotPath}`)
console.log(`fixtures to hide: ${(items ?? []).length}`)
console.log(`FRALDINHA remaps: ${(fraldinhaRows ?? []).length}`)
console.log(`FRANGO remaps: ${(frangoRows ?? []).length}`)

if (!APPLY) {
  console.log('dry-run — pass --apply to write DEV')
  process.exit(0)
}

const now = new Date().toISOString()
const { error: hideError } = await sb
  .from('catalog_items')
  .update({
    customer_visible: false,
    can_be_additional: false,
    updated_at: now,
  })
  .eq('company_id', COMPANY_ID)
  .in('id', FIXTURE_ITEM_IDS)

if (hideError) {
  console.error('hide fixtures failed', hideError.message)
  process.exit(1)
}

if ((fraldinhaRows ?? []).length > 0) {
  const { error } = await sb
    .from('package_items')
    .update({ additional_item_id: FRALDINHA_ANGUS_ID })
    .eq('company_id', COMPANY_ID)
    .eq('item_key', 'FRALDINHA')
    .eq('additional_item_id', FRALDINHA_WAGYU_ID)
  if (error) {
    console.error('FRALDINHA remap failed', error.message)
    process.exit(1)
  }
}

if ((frangoRows ?? []).length > 0) {
  const { error } = await sb
    .from('package_items')
    .update({ additional_item_id: FRANGO_SOBRECOXA_ID })
    .eq('company_id', COMPANY_ID)
    .eq('item_key', 'FRANGO')
    .eq('additional_item_id', LINGUICA_FRANGO_ID)
  if (error) {
    console.error('FRANGO remap failed', error.message)
    process.exit(1)
  }
}

const { data: stillPublic, error: verifyError } = await sb
  .from('catalog_items')
  .select('id, item_key, customer_visible, can_be_additional')
  .eq('company_id', COMPANY_ID)
  .in('id', FIXTURE_ITEM_IDS)

if (verifyError) {
  console.error(verifyError.message)
  process.exit(1)
}

const leaked = (stillPublic ?? []).filter(
  (row) => row.customer_visible === true || row.can_be_additional === true,
)
if (leaked.length > 0) {
  console.error('fixture still public', leaked)
  process.exit(1)
}

console.log('DEV cleanup applied — fixtures hidden, identity remaps written')
console.log('PACKAGE PRICING CHANGED: NO')
console.log('ADDITIONAL PRICE VALUES CHANGED: NO')
