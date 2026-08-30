/**
 * DEV-only editorial cleanup of CDL catalog / package display labels.
 *
 * Never touches PROD. Never rewrites historical quote snapshots.
 * Never changes prices, keys, ids, flags, quantities, or package structure.
 *
 *   node --experimental-strip-types scripts/dev/apply-cdl-catalog-display-labels.mjs
 *   node --experimental-strip-types scripts/dev/apply-cdl-catalog-display-labels.mjs --apply
 */
import { createClient } from '@supabase/supabase-js'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  formatCatalogDisplayLabel,
  isCatalogInternalKey,
} from '../../Lib/publicQuote/catalogDisplayName.ts'
import { assertDevUrl, loadDevEnv, DEV_REF } from './loadDevEnv.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const COMPANY_ID = '65fd576f-8d97-49ba-bf38-61bc1e94e94a'
const APPLY = process.argv.includes('--apply')
const NOW = new Date().toISOString()

const ACCENT_HINTS = [
  ['hamburguer', 'Hambúrguer'],
  ['file', 'Filé'],
  ['pao', 'Pão'],
  ['pure', 'Purê'],
  ['feijao', 'Feijão'],
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

async function must(label, query) {
  const { data, error } = await query
  if (error) throw new Error(`${label}: ${error.message}`)
  return data ?? []
}

function sameText(a, b) {
  return String(a ?? '') === String(b ?? '')
}

function looksLikeDisplayName(value) {
  const trimmed = String(value ?? '').trim()
  if (!trimmed) return false
  return !isCatalogInternalKey(trimmed)
}

function isQaOrFixtureRow(row) {
  const category = String(row.category_key || '').toLowerCase()
  if (category.startsWith('qa_')) return true
  const key = String(row.item_key || '').toUpperCase()
  if (key.startsWith('DEV_') || key.startsWith('TEST-') || key.startsWith('TEST_')) return true
  const text = `${row.item_name || ''} ${row.label_pt || ''}`
  return /QA INV|QA JDE|JDE QA|TEST-DEV|TESTE DEV/i.test(text) || /^JDE\b/i.test(String(row.label_pt || ''))
}

function accentHints(label) {
  if (!label) return []
  return String(label)
    .split(/\s+/)
    .flatMap((token) => {
      const hasAccent = /[\u0300-\u036f]/.test(token.normalize('NFD'))
      if (hasAccent) return []
      const plain = token
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z]/g, '')
      return ACCENT_HINTS.filter(([candidate]) => candidate === plain).map(([, hint]) => hint)
    })
}

function nextLabels(row, { includeItemName = false } = {}) {
  const next = {}
  const pt = row.label_pt == null ? null : formatCatalogDisplayLabel(row.label_pt, 'pt')
  const en = row.label_en == null ? null : formatCatalogDisplayLabel(row.label_en, 'en')
  const es = row.label_es == null ? null : formatCatalogDisplayLabel(row.label_es, 'es')
  if (row.label_pt != null && !sameText(row.label_pt, pt)) next.label_pt = pt
  if (row.label_en != null && !sameText(row.label_en, en)) next.label_en = en
  if (row.label_es != null && !sameText(row.label_es, es)) next.label_es = es
  if (includeItemName && looksLikeDisplayName(row.item_name)) {
    const name = formatCatalogDisplayLabel(row.item_name, 'pt')
    if (!sameText(row.item_name, name)) next.item_name = name
  }
  return next
}

function snapshotFingerprint(row, columns) {
  return Object.fromEntries(columns.map((column) => [column, row[column] ?? null]))
}

function sortedFingerprints(rows, columns) {
  return rows
    .map((row) => snapshotFingerprint(row, columns))
    .sort((a, b) => String(a.id).localeCompare(String(b.id)))
}

const catalogRows = await must(
  'catalog_items',
  sb
    .from('catalog_items')
    .select(
      'id, company_id, item_key, item_name, label_pt, label_en, label_es, category_key, active, customer_visible, can_be_package_item, can_be_side_item, can_be_additional, can_be_option_choice, inventory_enabled, price, sale_price, cost_price',
    )
    .eq('company_id', COMPANY_ID),
)

const packageItemRows = await must(
  'package_items',
  sb
    .from('package_items')
    .select(
      'id, company_id, package_id, item_key, additional_item_id, item_name, label_pt, label_en, label_es, active, included, blocks_additional_item, quantity',
    )
    .eq('company_id', COMPANY_ID),
)

const optionItemRows = await must(
  'package_option_group_items',
  sb
    .from('package_option_group_items')
    .select(
      'id, company_id, option_group_id, option_item_key, additional_item_id, label_pt, label_en, label_es, active, price_delta',
    )
    .eq('company_id', COMPANY_ID),
)

const sideItemRows = await must(
  'package_side_items',
  sb
    .from('package_side_items')
    .select(
      'id, company_id, package_id, item_key, additional_item_id, item_name, label_pt, label_en, label_es, active, included, blocks_additional_item, quantity',
    )
    .eq('company_id', COMPANY_ID),
)

const priceRows = await must(
  'catalog_item_prices',
  sb
    .from('catalog_item_prices')
    .select('id, catalog_item_id, amount, price_type, pricing_type, charge_type, active')
    .eq('company_id', COMPANY_ID),
)

async function countOrZero(table) {
  const { count, error } = await sb
    .from(table)
    .select('id', { count: 'exact', head: true })
    .eq('company_id', COMPANY_ID)
  if (error) {
    console.warn(`count ${table}: ${error.message}`)
    return null
  }
  return count ?? 0
}

const historicalCountsBefore = {
  quote_items: await countOrZero('quote_items'),
  quote_package_items: await countOrZero('quote_package_items'),
  quote_option_selections: await countOrZero('quote_option_selections'),
}

function collectChanges(sourceTable, rows, options) {
  return rows
    .filter((row) => !isQaOrFixtureRow(row))
    .map((row) => {
      const changes = nextLabels(row, options)
      if (Object.keys(changes).length === 0) return null
      return {
        SOURCE_TABLE: sourceTable,
        ID: row.id,
        ITEM_KEY: row.item_key ?? row.option_item_key ?? null,
        CATEGORY_KEY: row.category_key ?? null,
        OLD_PT: row.label_pt ?? null,
        NEW_PT: changes.label_pt ?? row.label_pt ?? null,
        OLD_EN: row.label_en ?? null,
        NEW_EN: changes.label_en ?? row.label_en ?? null,
        OLD_ES: row.label_es ?? null,
        NEW_ES: changes.label_es ?? row.label_es ?? null,
        OLD_ITEM_NAME: row.item_name ?? null,
        NEW_ITEM_NAME: changes.item_name ?? row.item_name ?? null,
        ACTIVE: row.active ?? null,
        ACCENT_HINTS: accentHints(changes.label_pt ?? row.label_pt),
        CHANGES: changes,
      }
    })
    .filter(Boolean)
}

const changes = {
  catalog_items: collectChanges('catalog_items', catalogRows, { includeItemName: true }),
  package_items: collectChanges('package_items', packageItemRows, { includeItemName: true }),
  package_option_group_items: collectChanges('package_option_group_items', optionItemRows),
  package_side_items: collectChanges('package_side_items', sideItemRows, {
    includeItemName: true,
  }),
}

const allChanges = Object.values(changes).flat()
const preview = {
  at: NOW,
  project: DEV_REF,
  company_id: COMPANY_ID,
  apply: APPLY,
  rows_audited: {
    catalog_items: catalogRows.length,
    package_items: packageItemRows.length,
    package_option_group_items: optionItemRows.length,
    package_side_items: sideItemRows.length,
  },
  rows_changing: {
    catalog_items: changes.catalog_items.length,
    package_items: changes.package_items.length,
    package_option_group_items: changes.package_option_group_items.length,
    package_side_items: changes.package_side_items.length,
  },
  historical_quote_rows_before: historicalCountsBefore,
  price_rows_audited: priceRows.length,
  accent_hints: allChanges.filter((row) => row.ACCENT_HINTS.length > 0).map((row) => ({
    SOURCE_TABLE: row.SOURCE_TABLE,
    ITEM_KEY: row.ITEM_KEY,
    NEW_PT: row.NEW_PT,
    ACCENT_HINTS: row.ACCENT_HINTS,
  })),
  diffs: allChanges.map(({ CHANGES, ...row }) => row),
}

const outDir = join(ROOT, 'docs/qa/snapshots')
mkdirSync(outDir, { recursive: true })
const stamp = NOW.replace(/[:.]/g, '-')
const previewPath = join(outDir, `cdl-catalog-display-labels-${stamp}.json`)
writeFileSync(previewPath, JSON.stringify(preview, null, 2))

console.log(`preview ${previewPath}`)
console.log(`audited catalog_items=${catalogRows.length} package_items=${packageItemRows.length} option_items=${optionItemRows.length} side_items=${sideItemRows.length}`)
console.log(`changing catalog_items=${changes.catalog_items.length} package_items=${changes.package_items.length} option_items=${changes.package_option_group_items.length} side_items=${changes.package_side_items.length}`)
console.log('--- DIFFS ---')
for (const row of allChanges) {
  console.log(
    [
      row.SOURCE_TABLE,
      row.ID,
      row.ITEM_KEY ?? '',
      row.CATEGORY_KEY ?? '',
      `PT:${JSON.stringify(row.OLD_PT)}=>${JSON.stringify(row.NEW_PT)}`,
      `EN:${JSON.stringify(row.OLD_EN)}=>${JSON.stringify(row.NEW_EN)}`,
      `ES:${JSON.stringify(row.OLD_ES)}=>${JSON.stringify(row.NEW_ES)}`,
      row.ACTIVE === false ? 'inactive' : 'active',
    ].join('\t'),
  )
}

if (allChanges.length === 0) {
  console.log('ZERO label changes')
}

if (!APPLY) {
  console.log('dry-run — pass --apply to write DEV labels only')
  process.exit(0)
}

const CATALOG_INVARIANT_COLS = [
  'id',
  'item_key',
  'active',
  'customer_visible',
  'can_be_package_item',
  'can_be_side_item',
  'can_be_additional',
  'can_be_option_choice',
  'inventory_enabled',
  'price',
  'sale_price',
  'cost_price',
]
const PACKAGE_INVARIANT_COLS = [
  'id',
  'item_key',
  'additional_item_id',
  'active',
  'included',
  'blocks_additional_item',
  'quantity',
]
const OPTION_INVARIANT_COLS = [
  'id',
  'option_item_key',
  'additional_item_id',
  'active',
  'price_delta',
]
const PRICE_INVARIANT_COLS = ['id', 'catalog_item_id', 'amount', 'active']

const invariantBefore = {
  catalog: sortedFingerprints(catalogRows, CATALOG_INVARIANT_COLS),
  packageItems: sortedFingerprints(packageItemRows, PACKAGE_INVARIANT_COLS),
  optionItems: sortedFingerprints(optionItemRows, OPTION_INVARIANT_COLS),
  sideItems: sortedFingerprints(sideItemRows, PACKAGE_INVARIANT_COLS),
  prices: sortedFingerprints(priceRows, PRICE_INVARIANT_COLS),
}

async function applyChanges(table, rows) {
  for (const row of rows) {
    const { error } = await sb
      .from(table)
      .update({ ...row.CHANGES, updated_at: NOW })
      .eq('company_id', COMPANY_ID)
      .eq('id', row.ID)
    if (error) throw new Error(`${table}.update ${row.ID}: ${error.message}`)
  }
}

await applyChanges('catalog_items', changes.catalog_items)
await applyChanges('package_items', changes.package_items)
await applyChanges('package_option_group_items', changes.package_option_group_items)
await applyChanges('package_side_items', changes.package_side_items)

const afterCatalog = await must(
  'catalog_items.after',
  sb
    .from('catalog_items')
    .select(
      'id, company_id, item_key, item_name, label_pt, label_en, label_es, category_key, active, customer_visible, can_be_package_item, can_be_side_item, can_be_additional, can_be_option_choice, inventory_enabled, price, sale_price, cost_price',
    )
    .eq('company_id', COMPANY_ID),
)
const afterPackageItems = await must(
  'package_items.after',
  sb
    .from('package_items')
    .select(
      'id, company_id, package_id, item_key, additional_item_id, item_name, label_pt, label_en, label_es, active, included, blocks_additional_item, quantity',
    )
    .eq('company_id', COMPANY_ID),
)
const afterOptionItems = await must(
  'package_option_group_items.after',
  sb
    .from('package_option_group_items')
    .select(
      'id, company_id, option_group_id, option_item_key, additional_item_id, label_pt, label_en, label_es, active, price_delta',
    )
    .eq('company_id', COMPANY_ID),
)
const afterSideItems = await must(
  'package_side_items.after',
  sb
    .from('package_side_items')
    .select(
      'id, company_id, package_id, item_key, additional_item_id, item_name, label_pt, label_en, label_es, active, included, blocks_additional_item, quantity',
    )
    .eq('company_id', COMPANY_ID),
)
const afterPrices = await must(
  'catalog_item_prices.after',
  sb
    .from('catalog_item_prices')
    .select('id, catalog_item_id, amount, price_type, pricing_type, charge_type, active')
    .eq('company_id', COMPANY_ID),
)

function assertSame(label, before, after) {
  const left = JSON.stringify(before)
  const right = JSON.stringify(after)
  if (left !== right) {
    throw new Error(`INVARIANCE FAIL ${label}`)
  }
}

assertSame(
  'catalog invariants',
  invariantBefore.catalog,
  sortedFingerprints(afterCatalog, CATALOG_INVARIANT_COLS),
)
assertSame(
  'package_items invariants',
  invariantBefore.packageItems,
  sortedFingerprints(afterPackageItems, PACKAGE_INVARIANT_COLS),
)
assertSame(
  'option_items invariants',
  invariantBefore.optionItems,
  sortedFingerprints(afterOptionItems, OPTION_INVARIANT_COLS),
)
assertSame(
  'side_items invariants',
  invariantBefore.sideItems,
  sortedFingerprints(afterSideItems, PACKAGE_INVARIANT_COLS),
)
assertSame(
  'prices',
  invariantBefore.prices,
  sortedFingerprints(afterPrices, PRICE_INVARIANT_COLS),
)

const secondPass = [
  ...collectChanges('catalog_items', afterCatalog, { includeItemName: true }),
  ...collectChanges('package_items', afterPackageItems, { includeItemName: true }),
  ...collectChanges('package_option_group_items', afterOptionItems),
  ...collectChanges('package_side_items', afterSideItems, { includeItemName: true }),
]

if (secondPass.length > 0) {
  console.error('IDEMPOTENCY FAIL', JSON.stringify(secondPass, null, 2))
  process.exit(1)
}

const historicalCountsAfter = {
  quote_items: await countOrZero('quote_items'),
  quote_package_items: await countOrZero('quote_package_items'),
  quote_option_selections: await countOrZero('quote_option_selections'),
}

console.log('APPLY_OK')
console.log(`ROWS_CHANGED_CATALOG_ITEMS ${changes.catalog_items.length}`)
console.log(`ROWS_CHANGED_PACKAGE_ITEMS ${changes.package_items.length}`)
console.log(`ROWS_CHANGED_OPTION_ITEMS ${changes.package_option_group_items.length}`)
console.log(`ROWS_CHANGED_SIDE_ITEMS ${changes.package_side_items.length}`)
console.log('PRICE_ROWS_CHANGED 0')
console.log('ITEM_KEYS_CHANGED 0')
console.log('ITEM_IDS_CHANGED 0')
console.log('FLAGS_CHANGED 0')
console.log('HISTORICAL_QUOTE_ROWS_CHANGED 0')
console.log(`HISTORICAL_COUNTS ${JSON.stringify({ before: historicalCountsBefore, after: historicalCountsAfter })}`)
console.log('IDEMPOTENCY PASS')
