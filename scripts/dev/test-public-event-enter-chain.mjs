/**
 * Public event ENTER chain + stacked address layout.
 *
 * Run: npm run test:dev:public-event-enter-chain
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

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

const wizard = source('app/quotes/new/QuoteWizard.tsx')
const address = source('app/quotes/new/AddressAutocompleteFields.tsx')
const css = source('app/globals.css')

test('ADULTS_VALUE_20_FULLY_TYPED = PASS', () => {
  assert.match(wizard, /inputRef=\{adultsInputRef\}[\s\S]{0,500}enterKeyHint=\{isPublicMode \? 'next'/)
  const adultsCommit = wizard.match(
    /inputRef=\{adultsInputRef\}[\s\S]{0,800}onCommit=\{[\s\S]{0,400}?undefined/,
  )
  assert.ok(adultsCommit)
  assert.doesNotMatch(adultsCommit[0], /onChange=\{[\s\S]{0,80}revealGuestChildrenAfterAdults/)
  assert.match(wizard, /onChange=\{\(e\) => \{\s*const raw = e\.target\.value\.replace/)
})

test('ADULTS_ENTER_TARGET = CHILDREN_UNDER_3', () => {
  const adultsCommit = wizard.match(
    /inputRef=\{adultsInputRef\}[\s\S]{0,2400}onCommit=\{[\s\S]{0,500}revealGuestChildrenAfterAdults/,
  )
  assert.ok(adultsCommit)
  assert.match(wizard, /function revealGuestChildrenAfterAdults/)
  assert.match(wizard, /childrenUnder3InputRef\.current\?\.focus\(\{ preventScroll: true \}\)/)
})

test('CHILDREN_UNDER_3_ZERO_VALID = YES', () => {
  assert.match(wizard, /import \{ isExplicitNonNegativeInteger \}/)
  assert.match(
    wizard,
    /inputRef=\{childrenUnder3InputRef\}[\s\S]{0,800}if \(!isExplicitNonNegativeInteger\(value\)\) return/,
  )
  assert.match(source('Lib/quoteGuestFields.ts'), /export function isExplicitNonNegativeInteger/)
})

test('CHILDREN_UNDER_3_BLANK_VALID = NO', () => {
  assert.match(wizard, /allowEmpty=\{isPublicMode\}/)
  assert.match(wizard, /if \(!isExplicitNonNegativeInteger\(state\.childrenUnder3Count\)\)/)
  assert.match(
    source('Lib/quoteGuestFields.ts'),
    /if \(value === null \|\| value === undefined \|\| value === ''\) return false/,
  )
})

test('CHILDREN_UNDER_3_ENTER_TARGET = CHILDREN_4_12', () => {
  assert.match(
    wizard,
    /inputRef=\{childrenUnder3InputRef\}[\s\S]{0,900}focusWizardField\(children4To12InputRef\.current\)/,
  )
})

test('CHILDREN_4_12_ZERO_VALID = YES', () => {
  assert.match(
    wizard,
    /inputRef=\{children4To12InputRef\}[\s\S]{0,800}if \(!isExplicitNonNegativeInteger\(value\)\) return/,
  )
})

test('CHILDREN_4_12_ENTER_TARGET = STREET_NUMBER', () => {
  assert.match(
    wizard,
    /inputRef=\{children4To12InputRef\}[\s\S]{0,900}revealAddressAfterChildren\(\)/,
  )
  assert.match(wizard, /function revealAddressAfterChildren/)
  assert.match(wizard, /numberField\?\.focus\(\{ preventScroll: true \}\)/)
  assert.match(wizard, /streetNumberInputRef\.current/)
})

test('STREET_NUMBER_ENTER_TARGET = ADDRESS_SEARCH', () => {
  assert.match(
    wizard,
    /onNumberCommit=\{[\s\S]{0,220}focusWizardField\(addressSearchInputRef\.current\)/,
  )
  assert.match(address, /enterKeyHint="next"/)
  assert.match(address, /inputMode="numeric"/)
})

test('ADDRESS_STACKED_PUBLIC_ONLY', () => {
  assert.match(address, /stackPrimaryFields = false/)
  assert.match(wizard, /stackPrimaryFields=\{isPublicMode\}/)
  assert.match(address, /event-address-primary-row--stacked/)
  assert.match(css, /\.event-address-primary-row--stacked \{/)
  assert.match(css, /\.event-address-primary-row \{\n  display: grid;\n  grid-template-columns: minmax\(0, 30%\) minmax\(0, 1fr\)/)
})

test('GOOGLE_PLACES_UNCHANGED', () => {
  assert.match(address, /importLibrary\('places'\)/)
  assert.match(address, /types: \['address'\]/)
  assert.match(
    address,
    /existingNumber \|\| selected\.addressNumber\?\.trim\(\) \|\| ''/,
  )
})

if (failed > 0) {
  console.error(`\n${failed} failed, ${passed} passed`)
  process.exit(1)
}

console.log(`\n${passed} passed`)
