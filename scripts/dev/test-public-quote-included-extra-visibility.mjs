/**
 * Public extras: package-included items stay visible but not chargeable.
 *
 * Run: npm run test:dev:public-quote-included-extra-visibility
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  CDL_STANDARD_PACKAGE_INCLUDED_ACCOMPANIMENT_KEYS,
  buildExtraAvailabilityByItemId,
  canSetPublicAdditionalQuantity,
  extraIdsIntersectingIncluded,
  getExtraAvailabilityStatus,
  getNonChargeableExtraIds,
  getSelectedInPackageCatalogIds,
  getUniversalIncludedCatalogIds,
  getVisiblePublicExtraItems,
  isStandardPackageIncludedAccompanimentKey,
  pruneBlockedAdditionalSelections,
} from '../../Lib/publicQuote/extrasEligibility.ts'
import { getQuoteStrings } from '../../Lib/quoteTranslations.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

const PICANHA = 'id-picanha-prime'
const SALMAO = 'id-salmao'
const CAMARAO = 'id-camarao'
const FAROFA = 'id-farofa'
const FAROFA_TEMPERADA = 'id-farofa-temperada'
const MEL = 'id-mel'
const GOIABADA = 'id-goiabada'
const CHIMICHURRI = 'id-chimichurri'
const PIMENTA_BICO = 'id-pimenta-bico'
const GELEIA = 'id-geleia'
const FRALDINHA_WAGYU = 'id-fraldinha-wagyu'

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
    category_key: fields.category_key ?? 'ACOMPANHAMENTOS',
    item_name: fields.item_name ?? null,
    label_pt: fields.label_pt ?? null,
    price: fields.price ?? 12,
    charge_type: fields.charge_type ?? 'PERSON',
  }
}

const catalog = [
  extra(PICANHA, {
    item_key: 'ITEM_001',
    category_key: 'BOVINO_TRADICIONAL',
    label_pt: 'PICANHA (ANGUS)',
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
  extra(FAROFA, {
    item_key: 'ITEM_059',
    label_pt: 'Farofa',
  }),
  extra(FAROFA_TEMPERADA, {
    item_key: 'ITEM_079',
    label_pt: 'Farofa Temperada',
  }),
  extra(MEL, {
    item_key: 'ITEM_060',
    label_pt: 'Mel',
  }),
  extra(GOIABADA, {
    item_key: 'ITEM_061',
    label_pt: 'Goiabada',
  }),
  extra(CHIMICHURRI, {
    item_key: 'ITEM_CHIMICHURRI',
    label_pt: 'Chimichurri',
  }),
  extra(PIMENTA_BICO, {
    item_key: 'ITEM_066',
    label_pt: 'Pimenta de Bico',
  }),
  extra(GELEIA, {
    item_key: 'ITEM_067',
    label_pt: 'Geleia de Pimenta',
  }),
  extra(FRALDINHA_WAGYU, {
    item_key: 'ITEM_010',
    category_key: 'BOVINO_NOBRE',
    label_pt: 'FRALDINHA (WAGYU)',
    price: 25,
  }),
]

function previewAdditionals(additionals) {
  return Object.entries(additionals)
    .filter(([, quantity]) => quantity > 0)
    .map(([itemId, quantity]) => ({ itemId, quantity }))
}

function reviewAdditionals(displayable, additionals) {
  return displayable
    .filter((item) => (additionals[item.id] ?? 0) > 0)
    .map((item) => item.id)
}

function selectedCount(displayable, additionals) {
  return displayable.reduce(
    (sum, item) => sum + (additionals[item.id] ?? 0),
    0,
  )
}

function setAdditionalQty(additionals, itemId, quantity, nonChargeable) {
  if (!canSetPublicAdditionalQuantity(itemId, nonChargeable)) return additionals
  const next = { ...additionals }
  if (quantity <= 0) delete next[itemId]
  else next[itemId] = quantity
  return next
}

const compositionBlocked = [PICANHA, SALMAO]
const compositionBlockedWithoutSelections = [PICANHA]
const standardPackage = { package_key: 'BBQPRI' }
const customPackage = { package_key: 'BBQPERS' }
const universalStandard = getUniversalIncludedCatalogIds(catalog, standardPackage)
const nonChargeable = getNonChargeableExtraIds(compositionBlocked, universalStandard)
const selectedInPackage = getSelectedInPackageCatalogIds(
  compositionBlocked,
  compositionBlockedWithoutSelections,
)
const displayable = getVisiblePublicExtraItems(catalog, [])
const chargeable = getVisiblePublicExtraItems(catalog, nonChargeable)
const availability = buildExtraAvailabilityByItemId(
  displayable.map((item) => item.id),
  nonChargeable,
  selectedInPackage,
)

test('FIXED_PACKAGE_ITEM_VISIBLE', () => {
  assert.ok(displayable.some((item) => item.id === PICANHA))
})

test('FIXED_PACKAGE_ITEM_DISABLED', () => {
  assert.equal(availability[PICANHA], 'INCLUDED_IN_PACKAGE')
  assert.equal(canSetPublicAdditionalQuantity(PICANHA, nonChargeable), false)
})

test('FIXED_PACKAGE_ITEM_NOT_CHARGEABLE', () => {
  assert.ok(!chargeable.some((item) => item.id === PICANHA))
  assert.deepEqual(extraIdsIntersectingIncluded(chargeable.map((item) => item.id), [PICANHA]), [])
})

test('SELECTED_OPTION_VISIBLE', () => {
  assert.ok(displayable.some((item) => item.id === SALMAO))
})

test('SELECTED_OPTION_DISABLED', () => {
  assert.equal(availability[SALMAO], 'SELECTED_IN_PACKAGE')
  assert.equal(canSetPublicAdditionalQuantity(SALMAO, nonChargeable), false)
})

test('UNSELECTED_OPTION_AVAILABLE', () => {
  assert.ok(displayable.some((item) => item.id === CAMARAO))
  assert.ok(chargeable.some((item) => item.id === CAMARAO))
  assert.equal(availability[CAMARAO], 'AVAILABLE')
  assert.equal(canSetPublicAdditionalQuantity(CAMARAO, nonChargeable), true)
})

test('UNIVERSAL_FAROFA_INCLUDED_STANDARD', () => {
  assert.ok(universalStandard.includes(FAROFA))
  assert.equal(availability[FAROFA], 'INCLUDED_IN_PACKAGE')
})

test('UNIVERSAL_HONEY_INCLUDED_STANDARD', () => {
  assert.ok(universalStandard.includes(MEL))
  assert.equal(availability[MEL], 'INCLUDED_IN_PACKAGE')
})

test('UNIVERSAL_GUAVA_INCLUDED_STANDARD', () => {
  assert.ok(universalStandard.includes(GOIABADA))
  assert.equal(availability[GOIABADA], 'INCLUDED_IN_PACKAGE')
})

test('UNIVERSAL_CHIMICHURRI_INCLUDED_STANDARD', () => {
  assert.ok(universalStandard.includes(CHIMICHURRI))
  assert.equal(availability[CHIMICHURRI], 'INCLUDED_IN_PACKAGE')
})

test('UNIVERSAL_PIMENTA_BICO_INCLUDED_STANDARD', () => {
  assert.ok(universalStandard.includes(PIMENTA_BICO))
  assert.equal(availability[PIMENTA_BICO], 'INCLUDED_IN_PACKAGE')
})

test('UNIVERSAL_PEPPER_JELLY_INCLUDED_STANDARD', () => {
  assert.ok(universalStandard.includes(GELEIA))
  assert.equal(availability[GELEIA], 'INCLUDED_IN_PACKAGE')
})

test('FAROFA_TEMPERADA_REMAINS_AVAILABLE', () => {
  assert.equal(isStandardPackageIncludedAccompanimentKey('ITEM_079'), false)
  assert.ok(!universalStandard.includes(FAROFA_TEMPERADA))
  assert.equal(availability[FAROFA_TEMPERADA], 'AVAILABLE')
  assert.equal(canSetPublicAdditionalQuantity(FAROFA_TEMPERADA, nonChargeable), true)
})

test('UNIVERSAL_ITEMS_AVAILABLE_CUSTOM_PACKAGE', () => {
  const customUniversal = getUniversalIncludedCatalogIds(catalog, customPackage)
  const customNonChargeable = getNonChargeableExtraIds([], customUniversal)
  assert.deepEqual(customUniversal, [])
  assert.equal(
    getExtraAvailabilityStatus(FAROFA, customNonChargeable, []),
    'AVAILABLE',
  )
  assert.equal(canSetPublicAdditionalQuantity(FAROFA, customNonChargeable), true)
  assert.equal(canSetPublicAdditionalQuantity(MEL, customNonChargeable), true)
})

test('PACKAGE_SWITCH_PRUNES_NOW_INCLUDED_EXTRA', () => {
  const customNonChargeable = getNonChargeableExtraIds([], [])
  let additionals = { [FAROFA]: 2, [FRALDINHA_WAGYU]: 1 }
  additionals = setAdditionalQty(additionals, FAROFA, 2, customNonChargeable)
  assert.equal(additionals[FAROFA], 2)
  const afterPrime = pruneBlockedAdditionalSelections(additionals, nonChargeable)
  assert.deepEqual(afterPrime.removedIds, [FAROFA])
  assert.equal(afterPrime.additionals[FAROFA], undefined)
  assert.equal(afterPrime.additionals[FRALDINHA_WAGYU], 1)
})

test('BLOCKED_ITEM_CANNOT_SET_QUANTITY', () => {
  const next = setAdditionalQty({ [FRALDINHA_WAGYU]: 1 }, PICANHA, 3, nonChargeable)
  assert.equal(next[PICANHA], undefined)
  assert.equal(next[FRALDINHA_WAGYU], 1)
  assert.equal(canSetPublicAdditionalQuantity(PICANHA, nonChargeable), false)
})

test('BLOCKED_ITEM_NOT_IN_PREVIEW_ADDITIONALS', () => {
  const { additionals } = pruneBlockedAdditionalSelections(
    { [PICANHA]: 2, [SALMAO]: 1, [FRALDINHA_WAGYU]: 1 },
    nonChargeable,
  )
  const preview = previewAdditionals(additionals)
  assert.deepEqual(
    preview.map((row) => row.itemId).sort(),
    [FRALDINHA_WAGYU],
  )
})

test('BLOCKED_ITEM_NOT_IN_REVIEW_ADDITIONALS', () => {
  const { additionals } = pruneBlockedAdditionalSelections(
    { [PICANHA]: 2, [FAROFA]: 1, [CAMARAO]: 1 },
    nonChargeable,
  )
  const reviewIds = reviewAdditionals(displayable, additionals)
  assert.deepEqual(reviewIds, [CAMARAO])
  const wizard = source('app/quotes/new/QuoteWizard.tsx')
  assert.match(
    wizard,
    /\.filter\(\(item\) => \(state\.additionals\[item\.id\] \?\? 0\) > 0\)/,
  )
  assert.doesNotMatch(wizard, /INCLUDED_IN_PACKAGE[\s\S]{0,80}reviewAdditionals/)
})

test('SELECTED_COUNT_EXCLUDES_INCLUDED_ITEMS', () => {
  const additionals = { [CAMARAO]: 2, [FRALDINHA_WAGYU]: 1 }
  assert.equal(selectedCount(displayable, additionals), 3)
  assert.equal(selectedCount(displayable, { ...additionals, [PICANHA]: 0 }), 3)
  assert.equal((additionals[PICANHA] ?? 0) > 0, false)
})

test('universal included keys stay canonical item_keys', () => {
  assert.deepEqual(
    [...CDL_STANDARD_PACKAGE_INCLUDED_ACCOMPANIMENT_KEYS],
    [
      'ITEM_CHIMICHURRI',
      'ITEM_059',
      'ITEM_060',
      'ITEM_061',
      'ITEM_066',
      'ITEM_067',
    ],
  )
  assert.equal(isStandardPackageIncludedAccompanimentKey('ITEM_059'), true)
  assert.equal(isStandardPackageIncludedAccompanimentKey('Farofa'), false)
})

test('display helper keeps fixtures and structural extras hidden', () => {
  const fixture = extra('dev-farofa', {
    item_key: 'DEV_FAROFA',
    label_pt: 'Farofa DEV',
  })
  const visible = getVisiblePublicExtraItems([...catalog, fixture], [])
  assert.ok(!visible.some((item) => item.id === 'dev-farofa'))
})

test('PT_EN_ES_LOCKED_EXTRA_COPY', () => {
  assert.equal(getQuoteStrings('pt').wizard.includedInPackage, 'Incluído no pacote')
  assert.equal(getQuoteStrings('pt').wizard.selectedInPackage, 'Selecionado no pacote')
  assert.equal(getQuoteStrings('pt').wizard.extraPriceAsAdditional, 'Preço como adicional')
  assert.equal(getQuoteStrings('en').wizard.includedInPackage, 'Included in package')
  assert.equal(getQuoteStrings('en').wizard.selectedInPackage, 'Selected in package')
  assert.equal(getQuoteStrings('en').wizard.extraPriceAsAdditional, 'Extra price')
  assert.equal(getQuoteStrings('es').wizard.includedInPackage, 'Incluido en el paquete')
  assert.equal(getQuoteStrings('es').wizard.selectedInPackage, 'Seleccionado en el paquete')
  assert.equal(getQuoteStrings('es').wizard.extraPriceAsAdditional, 'Precio como adicional')
})

test('wizard keeps chargeable extras out of state and shows locked cards', () => {
  const wizard = source('app/quotes/new/QuoteWizard.tsx')
  const card = source('components/quotes/additionals/AdditionalItemCard.tsx')
  const section = source(
    'components/quotes/additionals/AdditionalCategorySection.tsx',
  )
  assert.match(wizard, /getVisiblePublicExtraItems\(itemCatalog, \[\]\)/)
  assert.match(wizard, /nonChargeableExtraIds/)
  assert.match(
    wizard,
    /canSetPublicAdditionalQuantity\(itemId, nonChargeableExtraIds\)/,
  )
  assert.match(
    wizard,
    /pruneBlockedAdditionalSelections\(\s*prev\.additionals,\s*nonChargeableExtraIds/,
  )
  assert.match(wizard, /extraAvailabilityByItemId=\{extraAvailabilityByItemId\}/)
  assert.match(card, /aria-disabled="true"/)
  assert.match(card, /data-extra-availability=\{availability\}/)
  assert.match(card, /public-additional-card-lock-badge/)
  assert.match(section, /data-extra-summary-badge/)
  assert.match(section, /t\.wizard\.extraIncludedShort/)
})

if (failed > 0) {
  console.error(`\n${failed} failed, ${passed} passed`)
  process.exit(1)
}

console.log(`\n${passed} passed`)
