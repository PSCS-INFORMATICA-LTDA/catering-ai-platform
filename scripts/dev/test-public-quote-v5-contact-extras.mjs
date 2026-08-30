/**
 * Public Quote V5 — contact UX, extras filter, single-state services,
 * review reconciliation, and media gates.
 *
 * Run: node --experimental-strip-types scripts/dev/test-public-quote-v5-contact-extras.mjs
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  composePublicPhoneE164,
  formatNationalPhoneDisplay,
  splitPublicPhone,
  toPublicPhoneE164,
} from '../../Lib/publicQuote/phone.ts'
import { resolveDefaultPhoneCountryIso2 } from '../../Lib/publicQuote/phoneCountries.ts'
import {
  DISPOSABLE_KIT_ITEM_KEY,
  SERVICES_SUPPLIES_CATEGORY_KEY,
  WAITER_SERVICE_ITEM_KEY,
  filterPublicExtraItemsForPackage,
  shouldShowAccompanimentExtras,
} from '../../Lib/publicQuote/extrasEligibility.ts'
import { getQuoteStrings } from '../../Lib/quoteTranslations.ts'
import { PACKAGE_FOLDER_ART_V2 } from '../../Lib/publicQuote/packageFolderArt.generated.ts'

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

function areRequiredComplete(groups, selections) {
  const required = groups.filter(
    (group) => group.required === true && (group.items?.length ?? 0) > 0,
  )
  if (required.length === 0) return false
  return required.every((group) => Boolean(selections[group.id]?.trim()))
}

test('PHONE_A_US_E164', () => {
  assert.equal(composePublicPhoneE164('US', '4075551234'), '+14075551234')
  assert.equal(toPublicPhoneE164('+14075551234'), '+14075551234')
})

test('PHONE_B_BR_E164', () => {
  assert.equal(composePublicPhoneE164('BR', '11999999999'), '+5511999999999')
  assert.equal(toPublicPhoneE164('+5511999999999'), '+5511999999999')
})

test('PHONE_C_COUNTRY_MISSING_BLOCKS', () => {
  assert.equal(composePublicPhoneE164(null, '4075551234'), null)
  assert.equal(composePublicPhoneE164('', '11999999999'), null)
})

test('PHONE_D_NATIONAL_MISSING_BLOCKS', () => {
  assert.equal(composePublicPhoneE164('US', ''), null)
  assert.equal(composePublicPhoneE164('BR', '   '), null)
})

test('PHONE_E_DISPLAY_DOES_NOT_CHANGE_CANONICAL', () => {
  const display = formatNationalPhoneDisplay('US', '4075551234')
  assert.equal(display, '(407) 555-1234')
  assert.equal(composePublicPhoneE164('US', display), '+14075551234')
  const brDisplay = formatNationalPhoneDisplay('BR', '11999999999')
  assert.equal(composePublicPhoneE164('BR', brDisplay), '+5511999999999')
})

test('PHONE_STRIPS_DUPLICATE_CALLING_CODE', () => {
  assert.equal(composePublicPhoneE164('BR', '+55 11 99999 9999'), '+5511999999999')
  assert.equal(composePublicPhoneE164('BR', '5511999999999'), '+5511999999999')
  assert.equal(composePublicPhoneE164('US', '+1 407 555 1234'), '+14075551234')
})

test('PHONE_DEFAULT_FROM_COMPANY_NOT_LOCALE', () => {
  assert.equal(
    resolveDefaultPhoneCountryIso2({ allowedCountries: ['US'] }),
    'US',
  )
  assert.equal(
    resolveDefaultPhoneCountryIso2({
      allowedCountries: [],
      branchCountry: 'USA',
    }),
    'US',
  )
  assert.equal(
    resolveDefaultPhoneCountryIso2({ allowedCountries: [], branchCountry: null }),
    null,
  )
  const field = source('components/quotes/PublicPhoneField.tsx')
  assert.match(field, /resolveDefaultPhoneCountryIso2/)
  assert.match(field, /allowedCountries/)
  assert.match(field, /branchCountry/)
  assert.doesNotMatch(field, /language === 'pt'[\s\S]{0,80}iso2/)
  assert.match(field, /data-public-phone-split/)
  assert.match(field, /data-phone-country/)
  assert.match(field, /data-phone-national/)
  assert.match(field, /chosenIso2Ref/)
  assert.match(field, /inputMode="tel"/)
  assert.doesNotMatch(field, /type="number"/)
})

test('PHONE_SPLIT_RESTORES_CANONICAL', () => {
  const us = splitPublicPhone('+14075551234', 'US')
  assert.equal(us.iso2, 'US')
  assert.equal(us.nationalDigits, '4075551234')
  const br = splitPublicPhone('+5511999999999', 'BR')
  assert.equal(br.iso2, 'BR')
  assert.equal(br.nationalDigits, '11999999999')
})

test('WHATSAPP_READY_E164_NO_SEND', () => {
  const field = source('components/quotes/PublicPhoneField.tsx')
  const wizard = source('app/quotes/new/QuoteWizard.tsx')
  assert.match(field, /composePublicPhoneE164/)
  assert.doesNotMatch(field, /whatsapp\.com|wa\.me|WhatsApp/)
  assert.doesNotMatch(wizard, /fetch\(['"`].*whatsapp/i)
})

test('ADDRESS_FOCUS_STREET_NUMBER_PRESERVES_CHILDREN_AND_PLACES', () => {
  const wizard = source('app/quotes/new/QuoteWizard.tsx')
  const address = source('app/quotes/new/AddressAutocompleteFields.tsx')
  assert.match(wizard, /data-event-address-entry/)
  assert.match(wizard, /data-guest-children-under-3/)
  assert.match(wizard, /data-guest-children-4-12/)
  assert.match(wizard, /streetNumberInputRef\.current/)
  assert.match(address, /data-address-search/)
  assert.match(address, /data-address-number/)
  assert.match(address, /inputMode="numeric"/)
  assert.doesNotMatch(
    address,
    /inputMode="numeric"[\s\S]{0,80}autoComplete="street-address"/,
  )
  assert.match(address, /addressPlaceId/)
  assert.match(address, /addressLatitude/)
})

test('CUSTOM_PACKAGE_IDENTITY_IS_KEY', () => {
  assert.equal(shouldShowAccompanimentExtras({ package_key: 'BBQPERS' }), true)
  assert.equal(shouldShowAccompanimentExtras({ package_key: 'BBQPERS+' }), true)
  assert.equal(shouldShowAccompanimentExtras({ package_key: 'BBQLUX' }), false)
  assert.equal(shouldShowAccompanimentExtras({ package_key: 'BBQPRI' }), false)
  assert.equal(
    shouldShowAccompanimentExtras({ package_name: 'Pacote Personalizado' }),
    false,
  )
  const groups = source('Lib/packageOptionGroups.ts')
  assert.match(groups, /\\bPERS\\b\|BBQPERS/)
  assert.match(source('Lib/publicQuote/extrasEligibility.ts'), /\\bPERS\\b\|BBQPERS/)
})

test('ACCOMPANIMENTS_HIDDEN_ONLY_WHEN_INCLUDED', () => {
  const items = [
    {
      id: 'a',
      item_key: 'ITEM_061',
      category_key: 'ACOMPANHAMENTOS',
      item_type: 'PRODUCT',
      can_be_additional: true,
      customer_visible: true,
      active: true,
    },
    {
      id: 'b',
      item_key: 'ITEM_001',
      category_key: 'BOVINO_NOBRE',
      item_type: 'PRODUCT',
      can_be_additional: true,
      customer_visible: true,
      active: true,
    },
  ]
  assert.deepEqual(
    filterPublicExtraItemsForPackage(items, { package_key: 'BBQLUX' }).map(
      (row) => row.item_key,
    ),
    ['ITEM_061', 'ITEM_001'],
  )
  assert.deepEqual(
    filterPublicExtraItemsForPackage(items, { package_key: 'BBQPERS' }).map(
      (row) => row.item_key,
    ),
    ['ITEM_061', 'ITEM_001'],
  )
})

test('SERVICES_SUPPLIES_IS_LAST_AND_SINGLE_STATE', () => {
  assert.equal(SERVICES_SUPPLIES_CATEGORY_KEY, 'SERVICOS_E_SUPRIMENTOS')
  assert.equal(WAITER_SERVICE_ITEM_KEY, 'CDL_WAITER_SERVICE')
  assert.equal(DISPOSABLE_KIT_ITEM_KEY, 'KIT_DESCARTAVEIS')
  const translations = source('Lib/quoteTranslations.ts')
  const extras = source('Lib/publicQuote/suggestedExtras.ts')
  const wizard = source('app/quotes/new/QuoteWizard.tsx')
  assert.match(extras, /export function appendServiceSupplyGroup/)
  assert.match(wizard, /appendServiceSupplyGroup/)
  assert.match(wizard, /state\.additionals\[disposableKitItem\.id\]/)
  assert.match(wizard, /fromWithSidesSection &&[\s\S]*disposableKitItem\.id/)
  assert.match(translations, /Services & Supplies/)
  assert.match(translations, /Servicios y Suministros/)
  assert.equal(getQuoteStrings('pt').wizard.includedInPackage, 'Incluído no pacote')
  assert.equal(getQuoteStrings('en').wizard.includedInPackage, 'Included in package')
  assert.equal(getQuoteStrings('es').wizard.includedInPackage, 'Incluido en el paquete')
})

test('REQUIRED_OPTIONS_COMPLETE_TRANSITION', () => {
  const groups = [
    {
      id: 'g1',
      required: true,
      items: [{ id: 'i1' }],
    },
    {
      id: 'g2',
      required: true,
      items: [{ id: 'i2' }],
    },
  ]
  assert.equal(areRequiredComplete(groups, {}), false)
  assert.equal(areRequiredComplete(groups, { g1: 'i1' }), false)
  assert.equal(areRequiredComplete(groups, { g1: 'i1', g2: 'i2' }), true)
  assert.equal(areRequiredComplete([], {}), false)
  assert.match(
    source('Lib/packageOptionGroups.ts'),
    /export function areRequiredPackageOptionsComplete/,
  )
  assert.match(
    source('components/quotes/PublicPackageCatalog.tsx'),
    /justCompleted/,
  )
})

test('REVIEW_LINE_MATH_AND_SECTION', () => {
  assert.equal(3 * 50, 150)
  assert.equal(3 * 250, 750)
  const review = source('components/quote-review/QuoteReviewLayout.tsx')
  const mapper = source('components/quote-review/mapWizardToQuoteReview.ts')
  assert.match(review, /sectionKey="additionals"/)
  assert.match(review, /additionalsSection/)
  assert.match(review, /data-review-additional-id/)
  assert.match(mapper, /item\.perPerson \? input\.billableGuestCount : item\.quantity/)
})

test('I18N_V5_KEYS_PT_EN_ES', () => {
  for (const language of ['pt', 'en', 'es']) {
    const strings = getQuoteStrings(language)
    assert.ok(strings.wizard.phoneCountryRequired)
    assert.ok(strings.wizard.phoneNationalRequired)
    assert.ok(strings.wizard.phoneInvalidSplit)
    assert.ok(strings.wizard.disposableKitTitle)
    assert.ok(strings.wizard.waiterSectionTitle)
    assert.ok(strings.wizard.includedInPackage)
    assert.ok(strings.review.additionalsSection)
  }
  assert.equal(getQuoteStrings('pt').review.additionalsSection, 'Adicionais')
  assert.equal(getQuoteStrings('en').review.additionalsSection, 'Additional Items')
  assert.equal(getQuoteStrings('es').review.additionalsSection, 'Adicionales')
})

test('LUXURY_MEDIA_MAP_PILOT', () => {
  assert.equal(PACKAGE_FOLDER_ART_V2.BBQLUX.pt, 'bbqlux-pt-v3.webp')
  assert.equal(PACKAGE_FOLDER_ART_V2.BBQLUX.en, 'bbqlux-en-v3.webp')
  assert.equal(PACKAGE_FOLDER_ART_V2.BBQLUX.es, 'bbqlux-es-v3.webp')
  assert.equal(PACKAGE_FOLDER_ART_V2['BBQLUX+'].pt, 'bbqlux-plus-pt-v3.webp')
  assert.equal(PACKAGE_FOLDER_ART_V2['BBQLUX+'].en, 'bbqlux-plus-en-v3.webp')
  assert.equal(PACKAGE_FOLDER_ART_V2['BBQLUX+'].es, 'bbqlux-plus-es-v3.webp')
  assert.match(source('Lib/publicQuote/packageFolderArt.generated.ts'), /bbqpri-pt-v6\.webp/)
})

if (failed > 0) {
  console.error(`\n${failed} failed, ${passed} passed`)
  process.exit(1)
}
console.log(`\n${passed} passed`)
