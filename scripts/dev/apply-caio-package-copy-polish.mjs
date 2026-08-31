/**
 * DEV-only: Caio package copy polish.
 *
 * 1. Costela de Boi / Costela de Porco labels
 * 2. Commercial package order from lower to higher price,
 *    Personalized always last.
 * 3. No price / id / relationship changes
 *
 *   node --experimental-strip-types scripts/dev/apply-caio-package-copy-polish.mjs
 *   node --experimental-strip-types scripts/dev/apply-caio-package-copy-polish.mjs --apply
 */
import { createClient } from '@supabase/supabase-js'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { assertDevUrl, loadDevEnv } from './loadDevEnv.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const COMPANY_ID = '65fd576f-8d97-49ba-bf38-61bc1e94e94a'
const APPLY = process.argv.includes('--apply')
const NOW = new Date().toISOString()

const COSTELA_LABELS = {
  ITEM_003: {
    item_name: 'Costela de Boi',
    label_pt: 'Costela de Boi',
    label_en: 'Beef Ribs',
    label_es: 'Costilla de Res',
  },
  ITEM_014: {
    item_name: 'Costela de Porco',
    label_pt: 'Costela de Porco',
    label_en: 'Pork Ribs',
    label_es: 'Costilla de Cerdo',
  },
}

const PACKAGE_DISPLAY_ORDER = {
  BBQTRAD: 1,
  BBQSEL: 2,
  BBQCHO: 3,
  BBQPRI: 4,
  BBQLUX: 5,
  BBQPERS: 6,
  'BBQTRAD+': 7,
  'BBQSEL+': 8,
  'BBQCHO+': 9,
  'BBQPRI+': 10,
  'BBQLUX+': 11,
  'BBQPERS+': 12,
}

const FROZEN_PRICES = {
  BBQTRAD: 45,
  BBQSEL: 55,
  BBQCHO: 65,
  BBQPRI: 75,
  BBQLUX: 150,
  BBQPERS: 0,
  'BBQTRAD+': 58,
  'BBQSEL+': 68,
  'BBQCHO+': 78,
  'BBQPRI+': 88,
  'BBQLUX+': 163,
  'BBQPERS+': 0,
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

async function must(label, query) {
  const { data, error } = await query
  if (error) throw new Error(`${label}: ${error.message}`)
  return data ?? []
}

function fail(message) {
  console.error(message)
  process.exit(1)
}

const catalog = await must(
  'catalog_items',
  sb
    .from('catalog_items')
    .select(
      'id,item_key,item_name,label_pt,label_en,label_es,category_key,price,sale_price,active',
    )
    .eq('company_id', COMPANY_ID)
    .in('item_key', Object.keys(COSTELA_LABELS)),
)

if (catalog.length !== 2) fail(`COSTELA_CATALOG_COUNT=${catalog.length}`)

const bovine = catalog.find((row) => row.item_key === 'ITEM_003')
const pork = catalog.find((row) => row.item_key === 'ITEM_014')
if (!bovine || !pork) fail('COSTELA_ITEMS_MISSING')

const options = await must(
  'package_option_group_items',
  sb
    .from('package_option_group_items')
    .select(
      'id,option_item_key,additional_item_id,label_pt,label_en,label_es,price_delta,active',
    )
    .eq('company_id', COMPANY_ID)
    .in('additional_item_id', [bovine.id, pork.id]),
)

const packages = await must(
  'packages',
  sb
    .from('packages')
    .select('id,package_key,price_per_person,display_order,active')
    .eq('company_id', COMPANY_ID),
)

console.log('ENVIRONMENT=DEV')
console.log('COMPANY=CDL DEV')
console.log('PROD_WRITE=FORBIDDEN')
console.log('BOVINE_ITEM_ID', bovine.id)
console.log('PORK_ITEM_ID', pork.id)
console.log('BOVINE_BEFORE', bovine.label_pt, bovine.label_en, bovine.label_es)
console.log('PORK_BEFORE', pork.label_pt, pork.label_en, pork.label_es)
console.log('OPTION_COUNT', options.length)
console.log(
  'PACKAGE_ORDER_BEFORE',
  packages
    .slice()
    .sort((a, b) => Number(a.display_order) - Number(b.display_order))
    .map((row) => `${row.package_key}:${row.display_order}`)
    .join(' '),
)

if (!APPLY) {
  console.log('DRY-RUN — no writes. Re-run with --apply.')
  process.exit(0)
}

for (const row of catalog) {
  const labels = COSTELA_LABELS[row.item_key]
  const { error } = await sb
    .from('catalog_items')
    .update({
      item_name: labels.item_name,
      label_pt: labels.label_pt,
      label_en: labels.label_en,
      label_es: labels.label_es,
      updated_at: NOW,
    })
    .eq('id', row.id)
    .eq('company_id', COMPANY_ID)
  if (error) fail(`catalog_items.update ${row.item_key}: ${error.message}`)
}

for (const row of options) {
  const labels =
    row.additional_item_id === bovine.id
      ? COSTELA_LABELS.ITEM_003
      : COSTELA_LABELS.ITEM_014
  const { error } = await sb
    .from('package_option_group_items')
    .update({
      label_pt: labels.label_pt,
      label_en: labels.label_en,
      label_es: labels.label_es,
      updated_at: NOW,
    })
    .eq('id', row.id)
    .eq('company_id', COMPANY_ID)
  if (error) fail(`option_items.update ${row.id}: ${error.message}`)
}

for (const row of packages) {
  const nextOrder = PACKAGE_DISPLAY_ORDER[row.package_key]
  if (nextOrder == null) continue
  if (Number(row.display_order) === nextOrder) continue
  const { error } = await sb
    .from('packages')
    .update({ display_order: nextOrder, updated_at: NOW })
    .eq('id', row.id)
    .eq('company_id', COMPANY_ID)
  if (error) fail(`packages.update ${row.package_key}: ${error.message}`)
}

const afterCatalog = await must(
  'catalog_items.after',
  sb
    .from('catalog_items')
    .select('id,item_key,item_name,label_pt,label_en,label_es,price')
    .eq('company_id', COMPANY_ID)
    .in('item_key', Object.keys(COSTELA_LABELS)),
)
const afterBovine = afterCatalog.find((row) => row.item_key === 'ITEM_003')
const afterPork = afterCatalog.find((row) => row.item_key === 'ITEM_014')
const afterOptions = await must(
  'option_items.after',
  sb
    .from('package_option_group_items')
    .select('id,additional_item_id,label_pt,price_delta')
    .eq('company_id', COMPANY_ID)
    .in('additional_item_id', [bovine.id, pork.id]),
)
const afterPackages = await must(
  'packages.after',
  sb
    .from('packages')
    .select('id,package_key,price_per_person,display_order')
    .eq('company_id', COMPANY_ID),
)

if (afterBovine.id !== bovine.id || afterPork.id !== pork.id) {
  fail('COSTELA_IDS_CHANGED')
}
if (Number(afterBovine.price) !== 12 || Number(afterPork.price) !== 12) {
  fail('COSTELA_PRICE_CHANGED')
}
if (afterOptions.length !== options.length) fail('OPTION_COUNT_CHANGED')
if (afterOptions.some((row) => Number(row.price_delta) !== 0)) {
  fail('OPTION_PRICE_DELTA_CHANGED')
}

for (const [key, price] of Object.entries(FROZEN_PRICES)) {
  const row = afterPackages.find((pkg) => pkg.package_key === key)
  if (!row) fail(`PACKAGE_MISSING ${key}`)
  if (Number(row.price_per_person) !== price) {
    fail(`PRICE_CHANGED ${key} ${row.price_per_person}`)
  }
  if (Number(row.display_order) !== PACKAGE_DISPLAY_ORDER[key]) {
    fail(`ORDER_MISMATCH ${key} ${row.display_order}`)
  }
}

console.log('BOVINE_AFTER', afterBovine.label_pt, afterBovine.label_en, afterBovine.label_es)
console.log('PORK_AFTER', afterPork.label_pt, afterPork.label_en, afterPork.label_es)
console.log(
  'PACKAGE_ORDER_AFTER',
  afterPackages
    .slice()
    .sort((a, b) => Number(a.display_order) - Number(b.display_order))
    .map((row) => `${row.package_key}:${row.display_order}`)
    .join(' '),
)
console.log('APPLY_OK')
