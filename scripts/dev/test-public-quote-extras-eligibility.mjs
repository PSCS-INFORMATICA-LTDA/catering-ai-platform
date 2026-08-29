/**
 * Public extras eligibility: real catalog only + package composition
 * must not reappear as chargeable extras (canonical catalog item ids).
 *
 * Run: node --experimental-strip-types scripts/dev/test-public-quote-extras-eligibility.mjs
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  isPublicCatalogFixtureItem,
  isPublicCatalogFixturePackage,
} from '../../Lib/publicQuote/catalogVisibility.ts'
import {
  collectBlockedCatalogItemIds,
  extraIdsIntersectingIncluded,
  getVisiblePublicExtraItems,
  pruneBlockedAdditionalSelections,
} from '../../Lib/publicQuote/extrasEligibility.ts'
import { filterCatalogItems } from '../../Lib/itemCatalog.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

const PICANHA_ANGUS = '99920d4b-0fb9-44de-97e8-775877756962'
const FRALDINHA_ANGUS = '768c6e24-d24c-4cca-9ca3-35e7a789f54b'
const FRALDINHA_WAGYU = '404c667b-0605-48b8-9ca3-07b510be23bc'
const GRILL_RENTAL = '00c14d79-3365-4024-86bd-be58185fc74b'
const SALMAO = '48a3dcec-9a80-4b24-ba2f-e033101455c3'
const CAMARAO = '07a474e8-2431-4761-9f4f-e177c1c7f465'
const DEV_FAROFA = 'd1000000-0000-4000-8000-000000000003'
const TEST_DESSERT = 'd2000000-0000-4000-8000-000000000011'

let passed = 0
let failed = 0

function test(name, callback) {
  try {
    callback()
    passed += 1
    console.log(`PASS  ${name}`)
  } catch (error) {
    failed += 1
    console.error(`FAIL  ${name}`)
    console.error(`      ${error instanceof Error ? error.message : error}`)
  }
}

function source(relativePath) {
  return readFileSync(join(ROOT, relativePath), 'utf8')
}

function extra(id, fields = {}) {
  return {
    id,
    item_key: fields.item_key ?? `ITEM_${id.slice(0, 4)}`,
    item_type: fields.item_type ?? 'PRODUCT',
    can_be_additional: fields.can_be_additional ?? true,
    customer_visible: fields.customer_visible ?? true,
    active: fields.active ?? true,
    operational_item: fields.operational_item ?? false,
    category_key: fields.category_key ?? 'BOVINO_TRADICIONAL',
    item_name: fields.item_name ?? null,
    label_pt: fields.label_pt ?? null,
    price: fields.price ?? 10,
    charge_type: fields.charge_type ?? 'PERSON',
  }
}

const catalog = [
  extra(PICANHA_ANGUS, { item_key: 'ITEM_001', label_pt: 'PICANHA (ANGUS)' }),
  extra(FRALDINHA_ANGUS, { item_key: 'ITEM_004', label_pt: 'FRALDINHA (ANGUS)' }),
  extra(FRALDINHA_WAGYU, {
    item_key: 'ITEM_010',
    category_key: 'BOVINO_NOBRE',
    label_pt: 'FRALDINHA (WAGYU)',
    price: 25,
  }),
  extra(GRILL_RENTAL, {
    item_key: 'ITEM_084',
    item_type: 'EQUIPMENT',
    category_key: 'EQUIPAMENTOS',
    label_pt: 'ALUGUEL DA CHURRASQUEIRA',
    price: 100,
    charge_type: 'UNIT',
  }),
  extra(SALMAO, {
    item_key: 'ITEM_048',
    category_key: 'PEIXES',
    label_pt: 'SALMAO',
  }),
  extra(CAMARAO, {
    item_key: 'ITEM_050',
    category_key: 'FRUTOS_DO_MAR',
    label_pt: 'CAMARÃO',
  }),
  extra(DEV_FAROFA, {
    item_key: 'DEV_FAROFA',
    category_key: 'sides',
    label_pt: 'Farofa DEV',
  }),
  extra(TEST_DESSERT, {
    item_key: 'TEST-DEV-ADD-DESSERT',
    category_key: 'sides',
    label_pt: 'TESTE DEV — Sobremesa por pessoa',
  }),
]

const packageAIncludedRows = [
  {
    item_key: 'PICANHA_ANGUS',
    additional_item_id: PICANHA_ANGUS,
    blocks_additional_item: false,
  },
  {
    item_key: 'FRALDINHA',
    additional_item_id: FRALDINHA_ANGUS,
    blocks_additional_item: true,
  },
]

const packageBIncludedRows = [
  {
    item_key: 'FRALDINHA',
    additional_item_id: FRALDINHA_ANGUS,
    blocks_additional_item: true,
  },
]

function extrasFor(includedRows, selectedOptionIds = []) {
  const blocked = [
    ...collectBlockedCatalogItemIds(includedRows),
    ...selectedOptionIds,
  ]
  return {
    blocked,
    visible: getVisiblePublicExtraItems(catalog, blocked),
  }
}

test('fixture keys are hidden from the public extras catalog', () => {
  assert.equal(isPublicCatalogFixtureItem({ item_key: 'DEV_FAROFA' }), true)
  assert.equal(
    isPublicCatalogFixtureItem({ item_key: 'TEST-DEV-ADD-DESSERT' }),
    true,
  )
  assert.equal(
    isPublicCatalogFixtureItem({ item_key: 'TEST-DEV-ADDITIONAL-BOM' }),
    true,
  )
  assert.equal(
    isPublicCatalogFixtureItem({
      item_key: 'qa_core',
      category_key: 'qa_inventory',
    }),
    true,
  )
  assert.equal(isPublicCatalogFixtureItem({ item_key: 'ITEM_001' }), false)
  assert.equal(isPublicCatalogFixtureItem({ item_key: 'ITEM_084' }), false)
  assert.equal(
    isPublicCatalogFixturePackage({ package_key: 'TEST-DEV-PACKAGE-BOM' }),
    true,
  )
})

test('customer additional filter drops DEV/TEST even if flags say visible', () => {
  const rows = filterCatalogItems(catalog, 'additional', 'customer')
  const ids = rows.map((row) => row.id)
  assert.ok(ids.includes(PICANHA_ANGUS))
  assert.ok(ids.includes(GRILL_RENTAL))
  assert.ok(!ids.includes(DEV_FAROFA))
  assert.ok(!ids.includes(TEST_DESSERT))
  const admin = filterCatalogItems(catalog, 'additional', 'admin').map(
    (row) => row.id,
  )
  assert.ok(admin.includes(DEV_FAROFA))
})

test('included package catalog ids never appear in extras (intersection empty)', () => {
  const { blocked, visible } = extrasFor(packageAIncludedRows)
  const visibleIds = visible.map((row) => row.id)
  assert.deepEqual(extraIdsIntersectingIncluded(visibleIds, blocked), [])
  assert.ok(!visibleIds.includes(PICANHA_ANGUS))
  assert.ok(!visibleIds.includes(FRALDINHA_ANGUS))
  assert.ok(visibleIds.includes(FRALDINHA_WAGYU))
  assert.ok(!visibleIds.includes(GRILL_RENTAL))
})

test('inclusion blocks extras even when blocks_additional_item is false', () => {
  const blocked = collectBlockedCatalogItemIds(packageAIncludedRows)
  assert.ok(blocked.includes(PICANHA_ANGUS))
  const config = source('Lib/packageConfiguration.ts')
  assert.match(config, /collectBlockedCatalogItemIds/)
  assert.doesNotMatch(
    config,
    /if \(item\.blocks_additional_item && item\.additional_item_id/,
  )
})

test('package without the item exposes that extra again', () => {
  const pkgA = extrasFor(packageAIncludedRows)
  const pkgB = extrasFor(packageBIncludedRows)
  assert.ok(!pkgA.visible.some((row) => row.id === PICANHA_ANGUS))
  assert.ok(pkgB.visible.some((row) => row.id === PICANHA_ANGUS))
  assert.ok(!pkgB.visible.some((row) => row.id === FRALDINHA_ANGUS))
  assert.ok(!pkgB.visible.some((row) => row.id === GRILL_RENTAL))
})

test('selected extra is dropped when the new package already includes it', () => {
  const { blocked } = extrasFor(packageAIncludedRows)
  const { additionals, removedIds } = pruneBlockedAdditionalSelections(
    { [PICANHA_ANGUS]: 4, [GRILL_RENTAL]: 1, [FRALDINHA_WAGYU]: 2 },
    blocked,
  )
  assert.deepEqual(removedIds, [PICANHA_ANGUS])
  assert.equal(additionals[PICANHA_ANGUS], undefined)
  assert.equal(additionals[GRILL_RENTAL], 1)
  assert.equal(additionals[FRALDINHA_WAGYU], 2)
})

test('selected option choice also leaves extras (no duplicate seafood charge)', () => {
  const withoutChoice = extrasFor(packageAIncludedRows)
  const withSalmon = extrasFor(packageAIncludedRows, [SALMAO])
  assert.ok(withoutChoice.visible.some((row) => row.id === SALMAO))
  assert.ok(!withSalmon.visible.some((row) => row.id === SALMAO))
  assert.ok(withSalmon.visible.some((row) => row.id === CAMARAO))
  const { removedIds, additionals } = pruneBlockedAdditionalSelections(
    { [SALMAO]: 3, [CAMARAO]: 1 },
    withSalmon.blocked,
  )
  assert.deepEqual(removedIds, [SALMAO])
  assert.equal(additionals[CAMARAO], 1)
})

test('grill rental stays in catalog fetch but is hidden from generic extras', () => {
  const rows = filterCatalogItems(catalog, 'additional', 'customer')
  assert.ok(rows.some((row) => row.id === GRILL_RENTAL))
  const { visible } = extrasFor(packageAIncludedRows)
  const grill = visible.find((row) => row.id === GRILL_RENTAL)
  assert.equal(grill, undefined)
})

test('eligibility uses canonical ids, not translated names', () => {
  const eligibility = source('Lib/publicQuote/extrasEligibility.ts')
  const config = source('Lib/packageConfiguration.ts')
  assert.doesNotMatch(eligibility, /item\.name\s*===\s*packageItem\.name/)
  assert.doesNotMatch(eligibility, /includes\(['"]picanha['"]\)/i)
  assert.match(config, /additional_item_id/)
  assert.match(eligibility, /blockedCatalogItemIds/)
})

test('wizard prunes blocked extras and bootstrap hides fixture items', () => {
  const wizard = source('app/quotes/new/QuoteWizard.tsx')
  const bootstrap = source('Lib/publicQuote/bootstrap.ts')
  assert.match(wizard, /pruneBlockedAdditionalSelections/)
  assert.match(wizard, /getVisiblePublicExtraItems/)
  assert.match(bootstrap, /isPublicCatalogFixtureItem/)
})

if (failed > 0) {
  console.error(`\n${failed} failed, ${passed} passed`)
  process.exit(1)
}

console.log(`\n${passed} passed`)
