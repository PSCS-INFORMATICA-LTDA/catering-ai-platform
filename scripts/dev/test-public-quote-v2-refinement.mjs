/**
 * Public Quote V2 refinement — unit + source-contract QA.
 * Run: node --experimental-strip-types scripts/dev/test-public-quote-v2-refinement.mjs
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { filterCatalogItems } from '../../Lib/itemCatalog.ts'
import {
  displayPublicPhone,
  formatPublicPhoneInput,
  getPublicPhoneDefault,
  isUsablePublicPhone,
  sanitizeStoredPublicPhone,
  toPublicPhoneE164,
} from '../../Lib/publicQuote/phone.ts'
import {
  CDL_FLORIDA_LOCATION_BIAS,
  resolvePublicLocationBias,
} from '../../Lib/publicQuote/locationBias.ts'
import {
  findPackageByIdOrKey,
  resolvePackageIdForPersistence,
} from '../../Lib/publicQuote/packageLookup.ts'
import {
  getAdditionalChargeUnit,
  getAdditionalChargeUnitLabel,
} from '../../Lib/additionalChargeUnit.ts'
import { getCatalogItemSalePrice } from '../../Lib/itemCatalog.ts'
import {
  formatMileageQuantity,
  formatMilesWithKilometers,
  kilometersToMiles,
  milesToKilometers,
} from '../../Lib/units.ts'
import {
  enrichGooglePlaceFromGeocoder,
  parseGooglePlace,
} from '../../app/quotes/new/googlePlaces.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

let passed = 0
let failed = 0

function test(name, callback) {
  try {
    const result = callback()
    if (result instanceof Promise) throw new Error('use testAsync for promises')
    passed += 1
    console.log(`PASS  ${name}`)
  } catch (error) {
    failed += 1
    console.error(`FAIL  ${name}`)
    console.error(`      ${error instanceof Error ? error.message : error}`)
  }
}

async function testAsync(name, callback) {
  try {
    await callback()
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

function place(components, formatted) {
  return {
    place_id: 'place-test',
    formatted_address: formatted,
    address_components: components,
  }
}

function component(longName, types) {
  return { long_name: longName, short_name: longName, types }
}

/* ---------------------------------------------------------- phone (step 1) */

test('phone field starts empty and never injects a country code', () => {
  assert.equal(getPublicPhoneDefault(), '')
  assert.equal(formatPublicPhoneInput(''), '')
  assert.equal(formatPublicPhoneInput('   '), '')
  assert.equal(displayPublicPhone(''), '')
  assert.equal(displayPublicPhone(null), '')
  assert.equal(formatPublicPhoneInput('+'), '+')
  // Erasing the country code must not restore +1.
  assert.equal(formatPublicPhoneInput('+1'), '+1')
  assert.equal(formatPublicPhoneInput(''), '')
})

test('phone keeps an explicitly typed US code formatted', () => {
  assert.equal(formatPublicPhoneInput('+14075551234'), '+1 (407) 555-1234')
  assert.equal(toPublicPhoneE164('+1 (407) 555-1234'), '+14075551234')
  assert.equal(isUsablePublicPhone('+1 (407) 555-1234'), true)
})

test('phone accepts a bare US number without showing a forced +1', () => {
  assert.equal(formatPublicPhoneInput('4075551234'), '4075551234')
  assert.doesNotMatch(formatPublicPhoneInput('4075551234'), /\+1/)
  assert.equal(toPublicPhoneE164('4075551234'), '+14075551234')
  assert.equal(isUsablePublicPhone('4075551234'), true)
})

test('phone preserves other country codes', () => {
  assert.equal(formatPublicPhoneInput('+55 11 97618-2170'), '+55 11 97618-2170')
  assert.equal(toPublicPhoneE164('+55 11 97618-2170'), '+5511976182170')
  assert.match(formatPublicPhoneInput('+5'), /^\+5$/)
  assert.match(formatPublicPhoneInput('+55'), /^\+55$/)
  assert.match(formatPublicPhoneInput('+34600123456'), /^\+34/)
  assert.match(formatPublicPhoneInput('+447700900123'), /^\+44/)
  assert.equal(toPublicPhoneE164('+34600123456'), '+34600123456')
  assert.equal(formatPublicPhoneInput('0055 11 976182170'), '+55 11 97618-2170')
})

test('a plus typed after other digits restarts the country code', () => {
  // Field already holding a legacy "+1 " and the customer types +55.
  assert.equal(
    formatPublicPhoneInput('+1 +55 11 97618-2170'),
    '+55 11 97618-2170',
  )
  assert.equal(formatPublicPhoneInput('(407) 555-1234+55'), '+55')
  assert.equal(toPublicPhoneE164('+1 +55 11 97618-2170'), '+5511976182170')
})

test('legacy stored bare country codes restore as empty', () => {
  assert.equal(sanitizeStoredPublicPhone('+1 '), '')
  assert.equal(sanitizeStoredPublicPhone('+1'), '')
  assert.equal(sanitizeStoredPublicPhone('+'), '')
  assert.equal(sanitizeStoredPublicPhone(''), '')
  assert.equal(sanitizeStoredPublicPhone(null), '')
  assert.equal(sanitizeStoredPublicPhone('+14075551234'), '+14075551234')
  assert.equal(
    sanitizeStoredPublicPhone('+55 11 97618-2170'),
    '+55 11 97618-2170',
  )
  const experience = source(
    'app/quote/[companySlug]/[locale]/PublicQuoteExperience.tsx',
  )
  assert.match(experience, /sanitizeStoredPublicPhone\(draft\.contact\?\.phone\)/)
  const wizard = source('app/quotes/new/QuoteWizard.tsx')
  assert.match(wizard, /sanitizeStoredPublicPhone\(base\.customerDraftPhone\)/)
})

test('phone rejects incomplete numbers', () => {
  assert.equal(isUsablePublicPhone('+1'), false)
  assert.equal(isUsablePublicPhone('+1 (407)'), false)
  assert.equal(toPublicPhoneE164('123'), null)
  assert.equal(toPublicPhoneE164(''), null)
  // Local Brazilian mobile without a country code must ask for the code.
  assert.equal(toPublicPhoneE164('11976182170'), null)
})

test('public phone field has no focus-time default and shows an example', () => {
  const field = source('components/quotes/PublicPhoneField.tsx')
  assert.doesNotMatch(field, /onFocus/)
  assert.match(field, /publicPhonePlaceholder/)
  const wizard = source('app/quotes/new/QuoteWizard.tsx')
  assert.doesNotMatch(wizard, /getPublicPhoneDefault/)
  const experience = source(
    'app/quote/[companySlug]/[locale]/PublicQuoteExperience.tsx',
  )
  assert.doesNotMatch(experience, /getPublicPhoneDefault/)
  const translations = source('Lib/quoteTranslations.ts')
  assert.match(translations, /publicPhonePlaceholder: 'Ex\.: \+1 407 555 0123'/)
  assert.match(translations, /publicPhonePlaceholder: 'e\.g\. \+1 407 555 0123'/)
  assert.match(translations, /publicPhonePlaceholder: 'Ej\.: \+1 407 555 0123'/)
})

/* -------------------------------------------------- address number (step 2) */

test('street number comes only from the selected Place', () => {
  const withNumber = parseGooglePlace(
    place(
      [
        component('9800', ['street_number']),
        component('International Drive', ['route']),
        component('Orlando', ['locality']),
        component('FL', ['administrative_area_level_1']),
        component('32819', ['postal_code']),
        component('US', ['country']),
      ],
      '9800 International Dr, Orlando, FL 32819, USA',
    ),
  )
  assert.equal(withNumber.addressNumber, '9800')

  const withoutNumber = parseGooglePlace(
    place(
      [
        component('Walnut Avenue', ['route']),
        component('Sarasota', ['locality']),
        component('FL', ['administrative_area_level_1']),
        component('34234', ['postal_code']),
        component('US', ['country']),
      ],
      'Walnut Ave, Sarasota, FL 34234, USA',
    ),
  )
  assert.equal(withoutNumber.addressNumber, '')
})

await testAsync('geocoder enrichment never supplies a street number', async () => {
  const parsed = parseGooglePlace(
    place(
      [
        component('Walnut Avenue', ['route']),
        component('Sarasota', ['locality']),
        component('FL', ['administrative_area_level_1']),
        component('34234', ['postal_code']),
        component('US', ['country']),
      ],
      'Walnut Ave, Sarasota, FL 34234, USA',
    ),
  )
  const enriched = await enrichGooglePlaceFromGeocoder(
    { formatted_address: 'Walnut Ave, Sarasota, FL 34234, USA' },
    parsed,
  )
  assert.equal(enriched.addressNumber, '')

  const places = source('app/quotes/new/googlePlaces.ts')
  assert.match(places, /addressNumber: parsed\.addressNumber,/)
  assert.doesNotMatch(
    places,
    /addressNumber: parsed\.addressNumber \|\| geocoded\.addressNumber/,
  )
})

test('replacing the destination invalidates the previous distance', () => {
  const wizard = source('app/quotes/new/QuoteWizard.tsx')
  assert.match(wizard, /prev\.distance === 0 \? prev : \{ \.\.\.prev, distance: 0 \}/)
  assert.match(wizard, /mileageDistance: isPublicMode \? 0 : state\.distance/)
})

/* ------------------------------------------------------- package (step 3) */

test('package art keeps its natural ratio and is never cropped', () => {
  const catalog = source('components/quotes/PublicPackageCatalog.tsx')
  const hero = source('components/quotes/PackageCatalogHeroArt.tsx')
  assert.match(hero, /className="block h-auto w-full"/)
  assert.doesNotMatch(hero, /object-cover/)
  assert.doesNotMatch(catalog, /object-cover/)
  assert.doesNotMatch(catalog, /aspect-\[/)
  assert.match(catalog, /grid-cols-1 items-start gap-5 lg:grid-cols-2/)
})

test('package options render inline right below the selected package', () => {
  const catalog = source('components/quotes/PublicPackageCatalog.tsx')
  assert.match(catalog, /<Fragment key=\{pkg\.id\}>/)
  assert.match(catalog, /data-public-package-options/)
  assert.match(catalog, /lg:col-span-2/)
  assert.match(catalog, /scrollIntoView\(\{ behavior: 'smooth', block: 'nearest' \}\)/)
})

test('package step exposes a single Next CTA', () => {
  const catalog = source('components/quotes/PublicPackageCatalog.tsx')
  assert.doesNotMatch(catalog, /public-package-next/)
  assert.doesNotMatch(catalog, /onNext/)
  const nav = source('components/quotes/QuoteWizardStepNav.tsx')
  assert.match(nav, /data-testid="wizard-global-next"/)
  assert.match(nav, /keepPackageNextVisible/)
  assert.match(nav, /env\(safe-area-inset-bottom\)/)
  const wizard = source('app/quotes/new/QuoteWizard.tsx')
  const publicCatalogBlock = wizard.slice(
    wizard.indexOf('<PublicPackageCatalog'),
    wizard.indexOf('<QuotePackageStepExplorer'),
  )
  assert.ok(publicCatalogBlock.length > 0, 'public catalog block found')
  assert.doesNotMatch(
    publicCatalogBlock,
    /onNext/,
    'public package step must rely on the global wizard nav only',
  )
  // The approved backoffice explorer keeps its own Next and hides the global one.
  assert.match(wizard, /keepPackageNextVisible=\{isPublicMode\}/)
})

/* ------------------------------------------------------- additionals (4) */

test('charge unit comes from the registered pricing_type/charge_type', () => {
  const perPerson = { id: 'a', pricing_type: 'PER_PERSON', charge_type: 'PERSON' }
  const perUnit = { id: 'b', pricing_type: 'PER_UNIT', charge_type: 'UNIT' }
  const fixed = { id: 'c', pricing_type: 'FIXED', charge_type: 'UNIT' }
  const tray = {
    id: 'd',
    pricing_type: 'PER_UNIT',
    charge_type: 'UNIT',
    unit_label: 'bandeja',
  }
  const genericUnit = {
    id: 'e',
    pricing_type: 'PER_UNIT',
    charge_type: 'UNIT',
    unit_label: 'UN',
  }

  assert.equal(getAdditionalChargeUnit(perPerson), 'person')
  assert.equal(getAdditionalChargeUnit(perUnit), 'unit')
  assert.equal(getAdditionalChargeUnit(fixed), 'fixed')

  assert.equal(getAdditionalChargeUnitLabel(perPerson, 'pt'), 'por pessoa')
  assert.equal(getAdditionalChargeUnitLabel(perPerson, 'en'), 'per person')
  assert.equal(getAdditionalChargeUnitLabel(perPerson, 'es'), 'por persona')
  assert.equal(getAdditionalChargeUnitLabel(perUnit, 'pt'), 'por unidade')
  assert.equal(getAdditionalChargeUnitLabel(fixed, 'en'), 'fixed price')
  assert.equal(getAdditionalChargeUnitLabel(tray, 'pt'), 'bandeja')
  assert.equal(getAdditionalChargeUnitLabel(genericUnit, 'es'), 'por unidad')
})

test('missing additional price is reported instead of assumed as zero', () => {
  const hasPrice = (item) => getCatalogItemSalePrice(item) > 0
  assert.equal(hasPrice({ id: 'a', sale_price: 12 }), true)
  assert.equal(hasPrice({ id: 'b' }), false)
  assert.equal(hasPrice({ id: 'c', sale_price: 0, price: 0 }), false)
  const display = source('Lib/quoteAdditionalDisplay.ts')
  assert.match(display, /hasAdditionalPrice/)
  const priceDisplay = source('Lib/additionalPriceDisplay.ts')
  assert.match(priceDisplay, /priceUnavailable/)
  const card = source('components/quotes/additionals/AdditionalItemCard.tsx')
  assert.match(card, /getAdditionalPriceLabel/)
  const section = source(
    'components/quotes/additionals/AdditionalCategorySection.tsx',
  )
  assert.match(section, /getAdditionalPriceLabel/)
})

test('expanded additional cards show a price with unit and value', () => {
  const section = source(
    'components/quotes/additionals/AdditionalCategorySection.tsx',
  )
  assert.match(section, /data-additional-items-grid/)
  assert.match(section, /<AdditionalItemCard/)
  assert.match(section, /data-additional-category-summary/)
  const card = source('components/quotes/additionals/AdditionalItemCard.tsx')
  assert.match(card, /getAdditionalChargeUnitLabel/)
  assert.match(card, /grid-cols-\[7\.5rem_minmax\(0,1fr\)\]/)
})

test('additionals require usage flags; inactive and hidden stay filtered', () => {
  const cdlVisible = {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    item_type: 'PRODUCT',
    can_be_additional: true,
    customer_visible: true,
    active: true,
    operational_item: false,
  }
  const rows = filterCatalogItems(
    [
      cdlVisible,
      { ...cdlVisible, id: 'b', active: false },
      { ...cdlVisible, id: 'c', customer_visible: false },
      { ...cdlVisible, id: 'd', can_be_additional: false },
    ],
    'additional',
    'customer',
  )
  assert.deepEqual(
    rows.map((row) => row.id),
    [cdlVisible.id],
  )
  const bootstrap = source('Lib/publicQuote/bootstrap.ts')
  assert.match(bootstrap, /can_be_additional:\s*row\.can_be_additional === true/)
  assert.match(bootstrap, /companyId:\s*company\.id/)
})

/* ----------------------------------------------------------- mileage (15) */

test('mileage origin stays company-scoped and is never hardcoded in the UI', () => {
  const rules = source('Lib/supabaseCommercialRules.ts')
  assert.match(rules, /mileage_base_location/)
  const preview = source('app/api/public/quote-intake/preview/route.ts')
  assert.match(preview, /rules\.mileageBaseLocation/)
  const catalog = source('components/quotes/PublicPackageCatalog.tsx')
  assert.doesNotMatch(catalog, /Orlando/)
  const confirmation = source(
    'components/quote-review/PublicQuoteConfirmationStep.tsx',
  )
  assert.doesNotMatch(confirmation, /Orlando Eye/)
})

test('miles convert to kilometers for display only', () => {
  assert.equal(milesToKilometers(1.6), 2.6)
  assert.equal(milesToKilometers(20), 32.2)
  assert.equal(milesToKilometers(0), 0)
  assert.equal(kilometersToMiles(32.2), 20)
  assert.equal(
    formatMilesWithKilometers(1.6, '{mi} mi ({km} km)'),
    '1.6 mi (2.6 km)',
  )
  assert.equal(formatMileageQuantity(11.600000000000001), '11.6')
  assert.equal(formatMileageQuantity(31.6), '31.6')
  assert.equal(formatMileageQuantity(20), '20')
  assert.equal(formatMileageQuantity(0), '0')
  assert.equal(`${formatMileageQuantity(11.600000000000001)} mi`, '11.6 mi')
  assert.equal(formatMilesWithKilometers(null, '{mi} mi ({km} km)'), null)
  const layout = source('components/quote-review/QuoteReviewLayout.tsx')
  assert.match(layout, /formatDistanceForDisplay/)
  assert.match(layout, /mileageDistanceMiles/)
})

test('mileage missing config is explicit in the preview route', () => {
  const preview = source('app/api/public/quote-intake/preview/route.ts')
  assert.match(preview, /missing_origin|Mileage origin/)
  assert.match(preview, /hasConfirmedGoogleAddress/)
  const distance = source('Lib/publicQuote/distance.ts')
  assert.match(distance, /missing_origin/)
  assert.match(distance, /missing_maps_key/)
  assert.match(distance, /lookup_failed/)
  assert.match(distance, /Referer/)
  assert.match(distance, /mapsBrowserReferer|destinationForRoutes/)
})

/* ------------------------------------------------------------ review (18) */

test('confirmation has a single consolidated review', () => {
  const confirm = source(
    'components/quote-review/PublicQuoteConfirmationStep.tsx',
  )
  assert.match(confirm, /QuoteReviewLayout/)
  assert.match(confirm, /editStep/)
  // The duplicated facts card above the review is gone.
  assert.doesNotMatch(confirm, /confirmSectionClient/)
  assert.doesNotMatch(confirm, /confirmSectionGuests/)
  assert.doesNotMatch(confirm, /confirmSectionAdditionals/)
  const factCards = confirm.match(/confirmSectionPackage/g) ?? []
  assert.equal(factCards.length, 1, 'package fallback only while pricing is pending')
})

test('consolidated review carries contact and full address', () => {
  const layout = source('components/quote-review/QuoteReviewLayout.tsx')
  assert.match(layout, /data\.customerPhone/)
  assert.match(layout, /data\.customerEmail/)
  assert.match(layout, /data\.addressNumber/)
  assert.match(layout, /data\.country/)
  assert.match(layout, /mileageRateLabel/)
  assert.match(layout, /mileageRuleSummary/)
  assert.doesNotMatch(layout, /mileageLine\.formula/)
  const mapper = source('components/quote-review/mapWizardToQuoteReview.ts')
  assert.match(mapper, /customerPhone: state\.customerDraftPhone/)
  assert.match(mapper, /customerEmail: state\.customerDraftEmail/)
  assert.match(mapper, /addressNumber: state\.addressNumber/)
  assert.match(mapper, /country: state\.addressCountry/)
})

/* -------------------------------------------------------- kept baselines */

test('end time derives from existing duration rule, not a new hardcoded 4', () => {
  const duration = source('Lib/publicQuote/eventDuration.ts')
  const wizard = source('app/quotes/new/QuoteWizard.tsx')
  const commercial = source('Lib/cdlCommercialRules.ts')
  assert.match(commercial, /SERVICE_DURATION_HOURS\s*=\s*4/)
  assert.match(duration, /SERVICE_DURATION_HOURS/)
  assert.match(duration, /deriveEventEndTime/)
  assert.match(wizard, /deriveEventEndTime/)
  assert.match(wizard, /readOnly=\{isPublicMode\}/)
  assert.doesNotMatch(wizard, /addHoursToTime\(v,\s*4\)/)
})

test('Florida locationBias is company-scoped and never a restriction', () => {
  const cdl = resolvePublicLocationBias({ companySlug: 'cdl' })
  assert.deepEqual(cdl, CDL_FLORIDA_LOCATION_BIAS)
  assert.equal(resolvePublicLocationBias({ companySlug: 'other-tenant' }), null)
  const places = source('app/quotes/new/AddressAutocompleteFields.tsx')
  assert.match(places, /locationBias/)
  assert.match(places, /strictBounds:\s*false/)
  assert.doesNotMatch(places, /locationRestriction/)
})

test('selected package lookup persists by id or key', () => {
  const packages = [
    { id: '11111111-1111-4111-8111-111111111111', package_key: 'BBQPRI' },
    { id: '22222222-2222-4222-8222-222222222222', package_key: 'BBQPRI+' },
  ]
  assert.equal(
    findPackageByIdOrKey(packages, 'BBQPRI')?.id,
    '11111111-1111-4111-8111-111111111111',
  )
  assert.equal(
    resolvePackageIdForPersistence(packages, 'BBQPRI'),
    '11111111-1111-4111-8111-111111111111',
  )
  assert.equal(findPackageByIdOrKey(packages, 'missing'), null)
})

test('preview merges live address/package instead of stale draft only', () => {
  const preview = source('app/api/public/quote-intake/preview/route.ts')
  const merge = source('Lib/publicQuote/previewDraft.ts')
  assert.match(preview, /mergePublicQuotePreviewDraft/)
  assert.match(merge, /packageId/)
  assert.match(merge, /hasConfirmedGoogleAddress/)
})

test('pricing never stays in an endless loading state', () => {
  const confirm = source(
    'components/quote-review/PublicQuoteConfirmationStep.tsx',
  )
  assert.match(confirm, /pricingLoading/)
  assert.match(confirm, /pricingError/)
  assert.match(confirm, /onRetryPricing/)
  const hook = source('Lib/hooks/useQuotePricingPreview.ts')
  assert.match(hook, /PREVIEW_TIMEOUT_MS/)
  assert.match(hook, /code: timedOut \? 'timeout'/)
  assert.match(hook, /}, \[serialized, input\.enabled, input\.packageId\]/)
})

test('pricing stays server-side and public totals are not computed in the browser', () => {
  const confirm = source(
    'components/quote-review/PublicQuoteConfirmationStep.tsx',
  )
  assert.match(confirm, /breakdown/)
  const preview = source('app/api/public/quote-intake/preview/route.ts')
  assert.match(preview, /computeQuotePricing/)
  const submit = source('app/api/public/quote-intake/submit/route.ts')
  assert.match(submit, /computeQuotePricing/)
})

test('PT/EN/ES cover new public quote strings', () => {
  const translations = source('Lib/quoteTranslations.ts')
  for (const key of [
    'endTimeHintPublic',
    'publicPhoneHint',
    'publicPhonePlaceholder',
    'pricingRetry',
    'pricingTimeout',
    'pricingRateLimited',
    'publicSubmitRequest',
    'chargeUnitPerPerson',
    'chargeUnitPerUnit',
    'chargeUnitPerPortion',
    'chargeUnitFixed',
    'priceUnavailable',
    'mileageDistanceMiKm',
    'mileageDistanceMiles',
    'mileageDistanceKm',
  ]) {
    const matches = translations.match(new RegExp(`${key}:`, 'g')) || []
    assert.ok(
      matches.length >= 4,
      `${key} missing in type or locales (${matches.length})`,
    )
  }
  const common = source('Lib/i18n/common.ts')
  assert.match(common, /country: \{ pt: 'País', en: 'Country', es: 'País' \}/)
})

console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
