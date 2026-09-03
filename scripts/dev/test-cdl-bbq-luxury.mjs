/**
 * Live DEV gates for BBQ Luxury.
 *
 *   npm run test:dev:bbq-luxury
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { assertDevUrl, loadDevEnv } from './loadDevEnv.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const COMPANY_ID = '65fd576f-8d97-49ba-bf38-61bc1e94e94a'
const env = loadDevEnv(ROOT)
assertDevUrl(env.url)

const sb = createClient(env.url, env.service, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const displaySrc = readFileSync(join(ROOT, 'Lib/packageDisplay.ts'), 'utf8')
const detailsSrc = readFileSync(
  join(ROOT, 'components/quotes/SelectedPackageDetails.tsx'),
  'utf8',
)
const translationsSrc = readFileSync(join(ROOT, 'Lib/quoteTranslations.ts'), 'utf8')
const rulesSrc = readFileSync(join(ROOT, 'Lib/cdlCommercialRules.ts'), 'utf8')

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

const { data: packages, error: pkgError } = await sb
  .from('packages')
  .select(
    'id,package_key,package_name,label_pt,label_en,label_es,price_per_person,active,display_order,description_pt,items_description_pt',
  )
  .eq('company_id', COMPANY_ID)
if (pkgError) throw pkgError

const byKey = Object.fromEntries((packages ?? []).map((row) => [row.package_key, row]))
const luxuryFamily = (packages ?? []).filter((row) =>
  /^(BBQLUX\+?)$/i.test(row.package_key || ''),
)
const base = byKey.BBQLUX
const plus = byKey['BBQLUX+']

const { data: items } = await sb
  .from('package_items')
  .select('package_id,item_key,label_pt,additional_item_id,included,active,blocks_additional_item')
  .in('package_id', [base?.id, plus?.id].filter(Boolean))
  .eq('active', true)

const { data: groups } = await sb
  .from('package_option_groups')
  .select(
    'id,package_id,option_group_key,min_choices,max_choices,required,is_required,active',
  )
  .in('package_id', [base?.id, plus?.id].filter(Boolean))
  .eq('active', true)

const groupIds = (groups ?? []).map((row) => row.id)
const { data: groupItems } = groupIds.length
  ? await sb
      .from('package_option_group_items')
      .select('option_group_id,option_item_key,label_pt,additional_item_id,active')
      .in('option_group_id', groupIds)
      .eq('active', true)
  : { data: [] }

const { data: sides } = await sb
  .from('package_side_items')
  .select('package_id,item_key,label_pt,active,included')
  .in('package_id', [base?.id, plus?.id].filter(Boolean))
  .eq('active', true)

const { data: catalog } = await sb
  .from('catalog_items')
  .select('id,item_key')
  .eq('company_id', COMPANY_ID)
const catalogById = Object.fromEntries((catalog ?? []).map((row) => [row.id, row.item_key]))

function itemsFor(packageId) {
  return (items ?? []).filter((row) => row.package_id === packageId)
}
function groupsFor(packageId) {
  return (groups ?? []).filter((row) => row.package_id === packageId)
}
function choices(packageId, key) {
  const group = groupsFor(packageId).find((row) => row.option_group_key === key)
  return (groupItems ?? []).filter((row) => row.option_group_id === group?.id)
}

test('LUXURY_EXISTS', () => {
  assert.ok(base)
  assert.ok(plus)
})
test('LUXURY_VISIBLE', () => {
  assert.equal(base.active, true)
  assert.equal(plus.active, true)
})
test('LUXURY_PACKAGE_FAMILY_COUNT_1', () => {
  assert.equal(luxuryFamily.length, 2)
})
test('LUXURY_BASE_PRICE_150', () => {
  assert.equal(Number(base.price_per_person), 150)
})
test('LUXURY_PLUS_PRICE_163', () => {
  assert.equal(Number(plus.price_per_person), 163)
})
test('SIDES_INCREMENT_13', () => {
  assert.equal(Number(plus.price_per_person) - Number(base.price_per_person), 13)
  assert.match(rulesSrc, /SIDES_PRICE_PER_PERSON = 13/)
})
test('LUXURY_NAMES', () => {
  assert.equal(base.label_pt, 'BBQ Luxury')
  assert.equal(base.label_en, 'BBQ Luxury')
  assert.equal(base.label_es, 'BBQ Luxury')
})
test('LUXURY_POSITION_AFTER_PRIME', () => {
  assert.match(displaySrc, /const PACKAGE_TIER_ORDER = \['TRAD', 'SEL', 'CHO', 'PRI', 'LUX', 'PERS'\]/)
})
test('LUXURY_POSITION_BEFORE_CUSTOM', () => {
  const order = displaySrc.match(/PACKAGE_TIER_ORDER = \[([^\]]+)\]/)?.[1] ?? ''
  assert.ok(order.indexOf("'LUX'") < order.indexOf("'PERS'"))
})
test('LUXURY_PICANHA_ANGUS', () => {
  assert.ok(itemsFor(base.id).some((row) => catalogById[row.additional_item_id] === 'ITEM_001'))
})
test('LUXURY_PICANHA_WAGYU', () => {
  assert.ok(itemsFor(base.id).some((row) => catalogById[row.additional_item_id] === 'ITEM_009'))
})
test('LUXURY_FRALDINHA_ANGUS', () => {
  assert.ok(itemsFor(base.id).some((row) => catalogById[row.additional_item_id] === 'ITEM_004'))
})
test('LUXURY_CARRE_CORDEIRO', () => {
  assert.ok(itemsFor(base.id).some((row) => catalogById[row.additional_item_id] === 'ITEM_047'))
})
test('LUXURY_CHICKEN', () => {
  assert.ok(
    itemsFor(base.id).some(
      (row) => catalogById[row.additional_item_id] === 'ITEM_FRANGO_SOBRECOXA',
    ),
  )
})
test('LUXURY_GARLIC_BREAD', () => {
  assert.ok(itemsFor(base.id).some((row) => catalogById[row.additional_item_id] === 'ITEM_058'))
})
test('LUXURY_CHEESE', () => {
  assert.ok(itemsFor(base.id).some((row) => catalogById[row.additional_item_id] === 'ITEM_065'))
})
test('LUXURY_CORN', () => {
  assert.ok(itemsFor(base.id).some((row) => catalogById[row.additional_item_id] === 'ITEM_037'))
})
test('LUXURY_SAUSAGE_CANONICAL', () => {
  assert.ok(
    itemsFor(base.id).some(
      (row) => catalogById[row.additional_item_id] === 'ITEM_LINGUICA_TOSCANA_TRADICIONAL',
    ),
  )
})
test('LOBSTER_OR_SCALLOP_REQUIRED_ONE', () => {
  const group = groupsFor(base.id).find(
    (row) => row.option_group_key === 'LUXURY_LOBSTER_SCALLOP_CHOICE',
  )
  assert.ok(group)
  assert.equal(group.min_choices, 1)
  assert.equal(group.max_choices, 1)
  const opts = choices(base.id, 'LUXURY_LOBSTER_SCALLOP_CHOICE')
  assert.equal(opts.length, 2)
  assert.ok(opts.some((row) => catalogById[row.additional_item_id] === 'ITEM_051'))
  assert.ok(opts.some((row) => catalogById[row.additional_item_id] === 'ITEM_053'))
  assert.ok(opts.some((row) => /bacon/i.test(row.label_pt)))
})
test('SALMON_OR_SHRIMP_REQUIRED_ONE', () => {
  const group = groupsFor(base.id).find((row) => row.option_group_key === 'SEAFOOD_OPTION')
  assert.ok(group)
  assert.equal(group.min_choices, 1)
  assert.equal(group.max_choices, 1)
  const opts = choices(base.id, 'SEAFOOD_OPTION')
  assert.deepEqual(
    opts.map((row) => catalogById[row.additional_item_id]).sort(),
    ['ITEM_048', 'ITEM_050'],
  )
})
test('PORK_OR_BEEF_RIB_REQUIRED_ONE', () => {
  const group = groupsFor(base.id).find((row) => row.option_group_key === 'COSTELA_OPTION')
  assert.ok(group)
  assert.equal(group.min_choices, 1)
  assert.equal(group.max_choices, 1)
  const opts = choices(base.id, 'COSTELA_OPTION')
  assert.deepEqual(
    opts.map((row) => catalogById[row.additional_item_id]).sort(),
    ['ITEM_003', 'ITEM_014'],
  )
})
test('LUXURY_INCLUDED_ACCOMPANIMENTS', () => {
  const text = `${base.description_pt} ${base.items_description_pt}`.toLowerCase()
  for (const name of ['chimichurri', 'farofa', 'mel', 'goiabada', 'pimenta de bico', 'geleia de pimenta']) {
    assert.ok(text.includes(name), name)
  }
})
test('LUXURY_PLUS_SIDES_CORRECT', () => {
  const plusSides = (sides ?? []).filter((row) => row.package_id === plus.id)
  assert.deepEqual(
    plusSides.map((row) => row.item_key).sort(),
    ['ITEM_075', 'ITEM_076', 'ITEM_FEIJAO_PRETO'].sort(),
  )
  const sideGroup = groupsFor(plus.id).find((row) => row.option_group_key === 'SIDE_OPTION')
  assert.ok(sideGroup)
  const opts = choices(plus.id, 'SIDE_OPTION')
  assert.deepEqual(
    opts.map((row) => catalogById[row.additional_item_id]).sort(),
    ['ITEM_077', 'ITEM_082'],
  )
})
test('FEIJAO_TROPEIRO_IN_LUXURY_NO', () => {
  const all = [...itemsFor(plus.id), ...((sides ?? []).filter((row) => row.package_id === plus.id))]
  assert.equal(
    all.some((row) => /tropeiro/i.test(`${row.item_key} ${row.label_pt}`)),
    false,
  )
})
test('OTHER_PACKAGE_PRICES_UNCHANGED', () => {
  const expected = {
    BBQTRAD: 45,
    BBQSEL: 55,
    BBQCHO: 65,
    BBQPRI: 75,
    'BBQTRAD+': 58,
    'BBQSEL+': 68,
    'BBQCHO+': 78,
    'BBQPRI+': 88,
    BBQPERS: 0,
    'BBQPERS+': 0,
  }
  for (const [key, price] of Object.entries(expected)) {
    assert.equal(Number(byKey[key]?.price_per_person), price, key)
  }
})
test('REVIEW_OPTION_WIRED', () => {
  assert.match(detailsSrc, /LUXURY_LOBSTER_SCALLOP_CHOICE/)
  assert.match(translationsSrc, /lobsterScallopOption/)
})
test('NO_PARALLEL_ARCHITECTURE', () => {
  assert.match(displaySrc, /LUX: 'Luxury'/)
  assert.match(detailsSrc, /onlyGroupKeys=\{\['LUXURY_LOBSTER_SCALLOP_CHOICE'\]\}/)
})

if (failed > 0) {
  console.error(`\n${failed} failed, ${passed} passed`)
  process.exit(1)
}
console.log(`\n${passed} passed`)
process.exit(0)
