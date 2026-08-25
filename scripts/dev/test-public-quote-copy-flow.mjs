/**
 * Package copy polish, additional +/- contrast, and public fast-input flow.
 *
 * Run: node --experimental-strip-types scripts/dev/test-public-quote-copy-flow.mjs
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

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
const phone = source('components/quotes/PublicPhoneField.tsx')
const address = source('app/quotes/new/AddressAutocompleteFields.tsx')
const card = source('components/quotes/additionals/AdditionalItemCard.tsx')
const css = source('app/globals.css')
const phoneLib = source('Lib/publicQuote/phone.ts')
const duration = source('Lib/publicQuote/eventDuration.ts')
const display = source('Lib/quoteAdditionalDisplay.ts')
const visual = source('Lib/packageCatalogVisual.ts')
const generated = source('Lib/publicQuote/packageFolderArt.generated.ts')

test('ADDITIONAL_PLUS_ENABLED_VISIBLE', () => {
  const plus = css.match(/\.public-additional-qty-btn\.is-plus:not\(:disabled\) \{[\s\S]*?\n\}/)?.[0]
  assert.ok(plus)
  assert.match(plus, /#0b1f3a/)
  assert.match(plus, /#fff/)
  assert.match(card, /public-additional-qty-btn is-plus/)
  assert.match(card, /onChangeQty\(normalizedQty \+ 1\)/)
})

test('ADDITIONAL_MINUS_ENABLED_VISIBLE', () => {
  const minus = css.match(/\.public-additional-qty-btn\.is-minus:not\(:disabled\) \{[\s\S]*?\n\}/)?.[0]
  assert.ok(minus)
  assert.match(minus, /#0b1f3a/)
  assert.match(card, /public-additional-qty-btn is-minus/)
  assert.match(card, /onChangeQty\(normalizedQty - 1\)/)
})

test('ADDITIONAL_MINUS_DISABLED_RECOGNIZABLE', () => {
  const disabled = css.match(/\.public-additional-qty-btn:disabled \{[\s\S]*?\n\}/)?.[0]
  assert.ok(disabled)
  assert.match(disabled, /opacity: 1/)
  assert.doesNotMatch(disabled, /opacity:\s*0\.\d/)
  assert.match(disabled, /#8a857c|#c9c4bb|#f0eeea/)
})

test('ADDITIONAL_TOUCH_TARGET_OK', () => {
  const btn = css.match(/\.public-additional-qty-btn \{[\s\S]*?\n\}/)?.[0]
  assert.ok(btn)
  assert.match(btn, /width: 48px/)
  assert.match(btn, /height: 48px/)
  assert.match(css, /:focus-visible/)
})

test('ADDITIONAL_QUANTITY_MATH_UNCHANGED', () => {
  assert.match(display, /export function normalizeAdditionalQuantity/)
  assert.match(display, /export function calcAdditionalLineTotalForItem/)
  assert.match(display, /export function isPerPersonAdditional/)
  assert.match(card, /onChangeQty\(normalizedQty - 1\)/)
  assert.match(card, /onChangeQty\(normalizedQty \+ 1\)/)
  assert.doesNotMatch(card, /Math\.(floor|round|ceil)\(normalizedQty/)
})

test('DATE_COMMIT_OPENS_START_TIME', () => {
  assert.match(wizard, /function DatePickerField/)
  assert.match(wizard, /onCommit\?: \(value: string\) => void/)
  assert.match(wizard, /setStartTimePickerOpen\(true\)/)
  assert.match(wizard, /requestAnimationFrame\(\(\) => \{\s*requestAnimationFrame/)
})

test('EMPTY_START_TIME_DEFAULTS_TO_11_00', () => {
  assert.match(wizard, /emptyDefaultHour=\{isPublicMode \? 11 : 18\}/)
  assert.match(wizard, /setDraftHour\(emptyDefaultHour\)/)
  assert.doesNotMatch(wizard, /selected\?\.hours \?\? 18/)
})

test('EXISTING_START_TIME_PRESERVED', () => {
  assert.match(wizard, /if \(parsed\) \{\s*setDraftHour\(parsed\.hours\)/)
})

test('START_TIME_CONFIRM_FOCUSES_ADULTS', () => {
  assert.match(wizard, /onCommit\?: \(value: string\) => void/)
  assert.match(wizard, /focusWizardField\(adultsInputRef\.current\)/)
  assert.match(wizard, /function selectMinute/)
})

test('ADULTS_NUMERIC_KEYBOARD_HINT', () => {
  assert.match(wizard, /inputMode="numeric"/)
  assert.match(wizard, /pattern="\[0-9\]\*"/)
  assert.match(wizard, /enterKeyHint=\{isPublicMode \? 'next' : undefined\}/)
})

test('ADULTS_VALIDATION_UNCHANGED', () => {
  assert.match(wizard, /if \(typeof value === 'number'\) return value > 0 \? 'filled' : 'empty'/)
  assert.match(wizard, /blankZero=\{isPublicMode\}/)
})

test('ADULTS_TO_ADDRESS_FLOW', () => {
  assert.match(wizard, /guestField/)
  assert.match(wizard, /data-guest-field/)
  assert.match(wizard, /shouldAdvanceFromFieldBlur/)
  assert.match(wizard, /data-guest-address-transition/)
  const adultsCommit = wizard.match(
    /inputRef=\{adultsInputRef\}[\s\S]{0,1600}onCommit=\{[\s\S]{0,1200}scrollIntoView/,
  )
  assert.ok(adultsCommit)
  assert.match(adultsCommit[0], /guestAddressTransitionRef/)
  assert.doesNotMatch(adultsCommit[0], /streetNumberInputRef/)
})

test('ADULTS_TO_STREET_NUMBER', () => {
  const adultsCommit = wizard.match(
    /inputRef=\{adultsInputRef\}[\s\S]{0,1600}onCommit=\{[\s\S]{0,1200}scrollIntoView/,
  )
  assert.ok(adultsCommit)
  assert.doesNotMatch(adultsCommit[0], /streetNumberInputRef/)
})

test('STREET_NUMBER_NUMERIC_KEYBOARD_HINT', () => {
  assert.match(address, /inputMode="numeric"/)
  assert.match(address, /pattern="\[0-9\]\*"/)
  assert.match(address, /enterKeyHint="next"/)
  assert.match(address, /data-address-number/)
  assert.match(address, /numberInputRef/)
})

test('GOOGLE_ADDRESS_WITH_NUMBER_PRESERVED', () => {
  assert.match(address, /onPlaceSelected\?: \(info: \{ addressNumber: string \}\) => void/)
  assert.match(
    address,
    /const addressNumber =\s*selected\.addressNumber\?\.trim\(\) \|\|\s*valuesRef\.current\.addressNumber/,
  )
  assert.match(wizard, /if \(addressNumber\.trim\(\)\) return/)
})

test('GOOGLE_ADDRESS_WITHOUT_NUMBER_FOCUSES_NUMBER', () => {
  assert.match(address, /onPlaceSelectedRef\.current\?\.\(\{ addressNumber \}\)/)
  assert.match(
    wizard,
    /if \(addressNumber\.trim\(\)\) return\s*focusWizardField\(streetNumberInputRef\.current\)/,
  )
})

test('STREET_NUMBER_NUMERIC_WHEN_REQUIRED', () => {
  assert.match(address, /data-address-number/)
  assert.match(address, /inputMode="numeric"/)
  assert.match(address, /pattern="\[0-9\]\*"/)
})

test('GOOGLE_PLACES_UNCHANGED', () => {
  assert.match(address, /types: \['address'\]/)
  assert.match(address, /importLibrary\('places'\)/)
  assert.match(
    address,
    /const addressNumber =\s*selected\.addressNumber\?\.trim\(\) \|\|\s*valuesRef\.current\.addressNumber/,
  )
  assert.doesNotMatch(address, /inputMode="numeric"[\s\S]{0,80}autoComplete="street-address"/)
  assert.match(address, /data-address-search/)
  assert.match(address, /type="text"/)
})

test('END_TIME_AUTO_CALC_UNCHANGED', () => {
  assert.match(wizard, /deriveEventEndTime\(v, serviceDurationMinutes\)/)
  assert.match(duration, /export function deriveEventEndTime/)
  assert.match(duration, /export function resolveServiceDurationMinutes/)
})

test('END_TIME_AUTO_OPEN', () => {
  assert.match(wizard, /readOnly=\{isPublicMode\}/)
  assert.doesNotMatch(wizard, /setEndTimeOpen\(true\)|endTimePickerOpen/)
})

test('FIRST_NAME_TO_LAST_NAME_FLOW', () => {
  assert.match(wizard, /focusWizardField\(lastNameInputRef\.current\)/)
  assert.match(wizard, /enterKeyHint=\{isPublicMode \? 'next' : undefined\}/)
})

test('LAST_NAME_TO_PHONE_FLOW', () => {
  assert.match(wizard, /focusWizardField\(phoneInputRef\.current\)/)
})

test('PHONE_TYPE_TEL', () => {
  assert.match(phone, /type="tel"/)
  assert.match(phone, /inputRef/)
})

test('PHONE_INPUTMODE_TEL', () => {
  assert.match(phone, /inputMode="tel"/)
  assert.match(phone, /autoComplete="tel"/)
})

test('INTERNATIONAL_PLUS_ALLOWED', () => {
  assert.match(phoneLib, /export function formatPublicPhoneInput/)
  assert.match(phoneLib, /export function isUsablePublicPhone/)
  assert.match(phoneLib, /export function toPublicPhoneE164/)
})

test('AUTO_INSERT_PLUS_ONE', () => {
  assert.doesNotMatch(phone, /\+1['"`]/)
  assert.doesNotMatch(wizard, /customerDraftPhone:\s*'\\+1'/)
})

test('PHONE_VALIDATION_UNCHANGED', () => {
  assert.match(wizard, /isUsablePublicPhone\(state\.customerDraftPhone\)/)
  assert.match(phone, /isUsablePublicPhone\(display\)/)
})

test('CUSTOM_PLUS_MAPPED_TO_V8', () => {
  assert.match(generated, /bbqpers-plus-pt-v8\.webp/)
  assert.match(visual, /\?v=art8b/)
})

test('NO_QUERYSELECTOR_BY_LABEL', () => {
  assert.doesNotMatch(wizard, /querySelector\(['"]input/)
  assert.doesNotMatch(address, /querySelector\(['"]input/)
})

if (failed > 0) {
  console.error(`\n${failed} failed, ${passed} passed`)
  process.exit(1)
}
console.log(`\n${passed} passed`)
