/**
 * Suggested extras virtual category + grill image presentation gates.
 *
 * Run: node --experimental-strip-types scripts/dev/test-public-quote-suggested-extras.mjs
 */
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import {
  getVisiblePublicExtraItems,
} from '../../Lib/publicQuote/extrasEligibility.ts'
import {
  GRILL_RENTAL_DISPLAY_IMAGE_PATH,
  GRILL_RENTAL_ITEM_ID,
  GRILL_RENTAL_ITEM_KEY,
  getPublicAdditionalDisplayImageUrl,
  isGrillRentalAdditional,
} from '../../Lib/publicQuote/grillRentalDisplay.ts'
import {
  SUGGESTED_EXTRAS_DISPLAY_KEY,
  SUGGESTED_EXTRA_ITEM_IDS,
  SUGGESTED_EXTRA_ITEM_KEYS,
  displayGroupsHaveDuplicateItemIds,
  isSuggestedExtraItem,
  partitionSuggestedExtraItems,
  pickSuggestedExtraItems,
} from '../../Lib/publicQuote/suggestedExtrasResolve.ts'
import { assertDevUrl, loadDevEnv } from './loadDevEnv.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const source = (p) => readFileSync(join(ROOT, p), 'utf8')

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

const wizard = source('app/quotes/new/QuoteWizard.tsx')
const translations = source('Lib/quoteTranslations.ts')
const suggested = source('Lib/publicQuote/suggestedExtras.ts')
const resolveSrc = source('Lib/publicQuote/suggestedExtrasResolve.ts')
const grill = source('Lib/publicQuote/grillRentalDisplay.ts')
const categorySection = source(
  'components/quotes/additionals/AdditionalCategorySection.tsx',
)
const itemCard = source('components/quotes/additionals/AdditionalItemCard.tsx')
const css = source('app/globals.css')
const display = source('Lib/quoteAdditionalDisplay.ts')

function unitPrice(item) {
  return Number(item.sale_price ?? item.price ?? 0)
}

function categoryKeyOf(item) {
  return String(item.category_key || 'OUTROS')
}

const CANONICAL_ORDER = [
  'BOVINO_NOBRE',
  'BOVINO_TRADICIONAL',
  'PORCO',
  'CORDEIRO',
  'FRANGO',
  'LINGUICAS',
  'FRUTOS_DO_MAR',
  'LEGUMES_E_VEGETAIS',
  'FRUTAS',
  'ACOMPANHAMENTOS',
  'GUARNICOES',
  'EQUIPAMENTOS',
  'PEIXES',
  'LEGUMES_E_SALADAS',
  'OUTROS',
]

function buildDisplayGroups(items) {
  const { suggestedItems, remainingItems } = partitionSuggestedExtraItems(items)
  const sortedSuggested = [...suggestedItems].sort(
    (a, b) => unitPrice(b) - unitPrice(a),
  )
  const grouped = new Map()
  for (const item of remainingItems) {
    const key = categoryKeyOf(item)
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key).push(item)
  }
  const canonical = [...grouped.entries()]
    .sort(
      ([a], [b]) =>
        CANONICAL_ORDER.indexOf(a) - CANONICAL_ORDER.indexOf(b),
    )
    .map(([categoryKey, categoryItems]) => ({
      categoryKey,
      items: [...categoryItems].sort((a, b) => unitPrice(b) - unitPrice(a)),
    }))
  if (sortedSuggested.length === 0) return canonical
  return [
    { categoryKey: SUGGESTED_EXTRAS_DISPLAY_KEY, items: sortedSuggested },
    ...canonical,
  ]
}

function extra(id, fields = {}) {
  return {
    id,
    item_key: fields.item_key ?? `ITEM_${id.slice(0, 4)}`,
    item_name: fields.item_name ?? fields.label_pt ?? 'ITEM',
    label_pt: fields.label_pt ?? 'ITEM',
    label_en: fields.label_en ?? fields.label_pt ?? 'ITEM',
    category_key: fields.category_key ?? 'BOVINO_NOBRE',
    category_pt: fields.category_pt ?? fields.category_key ?? 'BOVINO_NOBRE',
    price: fields.price ?? 10,
    sale_price: fields.sale_price ?? fields.price ?? 10,
    active: fields.active ?? true,
    customer_visible: fields.customer_visible ?? true,
    can_be_additional: fields.can_be_additional ?? true,
    operational_item: fields.operational_item ?? false,
    item_type: fields.item_type ?? 'PRODUCT',
    charge_type: fields.charge_type ?? 'UNIT',
    pricing_type: fields.pricing_type ?? 'PER_UNIT',
    image_url: fields.image_url ?? null,
  }
}

const TOMAHAWK_WAGYU = extra(SUGGESTED_EXTRA_ITEM_IDS[0], {
  item_key: 'ITEM_013',
  label_pt: 'TOMAHAWK (WAGYU)',
  category_key: 'BOVINO_NOBRE',
  price: 250,
})
const TOMAHAWK_ANGUS = extra(SUGGESTED_EXTRA_ITEM_IDS[1], {
  item_key: 'ITEM_012',
  label_pt: 'TOMAHAWK (ANGUS)',
  category_key: 'BOVINO_NOBRE',
  price: 150,
})
const T_BONE = extra(SUGGESTED_EXTRA_ITEM_IDS[2], {
  item_key: 'ITEM_011',
  label_pt: 'T-BONE (ANGUS)',
  category_key: 'BOVINO_NOBRE',
  price: 80,
})
const PURURUCA = extra(SUGGESTED_EXTRA_ITEM_IDS[3], {
  item_key: 'ITEM_016',
  label_pt: 'PURURUCA',
  category_key: 'PORCO',
  price: 120,
})
const PICANHA_WAGYU = extra('c3cf79ab-b08c-482b-9f15-3d041ab33bab', {
  item_key: 'ITEM_009',
  label_pt: 'PICANHA (WAGYU)',
  category_key: 'BOVINO_NOBRE',
  price: 20,
})
const GRILL = extra(GRILL_RENTAL_ITEM_ID, {
  item_key: GRILL_RENTAL_ITEM_KEY,
  label_pt: 'ALUGUEL DA CHURRASQUEIRA',
  category_key: 'EQUIPAMENTOS',
  item_type: 'EQUIPMENT',
  price: 100,
  image_url: '/storage/additional-item-images/ITEM_084_clean_v1.webp',
})
const FRALDINHA = extra('404c667b-0605-48b8-9ca3-07b510be23bc', {
  item_key: 'ITEM_010',
  label_pt: 'FRALDINHA (WAGYU)',
  category_key: 'BOVINO_NOBRE',
  price: 25,
})
const CARRE = extra('f55c986c-f9f8-4a25-b1d7-e094facfb25a', {
  item_key: 'ITEM_015',
  label_pt: 'CARRÉ',
  category_key: 'PORCO',
  price: 10,
})
const ASA = extra('5ad9e83f-1459-4d27-8711-61f08a19973d', {
  item_key: 'ITEM_017',
  label_pt: 'ASA',
  category_key: 'FRANGO',
  price: 8,
})

const visible = [
  TOMAHAWK_WAGYU,
  TOMAHAWK_ANGUS,
  T_BONE,
  PURURUCA,
  PICANHA_WAGYU,
  FRALDINHA,
  CARRE,
  ASA,
  GRILL,
]

test('SUGGESTED_EXTRAS_VIRTUAL_DISPLAY_GROUP', () => {
  assert.equal(SUGGESTED_EXTRAS_DISPLAY_KEY, 'SUGGESTED_EXTRAS')
  assert.match(resolveSrc, /SUGGESTED_EXTRAS_DISPLAY_KEY = 'SUGGESTED_EXTRAS'/)
  assert.match(suggested, /Does not mutate catalog items/)
  assert.doesNotMatch(resolveSrc, /category_key\s*=/)
})

test('SUGGESTED_EXTRAS_DATABASE_CATEGORY_CHANGED', () => {
  assert.equal(TOMAHAWK_WAGYU.category_key, 'BOVINO_NOBRE')
  assert.equal(PURURUCA.category_key, 'PORCO')
  const groups = buildDisplayGroups(visible)
  const promoted = groups[0].items.find((item) => item.item_key === 'ITEM_013')
  assert.equal(promoted?.category_key, 'BOVINO_NOBRE')
  assert.doesNotMatch(suggested, /update\(|\.update\(|from\('catalog_items'\)/)
  assert.doesNotMatch(resolveSrc, /update\(|\.update\(|from\('catalog_items'\)/)
})

test('SUGGESTED_EXTRAS_ACTIVE_ITEMS_ONLY', () => {
  const hidden = extra('dead-tomahawk', {
    item_key: 'ITEM_013',
    label_pt: 'TOMAHAWK (WAGYU)',
    category_key: 'BOVINO_NOBRE',
    price: 250,
    active: false,
  })
  const eligible = getVisiblePublicExtraItems(
    [hidden, PICANHA_WAGYU, ASA],
    [],
  )
  assert.deepEqual(
    pickSuggestedExtraItems(eligible).map((item) => item.item_key),
    [],
  )
})

test('SUGGESTED_EXTRAS_ELIGIBILITY_FILTER', () => {
  const blockedId = TOMAHAWK_WAGYU.id
  const eligible = getVisiblePublicExtraItems(visible, [blockedId])
  const picked = pickSuggestedExtraItems(eligible)
  assert.equal(picked.some((item) => item.id === blockedId), false)
  assert.ok(picked.some((item) => item.item_key === 'ITEM_012'))
})

test('SUGGESTED_EXTRAS_NO_DUPLICATES', () => {
  const groups = buildDisplayGroups(visible)
  assert.equal(displayGroupsHaveDuplicateItemIds(groups), false)
  const { suggestedItems, remainingItems } = partitionSuggestedExtraItems(visible)
  const overlap = suggestedItems.filter((item) =>
    remainingItems.some((other) => other.id === item.id),
  )
  assert.equal(overlap.length, 0)
  const nobre = groups.find((group) => group.categoryKey === 'BOVINO_NOBRE')
  assert.ok(nobre)
  assert.equal(
    nobre.items.some((item) => item.item_key === 'ITEM_013'),
    false,
  )
  assert.equal(
    nobre.items.some((item) => item.item_key === 'ITEM_009'),
    true,
  )
})

test('SUGGESTED_EXTRAS_PRICE_DESC', () => {
  const groups = buildDisplayGroups(visible)
  const prices = groups[0].items.map((item) => unitPrice(item))
  assert.deepEqual(prices, [...prices].sort((a, b) => b - a))
  assert.deepEqual(
    groups[0].items.map((item) => item.item_key),
    ['ITEM_013', 'ITEM_012', 'ITEM_016', 'ITEM_011'],
  )
  assert.match(
    suggested,
    /getAdditionalUnitPrice\(b\) - getAdditionalUnitPrice\(a\)/,
  )
  assert.doesNotMatch(resolveSrc, /price:\s*\d/)
  assert.doesNotMatch(suggested, /price:\s*\d/)
})

test('SUGGESTED_EXTRAS_CATEGORY_FIRST', () => {
  const groups = buildDisplayGroups(visible)
  assert.equal(groups[0].categoryKey, SUGGESTED_EXTRAS_DISPLAY_KEY)
  assert.equal(groups[1].categoryKey, 'BOVINO_NOBRE')
  assert.match(suggested, /categoryKey: SUGGESTED_EXTRAS_DISPLAY_KEY/)
})

test('BOVINO_NOBRE_SECOND_VISIBLE_CATEGORY', () => {
  const groups = buildDisplayGroups(visible)
  assert.equal(groups[1].categoryKey, 'BOVINO_NOBRE')
  assert.equal(groups[1].items.length > 0, true)
})

test('CATEGORY_ORDER_AFTER_SUGGESTED', () => {
  const groups = buildDisplayGroups(visible)
  assert.deepEqual(
    groups.map((group) => group.categoryKey),
    [
      'SUGGESTED_EXTRAS',
      'BOVINO_NOBRE',
      'PORCO',
      'FRANGO',
      'EQUIPAMENTOS',
    ],
  )
  const block = translations.match(/const CATEGORY_SORT_ORDER = \[([\s\S]*?)\] as const/)?.[1]
  const order = [...block.matchAll(/'([A-Z_]+)'/g)].map((m) => m[1])
  assert.deepEqual(order.slice(0, 5), [
    'BOVINO_NOBRE',
    'BOVINO_TRADICIONAL',
    'PORCO',
    'CORDEIRO',
    'FRANGO',
  ])
})

test('SUGGESTED_EXTRAS_EMPTY_CANONICAL_CATEGORY_HIDDEN', () => {
  const onlyPromotedNobre = [
    TOMAHAWK_WAGYU,
    TOMAHAWK_ANGUS,
    T_BONE,
    ASA,
  ]
  const groups = buildDisplayGroups(onlyPromotedNobre)
  assert.equal(
    groups.some((group) => group.categoryKey === 'BOVINO_NOBRE'),
    false,
  )
})

test('SUGGESTED_EXTRAS_SELECTION_SHARED_STATE', () => {
  assert.match(wizard, /quantities=\{state\.additionals\}/)
  assert.match(wizard, /onChangeQty=\{setAdditionalQty\}/)
  assert.doesNotMatch(wizard, /suggestedExtrasState|promoQuantity|secondarySelection/)
  assert.doesNotMatch(categorySection, /suggestedExtrasState|promoQuantity/)
})

test('SUGGESTED_EXTRAS_REVIEW_WORKS', () => {
  assert.match(wizard, /getVisibleAdditionalCategoryKeys\(additionalItemsByCategory\)/)
  assert.match(wizard, /buildPublicAdditionalDisplayGroups/)
  assert.match(categorySection, /data-additional-category-sentinel/)
  assert.match(categorySection, /data-category-reviewed/)
  assert.match(categorySection, /featured \? \(/)
})

test('SUGGESTED_EXTRAS_PURCHASE_OPTIONAL', () => {
  assert.match(wizard, /const additionalsStepNextDisabled = false/)
  assert.doesNotMatch(suggested, /required|mustBuy|forceSelect/i)
})

test('SUGGESTED_EXTRAS_REVIEW_USES_CANONICAL_CATEGORY', () => {
  assert.match(suggested, /export function getReviewAdditionalCategoryLabel/)
  assert.match(suggested, /getAdditionalItemCategoryKey\(item\)/)
  assert.match(wizard, /getReviewAdditionalCategoryLabel\(item, uiLocale\)/)
  assert.doesNotMatch(wizard, /category: categoryLabel/)
})

test('SUGGESTED_EXTRAS_RESOLVES_BY_ITEM_KEY', () => {
  const byKey = extra('new-id-only-key', {
    item_key: 'ITEM_013',
    label_pt: 'TOMAHAWK (WAGYU)',
    category_key: 'BOVINO_NOBRE',
    price: 250,
  })
  assert.equal(isSuggestedExtraItem(byKey), true)
  const byId = extra(SUGGESTED_EXTRA_ITEM_IDS[0], {
    item_key: 'SOMETHING_ELSE',
    label_pt: 'OTHER',
    category_key: 'BOVINO_NOBRE',
    price: 250,
  })
  assert.equal(isSuggestedExtraItem(byId), true)
  assert.deepEqual([...SUGGESTED_EXTRA_ITEM_KEYS], [
    'ITEM_013',
    'ITEM_012',
    'ITEM_011',
    'ITEM_016',
  ])
})

test('SUGGESTED_EXTRAS_COPY_NO_PRICE', () => {
  const copy = [...translations.matchAll(/suggestedExtras\w+: '([^']*)'/g)].map(
    (m) => m[1],
  )
  for (const line of copy) {
    assert.doesNotMatch(line, /\$\s*\d/, `copy quotes a price: ${line}`)
  }
  assert.match(translations, /Escolha seus favoritos abaixo\./)
  assert.match(translations, /Choose your favorites below\./)
  assert.match(translations, /Elige tus favoritos abajo\./)
})

test('SUGGESTED_EXTRAS_MATCHES_EDITORIAL_LABELS', () => {
  assert.equal(
    isSuggestedExtraItem({
      id: 'unknown-id',
      item_key: 'OTHER',
      label_pt: 'Tomahawk (WAGYU) Folhado a Ouro',
    }),
    true,
  )
  assert.equal(
    isSuggestedExtraItem({
      id: 'unknown-id',
      item_key: 'OTHER',
      label_pt: 'T-Bone (ANGUS)',
    }),
    true,
  )
  assert.equal(
    isSuggestedExtraItem({
      id: 'unknown-id',
      item_key: 'OTHER',
      label_pt: 'Pimenta de Bico',
    }),
    false,
  )
})

test('SUGGESTED_EXTRAS_FEATURED_VISUAL', () => {
  assert.match(css, /\.public-suggested-extras-header \{[\s\S]*?#070707/)
  assert.match(css, /\.public-suggested-extras-title \{[\s\S]*?color: #fff/)
  assert.match(css, /background: var\(--cdl-yellow\)/)
  assert.match(
    css,
    /\.public-additional-category\.is-featured \.public-additional-card-name,[\s\S]*?text-transform: uppercase/,
  )
  assert.doesNotMatch(css, /text-transform:\s*capitalize/)
  assert.match(categorySection, /data-suggested-extras=\{featured \? 'true'/)
})

test('SUGGESTED_EXTRAS_ALWAYS_OPEN', () => {
  assert.match(categorySection, /const lockExpanded = featured/)
  assert.match(categorySection, /const isExpanded = lockExpanded \|\| expanded/)
  assert.match(categorySection, /data-suggested-extras-locked="true"/)
  assert.match(
    wizard,
    /categoryKey === SUGGESTED_EXTRAS_DISPLAY_KEY \|\|/,
  )
  assert.match(wizard, /openAdditionalCategories\.has\(categoryKey\)/)
  assert.match(
    wizard,
    /if \(category === SUGGESTED_EXTRAS_DISPLAY_KEY\) return/,
  )
})

test('ADDITIONAL_GRILL_ITEM_FOUND', () => {
  assert.equal(isGrillRentalAdditional(GRILL), true)
  assert.equal(GRILL.item_key, 'ITEM_084')
  assert.equal(GRILL.category_key, 'EQUIPAMENTOS')
})

test('GRILL_IMAGE_LARGE_OPERATIONAL_MODEL', () => {
  assert.equal(
    getPublicAdditionalDisplayImageUrl(GRILL),
    GRILL_RENTAL_DISPLAY_IMAGE_PATH,
  )
  assert.ok(
    existsSync(join(ROOT, 'public/cdl/additionals/cdl-operational-grill.webp')),
  )
  assert.match(grill, /cdl-event-pool-station|operational grill|pool-station/)
})

test('GRILL_IMAGE_REAL_CDL_ASSET', () => {
  assert.ok(existsSync(join(ROOT, 'public/cdl/hero/cdl-event-pool-station.webp')))
  assert.doesNotMatch(grill, /unsplash|pexels/i)
})

test('GRILL_IMAGE_CARD_CROP', () => {
  assert.match(itemCard, /data-additional-image-crop=\{grillCrop \? 'operational-grill'/)
  assert.match(css, /data-additional-image-crop='operational-grill'/)
})

test('GRILL_PRICE_UNCHANGED', () => {
  assert.equal(unitPrice(GRILL), 100)
  assert.doesNotMatch(grill, /price:\s*\d/)
})

test('GRILL_QUANTITY_RULE_UNCHANGED', () => {
  assert.match(itemCard, /data-additional-qty-label/)
  assert.match(display, /export function normalizeAdditionalQuantity/)
  assert.doesNotMatch(grill, /normalizeAdditionalQuantity|quantity\s*=/)
})

test('ITEMS_SORTED_PRICE_DESC_PRESERVED', () => {
  assert.match(
    display,
    /getAdditionalUnitPrice\(b\) - getAdditionalUnitPrice\(a\)/,
  )
})

async function proveLiveCatalogUnchanged() {
  const env = loadDevEnv(ROOT)
  assertDevUrl(env.url)
  const sb = createClient(env.url, env.service, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data, error } = await sb
    .from('catalog_items')
    .select('item_key, category_key, price, image_url, active, customer_visible, can_be_additional')
    .eq('company_id', '65fd576f-8d97-49ba-bf38-61bc1e94e94a')
    .in('item_key', [...SUGGESTED_EXTRA_ITEM_KEYS, GRILL_RENTAL_ITEM_KEY])
  if (error) throw error
  const byKey = Object.fromEntries((data ?? []).map((row) => [row.item_key, row]))
  assert.equal(byKey.ITEM_013?.category_key, 'BOVINO_NOBRE')
  assert.equal(byKey.ITEM_012?.category_key, 'BOVINO_NOBRE')
  assert.equal(byKey.ITEM_011?.category_key, 'BOVINO_NOBRE')
  assert.equal(byKey.ITEM_016?.category_key, 'PORCO')
  assert.equal(byKey.ITEM_084?.category_key, 'EQUIPAMENTOS')
  assert.equal(Number(byKey.ITEM_084?.price), 100)
  for (const key of SUGGESTED_EXTRA_ITEM_KEYS) {
    assert.equal(byKey[key]?.active, true, `${key} inactive`)
    assert.equal(byKey[key]?.customer_visible, true, `${key} hidden`)
    assert.equal(byKey[key]?.can_be_additional, true, `${key} not additional`)
  }
}

try {
  await proveLiveCatalogUnchanged()
  passed += 1
  console.log('PASS  LIVE_CATALOG_CATEGORY_AND_GRILL_PRICE_UNCHANGED')
} catch (error) {
  failed += 1
  console.error('FAIL  LIVE_CATALOG_CATEGORY_AND_GRILL_PRICE_UNCHANGED')
  console.error(`      ${error instanceof Error ? error.message : error}`)
}

if (failed > 0) {
  console.error(`\n${failed} failed, ${passed} passed`)
  process.exit(1)
}
console.log(`\n${passed} passed`)
