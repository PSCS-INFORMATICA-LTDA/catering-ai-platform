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

const quantity = (() => {
  const start = wizard.indexOf('function QuantityField(')
  const next = wizard.indexOf('\nfunction ', start + 1)
  return wizard.slice(start, next === -1 ? undefined : next)
})()
const enterHandler = quantity.slice(
  quantity.indexOf('onKeyDown='),
  quantity.indexOf('onBlur='),
)
const nativeLabel = wizard.slice(
  wizard.indexOf('if (nativeTargetId)'),
  wizard.indexOf('if (!onAdvance)'),
)

test('ENTER_ADULTS_TARGET = public-event-child-under-3', () => {
  assert.match(
    wizard,
    /inputId="public-event-adults"[\s\S]{0,400}nativeAdvanceTargetId=\{\s*isPublicMode \? 'public-event-child-under-3'/,
  )
})

test('ENTER_CHILD_UNDER_3_TARGET = public-event-child-4-12', () => {
  assert.match(
    wizard,
    /inputId="public-event-child-under-3"[\s\S]{0,400}nativeAdvanceTargetId=\{\s*isPublicMode \? 'public-event-child-4-12'/,
  )
})

test('ENTER_CHILD_4_12_TARGET = public-event-street-number', () => {
  assert.match(
    wizard,
    /inputId="public-event-child-4-12"[\s\S]{0,400}nativeAdvanceTargetId=\{\s*isPublicMode \? 'public-event-street-number'/,
  )
})

test('ENTER_FOCUS_BEFORE_FLUSHSYNC = PASS', () => {
  const focusAt = enterHandler.indexOf('nextInput.focus({ preventScroll: true })')
  const flushAt = enterHandler.indexOf('commitAndAdvance()')
  assert.ok(focusAt >= 0, 'Enter must focus the next input')
  assert.ok(flushAt > focusAt, 'commitAndAdvance may only follow the focus-first return')
  assert.doesNotMatch(enterHandler.slice(0, focusAt + 1), /flushSync|commitOnly|commitDraft|commitAndAdvance/)
})

test('ENTER_FOCUS_BEFORE_STATE_COMMIT = PASS', () => {
  assert.match(
    enterHandler,
    /nextInput\.focus\(\{ preventScroll: true \}\)[\s\S]*?return/,
  )
  assert.match(enterHandler, /if \(nativeAdvanceTargetId && completion === 'filled'\)/)
})

test('ENTER_NO_SETTIMEOUT_FOR_FOCUS = PASS', () => {
  assert.doesNotMatch(enterHandler, /setTimeout/)
})

test('ENTER_NO_RAF_FOR_FOCUS = PASS', () => {
  const focusAt = enterHandler.indexOf('nextInput.focus({ preventScroll: true })')
  const rafAt = enterHandler.indexOf('requestAnimationFrame')
  assert.ok(focusAt >= 0 && rafAt > focusAt, 'RAF may only follow sync focus')
  assert.match(enterHandler.slice(rafAt), /scrollIntoView/)
})

test('NATIVE_LABEL_CHECK_UNCHANGED = PASS', () => {
  assert.match(nativeLabel, /data-field-advance-mode="native-label"/)
  assert.doesNotMatch(nativeLabel, /onPointerDown|onPointerUp|onClick|preventDefault|\.focus\(/)
})

test('CHILD_ZERO_VALID = PASS', () => {
  assert.match(wizard, /getExplicitCountCompletion/)
  assert.match(source('Lib/quoteGuestFields.ts'), /export function isExplicitNonNegativeInteger/)
})

test('CHILD_BLANK_BLOCKED = PASS', () => {
  assert.match(
    source('Lib/quoteGuestFields.ts'),
    /if \(value === null \|\| value === undefined \|\| value === ''\) return false/,
  )
})

test('AUTOMATION_CAN_PROVE_IOS_KEYBOARD = NO', () => {
  assert.ok(true, 'Playwright cannot observe the iOS software keyboard')
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
  assert.match(wizard, /focusWizardField\(streetNumberInputRef\.current\)/)
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

test('FIELD_CHECK_OPTIONAL_ADVANCE', () => {
  assert.match(wizard, /function FieldCheck\(/)
  assert.match(wizard, /onAdvance\?: \(\) => void/)
  assert.match(wizard, /if \(!onAdvance\) \{/)
  assert.match(wizard, /pointer-events-none/)
  assert.match(wizard, /data-field-advance-check/)
  assert.match(wizard, /function commitAndAdvance\(\)/)
  assert.match(wizard, /flushSync\(/)
  assert.match(wizard, /onCommit\?\.\(next\)/)
  assert.match(wizard, /shouldAdvanceFromFieldBlur/)
  assert.match(wizard, /related\.closest\('\[data-field-advance-check\]'\)/)
})

test('ADULTS_CHECK_CLICK_TARGET = CHILD_UNDER_3', () => {
  assert.match(wizard, /advanceKey="adults"/)
  assert.match(wizard, /advanceOnCheck=\{isPublicMode\}/)
  assert.match(
    wizard,
    /advanceKey="adults"[\s\S]{0,400}revealGuestChildrenAfterAdults/,
  )
})

test('CHILD_UNDER_3_0_CHECK_VISIBLE = YES', () => {
  assert.match(wizard, /getExplicitCountCompletion/)
  assert.match(wizard, /import \{ isExplicitNonNegativeInteger \}/)
  assert.match(wizard, /advanceKey="children-under-3"/)
  assert.match(
    source('Lib/quoteGuestFields.ts'),
    /export function isExplicitNonNegativeInteger/,
  )
})

test('CHILD_UNDER_3_CHECK_CLICK_TARGET = CHILD_4_12', () => {
  assert.match(
    wizard,
    /advanceKey="children-under-3"[\s\S]{0,400}focusWizardField\(children4To12InputRef\.current\)/,
  )
})

test('CHILD_4_12_0_CHECK_VISIBLE = YES', () => {
  assert.match(wizard, /advanceKey="children-4-12"/)
  assert.match(
    wizard,
    /getExplicitCountCompletion\(\s*state\.children4To12Count/,
  )
})

test('CHILD_4_12_CHECK_CLICK_TARGET = STREET_NUMBER', () => {
  assert.match(
    wizard,
    /advanceKey="children-4-12"[\s\S]{0,400}revealAddressAfterChildren\(\)/,
  )
})

test('STREET_NUMBER_CHECK_CLICK_TARGET = ADDRESS_SEARCH', () => {
  assert.match(address, /showNumberAdvanceCheck = false/)
  assert.match(wizard, /showNumberAdvanceCheck=\{isPublicMode\}/)
  assert.match(address, /advanceKey="street-number"/)
  assert.match(
    address,
    /onNumberCommit\?\.\(next\)/,
  )
  assert.match(
    wizard,
    /onNumberCommit=\{[\s\S]{0,220}focusWizardField\(addressSearchInputRef\.current\)/,
  )
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
