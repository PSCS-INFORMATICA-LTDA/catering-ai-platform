/**
 * Agent 4 — Event children/address flow + package-aware extras filter.
 *
 * Run: npm run test:dev:public-quote-event-extras
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  composeCanonicalDestination,
  composeCanonicalStreetAddress,
} from '../../Lib/addressLine.ts'
import {
  collectBlockedCatalogItemIds,
  extraIdsIntersectingIncluded,
  filterPublicExtraItemsForPackage,
  getVisiblePublicExtraItems,
  pruneBlockedAdditionalSelections,
  shouldShowAccompanimentExtras,
} from '../../Lib/publicQuote/extrasEligibility.ts'
import { isExplicitNonNegativeInteger } from '../../Lib/quoteGuestFields.ts'
import { getQuoteStrings } from '../../Lib/quoteTranslations.ts'

function groupByCategory(items) {
  const grouped = new Map()
  for (const item of items) {
    const key = item.category_key
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key).push(item)
  }
  return [...grouped.entries()].map(([categoryKey, categoryItems]) => ({
    categoryKey,
    items: categoryItems,
  }))
}

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

const CHEESEBURGER = 'id-cheeseburger'
const HOT_DOG = 'id-hot-dog'
const FAROFA = 'id-farofa'
const MEL = 'id-mel'
const GOIABADA = 'id-goiabada'
const GELEIA = 'id-geleia'
const PIMENTA_BICO = 'id-pimenta-bico'
const ARROZ = 'id-arroz'
const SALPICAO = 'id-salpicao'

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
    item_key: fields.item_key ?? `ITEM_${id.slice(0, 8)}`,
    item_type: fields.item_type ?? 'PRODUCT',
    can_be_additional: fields.can_be_additional ?? true,
    customer_visible: fields.customer_visible ?? true,
    active: fields.active ?? true,
    operational_item: fields.operational_item ?? false,
    category_key: fields.category_key ?? 'ACOMPANHAMENTOS',
    item_name: fields.item_name ?? null,
    label_pt: fields.label_pt ?? id,
  }
}

const accompanimentCatalog = [
  extra(CHEESEBURGER, { label_pt: 'Cheeseburger', item_key: 'CHEESEBURGER' }),
  extra(HOT_DOG, { label_pt: 'Hot Dog', item_key: 'HOT_DOG' }),
  extra(FAROFA, { label_pt: 'Farofa', item_key: 'FAROFA' }),
  extra(MEL, { label_pt: 'Mel', item_key: 'MEL' }),
  extra(GOIABADA, { label_pt: 'Goiabada', item_key: 'GOIABADA' }),
  extra(GELEIA, { label_pt: 'Geleia de Pimenta', item_key: 'GELEIA_PIMENTA' }),
  extra(PIMENTA_BICO, { label_pt: 'Pimenta de Bico', item_key: 'PIMENTA_BICO' }),
  extra(ARROZ, { label_pt: 'Arroz Branco', category_key: 'GUARNICOES', item_key: 'ARROZ' }),
  extra(SALPICAO, { label_pt: 'Salpicão de Frango', category_key: 'GUARNICOES', item_key: 'SALPICAO' }),
]

function publicEventIssues(state) {
  const issues = []
  if (!(state.adultCount > 0)) issues.push('adults')
  if (!isExplicitNonNegativeInteger(state.childrenUnder3Count)) {
    issues.push(getQuoteStrings('pt').wizard.issueChildrenUnder3)
  }
  if (!isExplicitNonNegativeInteger(state.children4To12Count)) {
    issues.push(getQuoteStrings('pt').wizard.issueChildren4To12)
  }
  if (!String(state.addressNumber ?? '').trim()) {
    issues.push(getQuoteStrings('pt').wizard.issueAddressNumber)
  }
  return issues
}

function eventState(overrides = {}) {
  return {
    adultCount: 20,
    childrenUnder3Count: 0,
    children4To12Count: 0,
    addressNumber: '1324',
    ...overrides,
  }
}

test('ADULTS_VALID_FOCUS_CHILD_0_3', () => {
  const wizard = source('app/quotes/new/QuoteWizard.tsx')
  assert.match(wizard, /revealGuestChildrenAfterAdults/)
  assert.match(wizard, /childrenUnder3InputRef\.current\?\.focus\(\{ preventScroll: true \}\)/)
  assert.match(
    wizard,
    /inputRef=\{adultsInputRef\}[\s\S]{0,800}revealGuestChildrenAfterAdults/,
  )
  assert.doesNotMatch(
    wizard,
    /inputRef=\{adultsInputRef\}[\s\S]{0,800}streetNumberInputRef/,
  )
})

test('CHILD_0_3_BLANK_NEXT_BLOCKED', () => {
  const issues = publicEventIssues(eventState({ childrenUnder3Count: null }))
  assert.ok(issues.some((issue) => /crianças até 3/i.test(issue)))
  const status = source('app/quotes/new/wizardStepStatus.ts')
  assert.match(status, /isExplicitNonNegativeInteger\(state\.childrenUnder3Count\)/)
})

test('CHILD_0_3_ZERO_VALID', () => {
  assert.equal(isExplicitNonNegativeInteger(0), true)
  const issues = publicEventIssues(eventState({ childrenUnder3Count: 0 }))
  assert.equal(issues.some((issue) => /crianças até 3/i.test(issue)), false)
})

test('CHILD_0_3_VALUE_VALID', () => {
  assert.equal(isExplicitNonNegativeInteger(2), true)
  const issues = publicEventIssues(eventState({ childrenUnder3Count: 2 }))
  assert.equal(issues.some((issue) => /crianças até 3/i.test(issue)), false)
})

test('CHILD_0_3_TO_CHILD_4_12_FOCUS', () => {
  const wizard = source('app/quotes/new/QuoteWizard.tsx')
  assert.match(wizard, /focusWizardField\(children4To12InputRef\.current\)/)
})

test('CHILD_4_12_BLANK_NEXT_BLOCKED', () => {
  const issues = publicEventIssues(eventState({ children4To12Count: null }))
  assert.ok(issues.some((issue) => /4 a 12/i.test(issue)))
  const status = source('app/quotes/new/wizardStepStatus.ts')
  assert.match(status, /isExplicitNonNegativeInteger\(state\.children4To12Count\)/)
})

test('CHILD_4_12_ZERO_VALID', () => {
  const issues = publicEventIssues(eventState({ children4To12Count: 0 }))
  assert.equal(issues.some((issue) => /4 a 12/i.test(issue)), false)
})

test('CHILD_4_12_VALUE_VALID', () => {
  const issues = publicEventIssues(eventState({ children4To12Count: 3 }))
  assert.equal(issues.some((issue) => /4 a 12/i.test(issue)), false)
})

test('CHILD_4_12_TO_STREET_NUMBER_FOCUS', () => {
  const wizard = source('app/quotes/new/QuoteWizard.tsx')
  assert.match(wizard, /revealAddressAfterChildren/)
  assert.match(wizard, /children4To12InputRef[\s\S]{0,500}revealAddressAfterChildren/)
})

test('CHILD_FIELDS_BYPASS_ALLOWED = NO', () => {
  assert.equal(isExplicitNonNegativeInteger(''), false)
  assert.equal(isExplicitNonNegativeInteger(null), false)
  assert.equal(isExplicitNonNegativeInteger(undefined), false)
  assert.equal(isExplicitNonNegativeInteger(0), true)
  const blank = publicEventIssues(eventState({
    childrenUnder3Count: null,
    children4To12Count: null,
  }))
  assert.ok(blank.length >= 2)
})

test('ADDRESS_NUMBER_REQUIRED', () => {
  const issues = publicEventIssues(eventState({ addressNumber: '' }))
  assert.ok(issues.some((issue) => /número/i.test(issue)))
  const status = source('app/quotes/new/wizardStepStatus.ts')
  assert.match(status, /issueAddressNumber/)
})

test('ADDRESS_NUMBER_NUMERIC_KEYBOARD', () => {
  const address = source('app/quotes/new/AddressAutocompleteFields.tsx')
  assert.match(address, /data-address-number[\s\S]{0,120}inputMode="numeric"/)
})

test('NUMBER_AND_ADDRESS_SAME_ROW_MOBILE', () => {
  const css = source('app/globals.css')
  assert.match(css, /\.event-address-primary-row \{/)
  assert.match(css, /grid-template-columns: minmax\(0, 30%\) minmax\(0, 1fr\)/)
  const address = source('app/quotes/new/AddressAutocompleteFields.tsx')
  assert.match(address, /event-address-primary-row/)
  const row = address.match(
    /event-address-primary-row[\s\S]+data-address-number[\s\S]+data-address-search/,
  )
  assert.ok(row)
})

test('ADDRESS_AUTOCOMPLETE_WORKS', () => {
  const address = source('app/quotes/new/AddressAutocompleteFields.tsx')
  assert.match(address, /importLibrary\('places'\)/)
  assert.match(address, /types: \['address'\]/)
})

test('GOOGLE_SELECTION_REQUIRED = PRESERVED', () => {
  const status = source('app/quotes/new/wizardStepStatus.ts')
  assert.match(status, /addressSource !== 'manual'/)
  assert.match(status, /addressPlaceId/)
})

test('CANONICAL_ADDRESS_CONTAINS_NUMBER', () => {
  const dest = composeCanonicalDestination({
    address: 'Lakeland Hills Blvd',
    addressNumber: '1324',
    city: 'Lakeland',
    state: 'FL',
    zipCode: '33805',
  })
  assert.match(dest, /1324/)
  assert.match(dest, /Lakeland Hills Blvd/)
  assert.equal(dest, '1324 Lakeland Hills Blvd, Lakeland, FL 33805')
  assert.match(composeCanonicalStreetAddress('Lakeland Hills Blvd', '1324'), /^1324 /)
})

test('MILEAGE_DESTINATION_CONTAINS_NUMBER', () => {
  const hook = source('Lib/hooks/useAutoEventDistance.ts')
  assert.match(hook, /composeCanonicalDestination/)
  assert.match(hook, /addressNumber/)
})

test('CHANGE_NUMBER_INVALIDATES_STALE_DISTANCE', () => {
  const wizard = source('app/quotes/new/QuoteWizard.tsx')
  assert.match(wizard, /state\.addressNumber/)
  assert.match(wizard, /prev\.distance === 0 \? prev : \{ \.\.\.prev, distance: 0 \}/)
})

test('ZERO_CHILDREN_PERSISTED_NOT_CONVERTED_TO_NULL', () => {
  const validation = source('Lib/publicQuote/validation.ts')
  const experience = source(
    'app/quote/[companySlug]/[locale]/PublicQuoteExperience.tsx',
  )
  assert.match(validation, /optionalNonNegativeInteger/)
  assert.match(validation, /isExplicitNonNegativeInteger\(draft\.event\.childrenUnder3Count\)/)
  assert.match(experience, /typeof draft\.event\?\.childrenUnder3Count === 'number'/)
  assert.doesNotMatch(
    experience,
    /childrenUnder3Count: draft\.event\?\.childrenUnder3Count \|\| 0/,
  )
  assert.equal(isExplicitNonNegativeInteger(0), true)
})

test('BLANK_CHILDREN_STAY_NULL_IN_SANITIZE', () => {
  const validation = source('Lib/publicQuote/validation.ts')
  assert.match(validation, /if \(value === null \|\| value === undefined \|\| value === ''\) return null/)
  assert.equal(isExplicitNonNegativeInteger(null), false)
  assert.equal(isExplicitNonNegativeInteger(''), false)
})

test('CUSTOM_PACKAGE_SHOWS_ALL_ELIGIBLE_ADDITIONALS', () => {
  assert.equal(shouldShowAccompanimentExtras({ package_key: 'BBQPERS' }), true)
  assert.equal(shouldShowAccompanimentExtras({ package_key: 'BBQPERS+' }), true)
  const groups = source('Lib/packageOptionGroups.ts')
  const config = source('Lib/packageConfiguration.ts')
  assert.match(groups, /if \(!packageId\?\.trim\(\) \|\| isCustomPackage\(pkg\)\) return false/)
  assert.match(config, /if \(customPackage \|\| !packageId\?\.trim\(\)\) return \[\]/)
  const visible = filterPublicExtraItemsForPackage(
    getVisiblePublicExtraItems(accompanimentCatalog, []),
    { package_key: 'BBQPERS' },
  )
  assert.equal(visible.length, accompanimentCatalog.length)
})

test('NORMAL_PACKAGE_HIDES_ONLY_INCLUDED_ITEMS', () => {
  const included = collectBlockedCatalogItemIds([
    { additional_item_id: MEL },
    { additional_item_id: GOIABADA },
  ])
  const visible = getVisiblePublicExtraItems(accompanimentCatalog, included)
  const ids = visible.map((row) => row.id)
  assert.ok(!ids.includes(MEL))
  assert.ok(!ids.includes(GOIABADA))
  assert.ok(ids.includes(CHEESEBURGER))
  assert.ok(ids.includes(HOT_DOG))
  assert.ok(ids.includes(FAROFA))
  assert.deepEqual(extraIdsIntersectingIncluded(ids, included), [])
})

test('CATEGORY_LEVEL_HIDE = NO', () => {
  const eligibility = source('Lib/publicQuote/extrasEligibility.ts')
  assert.doesNotMatch(eligibility, /!== 'ACOMPANHAMENTOS'/)
  assert.doesNotMatch(eligibility, /hideCategory\(/)
  const kept = filterPublicExtraItemsForPackage(accompanimentCatalog, {
    package_key: 'BBQLUX',
  })
  assert.equal(kept.length, accompanimentCatalog.length)
})

test('CHEESEBURGER_VISIBLE_IF_NOT_INCLUDED', () => {
  const visible = getVisiblePublicExtraItems(accompanimentCatalog, [MEL])
  assert.ok(visible.some((row) => row.id === CHEESEBURGER))
})

test('HOT_DOG_VISIBLE_IF_NOT_INCLUDED', () => {
  const visible = getVisiblePublicExtraItems(accompanimentCatalog, [MEL])
  assert.ok(visible.some((row) => row.id === HOT_DOG))
})

test('FAROFA_VISIBLE_IF_NOT_INCLUDED', () => {
  const visible = getVisiblePublicExtraItems(accompanimentCatalog, [MEL, GOIABADA])
  assert.ok(visible.some((row) => row.id === FAROFA))
})

test('MEL_HIDDEN_ONLY_IF_INCLUDED', () => {
  assert.ok(getVisiblePublicExtraItems(accompanimentCatalog, []).some((row) => row.id === MEL))
  assert.ok(!getVisiblePublicExtraItems(accompanimentCatalog, [MEL]).some((row) => row.id === MEL))
})

test('GOIABADA_HIDDEN_ONLY_IF_INCLUDED', () => {
  assert.ok(getVisiblePublicExtraItems(accompanimentCatalog, []).some((row) => row.id === GOIABADA))
  assert.ok(!getVisiblePublicExtraItems(accompanimentCatalog, [GOIABADA]).some((row) => row.id === GOIABADA))
})

test('GELEIA_PIMENTA_HIDDEN_ONLY_IF_INCLUDED', () => {
  assert.ok(getVisiblePublicExtraItems(accompanimentCatalog, [GELEIA]).every((row) => row.id !== GELEIA))
  assert.ok(getVisiblePublicExtraItems(accompanimentCatalog, []).some((row) => row.id === GELEIA))
})

test('PIMENTA_BICO_HIDDEN_ONLY_IF_INCLUDED', () => {
  assert.ok(getVisiblePublicExtraItems(accompanimentCatalog, [PIMENTA_BICO]).every((row) => row.id !== PIMENTA_BICO))
  assert.ok(getVisiblePublicExtraItems(accompanimentCatalog, []).some((row) => row.id === PIMENTA_BICO))
})

test('NON_INCLUDED_GARNISH_REMAINS_VISIBLE', () => {
  const visible = getVisiblePublicExtraItems(accompanimentCatalog, [ARROZ])
  assert.ok(visible.some((row) => row.id === SALPICAO))
  assert.ok(!visible.some((row) => row.id === ARROZ))
})

test('PACKAGE_CHANGE_PRUNES_ONLY_NOW_INCLUDED', () => {
  const { additionals, removedIds } = pruneBlockedAdditionalSelections(
    { [MEL]: 2, [CHEESEBURGER]: 1, [FAROFA]: 1 },
    [MEL, GOIABADA],
  )
  assert.deepEqual(removedIds, [MEL])
  assert.equal(additionals[CHEESEBURGER], 1)
  assert.equal(additionals[FAROFA], 1)
})

test('CATEGORY_VISIBLE_COUNT_MATCHES_RENDERED_ITEMS', () => {
  const visible = getVisiblePublicExtraItems(accompanimentCatalog, [MEL, GOIABADA])
  const groups = groupByCategory(visible)
  for (const group of groups) {
    assert.equal(group.items.length > 0, true)
  }
  const accompaniments = groups.find((group) => group.categoryKey === 'ACOMPANHAMENTOS')
  assert.ok(accompaniments)
  assert.equal(
    accompaniments.items.length,
    visible.filter((item) => item.category_key === 'ACOMPANHAMENTOS').length,
  )
  const section = source('components/quotes/additionals/AdditionalCategorySection.tsx')
  assert.match(section, /t\.itemsCount\(items\.length\)/)
})

test('EMPTY_CATEGORY_RENDERED = NO', () => {
  const onlyGarnish = accompanimentCatalog.filter((item) => item.category_key === 'GUARNICOES')
  const groups = groupByCategory(
    getVisiblePublicExtraItems(onlyGarnish, [ARROZ, SALPICAO]),
  )
  assert.equal(groups.some((group) => group.items.length === 0), false)
  assert.equal(groups.some((group) => group.categoryKey === 'GUARNICOES'), false)
  const display = source('Lib/quoteAdditionalDisplay.ts')
  assert.match(display, /if \(!acc\[key\]\) acc\[key\] = \[\]/)
})

test('PERSONALIZED_DETECTION_USES_EXISTING_HELPER', () => {
  assert.equal(shouldShowAccompanimentExtras({ package_key: 'BBQTRAD' }), false)
  assert.equal(shouldShowAccompanimentExtras({ package_key: 'BBQPRI' }), false)
  assert.equal(shouldShowAccompanimentExtras({ package_key: 'BBQLUX' }), false)
  assert.equal(shouldShowAccompanimentExtras({ package_key: 'BBQPERS' }), true)
  assert.equal(shouldShowAccompanimentExtras({ package_key: 'BBQPERS+' }), true)
  const groups = source('Lib/packageOptionGroups.ts')
  assert.match(groups, /export function isCustomPackage/)
  assert.match(groups, /\\bPERS\\b\|BBQPERS/)
})

test('USER_NUMBER_WINS_OVER_GOOGLE', () => {
  const address = source('app/quotes/new/AddressAutocompleteFields.tsx')
  assert.match(address, /existingNumber \|\| selected\.addressNumber/)
})

test('PT_EN_ES_CHILDREN_AND_NUMBER_ISSUES', () => {
  for (const locale of ['pt', 'en', 'es']) {
    const copy = getQuoteStrings(locale).wizard
    assert.ok(copy.issueChildrenUnder3)
    assert.ok(copy.issueChildren4To12)
    assert.ok(copy.issueAddressNumber)
    assert.ok(copy.childrenUnder3)
    assert.ok(copy.children4to12)
  }
})

test('PACKAGE_MATRIX_ID_FILTER', () => {
  const matrix = [
    {
      package: 'BBQ Tradicional',
      included: [],
      hidden: [],
      visibleMust: [CHEESEBURGER, HOT_DOG, FAROFA, MEL, GOIABADA],
    },
    {
      package: 'BBQ Tradicional + sides',
      included: [ARROZ],
      hidden: [ARROZ],
      visibleMust: [SALPICAO, CHEESEBURGER],
    },
    {
      package: 'BBQ Luxury',
      included: [MEL, GOIABADA],
      hidden: [MEL, GOIABADA],
      visibleMust: [CHEESEBURGER, HOT_DOG, FAROFA, GELEIA, PIMENTA_BICO],
    },
    {
      package: 'BBQ Personalizado',
      included: [MEL, GOIABADA],
      custom: true,
      hidden: [],
      visibleMust: [MEL, GOIABADA, CHEESEBURGER],
    },
  ]

  for (const row of matrix) {
    const blocked = row.custom ? [] : row.included
    const visible = getVisiblePublicExtraItems(accompanimentCatalog, blocked)
    const visibleIds = visible.map((item) => item.id)
    for (const id of row.hidden) {
      assert.equal(visibleIds.includes(id), false, `${row.package} should hide ${id}`)
    }
    for (const id of row.visibleMust) {
      assert.equal(visibleIds.includes(id), true, `${row.package} should show ${id}`)
    }
  }
})

if (failed > 0) {
  console.error(`\n${failed} failed, ${passed} passed`)
  process.exit(1)
}

console.log(`\n${passed} passed`)
