/**
 * Live DEV gate: public commercial catalog matches CDL 2026 source only.
 *
 *   npm run test:dev:cdl-2026-catalog
 */
import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { assertDevUrl, loadDevEnv } from './loadDevEnv.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const COMPANY_ID = '65fd576f-8d97-49ba-bf38-61bc1e94e94a'
const env = loadDevEnv(ROOT)
assertDevUrl(env.url)

const sb = createClient(env.url, env.service, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const SOURCE_KEYS = new Set([
  'ITEM_001', 'ITEM_002', 'ITEM_003', 'ITEM_004', 'ITEM_006',
  'ITEM_007', 'ITEM_008', 'ITEM_009', 'ITEM_010', 'ITEM_011', 'ITEM_012', 'ITEM_013',
  'ITEM_014', 'ITEM_015', 'ITEM_016',
  'ITEM_017', 'ITEM_018', 'ITEM_019', 'ITEM_020', 'ITEM_021', 'ITEM_FRANGO_SOBRECOXA',
  'ITEM_024', 'ITEM_025', 'ITEM_026', 'ITEM_027', 'ITEM_028', 'ITEM_LINGUICA_TOSCANA_TRADICIONAL',
  'ITEM_031', 'ITEM_032', 'ITEM_033', 'ITEM_034', 'ITEM_035', 'ITEM_036', 'ITEM_037',
  'ITEM_038', 'ITEM_039', 'ITEM_040', 'ITEM_041', 'ITEM_042', 'ITEM_043',
  'ITEM_044', 'ITEM_045', 'ITEM_047',
  'ITEM_048', 'ITEM_049', 'ITEM_050', 'ITEM_051', 'ITEM_052', 'ITEM_053',
  'ITEM_055', 'ITEM_057_BANANA',
  'ITEM_058', 'ITEM_059', 'ITEM_060', 'ITEM_061', 'ITEM_063', 'ITEM_065',
  'ITEM_066', 'ITEM_067', 'ITEM_068', 'ITEM_069',
  'ITEM_075', 'ITEM_076', 'ITEM_077', 'ITEM_078', 'ITEM_079', 'ITEM_080',
  'ITEM_082', 'ITEM_FEIJAO_PRETO', 'ITEM_PURE_DE_BATATA',
  'ITEM_084',
  'ITEM_CHIMICHURRI', 'ITEM_FILE_MIGNON_BOVINO', 'ITEM_FILE_MIGNON_PORCO',
  'ITEM_CARANGUEJO_REI',
])

const CRITICAL = {
  ITEM_013: [400, 'PER_UNIT'],
  ITEM_012: [200, 'PER_UNIT'],
  ITEM_011: [100, 'PER_UNIT'],
  ITEM_016: [120, 'PER_UNIT'],
  ITEM_084: [100, 'PER_UNIT'],
  ITEM_010: [35, 'PER_PERSON'],
  ITEM_009: [30, 'PER_PERSON'],
  ITEM_FILE_MIGNON_BOVINO: [15, 'PER_PERSON'],
  ITEM_008: [15, 'PER_PERSON'],
  ITEM_007: [13, 'PER_PERSON'],
  ITEM_004: [15, 'PER_PERSON'],
  ITEM_001: [15, 'PER_PERSON'],
  ITEM_006: [12, 'PER_PERSON'],
  ITEM_003: [12, 'PER_PERSON'],
  ITEM_002: [10, 'PER_PERSON'],
  ITEM_CARANGUEJO_REI: [50, 'PER_PERSON'],
  ITEM_051: [30, 'PER_PERSON'],
  ITEM_053: [30, 'PER_PERSON'],
  ITEM_052: [25, 'PER_PERSON'],
  ITEM_049: [15, 'PER_PERSON'],
  ITEM_050: [12, 'PER_PERSON'],
  ITEM_048: [12, 'PER_PERSON'],
  ITEM_075: [4, 'PER_PERSON'],
  ITEM_FEIJAO_PRETO: [5, 'PER_PERSON'],
  ITEM_078: [7, 'PER_PERSON'],
  ITEM_082: [5, 'PER_PERSON'],
  ITEM_076: [5, 'PER_PERSON'],
  ITEM_077: [3, 'PER_PERSON'],
  ITEM_079: [3, 'PER_PERSON'],
  ITEM_080: [3, 'PER_PERSON'],
  ITEM_PURE_DE_BATATA: [3, 'PER_PERSON'],
}

const WANT_SIDES = [
  'ARROZ BRANCO',
  'FEIJÃO PRETO',
  'SALPICÃO DE FRANGO',
  'VINAGRETE',
  'MAIONESE',
  'SALADA CÉSAR',
  'FAROFA TEMPERADA',
  'MANDIOCA COZIDA',
  'PURÊ DE BATATA',
]

function isFixture(item) {
  const key = String(item.item_key || '').toUpperCase()
  const name = `${item.item_name ?? ''} ${item.label_pt ?? ''}`.toUpperCase()
  const cat = String(item.category_key || '').toLowerCase()
  return (
    key.startsWith('DEV_') ||
    key.startsWith('TEST-') ||
    key.startsWith('TEST_') ||
    cat === 'qa_inventory' ||
    cat === 'qa_inventory_jde' ||
    name.includes('TEST-DEV') ||
    name.includes('TESTE DEV') ||
    name.startsWith('QA INV') ||
    name.startsWith('JDE QA') ||
    name.startsWith('QA JDE')
  )
}

const { data: items, error: itemsError } = await sb
  .from('catalog_items')
  .select(
    'id,item_key,item_name,label_pt,label_en,label_es,category_key,price,sale_price,pricing_type,charge_type,active,customer_visible,can_be_additional,item_type,operational_item',
  )
  .eq('company_id', COMPANY_ID)
if (itemsError) throw itemsError

const { data: prices, error: pricesError } = await sb
  .from('catalog_item_prices')
  .select('id,catalog_item_id,amount,price_type,pricing_type,charge_type,active')
  .eq('company_id', COMPANY_ID)
if (pricesError) throw pricesError

const { data: packages, error: pkgError } = await sb
  .from('packages')
  .select('package_key,price_per_person,active')
  .eq('company_id', COMPANY_ID)
  .in('package_key', ['BBQTRAD', 'BBQSEL', 'BBQCHO', 'BBQPRI', 'BBQLUX', 'BBQTRAD+', 'BBQSEL+', 'BBQCHO+', 'BBQPRI+', 'BBQLUX+', 'BBQPERS', 'BBQPERS+'])
if (pkgError) throw pkgError

const publicItems = (items ?? []).filter(
  (item) =>
    item.active !== false &&
    item.customer_visible !== false &&
    item.can_be_additional === true &&
    !isFixture(item),
)

let passed = 0
let failed = 0
function test(name, fn) {
  try {
    fn()
    passed += 1
    console.log(`PASS  ${name}`)
  } catch (error) {
    failed += 1
    console.error(`FAIL  ${name}`)
    console.error(`      ${error instanceof Error ? error.message : error}`)
  }
}

test('PUBLIC_CATALOG_REAL_CDL_ONLY', () => {
  const extra = publicItems.filter((item) => !SOURCE_KEYS.has(item.item_key))
  assert.equal(extra.length, 0, extra.map((item) => item.item_key).join(','))
})

test('SYNTHETIC_PUBLIC_ITEMS_0', () => {
  const synthetic = publicItems.filter(isFixture)
  assert.equal(synthetic.length, 0)
})

test('PLACEHOLDER_EVENT_ITEMS_0', () => {
  const placeholders = publicItems.filter((item) =>
    /PLACEHOLDER|EVENTO FUTURO|ITEM_EVENT/i.test(`${item.item_key} ${item.label_pt}`),
  )
  assert.equal(placeholders.length, 0)
})

test('PUBLIC_NON_SOURCE_ITEM_COUNT_0', () => {
  assert.equal(
    publicItems.filter((item) => !SOURCE_KEYS.has(item.item_key)).length,
    0,
  )
})

test('FEIJAO_TROPEIRO_NOT_PUBLIC', () => {
  assert.equal(
    publicItems.some((item) => item.item_key === 'ITEM_081'),
    false,
  )
})

test('NO_PUBLIC_PEIXES_OR_CONDIMENTOS', () => {
  assert.equal(
    publicItems.some((item) => item.category_key === 'PEIXES'),
    false,
  )
  assert.equal(
    publicItems.some((item) => item.category_key === 'CONDIMENTOS'),
    false,
  )
})

test('GUARNICOES_EXACT_UPPERCASE', () => {
  const sides = publicItems.filter((item) => item.category_key === 'GUARNICOES')
  assert.deepEqual(
    sides.map((item) => item.label_pt).sort(),
    [...WANT_SIDES].sort(),
  )
  for (const item of sides) {
    assert.equal(item.label_pt, item.label_pt.toUpperCase())
    assert.equal(item.label_en, item.label_en.toUpperCase())
    assert.equal(item.label_es, item.label_es.toUpperCase())
  }
})

test('ACTIVE_PRICES_MATCH_REAL_SOURCE', () => {
  const byKey = Object.fromEntries((items ?? []).map((item) => [item.item_key, item]))
  for (const [key, [amount, type]] of Object.entries(CRITICAL)) {
    const item = byKey[key]
    assert.ok(item, `missing ${key}`)
    assert.equal(Number(item.sale_price), amount, `${key} sale_price`)
    assert.equal(Number(item.price), amount, `${key} price`)
    assert.equal(item.pricing_type, type, `${key} pricing_type`)
    const active = (prices ?? []).filter(
      (row) =>
        row.catalog_item_id === item.id &&
        row.active === true &&
        String(row.price_type).toUpperCase() === 'SALE',
    )
    assert.equal(active.length, 1, `${key} active prices ${active.length}`)
    assert.equal(Number(active[0].amount), amount, `${key} versioned amount`)
    assert.equal(active[0].pricing_type, type, `${key} versioned type`)
  }
})

test('PACKAGES_UNCHANGED', () => {
  const byKey = Object.fromEntries((packages ?? []).map((row) => [row.package_key, row]))
  assert.equal(Number(byKey.BBQTRAD?.price_per_person), 45)
  assert.equal(Number(byKey.BBQSEL?.price_per_person), 55)
  assert.equal(Number(byKey.BBQCHO?.price_per_person), 65)
  assert.equal(Number(byKey.BBQPRI?.price_per_person), 75)
  assert.equal(Number(byKey['BBQTRAD+']?.price_per_person), 58)
  assert.equal(Number(byKey['BBQSEL+']?.price_per_person), 68)
  assert.equal(Number(byKey['BBQCHO+']?.price_per_person), 78)
  assert.equal(Number(byKey['BBQPRI+']?.price_per_person), 88)
  assert.equal(Number(byKey.BBQPERS?.price_per_person), 0)
  assert.equal(Number(byKey['BBQPERS+']?.price_per_person), 0)
})

test('LUXURY_OFFICIAL_PRICES', () => {
  const byKey = Object.fromEntries((packages ?? []).map((row) => [row.package_key, row]))
  assert.equal(Number(byKey.BBQLUX?.price_per_person), 150)
  assert.equal(Number(byKey['BBQLUX+']?.price_per_person), 163)
  assert.equal(byKey.BBQLUX?.active, true)
  assert.equal(byKey['BBQLUX+']?.active, true)
})

if (failed > 0) {
  console.error(`\n${failed} failed, ${passed} passed`)
  process.exit(1)
}
console.log(`\n${passed} passed`)
console.log(`PUBLIC_NON_SOURCE_ITEM_COUNT=${publicItems.filter((item) => !SOURCE_KEYS.has(item.item_key)).length}`)
console.log(`PUBLIC_COUNT=${publicItems.length}`)
process.exit(0)
