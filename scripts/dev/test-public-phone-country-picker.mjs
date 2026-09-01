/**
 * Public phone country picker: no autofocus, portal above sticky actions.
 *
 * Run: npm run test:dev:public-phone-country-picker
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { filterPhoneCountries } from '../../Lib/publicQuote/phoneCountries.ts'

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

const field = source('components/quotes/PublicPhoneField.tsx')
const css = source('app/globals.css')
const wizard = source('app/quotes/new/QuoteWizard.tsx')
const address = source('app/quotes/new/AddressAutocompleteFields.tsx')
const phone = source('Lib/publicQuote/phone.ts')
const countries = source('Lib/publicQuote/phoneCountries.ts')

test('COUNTRY_PICKER_NO_AUTOFOCUS', () => {
  assert.doesNotMatch(field, /autoFocus/)
  assert.doesNotMatch(field, /searchUnlocked/)
  assert.doesNotMatch(field, /searchInputRef/)
  assert.doesNotMatch(field, /onFocus=/)
  assert.doesNotMatch(field, /data-phone-country-search[\s\S]{0,400}\.focus\(/)
})

test('OPEN_BLURS_ACTIVE_INPUT', () => {
  assert.match(field, /function blurActiveElement/)
  assert.match(field, /document\.activeElement/)
  assert.match(field, /active\.blur\(\)/)
  assert.match(field, /function openPicker\(\) \{\s*blurActiveElement\(\)/)
  assert.match(field, /onPointerDown=\{\(\) => \{\s*if \(open\) return\s*blurActiveElement\(\)/)
})

test('OPEN_PARKS_FOCUS_ON_CLOSE_NOT_SEARCH', () => {
  assert.match(field, /closeButtonRef\.current\?\.focus\(\{ preventScroll: true \}\)/)
  assert.match(
    field,
    /if \(active instanceof HTMLInputElement \|\| active instanceof HTMLTextAreaElement\) \{\s*active\.blur\(\)/,
  )
})

test('PICKER_PORTAL_DIALOG', () => {
  assert.match(field, /createPortal/)
  assert.match(field, /document\.body/)
  assert.match(field, /data-phone-country-picker/)
  assert.match(field, /role="dialog"/)
  assert.match(field, /aria-modal="true"/)
  assert.match(field, /data-phone-country-search/)
  assert.match(field, /data-phone-country-list/)
  assert.match(field, /onChange=\{\(event\) => setQuery\(event\.target\.value\)\}/)
})

test('COUNTRY_SELECT_TARGET_NATIONAL_PHONE', () => {
  assert.match(field, /function selectCountry\(/)
  assert.match(field, /closePicker\(\{ restoreCountryFocus: false \}\)/)
  assert.match(field, /nationalInputRef\.current\?\.focus\(/)
  assert.match(field, /data-phone-national/)
  assert.doesNotMatch(field, /data-phone-area/)
  assert.match(field, /countryButtonRef\.current\?\.focus\(\{ preventScroll: true \}\)/)
  assert.match(
    field,
    /onClick=\{\(\) => \(open \? closePicker\(\) : openPicker\(\)\)\}/,
  )
})

test('PICKER_Z_INDEX_ABOVE_STICKY_NAV', () => {
  const picker = css.match(/\.public-phone-country-picker \{[\s\S]*?\n\}/)?.[0]
  assert.ok(picker)
  assert.match(picker, /z-index:\s*60/)
  const nav = source('components/quotes/QuoteWizardStepNav.tsx')
  assert.match(nav, /sticky bottom-0 z-30/)
})

test('PICKER_USES_DVH_AND_VISUAL_VIEWPORT', () => {
  assert.match(css, /70dvh/)
  assert.match(css, /--public-phone-country-picker-vh/)
  assert.match(field, /window\.visualViewport/)
  assert.match(css, /env\(safe-area-inset-bottom/)
  assert.match(css, /overscroll-behavior:\s*contain/)
})

test('SEARCH_BRASIL_FILTERS_TO_BR', () => {
  const rows = filterPhoneCountries('Brasil', 'pt')
  assert.equal(rows.length, 1)
  assert.equal(rows[0]?.iso2, 'BR')
  assert.equal(rows[0]?.callingCode, '55')
  const byCode = filterPhoneCountries('+55', 'pt')
  assert.ok(byCode.some((row) => row.iso2 === 'BR'))
  assert.ok(byCode.length < 10)
  assert.match(countries, /digits\.length > 0 && country\.callingCode\.includes\(digits\)/)
})

test('PHONE_MODEL_UNCHANGED', () => {
  assert.match(field, /composePublicPhoneE164/)
  assert.match(field, /splitPublicPhone/)
  assert.match(field, /chosenIso2Ref/)
  assert.match(phone, /export function composePublicPhoneE164/)
  assert.match(countries, /export function resolveDefaultPhoneCountryIso2/)
})

test('ADDRESS_AND_OTHER_STEPS_UNTOUCHED_IN_THIS_DIFF_GUARD', () => {
  assert.match(address, /data-address-number/)
  assert.match(address, /data-address-search/)
  assert.match(wizard, /revealGuestChildrenAfterAdults/)
})

if (failed > 0) {
  console.error(`\n${failed} failed, ${passed} passed`)
  process.exit(1)
}

console.log(`\n${passed} passed`)
