/**
 * Public phone: country / DDI + single national field + ENTER to email.
 *
 * Run: npm run test:dev:public-phone-split-focus
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  composePublicPhoneE164,
  formatNationalPhoneDisplay,
  splitPublicPhone,
} from '../../Lib/publicQuote/phone.ts'
import { getQuoteStrings } from '../../Lib/quoteTranslations.ts'

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
const wizard = source('app/quotes/new/QuoteWizard.tsx')
const css = source('app/globals.css')
const phone = source('Lib/publicQuote/phone.ts')

test('COUNTRY_ROW_FULL_WIDTH = PASS', () => {
  assert.match(field, /data-phone-country-row/)
  assert.match(
    field,
    /data-phone-country[\s\S]{0,400}flex min-h-12 w-full/,
  )
})

test('SEPARATE_DDD_INPUT_EXISTS = NO', () => {
  assert.doesNotMatch(field, /data-phone-area/)
  assert.doesNotMatch(field, /areaCodeInputRef/)
})

test('SEPARATE_SUBSCRIBER_INPUT_EXISTS = NO', () => {
  assert.doesNotMatch(field, /subscriberInputRef/)
  assert.doesNotMatch(field, /formatSubscriberPhoneDisplay/)
})

test('NATIONAL_PHONE_SINGLE_INPUT = YES', () => {
  assert.match(field, /data-phone-national-row/)
  assert.match(field, /data-phone-national/)
  assert.equal((field.match(/data-phone-national(?!-)/g) || []).length, 1)
  assert.match(css, /\.public-phone-national-row \{/)
  assert.match(css, /grid-template-columns: minmax\(0, 1fr\)/)
  assert.doesNotMatch(
    field,
    /grid-cols-\[minmax\(7\.5rem,0\.42fr\)_minmax\(0,1fr\)\]/,
  )
})

test('BR_INPUT_DISPLAY_AND_CANONICAL', () => {
  const parts = splitPublicPhone('+5511976182170', 'BR')
  assert.equal(parts.iso2, 'BR')
  assert.equal(parts.callingCode, '55')
  assert.equal(parts.nationalDigits, '11976182170')
  assert.equal(
    formatNationalPhoneDisplay(parts.iso2, parts.nationalDigits),
    '11 97618-2170',
  )
  assert.equal(
    composePublicPhoneE164(parts.iso2, parts.nationalDigits),
    '+5511976182170',
  )
})

test('US_INPUT_DISPLAY_AND_CANONICAL', () => {
  const parts = splitPublicPhone('+14075551234', 'US')
  assert.equal(parts.iso2, 'US')
  assert.equal(parts.callingCode, '1')
  assert.equal(parts.nationalDigits, '4075551234')
  assert.equal(
    formatNationalPhoneDisplay(parts.iso2, parts.nationalDigits),
    '(407) 555-1234',
  )
  assert.equal(
    composePublicPhoneE164(parts.iso2, parts.nationalDigits),
    '+14075551234',
  )
})

test('COUNTRY_SELECT_FOCUS_TARGET = NATIONAL_PHONE', () => {
  assert.match(field, /function selectCountry\(/)
  assert.match(field, /closePicker\(\{ restoreCountryFocus: false \}\)/)
  assert.match(field, /nationalInputRef\.current\?\.focus\(/)
  assert.match(field, /data-phone-national/)
})

test('PHONE_ENTER_TARGET = OPTIONAL_EMAIL', () => {
  assert.match(field, /data-phone-national[\s\S]{0,400}enterKeyHint="next"/)
  assert.match(field, /type="tel"/)
  assert.match(field, /inputMode="tel"/)
  assert.match(field, /onValidAdvance\?\.\(\)/)
  assert.match(
    wizard,
    /onValidAdvance=\{\(\) =>\s*focusWizardField\(emailInputRef\.current\)/,
  )
  assert.match(wizard, /inputRef=\{emailInputRef\}/)
  assert.match(
    wizard,
    /inputRef=\{emailInputRef\}[\s\S]{0,500}goNext\(\)/,
  )
  assert.doesNotMatch(
    wizard,
    /inputRef=\{emailInputRef\}[\s\S]{0,400}setStep\(/,
  )
})

test('PHONE_E164_CHANGED = NO', () => {
  assert.match(field, /splitPublicPhone/)
  assert.match(field, /formatNationalPhoneDisplay/)
  assert.match(field, /composePublicPhoneE164/)
  assert.match(phone, /export function toPublicPhoneE164/)
  assert.match(phone, /export function sanitizeStoredPublicPhone/)
  assert.match(phone, /export function composePublicPhoneE164/)
  assert.match(phone, /export function splitPublicPhone/)
  assert.doesNotMatch(field, /phone_ddi|phone_ddd|phone_number/)
})

test('PHONE_LABELS_PT_EN_ES', () => {
  assert.equal(getQuoteStrings('pt').wizard.phoneCountryDdiLabel, 'País / DDI')
  assert.equal(getQuoteStrings('pt').wizard.phoneAreaCodeLabel, 'DDD')
  assert.equal(getQuoteStrings('pt').wizard.phoneSubscriberLabel, 'Número')
  assert.equal(getQuoteStrings('en').wizard.phoneCountryDdiLabel, 'Country / code')
  assert.equal(getQuoteStrings('en').wizard.phoneAreaCodeLabel, 'Area code')
  assert.equal(getQuoteStrings('en').wizard.phoneSubscriberLabel, 'Phone number')
  assert.equal(getQuoteStrings('es').wizard.phoneCountryDdiLabel, 'País / código')
  assert.equal(getQuoteStrings('es').wizard.phoneAreaCodeLabel, 'Código de área')
  assert.equal(getQuoteStrings('es').wizard.phoneSubscriberLabel, 'Número')
  assert.match(field, /phoneAreaCodeLabel\} \+ \$\{t\.phoneSubscriberLabel\}/)
})

if (failed > 0) {
  console.error(`\n${failed} failed, ${passed} passed`)
  process.exit(1)
}

console.log(`\n${passed} passed`)
