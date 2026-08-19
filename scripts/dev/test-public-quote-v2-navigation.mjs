/**
 * Public Quote V2 — sequential navigation, package math, extras review, mileage units.
 * Run: node --experimental-strip-types scripts/dev/test-public-quote-v2-navigation.mjs
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  formatPackageHeroPrice,
  getPackageCatalogPrice,
  getPackageCatalogVariant,
  getPackagePriceCaption,
  getPackageSidesDescription,
  packageSidesMathHolds,
  resolvePackageSidesPricing,
} from '../../Lib/packageCatalogVisual.ts'
import { isPublicGrillDraftAnswered } from '../../Lib/publicQuote/grillDraft.ts'
import {
  formatDistanceForDisplay,
  parseDistanceDisplayUnit,
} from '../../Lib/units.ts'
import { areAllAdditionalCategoriesVisited } from '../../Lib/wizardAdditionalCategories.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

const SIDES_PRICE_PER_PERSON = 13

const CDL_PACKAGES = [
  { package_key: 'BBQTRAD', price_per_person: 45, with_sides: false },
  { package_key: 'BBQSEL', price_per_person: 55, with_sides: false },
  { package_key: 'BBQCHO', price_per_person: 65, with_sides: false },
  { package_key: 'BBQPRI', price_per_person: 75, with_sides: false },
  { package_key: 'BBQTRAD+', price_per_person: 58, with_sides: true },
  { package_key: 'BBQSEL+', price_per_person: 68, with_sides: true },
  { package_key: 'BBQCHO+', price_per_person: 78, with_sides: true },
  { package_key: 'BBQPRI+', price_per_person: 88, with_sides: true },
]

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

function getMaxReachableStep(completeFlags) {
  for (let index = 0; index < completeFlags.length - 1; index += 1) {
    if (!completeFlags[index]) return index
  }
  return completeFlags.length - 1
}

function visualStatus(stepIndex, completeFlags) {
  const max = getMaxReachableStep(completeFlags)
  if (stepIndex > max) return 'locked'
  return completeFlags[stepIndex] ? 'complete' : 'pending'
}

function canNavigate(stepIndex, completeFlags) {
  return stepIndex <= getMaxReachableStep(completeFlags)
}

/* TEST 1 sequential locking */
test('TEST 1 new quote only unlocks Cliente', () => {
  const complete = [false, false, false, false, false, false]
  assert.equal(visualStatus(0, complete), 'pending')
  assert.equal(visualStatus(1, complete), 'locked')
  assert.equal(visualStatus(2, complete), 'locked')
  assert.equal(visualStatus(3, complete), 'locked')
  assert.equal(visualStatus(4, complete), 'locked')
  assert.equal(visualStatus(5, complete), 'locked')
  assert.equal(canNavigate(0, complete), true)
  assert.equal(canNavigate(4, complete), false)
  assert.equal(getMaxReachableStep(complete), 0)
  const statusSrc = source('app/quotes/new/wizardStepStatus.ts')
  assert.match(statusSrc, /export type StepVisualStatus = .*'locked'/)
  assert.match(statusSrc, /export function getMaxReachableStep/)
  assert.match(statusSrc, /export function canNavigateToStep/)
  assert.doesNotMatch(statusSrc, /currentStep > 3/)
  const wizard = source('app/quotes/new/QuoteWizard.tsx')
  assert.match(wizard, /canNavigateToStep\(nextStep, stepStatusCtx\)/)
  assert.match(wizard, /getMaxReachableStep\(stepStatusCtx\)/)
})

test('TEST 1 leftover BBQ content does not unlock BBQ', () => {
  const complete = [false, false, false, false, true, false]
  assert.equal(visualStatus(4, complete), 'locked')
  assert.equal(canNavigate(4, complete), false)
})

/* TEST 2 client validation */
test('TEST 2 partial client keeps Evento locked', () => {
  const complete = [false, false, false, false, false, false]
  assert.equal(visualStatus(1, complete), 'locked')
})

test('TEST 2 complete client unlocks Evento only', () => {
  const complete = [true, false, false, false, false, false]
  assert.equal(visualStatus(0, complete), 'complete')
  assert.equal(visualStatus(1, complete), 'pending')
  assert.equal(visualStatus(2, complete), 'locked')
  assert.equal(canNavigate(1, complete), true)
  assert.equal(canNavigate(2, complete), false)
})

/* TEST 3 event validation */
test('TEST 3 complete event unlocks Pacote', () => {
  const complete = [true, true, false, false, false, false]
  assert.equal(visualStatus(1, complete), 'complete')
  assert.equal(visualStatus(2, complete), 'pending')
  assert.equal(visualStatus(3, complete), 'locked')
})

/* TEST 4 package */
test('TEST 4 selected package unlocks extras', () => {
  const complete = [true, true, true, false, false, false]
  assert.equal(visualStatus(2, complete), 'complete')
  assert.equal(visualStatus(3, complete), 'pending')
  assert.equal(canNavigate(3, complete), true)
  assert.equal(canNavigate(4, complete), false)
})

/* TEST 5 extras review */
test('TEST 5 unreviewed extras block BBQ', () => {
  assert.equal(
    areAllAdditionalCategoriesVisited(['GUARNICOES', 'BOVINO'], new Set()),
    false,
  )
  const complete = [true, true, true, false, false, false]
  assert.equal(visualStatus(4, complete), 'locked')
  const advance = source('Lib/wizardStepAdvance.ts')
  assert.match(advance, /areAllAdditionalCategoriesVisited/)
  assert.doesNotMatch(advance, /return true\n}/)
})

/* TEST 6 no purchase still valid */
test('TEST 6 reviewing all extras without purchase unlocks BBQ', () => {
  const visited = new Set(['GUARNICOES', 'BOVINO'])
  assert.equal(
    areAllAdditionalCategoriesVisited(['GUARNICOES', 'BOVINO'], visited),
    true,
  )
  const complete = [true, true, true, true, false, false]
  assert.equal(visualStatus(3, complete), 'complete')
  assert.equal(visualStatus(4, complete), 'pending')
  assert.equal(canNavigate(4, complete), true)
})

/* TEST 7 BBQ */
test('TEST 7 incomplete BBQ keeps Review locked', () => {
  const complete = [true, true, true, true, false, false]
  assert.equal(visualStatus(5, complete), 'locked')
})

test('TEST 7 answered BBQ unlocks Review', () => {
  const complete = [true, true, true, true, true, false]
  assert.equal(visualStatus(4, complete), 'complete')
  assert.equal(canNavigate(5, complete), true)
})

/* TEST 8 review */
test('TEST 8 review completes when 1-5 and pricing are valid', () => {
  const complete = [true, true, true, true, true, true]
  assert.equal(visualStatus(5, complete), 'complete')
})

/* TEST 9 reload / draft */
test('TEST 9 leftover hasGrill false is not a BBQ answer', () => {
  assert.equal(isPublicGrillDraftAnswered({ hasGrill: false }, 0), false)
  assert.equal(
    isPublicGrillDraftAnswered({ hasGrill: false, setupAnswered: true }, 0),
    true,
  )
  assert.equal(isPublicGrillDraftAnswered({ hasGrill: false }, 4), true)
  assert.equal(isPublicGrillDraftAnswered({ hasGrill: true }, 0), true)
  const experience = source(
    'app/quote/[companySlug]/[locale]/PublicQuoteExperience.tsx',
  )
  assert.match(experience, /isPublicGrillDraftAnswered/)
  assert.match(experience, /initialStep=\{restoredStep\}/)
})

/* TEST 10 package + garnish math */
test('TEST 10 CDL packages with garnish: base + sides = total', () => {
  const byKey = new Map(CDL_PACKAGES.map((pkg) => [pkg.package_key, pkg]))
  const withSides = CDL_PACKAGES.filter((pkg) => pkg.with_sides)
  assert.ok(withSides.length >= 4)
  for (const pkg of withSides) {
    const base = byKey.get(pkg.package_key.replace(/\+$/, ''))
    assert.ok(base, `missing base for ${pkg.package_key}`)
    const pricing = resolvePackageSidesPricing(
      pkg,
      base,
      SIDES_PRICE_PER_PERSON,
    )
    assert.ok(pricing)
    assert.equal(pricing.mode, 'breakdown')
    assert.equal(pricing.basePricePerPerson, base.price_per_person)
    assert.equal(pricing.sidesPricePerPerson, SIDES_PRICE_PER_PERSON)
    assert.equal(pricing.totalPerPerson, pkg.price_per_person)
    assert.equal(
      pricing.basePricePerPerson + pricing.sidesPricePerPerson,
      pricing.totalPerPerson,
    )
    assert.equal(packageSidesMathHolds(pkg, base, SIDES_PRICE_PER_PERSON), true)
    assert.equal(
      formatPackageHeroPrice(pricing.totalPerPerson),
      `$${pricing.totalPerPerson}`,
    )
  }
  const commercial = source('Lib/cdlCommercialRules.ts')
  assert.match(commercial, /SIDES_PRICE_PER_PERSON = 13/)
  assert.match(commercial, /price_per_person: 65/)
  assert.match(commercial, /price_per_person: 78/)
})

test('TEST 10 packages without garnish do not invent a sides line', () => {
  const pkg = CDL_PACKAGES.find((item) => item.package_key === 'BBQCHO')
  assert.ok(pkg)
  assert.equal(getPackageCatalogVariant(pkg), 'without_sides')
  assert.equal(
    resolvePackageSidesPricing(pkg, null, SIDES_PRICE_PER_PERSON),
    null,
  )
  assert.equal(getPackageCatalogPrice(pkg), 65)
})

/* TEST 11-13 localized overlay copy */
test('TEST 11 PT package overlay copy', () => {
  assert.equal(getPackagePriceCaption('pt'), 'DÓLARES POR PESSOA')
  assert.match(getPackageSidesDescription('pt'), /Feijão preto/i)
  assert.doesNotMatch(getPackageSidesDescription('pt'), /tropeiro/i)
})

test('TEST 12 EN package overlay copy', () => {
  assert.equal(getPackagePriceCaption('en'), 'DOLLARS PER PERSON')
  assert.match(getPackageSidesDescription('en'), /black beans/i)
  assert.doesNotMatch(getPackageSidesDescription('en'), /tropeiro/i)
})

test('TEST 13 ES package overlay copy', () => {
  assert.equal(getPackagePriceCaption('es'), 'DÓLARES POR PERSONA')
  assert.match(getPackageSidesDescription('es'), /Frijoles negros/i)
  assert.doesNotMatch(getPackageSidesDescription('es'), /tropeiro/i)
})

test('TEST 14 Feijão preto is the garnish overlay, not tropeiro', () => {
  const hero = source('components/quotes/PackageCatalogHeroArt.tsx')
  const catalog = source('components/quotes/PublicPackageCatalog.tsx')
  assert.match(hero, /getPackageSidesDescription/)
  assert.match(hero, /data-package-hero-price/)
  assert.match(hero, /data-package-hero-garnish/)
  assert.match(hero, /@container/)
  assert.match(hero, /bg-\[#14100c\]/)
  assert.doesNotMatch(hero, /bg-black\/75/)
  assert.match(catalog, /data-package-price-breakdown/)
  assert.match(catalog, /data-package-display-total/)
  assert.doesNotMatch(hero, /tropeiro/i)
  assert.doesNotMatch(catalog, /tropeiro/i)
})

/* TEST 15 mileage miles only via company-scoped unit */
test('TEST 15 CDL miles-only formatter hides kilometers', () => {
  assert.equal(parseDistanceDisplayUnit('miles'), 'miles')
  assert.equal(parseDistanceDisplayUnit('km'), 'kilometers')
  assert.equal(parseDistanceDisplayUnit(''), 'both')
  assert.equal(
    formatDistanceForDisplay(131.4, 'miles', {
      miles: '{mi} mi',
      kilometers: '{km} km',
      both: '{mi} mi ({km} km)',
    }),
    '131.4 mi',
  )
  assert.equal(
    formatDistanceForDisplay(1.6, 'both', {
      miles: '{mi} mi',
      kilometers: '{km} km',
      both: '{mi} mi ({km} km)',
    }),
    '1.6 mi (2.6 km)',
  )
  const rules = source('Lib/supabaseCommercialRules.ts')
  assert.match(rules, /distance_display_unit/)
  assert.match(rules, /distanceDisplayUnit: 'both'/)
  assert.doesNotMatch(rules, /hideKilometers = true/)
  const layout = source('components/quote-review/QuoteReviewLayout.tsx')
  assert.match(layout, /formatDistanceForDisplay/)
  assert.match(layout, /distanceDisplayUnit/)
})

/* TEST 16-17 overflow + extras */
test('TEST 16 mobile overflow contracts exist', () => {
  const css = source('app/quotes/[id]/quote-print.css')
  assert.match(css, /minmax\(0, 1fr\)/)
  assert.match(css, /overflow-wrap: anywhere/)
  const wizard = source('app/quotes/new/QuoteWizard.tsx')
  assert.match(wizard, /min-w-0 max-w-full/)
  const stepper = source('components/quotes/QuoteStepper.tsx')
  assert.match(stepper, /max-w-full/)
  assert.doesNotMatch(stepper, /overflow-x-auto/)
})

test('TEST 17 extras review UI no longer shows REVISADA', () => {
  const extras = source(
    'components/quotes/additionals/AdditionalCategorySection.tsx',
  )
  assert.doesNotMatch(extras, /categoryReviewStatusReviewed/)
  assert.doesNotMatch(extras, /IntersectionObserver/)
  assert.match(extras, /data-category-reviewed/)
  const wizard = source('app/quotes/new/QuoteWizard.tsx')
  assert.doesNotMatch(
    wizard,
    /setVisitedAdditionalCategories\(new Set\(additionalCategoryKeys\)\)/,
  )
  assert.match(wizard, /handleAdditionalsNextBlockedClick/)
  assert.match(wizard, /scrollToAdditionalCategory/)
  assert.match(wizard, /additionalsStepNextDisabled/)
  const stepNav = source('components/quotes/QuoteWizardStepNav.tsx')
  assert.match(stepNav, /data-additionals-review-hint/)
  assert.match(stepNav, /additionalsReviewMessage/)
})

test('inline package options remain under the selected card', () => {
  const catalog = source('components/quotes/PublicPackageCatalog.tsx')
  assert.match(catalog, /data-public-package-options/)
  assert.match(catalog, /lg:col-span-2/)
})

if (failed > 0) {
  console.error(`\n${failed} failed, ${passed} passed`)
  process.exit(1)
}

console.log(`\n${passed} passed`)
