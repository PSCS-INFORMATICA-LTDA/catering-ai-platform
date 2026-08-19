/**
 * Public Quote — package groups + collapsed extras summaries (TEST 1–28).
 * Run: node --experimental-strip-types scripts/dev/test-public-quote-extras-summary.mjs
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getAdditionalChargeUnitLabel } from '../../Lib/additionalChargeUnit.ts'
import {
  getAdditionalPriceLabel,
  getAdditionalPriceValue,
} from '../../Lib/additionalPriceDisplay.ts'
import {
  getAdditionalCategoryExposeRootMargin,
  isAdditionalCategorySentinelInView,
  isExtrasExposeScrollJump,
  shouldExposeAdditionalCategory,
} from '../../Lib/additionalCategoryExposure.ts'
import { getPublicPackageSidesGroup } from '../../Lib/packageCatalogVisual.ts'
import { pickLocalizedText } from '../../Lib/i18n/locales.ts'
import {
  areAllAdditionalCategoriesVisited,
  getUnvisitedAdditionalCategoryKeys,
  markAdditionalCategoryVisitedInSet,
} from '../../Lib/wizardAdditionalCategories.ts'
import { tw } from '../../Lib/quoteTranslations.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const source = (relativePath) => readFileSync(join(ROOT, relativePath), 'utf8')

const catalogSrc = source('components/quotes/PublicPackageCatalog.tsx')
const sectionSrc = source(
  'components/quotes/additionals/AdditionalCategorySection.tsx',
)
const cardSrc = source('components/quotes/additionals/AdditionalItemCard.tsx')
const wizardSrc = source('app/quotes/new/QuoteWizard.tsx')
const stepNavSrc = source('components/quotes/QuoteWizardStepNav.tsx')
const exposureSrc = source('Lib/additionalCategoryExposure.ts')
const translationsSrc = source('Lib/quoteTranslations.ts')

/**
 * `Lib/packageFieldAccess` and `Lib/quoteAdditionalDisplay` use `@/` aliases,
 * which Node ESM cannot resolve. The label rules below call the very same
 * resolvers those modules delegate to, and the source assertions keep the
 * wiring honest.
 */
const packageFieldAccessSrc = source('Lib/packageFieldAccess.ts')
const additionalDisplaySrc = source('Lib/quoteAdditionalDisplay.ts')

function packageLabel(pkg, locale) {
  return (
    pickLocalizedText(
      { pt: pkg.label_pt, en: pkg.label_en, es: pkg.label_es },
      locale,
    ).trim() ||
    pkg.package_name?.trim() ||
    (pkg.package_key ?? '').trim() ||
    'Pacote'
  )
}

function additionalLabel(item, language) {
  return (
    pickLocalizedText(
      { pt: item.label_pt, en: item.label_en, es: item.label_es },
      language,
    ).trim() ||
    item.item_name?.trim() ||
    '—'
  )
}

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

/* Registered catalog rows used as fixtures — no hardcoded UI copy. */
const PER_PERSON_ITEM = {
  id: 'item-per-person',
  item_key: 'ITEM_TIRAS',
  label_pt: 'Assado de Tiras',
  label_en: 'Beef Short Ribs Strips',
  label_es: 'Asado de Tira',
  sale_price: 10,
  pricing_type: 'PER_PERSON',
  charge_type: 'PERSON',
}

const UNIT_ITEM = {
  id: 'item-unit',
  item_key: 'ITEM_BANDEJA',
  label_pt: 'Bandeja de Legumes',
  label_en: 'Vegetable Tray',
  label_es: 'Bandeja de Verduras',
  sale_price: 45,
  pricing_type: 'PER_UNIT',
  charge_type: 'UNIT',
  unit_label: 'bandeja',
  quantity: 1,
}

const NO_PRICE_ITEM = {
  id: 'item-no-price',
  item_key: 'ITEM_SEM_PRECO',
  label_pt: 'Item sem preço',
  label_en: 'Item without price',
  label_es: 'Artículo sin precio',
}

/* ---------------------------- PACKAGE GROUPS ---------------------------- */

test('TEST 1 with/without sides groups are rendered before the packages', () => {
  assert.match(catalogSrc, /data-package-group="with_sides"/)
  assert.match(catalogSrc, /data-package-group="without_sides"/)
  assert.match(catalogSrc, /withSidesGroupTitle/)
  assert.match(catalogSrc, /withoutSidesGroupTitle/)
  assert.match(catalogSrc, /withSidesGroupHint/)
  assert.match(catalogSrc, /withoutSidesGroupHint/)
  assert.match(catalogSrc, /aria-expanded=\{expanded\}/)
  assert.doesNotMatch(catalogSrc, /Step 3A|3B/)
})

test('TEST 2 group classification is data-driven, never by name or id list', () => {
  assert.equal(getPublicPackageSidesGroup({ package_key: 'BBQCHO+' }), 'with_sides')
  assert.equal(getPublicPackageSidesGroup({ package_key: 'BBQCHO' }), 'without_sides')
  assert.equal(getPublicPackageSidesGroup({ package_key: 'BBQPERS+' }), 'with_sides')
  assert.doesNotMatch(catalogSrc, /name\.includes\(/)
  assert.doesNotMatch(catalogSrc, /label_pt\.includes\(/)
  assert.doesNotMatch(wizardSrc, /CDL_PACKAGE_IDS|HARDCODED_PACKAGE/)
  assert.match(wizardSrc, /getPublicPackageSidesGroup\(p\) === 'without_sides'/)
  assert.match(wizardSrc, /getPublicPackageSidesGroup\(p\) === 'with_sides'/)
})

test('TEST 3 package name comes from the localized canonical record', () => {
  const pkg = {
    package_key: 'BBQCHO+',
    package_name: 'BBQ 3',
    label_pt: 'BBQ Choice com guarnições',
    label_en: 'BBQ Choice with side dishes',
    label_es: 'BBQ Choice con guarniciones',
  }
  assert.equal(packageLabel(pkg, 'pt'), 'BBQ Choice com guarnições')
  assert.equal(packageLabel(pkg, 'en'), 'BBQ Choice with side dishes')
  assert.equal(packageLabel(pkg, 'es'), 'BBQ Choice con guarniciones')
  assert.match(packageFieldAccessSrc, /pickLocalizedText/)
  assert.match(catalogSrc, /getPackageCatalogName\(pkg, language\)/)
})

test('TEST 4 Choice stays Choice in every locale, never a legacy number', () => {
  const pkg = {
    package_key: 'BBQCHO',
    package_name: 'BBQ 3',
    label_pt: 'BBQ Choice',
    label_en: 'BBQ Choice',
    label_es: 'BBQ Choice',
  }
  for (const locale of ['pt', 'en', 'es']) {
    const label = packageLabel(pkg, locale)
    assert.match(label, /Choice/)
    assert.doesNotMatch(label, /BBQ 3|Package 3/)
  }
})

test('TEST 5 package pricing box stays below the art with canonical math', () => {
  assert.match(catalogSrc, /data-package-price-breakdown/)
  assert.match(catalogSrc, /resolvePackageSidesPricing/)
  assert.match(catalogSrc, /showGarnishLine/)
  assert.match(catalogSrc, /sidesPricePerPerson/)
  assert.doesNotMatch(catalogSrc, /\b13\b\s*\+/)
})

test('TEST 6 package options remain inline under the selected package', () => {
  assert.match(catalogSrc, /data-public-package-options/)
  assert.match(catalogSrc, /active && selectableGroups\.length > 0/)
  assert.match(catalogSrc, /lg:col-span-2/)
})

/* ------------------------------- EXTRAS -------------------------------- */

test('TEST 7 extras categories start closed', () => {
  assert.match(wizardSrc, /useState<\s*Set<string>\s*>\(\(\) => new Set\(\)\)/)
  assert.doesNotMatch(wizardSrc, /new Set\(additionalCategoryKeys\)/)
  assert.match(sectionSrc, /aria-expanded=\{expanded\}/)
})

test('TEST 8 no category auto-opens from scroll, observers or navigation', () => {
  assert.doesNotMatch(exposureSrc, /shouldAutoOpenAdditionalCategory/)
  assert.doesNotMatch(exposureSrc, /READING_ZONE/)
  assert.doesNotMatch(sectionSrc, /onEnterReadingZone/)
  assert.doesNotMatch(wizardSrc, /handleAdditionalCategoryReadingZone/)
  // The only place that opens a category is the customer toggle.
  const openCalls = wizardSrc.match(/setOpenAdditionalCategories\(/g) ?? []
  assert.equal(openCalls.length, 2, 'expected toggle + step reset only')
  assert.match(wizardSrc, /function toggleAdditionalCategory/)
  assert.match(sectionSrc, /onClick=\{onToggle\}/)
})

test('TEST 9 a closed category summarizes every registered item', () => {
  assert.match(sectionSrc, /data-additional-category-summary/)
  assert.match(sectionSrc, /\{items\.map\(\(item\) => \{/)
  assert.doesNotMatch(sectionSrc, /items\.slice\(/)
  assert.doesNotMatch(sectionSrc, /verMais|seeMore|showMore/i)
})

test('TEST 10 summary lines carry a discrete bullet', () => {
  assert.match(sectionSrc, /data-additional-summary-item/)
  assert.match(sectionSrc, /•/)
  assert.match(sectionSrc, /<ul/)
  assert.match(sectionSrc, /<li/)
})

test('TEST 11 every summary line shows the registered price', () => {
  assert.equal(getAdditionalPriceLabel(PER_PERSON_ITEM, 'pt'), '$10.00')
  assert.equal(getAdditionalPriceLabel(UNIT_ITEM, 'en'), '$45.00')
  assert.equal(
    getAdditionalPriceLabel(NO_PRICE_ITEM, 'pt'),
    tw('pt', 'priceUnavailable'),
  )
  assert.match(sectionSrc, /getAdditionalPriceLabel\(item, language\)/)
})

test('TEST 12 summary shows the registered charge unit, never an invented UOM', () => {
  assert.equal(
    getAdditionalChargeUnitLabel(PER_PERSON_ITEM, 'pt'),
    tw('pt', 'chargeUnitPerPerson'),
  )
  assert.equal(getAdditionalChargeUnitLabel(UNIT_ITEM, 'pt'), 'bandeja')
  assert.equal(
    getAdditionalChargeUnitLabel({ ...UNIT_ITEM, unit_label: 'UN' }, 'en'),
    tw('en', 'chargeUnitPerUnit'),
  )
  assert.match(sectionSrc, /getAdditionalChargeUnitLabel\(item, language\)/)
})

test('TEST 13 summary price and expanded price share one source', () => {
  assert.match(sectionSrc, /getAdditionalPriceLabel/)
  assert.match(cardSrc, /getAdditionalPriceLabel/)
  assert.doesNotMatch(cardSrc, /hasAdditionalPrice\(item\)\s*\?/)
  assert.match(additionalDisplaySrc, /from '@\/Lib\/additionalPriceDisplay'/)
  assert.equal(getAdditionalPriceValue(PER_PERSON_ITEM), 10)
  assert.equal(getAdditionalPriceValue(NO_PRICE_ITEM), 0)
})

test('TEST 14 opening a category still renders the detailed cards', () => {
  assert.match(sectionSrc, /\{expanded \? \(/)
  assert.match(sectionSrc, /data-additional-items-grid/)
  assert.match(sectionSrc, /<AdditionalItemCard/)
  assert.match(cardSrc, /loading="lazy"/)
})

test('TEST 15 closing a category brings the summary back and keeps selections', () => {
  assert.match(sectionSrc, /\) : \(/)
  assert.match(sectionSrc, /quantities\[item\.id\] \?\? 0/)
  assert.match(sectionSrc, /×\{quantity\}/)
  assert.doesNotMatch(wizardSrc, /delete .*visitedAdditionalCategories/)
})

test('TEST 16 zero additionals remains valid', () => {
  const keys = ['BOVINO', 'GUARNICOES']
  let visited = new Set()
  for (const key of keys) {
    visited = markAdditionalCategoryVisitedInSet(visited, key)
  }
  assert.equal(areAllAdditionalCategoriesVisited(keys, visited), true)
  const stepStatus = source('app/quotes/new/wizardStepStatus.ts')
  assert.doesNotMatch(stepStatus, /additionalsCount > 0/)
})

test('TEST 17 advancing never requires expanding a category', () => {
  assert.match(wizardSrc, /handleAdditionalCategoryExpose/)
  assert.doesNotMatch(
    wizardSrc,
    /openAdditionalCategories[\s\S]{0,80}additionalsStepNextDisabled/,
  )
  assert.equal(
    shouldExposeAdditionalCategory({ isIntersecting: true, intersectionRatio: 0.6 }),
    true,
  )
  assert.equal(
    shouldExposeAdditionalCategory({ isIntersecting: true, intersectionRatio: 0.2 }),
    false,
  )
})

/* -------------------------------- CTA ---------------------------------- */

test('TEST 18 Next stays pinned to the bottom during the extras step', () => {
  assert.match(stepNavSrc, /sticky bottom-0/)
  assert.match(wizardSrc, /sticky=\{isPublicMode\}/)
  assert.match(stepNavSrc, /data-testid="wizard-global-next"/)
})

test('TEST 19 Next starts disabled while summaries are pending', () => {
  assert.match(wizardSrc, /additionalCategoryKeys\.length > 0 && !allAdditionalCategoriesVisited/)
  assert.match(stepNavSrc, /step === 3 && additionalsStepNextDisabled/)
  assert.equal(
    getUnvisitedAdditionalCategoryKeys(['A', 'B'], new Set(['A'])).length,
    1,
  )
})

test('TEST 20 Next enables once every summary was reached', () => {
  const keys = ['A', 'B', 'C']
  let visited = new Set()
  for (const key of keys) {
    visited = markAdditionalCategoryVisitedInSet(visited, key)
  }
  assert.equal(getUnvisitedAdditionalCategoryKeys(keys, visited).length, 0)
  assert.equal(areAllAdditionalCategoriesVisited(keys, visited), true)
  assert.match(wizardSrc, /canAdvanceFromAdditionalsStep/)
})

test('TEST 21b muted exposure is re-evaluated so review can never dead-end', () => {
  assert.match(wizardSrc, /setExtrasExposeEpoch\(\(epoch\) => epoch \+ 1\)/)
  assert.match(wizardSrc, /exposeEpoch=\{extrasExposeEpoch\}/)
  assert.match(sectionSrc, /\}, \[categoryKey, exposeEpoch, ctaReservePx\]\)/)
  assert.match(wizardSrc, /window\.scrollTo\(\{ top: 0, behavior: 'auto' \}\)/)
})

test('TEST 21 blocked Next scrolls to the pending summary without opening it', () => {
  const start = wizardSrc.indexOf('function handleAdditionalsNextBlockedClick')
  assert.ok(start > 0)
  const blocked = wizardSrc.slice(
    start,
    start + wizardSrc.slice(start).indexOf('\n  }\n'),
  )
  assert.match(blocked, /scrollToAdditionalCategory/)
  assert.match(blocked, /setEmphasizedAdditionalCategory/)
  assert.doesNotMatch(blocked, /setOpenAdditionalCategories/)
  assert.match(wizardSrc, /additionalsReviewAllCategories/)
})

test('TEST 21c End/Home jumps do not review skipped summaries', () => {
  assert.equal(isExtrasExposeScrollJump(2000, 844), true)
  assert.equal(isExtrasExposeScrollJump(80, 844), false)
  assert.equal(
    isAdditionalCategorySentinelInView({ top: 200, bottom: 201 }, 844, 176),
    true,
  )
  assert.equal(
    isAdditionalCategorySentinelInView({ top: 900, bottom: 901 }, 844, 176),
    false,
  )
  assert.match(sectionSrc, /isAdditionalCategorySentinelInView/)
  assert.match(wizardSrc, /isExtrasExposeScrollJump/)
  assert.match(wizardSrc, /extrasExposeArmedRef\.current = false/)
  assert.doesNotMatch(
    wizardSrc,
    /isExtrasExposeScrollJump[\s\S]{0,200}setOpenAdditionalCategories/,
  )
})

test('TEST 22 back navigation preserves review and selections', () => {
  assert.match(wizardSrc, /pruneVisitedAdditionalCategories/)
  assert.doesNotMatch(wizardSrc, /step !== 3[\s\S]{0,80}setVisitedAdditionalCategories\(new Set\(\)\)/)
  assert.match(wizardSrc, /if \(step !== 3\) \{\s*setOpenAdditionalCategories\(new Set\(\)\)/)
})

test('TEST 23 a new quote resets the review state', () => {
  assert.match(
    wizardSrc,
    /new Set\(initialReviewedCategoryKeys\?\.filter\(Boolean\) \?\? \[\]\)/,
  )
  assert.match(wizardSrc, /reviewedCategoryKeys/)
  const experience = source(
    'app/quote/[companySlug]/[locale]/PublicQuoteExperience.tsx',
  )
  assert.match(experience, /restoredDraft\?\.selection\?\.reviewedCategoryKeys/)
})

test('TEST 24 the pinned CTA reserves space so the last content stays visible', () => {
  assert.match(wizardSrc, /data-wizard-cta-spacer/)
  assert.match(wizardSrc, /data-cta-reserve-px=\{ctaReservePx\}/)
  assert.match(wizardSrc, /style=\{\{ height: ctaReservePx \}\}/)
  assert.match(wizardSrc, /ResizeObserver/)
  assert.match(wizardSrc, /containerRef=\{stepNavRef\}/)
  assert.match(stepNavSrc, /sticky bottom-0/)
  assert.match(stepNavSrc, /pb-\[max\(0\.75rem,env\(safe-area-inset-bottom\)\)\]/)
  assert.doesNotMatch(wizardSrc, /h-\[calc\(7rem/)
  assert.equal(
    getAdditionalCategoryExposeRootMargin(160),
    '0px 0px -160px 0px',
  )
})

test('TEST 25 summary rows cannot create horizontal overflow', () => {
  assert.match(sectionSrc, /min-w-0/)
  assert.match(sectionSrc, /flex-wrap/)
  assert.match(sectionSrc, /break-words/)
  assert.match(sectionSrc, /overflow-hidden rounded-2xl/)
})

/* -------------------------------- I18N --------------------------------- */

test('TEST 26 PT copy', () => {
  assert.equal(tw('pt', 'withSidesGroupTitle'), 'Com guarnição')
  assert.equal(tw('pt', 'withoutSidesGroupTitle'), 'Sem guarnição')
  assert.match(tw('pt', 'withSidesGroupHint'), /acompanhamentos previstos/)
  assert.equal(
    tw('pt', 'additionalsReviewAllCategories'),
    'Percorra todas as categorias antes de continuar.',
  )
  assert.equal(additionalLabel(PER_PERSON_ITEM, 'pt'), 'Assado de Tiras')
  assert.match(additionalDisplaySrc, /resolveCatalogItemDisplayLabel/)
  assert.match(sectionSrc, /getLocalizedAdditionalLabel\(item, language\)/)
})

test('TEST 27 EN copy', () => {
  assert.equal(tw('en', 'withSidesGroupTitle'), 'With sides')
  assert.equal(tw('en', 'withoutSidesGroupTitle'), 'Without sides')
  assert.match(tw('en', 'withSidesGroupHint'), /side dishes provided/)
  assert.equal(
    tw('en', 'additionalsReviewAllCategories'),
    'Review all categories before continuing.',
  )
  assert.equal(
    additionalLabel(PER_PERSON_ITEM, 'en'),
    'Beef Short Ribs Strips',
  )
})

test('TEST 28 ES copy', () => {
  assert.equal(tw('es', 'withSidesGroupTitle'), 'Con acompañamientos')
  assert.equal(tw('es', 'withoutSidesGroupTitle'), 'Sin acompañamientos')
  assert.match(tw('es', 'withSidesGroupHint'), /acompañamientos previstos/)
  assert.equal(
    tw('es', 'additionalsReviewAllCategories'),
    'Revisa todas las categorías antes de continuar.',
  )
  assert.equal(additionalLabel(PER_PERSON_ITEM, 'es'), 'Asado de Tira')
  assert.match(translationsSrc, /Con acompañamientos/)
})

if (failed > 0) {
  console.error(`\n${failed} failed, ${passed} passed`)
  process.exit(1)
}

console.log(`\n${passed} passed`)
