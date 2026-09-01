/**
 * Public phone split: country / area / subscriber + ENTER focus chain.
 *
 * Run: npm run test:dev:public-phone-split-focus
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  composeNationalFromAreaAndSubscriber,
  composePublicPhoneE164,
  splitNationalIntoAreaAndSubscriber,
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

test('COUNTRY_PICKER_OPEN_KEYBOARD = NO', () => {
  assert.doesNotMatch(field, /autoFocus/)
  assert.doesNotMatch(field, /onFocus=/)
  assert.match(field, /function openPicker\(\) \{\s*blurActiveElement\(\)/)
  assert.match(field, /closeButtonRef\.current\?\.focus\(\{ preventScroll: true \}\)/)
})

test('COUNTRY_SELECT_TARGET = AREA_CODE', () => {
  assert.match(field, /function selectCountry\(/)
  assert.match(field, /closePicker\(\{ restoreCountryFocus: false \}\)/)
  assert.match(field, /areaCodeInputRef\.current\?\.focus\(/)
  assert.match(field, /data-phone-area/)
})

test('PHONE_TWO_ROW_LAYOUT', () => {
  assert.match(field, /data-phone-country-row/)
  assert.match(field, /data-phone-national-row/)
  assert.match(css, /\.public-phone-national-row \{/)
  assert.doesNotMatch(
    field,
    /grid-cols-\[minmax\(7\.5rem,0\.42fr\)_minmax\(0,1fr\)\]/,
  )
})

test('BR_CANONICAL_SPLIT', () => {
  const parts = splitPublicPhone('+5511976182170', 'BR')
  assert.equal(parts.iso2, 'BR')
  assert.equal(parts.callingCode, '55')
  assert.equal(parts.nationalDigits, '11976182170')
  const split = splitNationalIntoAreaAndSubscriber(parts.iso2, parts.nationalDigits)
  assert.equal(split.areaCode, '11')
  assert.equal(split.subscriberNumber, '976182170')
  const national = composeNationalFromAreaAndSubscriber('11', '976182170')
  assert.equal(composePublicPhoneE164('BR', national), '+5511976182170')
})

test('US_CANONICAL_SPLIT', () => {
  const parts = splitPublicPhone('+14075551234', 'US')
  assert.equal(parts.iso2, 'US')
  assert.equal(parts.callingCode, '1')
  assert.equal(parts.nationalDigits, '4075551234')
  const split = splitNationalIntoAreaAndSubscriber(parts.iso2, parts.nationalDigits)
  assert.equal(split.areaCode, '407')
  assert.equal(split.subscriberNumber, '5551234')
  const national = composeNationalFromAreaAndSubscriber('407', '5551234')
  assert.equal(composePublicPhoneE164('US', national), '+14075551234')
})

test('AREA_CODE_ENTER_TARGET = PHONE', () => {
  assert.match(field, /data-phone-area[\s\S]{0,400}enterKeyHint="next"/)
  assert.match(
    field,
    /data-phone-area[\s\S]{0,700}subscriberInputRef\.current\?\.focus\(\)/,
  )
  assert.doesNotMatch(
    field,
    /getPublicPhoneAreaHintLength[\s\S]{0,200}onChange[\s\S]{0,120}focus\(/,
  )
})

test('PHONE_ENTER_TARGET = EMAIL', () => {
  assert.match(field, /data-phone-national[\s\S]{0,400}enterKeyHint="next"/)
  assert.match(field, /onValidAdvance\?\.\(\)/)
  assert.match(wizard, /onValidAdvance=\{\(\) =>\s*focusWizardField\(emailInputRef\.current\)/)
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

test('BACK_PRESERVES_E164 = PASS', () => {
  assert.match(field, /splitPublicPhone/)
  assert.match(field, /splitNationalIntoAreaAndSubscriber/)
  assert.match(field, /composePublicPhoneE164/)
  assert.match(phone, /export function toPublicPhoneE164/)
  assert.match(phone, /export function sanitizeStoredPublicPhone/)
  const restored = splitNationalIntoAreaAndSubscriber(
    'BR',
    splitPublicPhone('+5511976182170', 'BR').nationalDigits,
  )
  assert.equal(
    composePublicPhoneE164(
      'BR',
      composeNationalFromAreaAndSubscriber(
        restored.areaCode,
        restored.subscriberNumber,
      ),
    ),
    '+5511976182170',
  )
})

test('PHONE_MODEL_UNCHANGED', () => {
  assert.match(phone, /export function toPublicPhoneE164/)
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
})

if (failed > 0) {
  console.error(`\n${failed} failed, ${passed} passed`)
  process.exit(1)
}

console.log(`\n${passed} passed`)
