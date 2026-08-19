/**
 * Public Quote polish — branding, package groups, extras hit-area, review, mileage.
 * Run: node --experimental-strip-types scripts/dev/test-public-quote-polish.mjs
 */
import assert from 'node:assert/strict'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  getPackageCatalogName,
  getPublicPackageFamilyExampleNames,
  getPublicPackageSidesGroup,
} from '../../Lib/packageCatalogVisual.ts'
import { formatMileageQuantity } from '../../Lib/units.ts'
import { tw } from '../../Lib/quoteTranslations.ts'
import {
  formatEventAddressLines,
  isSameEventDestination,
} from '../../Lib/formatEventAddress.ts'
import { publicQuoteSessionHasProgress } from '../../Lib/publicQuote/sessionProgress.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const source = (relativePath) => readFileSync(join(ROOT, relativePath), 'utf8')

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

const experience = source(
  'app/quote/[companySlug]/[locale]/PublicQuoteExperience.tsx',
)
const switcher = source('components/quotes/PublicLocaleSwitcher.tsx')
const bootstrap = source('Lib/publicQuote/bootstrap.ts')
const catalog = source('components/quotes/PublicPackageCatalog.tsx')
const extras = source(
  'components/quotes/additionals/AdditionalCategorySection.tsx',
)
const wizard = source('app/quotes/new/QuoteWizard.tsx')
const stepNav = source('components/quotes/QuoteWizardStepNav.tsx')
const review = source('components/quote-review/QuoteReviewLayout.tsx')
const confirm = source(
  'components/quote-review/PublicQuoteConfirmationStep.tsx',
)
const units = source('Lib/units.ts')
const totals = source('Lib/calculateQuoteTotals.ts')
const mark = source('components/brand/PscsOneMark.tsx')
const sidebar = source('components/layout/CateringSidebar.tsx')
const authShell = source('components/auth/AuthGlassShell.tsx')
const translations = source('Lib/quoteTranslations.ts')
const sessionSrc = source('Lib/publicQuote/session.ts')

test('TEST 1 Public header uses tenant logo', () => {
  assert.match(experience, /data-tenant-logo/)
  assert.match(experience, /bootstrap\.company\.logoUrl/)
  assert.match(experience, /object-contain/)
  assert.match(bootstrap, /resolveCompanyLogoUrl/)
  assert.doesNotMatch(experience, /if \(company === ['\"]CDL['\"]\)/)
  assert.doesNotMatch(bootstrap, /if \(company === ['\"]CDL['\"]\)/)
})

test('TEST 2 PT shows Brazil flag', () => {
  assert.match(switcher, /pt: '🇧🇷'/)
  assert.match(switcher, /pt: 'PT'/)
})

test('TEST 3 EN shows USA flag', () => {
  assert.match(switcher, /en: '🇺🇸'/)
  assert.match(switcher, /en: 'EN'/)
})

test('TEST 4 ES shows Spain flag', () => {
  assert.match(switcher, /es: '🇪🇸'/)
  assert.match(switcher, /es: 'ES'/)
})

test('TEST 5 Locale selector remains accessible', () => {
  assert.match(switcher, /aria-label=\{LOCALE_NAMES\[language\]\}/)
  assert.match(switcher, /pt: 'Português'/)
  assert.match(switcher, /en: 'English'/)
  assert.match(switcher, /es: 'Español'/)
  assert.match(switcher, /data-public-locale-switcher/)
})

test('TEST 6 Package groups start collapsed', () => {
  assert.match(catalog, /useState<PackageSidesGroup \| null>/)
  assert.match(catalog, /if \(!selectedPackageId\) return null/)
  assert.doesNotMatch(catalog, /setOpenGroup\(['\"]with_sides['\"]\)/)
  assert.doesNotMatch(catalog, /setOpenGroup\(['\"]without_sides['\"]\)/)
  assert.doesNotMatch(
    catalog,
    /setOpenGroup\(getPublicPackageSidesGroup/,
  )
})

test('TEST 7 Compact with-sides selector has no inner count', () => {
  assert.match(catalog, /data-package-group=\{group\}/)
  assert.match(catalog, /inline-flex w-fit/)
  assert.doesNotMatch(catalog, /t\.packagesAvailableCount\(packagesWithSides\.length\)/)
  assert.doesNotMatch(catalog, /5 pacotes disponíveis/)
})

test('TEST 8 Compact without-sides selector has no inner count', () => {
  assert.doesNotMatch(
    catalog,
    /t\.packagesAvailableCount\(packagesWithoutSides\.length\)/,
  )
  assert.doesNotMatch(catalog, /packagesWithoutSides\.length === 5/)
})

test('TEST 9 Premium copy lives above the selectors', () => {
  assert.equal(tw('pt', 'publicPackageExperienceTitle'), 'Escolha sua experiência')
  assert.equal(tw('en', 'publicPackageExperienceTitle'), 'Choose your experience')
  assert.equal(tw('es', 'publicPackageExperienceTitle'), 'Elige tu experiencia')
  assert.match(tw('pt', 'publicPackageExperienceBody'), /com ou sem guarnições/)
  assert.match(tw('en', 'publicPackageExperienceBody'), /with or without sides/)
  assert.match(tw('es', 'publicPackageExperienceBody'), /con o sin acompañamientos/)
  assert.match(catalog, /data-package-experience-intro/)
  assert.doesNotMatch(catalog, /packageGroupHint\(/)
})

test('TEST 10 Package name canonical', () => {
  assert.match(catalog, /getPackageCatalogName\(pkg, language\)/)
  assert.doesNotMatch(catalog, /BBQ 3/)
  const name = getPackageCatalogName(
    {
      package_key: 'BBQCHO+',
      package_name: 'BBQ Choice',
      label_pt: 'BBQ Choice',
      label_en: 'BBQ Choice',
      label_es: 'BBQ Choice',
    },
    'pt',
  )
  assert.equal(name, 'BBQ Choice')
})

test('TEST 11 Choice naming consistency', () => {
  const pkg = {
    package_key: 'BBQCHO+',
    package_name: 'BBQ 3',
    label_pt: 'BBQ Choice',
    label_en: 'BBQ Choice',
    label_es: 'BBQ Choice',
  }
  assert.equal(getPackageCatalogName(pkg, 'en'), 'BBQ Choice')
  assert.doesNotMatch(getPackageCatalogName(pkg, 'pt'), /BBQ 3|Package 3/)
  assert.equal(getPublicPackageSidesGroup(pkg), 'with_sides')
})

test('TEST 12 Package pricing unchanged', () => {
  assert.match(catalog, /data-package-price-breakdown/)
  assert.match(catalog, /resolvePackageSidesPricing/)
  assert.doesNotMatch(totals, /formatMileageQuantity/)
  assert.match(catalog, /showGarnishLine/)
})

test('TEST 13 Package options inline unchanged', () => {
  assert.match(catalog, /data-public-package-options/)
  assert.match(catalog, /active && selectableGroups\.length > 0/)
  assert.match(catalog, /lg:col-span-2/)
})

test('TEST 14 Extras start collapsed', () => {
  assert.match(wizard, /useState<\s*Set<string>\s*>\(\(\) => new Set\(\)\)/)
  assert.doesNotMatch(wizard, /new Set\(additionalCategoryKeys\)/)
})

test('TEST 15 Extras do not auto-open', () => {
  assert.doesNotMatch(extras, /shouldAutoOpenAdditionalCategory/)
  const openCalls = wizard.match(/setOpenAdditionalCategories\(/g) ?? []
  assert.equal(openCalls.length, 2)
})

test('TEST 16 Full collapsed category card opens on click', () => {
  assert.match(extras, /data-additional-category-hitarea/)
  assert.match(extras, /absolute inset-0/)
  assert.match(extras, /onClick=\{onToggle\}/)
})

test('TEST 17 Click on summary item/price area opens category', () => {
  const collapsed = extras.slice(extras.indexOf('data-additional-category-hitarea'))
  assert.match(collapsed, /absolute inset-0/)
  assert.match(extras, /data-additional-category-summary/)
  assert.match(extras, /getAdditionalPriceLabel\(item, language\)/)
})

test('TEST 18 Expanded interactive control does not accidentally collapse', () => {
  const expanded = extras.slice(
    extras.indexOf('{expanded ? ('),
    extras.indexOf('data-additional-category-hitarea'),
  )
  assert.match(expanded, /<AdditionalItemCard/)
  assert.match(expanded, /onChangeQty=\{/)
  assert.doesNotMatch(expanded, /onChangeQty[\s\S]{0,80}onToggle/)
})

test('TEST 19 Keyboard expansion works', () => {
  assert.match(extras, /<button/)
  assert.match(extras, /aria-expanded=\{expanded\}/)
  assert.match(extras, /type="button"/)
})

test('TEST 20 Summary items/prices/UOM preserved', () => {
  assert.match(extras, /<ul/)
  assert.match(extras, /<li/)
  assert.match(extras, /getAdditionalPriceLabel/)
  assert.match(extras, /getAdditionalChargeUnitLabel/)
  assert.doesNotMatch(extras, /items\.slice\(/)
})

test('TEST 21 Next stays fixed', () => {
  assert.match(stepNav, /sticky bottom-0/)
  assert.match(wizard, /data-wizard-cta-spacer/)
})

test('TEST 22 Review top duplicate removed', () => {
  assert.doesNotMatch(review, /QuoteProposalOverviewCard/)
  assert.doesNotMatch(review, /quote-proposal-overview-badges/)
  assert.doesNotMatch(review, /withSides[\s\S]{0,40}additionalCount/)
})

test('TEST 23 Review starts at Client', () => {
  const client = review.indexOf('sectionKey="client"')
  const event = review.indexOf('sectionKey="event"')
  const guests = review.indexOf('sectionKey="guests"')
  const pkg = review.indexOf('sectionKey="package"')
  assert.ok(client >= 0 && event > client)
  assert.ok(guests > event)
  assert.ok(pkg > guests)
  assert.match(confirm, /QuoteReviewLayout/)
})

test('TEST 24 People/billing before Package on mobile', () => {
  const guests = review.indexOf('sectionKey="guests"')
  const pkg = review.indexOf('sectionKey="package"')
  assert.ok(guests >= 0 && pkg > guests)
  assert.match(review, /quote-proposal-grid-2/)
})

test('TEST 25 Review keeps all canonical information exactly once', () => {
  assert.match(review, /data\.customerName/)
  assert.match(review, /data\.customerPhone/)
  assert.match(review, /GuestBreakdownPanel/)
  assert.match(review, /QuoteReviewPackageCdlSection/)
  assert.match(review, /t\.review\.additionalsSection/)
  assert.match(review, /t\.review\.mileageSection/)
  assert.equal((review.match(/sectionKey="client"/g) ?? []).length, 2)
})

test('TEST 26 Mileage billable display rounds correctly', () => {
  assert.equal(formatMileageQuantity(11.600000000000001), '11.6')
  assert.equal(formatMileageQuantity(31.6), '31.6')
  assert.equal(formatMileageQuantity(20), '20')
  assert.equal(formatMileageQuantity(0), '0')
  assert.equal(`${formatMileageQuantity(11.600000000000001)} mi`, '11.6 mi')
  assert.match(review, /formatMileageQuantity\(chargedMiles\)/)
  assert.match(review, /formatMileageQuantity\(mileageLine\.quantity\)/)
})

test('TEST 27 Mileage formula unchanged', () => {
  assert.doesNotMatch(totals, /formatMileageQuantity/)
  assert.match(units, /Presentation-only mileage quantity/)
  assert.doesNotMatch(units, /calculateQuoteTotals/)
})

test('TEST 28 PSCS One branding correct', () => {
  assert.match(sidebar, /PSCS One/)
  assert.doesNotMatch(sidebar, /PSCS Informática/)
  assert.match(sidebar, /PscsOneMark/)
  assert.match(mark, /src="\/brand\/pscs-one\.png"/)
  assert.match(mark, /alt="PSCS One"/)
})

test('TEST 29 Same black/red PSCS One logo in light mode', () => {
  assert.match(mark, /bg-white/)
  assert.doesNotMatch(mark, /src="\/brand\/pscs-one-white/)
})

test('TEST 30 Same black/red PSCS One logo in dark mode', () => {
  assert.doesNotMatch(mark, /dark:invert/)
  assert.doesNotMatch(mark, /brightness-0 invert/)
  assert.doesNotMatch(authShell, /dark:invert/)
  assert.doesNotMatch(sidebar, /brightness-0 invert/)
})

test('TEST 31 Public landing tenant-first', () => {
  assert.match(experience, /data-public-landing/)
  assert.match(experience, /bootstrap\.company\.logoUrl/)
  assert.match(experience, /bootstrap\.company\.name/)
  assert.match(experience, /LANDING AGUARDANDO ASSETS FINAIS/)
  const landing = experience.slice(experience.indexOf('data-public-landing'))
  const tenantLogo = landing.indexOf('bootstrap.company.logoUrl')
  const powered = landing.indexOf('data-powered-by')
  assert.ok(tenantLogo >= 0)
  assert.ok(powered === -1 || powered > tenantLogo)
})

test('TEST 32 Powered by PSCS One - Catering AI', () => {
  assert.match(experience, /Powered by PSCS One · Catering AI/)
  assert.doesNotMatch(experience, /Catering App/)
  assert.match(experience, /data-powered-by/)
  assert.match(experience, /data-footer-since-pioneer/)
  assert.equal(
    tw('pt', 'footerSincePioneer'),
    'Desde 2017 · Pioneira em Orlando, Flórida',
  )
  assert.equal(
    tw('en', 'footerSincePioneer'),
    'Since 2017 · Pioneer in Orlando, Florida',
  )
  assert.equal(
    tw('es', 'footerSincePioneer'),
    'Desde 2017 · Pionera en Orlando, Florida',
  )
})

test('TEST 33 No image files edited/generated', () => {
  const changed = execSync('git diff --name-only HEAD', {
    cwd: ROOT,
    encoding: 'utf8',
  })
  const images = changed
    .split('\n')
    .filter((file) => /\.(png|jpe?g|webp|gif|pdf|svg)$/i.test(file))
  assert.deepEqual(images, [])
})

test('TEST 34 No horizontal overflow', () => {
  assert.match(experience, /min-w-0/)
  assert.match(catalog, /min-w-0/)
  assert.match(extras, /overflow-hidden rounded-2xl/)
  assert.match(extras, /min-w-0/)
  assert.match(review, /overflow-x-hidden/)
})

test('family example names never invent packages', () => {
  const names = getPublicPackageFamilyExampleNames(
    [{ package_key: 'BBQCHO+' }, { package_key: 'BBQPRI+' }],
    'pt',
  )
  assert.deepEqual(names, ['Prime', 'Choice'])
  assert.deepEqual(
    getPublicPackageFamilyExampleNames([{ package_key: 'BBQPERS+' }], 'pt'),
    [],
  )
})

test('TEST 35 Language switch resumes same-company session', () => {
  assert.doesNotMatch(
    sessionSrc,
    /session\.company_id === companyId && session\.locale === locale/,
  )
  assert.match(sessionSrc, /session\.company_id !== companyId/)
  assert.match(sessionSrc, /\.update\(\{ locale, draft \}\)/)
  assert.match(experience, /startQuote\(\{ auto: true \}\)/)
  assert.match(experience, /publicQuoteActiveStorageKey/)
})

test('TEST 36 Progress helper does not treat empty drafts as resumable', () => {
  assert.equal(publicQuoteSessionHasProgress(null, 0), false)
  assert.equal(publicQuoteSessionHasProgress({ contact: { firstName: 'Ana' } }, 0), true)
  assert.equal(
    publicQuoteSessionHasProgress({ selection: { packageId: 'pkg-1' } }, 0),
    true,
  )
  assert.equal(publicQuoteSessionHasProgress({}, 2), true)
})

test('TEST 37 Returning to Package reopens the selected family only', () => {
  assert.match(catalog, /getPublicPackageSidesGroup\(selected\)/)
  assert.match(catalog, /if \(!selectedPackageId\) return null/)
})

test('TEST 38 Landing watermark is a centered circular clip', () => {
  assert.match(experience, /data-landing-watermark/)
  assert.match(experience, /overflow-hidden rounded-full/)
  assert.match(experience, /left-1\/2 top-1\/2/)
  assert.match(experience, /-translate-x-1\/2 -translate-y-1\/2/)
  assert.match(experience, /clipPath: 'circle\(46%\)'/)
  assert.doesNotMatch(experience, /-right-8 bottom-\[-12%\]/)
})

test('TEST 39 Landing CTA starts a new quote session', () => {
  assert.match(experience, /startQuote\(\{ forceNew: true \}\)/)
  assert.match(experience, /startQuote\(\{ auto: true \}\)/)
  assert.match(sessionSrc, /options\.forceNew/)
  const route = source('app/api/public/quote-intake/session/route.ts')
  assert.match(route, /forceNew: body\?\.forceNew === true/)
  const startAt = experience.indexOf('async function startQuote')
  const startQuoteFn = experience.slice(
    startAt,
    experience.indexOf('useEffect(() => {', startAt),
  )
  assert.match(startQuoteFn, /options\.forceNew/)
  assert.match(startQuoteFn, /!options\.auto/)
})

test('TEST 40 Review shows the event address once and compact mileage destination', () => {
  assert.match(review, /data-review-event-address/)
  assert.match(review, /data-mileage-destination/)
  assert.match(review, /mileageDestinationSameAsEvent/)
  assert.match(review, /formatEventAddressLines/)
  assert.doesNotMatch(review, /join\(' · '\)/)
  const confirmationEvent = review.slice(
    review.indexOf('function ConfirmationProposalBody'),
    review.indexOf('function DefaultProposalBody'),
  )
  assert.doesNotMatch(confirmationEvent, /quote-proposal-info-grid mt-4/)
  assert.match(confirmationEvent, /<EventLocationBlock/)
  assert.equal(
    (confirmationEvent.match(/<EventLocationBlock/g) ?? []).length,
    1,
  )
  assert.equal((review.match(/data-review-event-address/g) ?? []).length, 1)
})

test('TEST 41 Event address formatter is presentation-only', () => {
  assert.deepEqual(
    formatEventAddressLines({
      line: 'Hillview Loop',
      city: 'Haines City',
      state: 'FL',
      zip: '33844-9685',
    }),
    ['Hillview Loop', 'Haines City, FL 33844-9685'],
  )
  assert.equal(
    isSameEventDestination(
      'Hillview Loop Haines City FL 33844-9685',
      'Hillview Loop\nHaines City, FL 33844-9685',
    ),
    true,
  )
})

test('TEST 42 New quote hydrates empty package and additionals', () => {
  assert.match(experience, /packageId: draft\.selection\?\.packageId \|\| null/)
  assert.match(
    experience,
    /\.filter\(\(line\) => line\.itemId && line\.quantity > 0\)/,
  )
  const types = source('Lib/quoteWizardTypes.ts')
  assert.match(types, /packageId: null/)
  assert.match(types, /additionals: \{\}/)
})

if (failed > 0) {
  console.error(`\n${failed} failed, ${passed} passed`)
  process.exit(1)
}

console.log(`\n${passed} passed`)
