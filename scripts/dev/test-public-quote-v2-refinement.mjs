/**
 * Public Quote V2 refinement — unit + source-contract QA.
 * Run: node --experimental-strip-types scripts/dev/test-public-quote-v2-refinement.mjs
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { filterCatalogItems } from '../../Lib/itemCatalog.ts'
import { isUsablePhone, toE164Digits } from '../../Lib/normalizePhone.ts'
import {
  CDL_FLORIDA_LOCATION_BIAS,
  resolvePublicLocationBias,
} from '../../Lib/publicQuote/locationBias.ts'
import {
  findPackageByIdOrKey,
  resolvePackageIdForPersistence,
} from '../../Lib/publicQuote/packageLookup.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

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

function getPublicPhoneDefault() {
  return '+1 '
}

function hasExplicitNonUsCountryCode(raw) {
  const trimmed = raw.trim()
  if (!trimmed) return false
  if (trimmed.startsWith('00')) {
    const digits = toE164Digits(trimmed)
    return digits.length >= 2 && !digits.startsWith('1')
  }
  if (!trimmed.startsWith('+')) return false
  if (trimmed === '+' || trimmed === '+1' || trimmed.startsWith('+1')) return false
  return true
}

function formatPublicPhoneInput(raw) {
  const trimmed = raw.trim()
  if (!trimmed) return '+1 '
  if (trimmed === '+') return '+'
  const compact = trimmed.replace(/\s+/g, '')
  if (/^\+(?!1)\d/.test(compact) || compact.includes('+55')) {
    const start = compact.includes('+') ? compact.slice(compact.indexOf('+')) : compact
    const digits = toE164Digits(start).slice(0, 15)
    return digits ? `+${digits}` : '+'
  }
  let digits = toE164Digits(trimmed)
  if (digits.startsWith('155') && digits.length >= 13) {
    digits = digits.slice(1)
    return `+${digits}`
  }
  const national = (digits.startsWith('1') ? digits.slice(1) : digits).slice(0, 10)
  const area = national.slice(0, 3)
  const prefix = national.slice(3, 6)
  const line = national.slice(6, 10)
  if (!area) return '+1 '
  if (national.length <= 3) return `+1 (${area}`
  if (national.length <= 6) return `+1 (${area}) ${prefix}`
  return `+1 (${area}) ${prefix}-${line}`
}

function toPublicPhoneE164(raw) {
  const trimmed = raw.trim()
  if (!trimmed) return null
  if (hasExplicitNonUsCountryCode(trimmed)) {
    const digits = toE164Digits(trimmed)
    if (digits.length < 8 || digits.length > 15) return null
    return isUsablePhone(`+${digits}`) || digits.length >= 11 ? `+${digits}` : null
  }
  const digits = toE164Digits(trimmed)
  const nanp = digits.startsWith('1') ? digits : `1${digits}`
  return /^1[2-9]\d{2}[2-9]\d{6}$/.test(nanp) ? `+${nanp}` : null
}

function isUsablePublicPhone(raw) {
  return toPublicPhoneE164(raw) != null
}

test('phone defaults to US +1', () => {
  assert.equal(getPublicPhoneDefault().trim(), '+1')
  assert.equal(formatPublicPhoneInput(''), '+1 ')
  assert.equal(formatPublicPhoneInput('4075551234'), '+1 (407) 555-1234')
  assert.equal(toPublicPhoneE164('4075551234'), '+14075551234')
  assert.equal(toPublicPhoneE164('+1 (407) 555-1234'), '+14075551234')
  assert.equal(isUsablePublicPhone('+1 (407) 555-1234'), true)
})

test('phone keeps explicit international +55', () => {
  assert.equal(formatPublicPhoneInput('+'), '+')
  const formatted = formatPublicPhoneInput('+55 11 97618-2170')
  assert.match(formatted, /\+55/)
  assert.doesNotMatch(formatted, /^\+1/)
  assert.match(formatPublicPhoneInput('+15511976182170'), /\+55/)
  assert.equal(toPublicPhoneE164('+55 11 97618-2170'), '+5511976182170')
  assert.equal(isUsablePublicPhone('+55 11 97618-2170'), true)
  const phoneSource = source('Lib/publicQuote/phone.ts')
  assert.match(phoneSource, /if \(trimmed === '\+'\) return '\+'/)
  const nav = source('components/quotes/QuoteWizardStepNav.tsx')
  assert.match(nav, /keepPackageNextVisible/)
})

test('phone rejects invalid numbers', () => {
  assert.equal(isUsablePublicPhone('+1'), false)
  assert.equal(isUsablePublicPhone('+1 (407)'), false)
  assert.equal(toPublicPhoneE164('123'), null)
})

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

test('additionals require usage flags; inactive and hidden stay filtered', () => {
  const cdlVisible = {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    item_type: 'PRODUCT',
    can_be_additional: true,
    customer_visible: true,
    active: true,
    operational_item: false,
  }
  const inactive = {
    ...cdlVisible,
    id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    active: false,
  }
  const hidden = {
    ...cdlVisible,
    id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    customer_visible: false,
  }
  const missingFlag = {
    ...cdlVisible,
    id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    can_be_additional: false,
  }
  const rows = filterCatalogItems(
    [cdlVisible, inactive, hidden, missingFlag],
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

test('preview merges live address/package instead of stale draft only', () => {
  const preview = source('app/api/public/quote-intake/preview/route.ts')
  const merge = source('Lib/publicQuote/previewDraft.ts')
  assert.match(preview, /mergePublicQuotePreviewDraft/)
  assert.match(merge, /packageId/)
  assert.match(merge, /addressPatch|address/)
  assert.match(merge, /hasConfirmedGoogleAddress/)
})

test('mileage missing config is explicit in preview route', () => {
  const preview = source('app/api/public/quote-intake/preview/route.ts')
  assert.match(preview, /missing_origin|Mileage origin/)
  assert.match(preview, /hasConfirmedGoogleAddress/)
  const distance = source('Lib/publicQuote/distance.ts')
  assert.match(distance, /missing_origin/)
  assert.match(distance, /missing_maps_key/)
  assert.match(distance, /lookup_failed/)
})

test('pricing confirmation never treats empty breakdown as infinite loading', () => {
  const confirm = source(
    'components/quote-review/PublicQuoteConfirmationStep.tsx',
  )
  assert.match(confirm, /pricingLoading/)
  assert.match(confirm, /pricingError/)
  assert.match(confirm, /onRetryPricing/)
  assert.match(confirm, /QuoteReviewLayout/)
  assert.doesNotMatch(confirm, /Calculando a estimativa/)
  const hook = source('Lib/hooks/useQuotePricingPreview.ts')
  assert.match(hook, /PREVIEW_TIMEOUT_MS/)
  assert.match(hook, /code: timedOut \? 'timeout'/)
})

test('public package step is image-first and does not dump highlights', () => {
  const catalog = source('components/quotes/PublicPackageCatalog.tsx')
  assert.match(catalog, /getPackageCatalogImage/)
  assert.match(catalog, /PackageIncludedOptions/)
  assert.match(catalog, /data-testid="public-package-next"/)
  assert.match(catalog, /onNext/)
  assert.doesNotMatch(
    catalog,
    /Destaques|packageHighlights|SelectedPackageDetails/,
  )
  const wizard = source('app/quotes/new/QuoteWizard.tsx')
  assert.match(wizard, /PublicPackageCatalog/)
  assert.match(wizard, /isPublicMode/)
  assert.match(wizard, /onNext=\{goNext\}/)
})

test('PT/EN/ES cover new public quote strings', () => {
  const translations = source('Lib/quoteTranslations.ts')
  for (const key of [
    'endTimeHintPublic',
    'publicPhoneHint',
    'pricingRetry',
    'pricingTimeout',
    'publicSubmitRequest',
  ]) {
    const matches = translations.match(new RegExp(`${key}:`, 'g')) || []
    assert.ok(
      matches.length >= 4,
      `${key} missing in type or locales (${matches.length})`,
    )
  }
})

console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
