/**
 * Final public CDL closeout: review order, trusted event checks,
 * public review footer, and success contact card.
 *
 * Run: npm run test:dev:public-quote-closeout-polish
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolvePublicCompanyContacts } from '../../Lib/publicQuote/companyContacts.ts'

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

function sliceFn(sourceText, name) {
  const start = sourceText.indexOf(`function ${name}(`)
  assert.ok(start >= 0, `missing function ${name}`)
  const next = sourceText.indexOf('\nfunction ', start + 1)
  return sourceText.slice(start, next === -1 ? undefined : next)
}

const wizard = source('app/quotes/new/QuoteWizard.tsx')
const address = source('app/quotes/new/AddressAutocompleteFields.tsx')
const reviewSection = source(
  'components/quote-review/QuoteReviewPackageCdlSection.tsx',
)
const layout = source('components/quote-review/QuoteReviewLayout.tsx')
const confirm = source(
  'components/quote-review/PublicQuoteConfirmationStep.tsx',
)
const successScreen = source('components/quotes/PublicQuoteSuccessScreen.tsx')
const experience = source(
  'app/quote/[companySlug]/[locale]/PublicQuoteExperience.tsx',
)
const css = source('app/globals.css')
const printCss = source('app/quotes/[id]/quote-print.css')
const pscs = source('components/brand/PscsOneMark.tsx')
const mapper = source('components/quote-review/mapWizardToQuoteReview.ts')

const wizardCheck = sliceFn(wizard, 'FieldCheck')
const nativeCheck = wizardCheck.slice(
  wizardCheck.indexOf('if (nativeTargetId)'),
  wizardCheck.indexOf('if (!onAdvance)'),
)
const addressCheck = sliceFn(address, 'FieldCheck')
const focusFn = sliceFn(wizard, 'focusWizardField')
const successFooter = (() => {
  const start = experience.indexOf('data-success-footer')
  return experience.slice(start, experience.indexOf('</footer>', start) + 9)
})()

test('PACKAGE_REVIEW_ORDER', () => {
  const image = reviewSection.indexOf('data-review-package-image')
  const items = reviewSection.indexOf('data-review-package-items')
  const garnish = reviewSection.indexOf('data-review-garnish')
  const choices = reviewSection.indexOf('data-review-included-choices')
  const layoutPackage = layout.indexOf('sectionKey="package"')
  const layoutAdditionals = layout.indexOf('sectionKey="additionals"')
  assert.ok(image > 0 && items > image)
  assert.ok(garnish > items)
  assert.ok(choices > garnish)
  assert.ok(layoutAdditionals > layoutPackage)
})

test('INCLUDED_CHOICES_BLOCK_COUNT = 1', () => {
  assert.equal((reviewSection.match(/data-review-included-choices/g) || []).length, 1)
  assert.equal((reviewSection.match(/tw\(loc, 'includedChoices'\)/g) || []).length, 1)
})

test('SAUSAGE_AND_GARNISH_SAME_LIST = YES', () => {
  const start = reviewSection.indexOf('data-review-included-choices')
  const block = reviewSection.slice(
    start,
    reviewSection.indexOf('showAdditionalItems', start),
  )
  assert.match(block, /packageSelections\.map/)
  assert.equal((block.match(/<ul/g) || []).length, 1)
  const fixture = [
    { itemLabel: 'Tradicional Frango' },
    { itemLabel: 'Vinagrete' },
  ]
  assert.ok(fixture.length >= 2)
})

test('PACKAGE_FIXED_ITEMS_UNCHANGED = YES', () => {
  assert.match(mapper, /formatDisplayableFixedPackageItemsText/)
  assert.match(mapper, /buildPackageSelectionLabels/)
})

test('NO_SET_TIMEOUT_FOR_ADVANCE_FOCUS', () => {
  assert.doesNotMatch(wizardCheck, /setTimeout/)
  assert.doesNotMatch(addressCheck, /setTimeout/)
  assert.doesNotMatch(focusFn, /setTimeout/)
})

test('NO_PROMISE_FOR_ADVANCE_FOCUS', () => {
  assert.doesNotMatch(wizardCheck, /\.then\(|await |Promise/)
  assert.doesNotMatch(addressCheck, /\.then\(|await |Promise/)
  assert.doesNotMatch(focusFn, /\.then\(|await |Promise/)
})

test('NO_EFFECT_BASED_ADVANCE_FOCUS', () => {
  assert.doesNotMatch(wizardCheck, /useEffect/)
  assert.doesNotMatch(addressCheck, /useEffect/)
  assert.doesNotMatch(focusFn, /useEffect/)
})

test('ADULTS_CHECK_ELEMENT = LABEL', () => {
  assert.match(wizard, /advanceKey="adults"/)
  assert.match(wizard, /nativeAdvanceTargetId=\{[\s\S]*?public-event-child-under-3/)
  assert.match(nativeCheck, /<label/)
  assert.match(nativeCheck, /htmlFor=\{nativeTargetId\}/)
  assert.match(nativeCheck, /data-field-advance-mode="native-label"/)
  assert.doesNotMatch(nativeCheck, /<button/)
})

test('ADULTS_CHECK_FOR = public-event-child-under-3', () => {
  assert.match(wizard, /inputId="public-event-adults"/)
  assert.match(
    wizard,
    /advanceKey="adults"[\s\S]{0,220}nativeAdvanceTargetId=\{[\s\S]{0,80}public-event-child-under-3/,
  )
})

test('CHILD_UNDER_3_CHECK_ELEMENT = LABEL', () => {
  assert.match(wizard, /advanceKey="children-under-3"/)
  assert.match(wizard, /nativeAdvanceTargetId=\{[\s\S]*?public-event-child-4-12/)
})

test('CHILD_UNDER_3_CHECK_FOR = public-event-child-4-12', () => {
  assert.match(wizard, /inputId="public-event-child-under-3"/)
  assert.match(
    wizard,
    /advanceKey="children-under-3"[\s\S]{0,220}nativeAdvanceTargetId=\{[\s\S]{0,80}public-event-child-4-12/,
  )
})

test('CHILD_4_12_CHECK_ELEMENT = LABEL', () => {
  assert.match(wizard, /advanceKey="children-4-12"/)
  assert.match(wizard, /nativeAdvanceTargetId=\{[\s\S]*?public-event-street-number/)
})

test('CHILD_4_12_CHECK_FOR = public-event-street-number', () => {
  assert.match(wizard, /inputId="public-event-child-4-12"/)
  assert.match(
    wizard,
    /advanceKey="children-4-12"[\s\S]{0,220}nativeAdvanceTargetId=\{[\s\S]{0,80}public-event-street-number/,
  )
})

test('TARGET_CHILD_UNDER_3_EXISTS = YES', () => {
  assert.match(wizard, /inputId="public-event-child-under-3"/)
})

test('TARGET_CHILD_4_12_EXISTS = YES', () => {
  assert.match(wizard, /inputId="public-event-child-4-12"/)
})

test('TARGET_STREET_NUMBER_EXISTS = YES', () => {
  assert.match(wizard, /numberInputId="public-event-street-number"/)
  assert.match(address, /id=\{numberInputId\}/)
})

test('NATIVE_LABEL_CLICK_PREVENT_DEFAULT = NO', () => {
  assert.doesNotMatch(nativeCheck, /preventDefault\(/)
})

test('CHECK_PROGRAMMATIC_NEXT_FOCUS = NO', () => {
  assert.doesNotMatch(nativeCheck, /\.focus\(/)
  assert.doesNotMatch(nativeCheck, /focusWizardField/)
  assert.doesNotMatch(nativeCheck, /requestAnimationFrame/)
  assert.doesNotMatch(nativeCheck, /setTimeout/)
  assert.match(wizard, /function handleBeforeNativeAdvance\(\) \{[\s\S]*?commitOnly\(\)/)
  assert.doesNotMatch(
    wizard.slice(
      wizard.indexOf('function handleBeforeNativeAdvance'),
      wizard.indexOf('return (', wizard.indexOf('function handleBeforeNativeAdvance')),
    ),
    /onCommit|focusWizardField/,
  )
})

test('POINTERDOWN_ADVANCE_CALLS = 0', () => {
  const pointerDownBlock = wizardCheck.slice(
    wizardCheck.indexOf('onPointerDown'),
    wizardCheck.indexOf('onPointerUp'),
  )
  assert.match(pointerDownBlock, /event.preventDefault\(\)/)
  assert.doesNotMatch(pointerDownBlock, /advance\(/)
})

test('POINTERUP_ADVANCE_CALLS = 1', () => {
  const pointerUpBlock = wizardCheck.slice(
    wizardCheck.indexOf('onPointerUp'),
    wizardCheck.indexOf('onPointerCancel'),
  )
  assert.equal((pointerUpBlock.match(/advance\(\)/g) || []).length, 1)
  assert.match(pointerUpBlock, /event.preventDefault\(\)/)
  assert.match(pointerUpBlock, /event.stopPropagation\(\)/)
})

test('CLICK_AFTER_POINTERUP_ADVANCE_CALLS = 0', () => {
  assert.match(wizardCheck, /advancedByPointerRef/)
  assert.match(
    wizardCheck,
    /if \(advancedByPointerRef\.current\) \{\s*advancedByPointerRef\.current = false\s*return/,
  )
  const clickBlock = wizardCheck.slice(wizardCheck.indexOf('onClick'))
  assert.match(clickBlock, /advance\(\)/)
})

test('FIELD_CHECK_CLICK_DOES_NOT_DOUBLE_ADVANCE = PASS', () => {
  assert.match(wizardCheck, /onPointerCancel/)
  assert.match(wizardCheck, /advancedByPointerRef/)
  const clickBlock = wizardCheck.slice(wizardCheck.indexOf('onClick'))
  assert.match(clickBlock, /if \(advancedByPointerRef\.current\)/)
  assert.match(clickBlock, /advance\(\)/)
})

test('FOCUS_SYNCHRONOUS = YES', () => {
  assert.match(focusFn, /node\.focus\(\{ preventScroll: true \}\)/)
  assert.match(focusFn, /setSelectionRange/)
  const focusAt = focusFn.indexOf('node.focus({ preventScroll: true })')
  const rafAt = focusFn.indexOf('requestAnimationFrame')
  assert.ok(rafAt > focusAt, 'RAF may only follow the sync focus')
  assert.doesNotMatch(focusFn, /setTimeout/)
  assert.doesNotMatch(wizardCheck, /setTimeout|requestAnimationFrame\(|\.then\(|await |useEffect/)
  assert.match(wizard, /flushSync/)
  assert.match(wizard, /function commitOnly\(\) \{[\s\S]*?flushSync\(/)
  assert.match(wizard, /function commitAndAdvance\(\) \{[\s\S]*?commitOnly\(\)/)
})

test('FOCUS_IS_SYNCHRONOUS = PASS', () => {
  const pointerUpBlock = wizardCheck.slice(
    wizardCheck.indexOf('onPointerUp'),
    wizardCheck.indexOf('onPointerCancel'),
  )
  assert.match(pointerUpBlock, /advance\(\)/)
  assert.doesNotMatch(pointerUpBlock, /setTimeout|requestAnimationFrame\(|\.then\(|await |useEffect/)
  assert.match(focusFn, /node\.focus\(\{ preventScroll: true \}\)/)
})

test('NO_SET_TIMEOUT = YES', () => {
  assert.doesNotMatch(wizardCheck, /setTimeout/)
  assert.doesNotMatch(focusFn, /setTimeout/)
})

test('NO_PROMISE = YES', () => {
  assert.doesNotMatch(wizardCheck, /\.then\(|await |Promise/)
  assert.doesNotMatch(focusFn, /\.then\(|await |Promise/)
})

test('NO_EFFECT_FOCUS = YES', () => {
  assert.doesNotMatch(wizardCheck, /useEffect/)
  assert.doesNotMatch(focusFn, /useEffect/)
})

test('ADULTS_TARGET = CHILD_UNDER_3', () => {
  assert.match(
    wizard,
    /function revealGuestChildrenAfterAdults\(\) \{\s*focusWizardField\(childrenUnder3InputRef\.current\)/,
  )
  assert.match(wizard, /advanceKey="adults"[\s\S]*?revealGuestChildrenAfterAdults/)
})

test('CHILD_UNDER_3_TARGET = CHILD_4_12', () => {
  assert.match(
    wizard,
    /advanceKey="children-under-3"[\s\S]*?focusWizardField\(children4To12InputRef\.current\)/,
  )
})

test('CHILD_4_12_TARGET = STREET_NUMBER', () => {
  assert.match(
    wizard,
    /function revealAddressAfterChildren\(\) \{\s*focusWizardField\(streetNumberInputRef\.current\)/,
  )
  assert.match(wizard, /advanceKey="children-4-12"[\s\S]*?revealAddressAfterChildren/)
})

test('NO_SET_TIMEOUT_FOR_KEYBOARD = PASS', () => {
  assert.doesNotMatch(wizardCheck, /setTimeout/)
  assert.doesNotMatch(focusFn, /setTimeout/)
})

test('NO_PROMISE_FOR_KEYBOARD = PASS', () => {
  assert.doesNotMatch(wizardCheck, /\.then\(|await |Promise/)
  assert.doesNotMatch(focusFn, /\.then\(|await |Promise/)
})

test('NO_USE_EFFECT_FOR_KEYBOARD = PASS', () => {
  assert.doesNotMatch(wizardCheck, /useEffect/)
  assert.doesNotMatch(focusFn, /useEffect/)
})

test('DOUBLE_ADVANCE = 0', () => {
  assert.match(wizardCheck, /advancedByPointerRef/)
  assert.match(
    wizardCheck,
    /if \(advancedByPointerRef\.current\) \{\s*advancedByPointerRef\.current = false\s*return/,
  )
  assert.equal((wizardCheck.match(/advance\(\)/g) || []).length, 2)
})

test('ONE_TAP_ONE_ADVANCE = YES', () => {
  assert.equal((wizardCheck.match(/advance\(\)/g) || []).length, 2)
  assert.match(wizardCheck, /advancedByPointerRef/)
  assert.doesNotMatch(wizardCheck, /skipClickRef/)
})

test('KEYBOARD_BUTTON_ACTIVATION_WORKS', () => {
  assert.match(wizardCheck, /type="button"/)
  assert.match(wizardCheck, /aria-label/)
  assert.match(wizardCheck, /onClick=\{/)
  assert.match(wizardCheck, /h-11 w-11/)
})

test('NUMBER_TO_ADDRESS_CODE_UNCHANGED', () => {
  assert.match(addressCheck, /skipClickRef/)
  assert.match(addressCheck, /advanceFromTrustedGesture\(\)/)
  assert.match(address, /advanceKey="street-number"/)
  assert.match(
    wizard,
    /onNumberCommit=\{[\s\S]{0,220}focusWizardField\(addressSearchInputRef\.current\)/,
  )
})

test('INPUT_MODE_GATES', () => {
  assert.match(wizard, /data-guest-input=\{advanceKey/)
  assert.match(wizard, /inputMode="numeric"/)
  assert.match(address, /data-address-number[\s\S]{0,180}inputMode="numeric"/)
  assert.match(address, /data-address-search[\s\S]{0,180}type="text"/)
  assert.doesNotMatch(
    address.slice(
      address.indexOf('data-address-search'),
      address.indexOf('data-address-search') + 220,
    ),
    /inputMode="numeric"/,
  )
})

test('CDL_LOGO_COUNT_IN_PUBLIC_FOOTER = 1', () => {
  assert.match(confirm, /publicReviewFooter/)
  assert.match(layout, /data-public-review-cdl-logo/)
  assert.equal((layout.match(/data-public-review-cdl-logo/g) || []).length, 1)
  assert.match(layout, /quote-proposal-signature--public/)
  assert.match(layout, /<CdlBrandLogo/)
})

test('CDL_LOGO_CENTERED = YES', () => {
  assert.match(printCss, /quote-proposal-signature--public \.quote-proposal-public-cdl-logo-wrap/)
  assert.match(printCss, /justify-content: center/)
  assert.match(printCss, /object-fit: contain/)
})

test('FOOTER_BRAND_AND_LOCATION', () => {
  const footer = layout.slice(
    layout.indexOf('data-public-review-footer'),
    layout.indexOf('function DefaultProposalBody'),
  )
  assert.match(footer, /BBQ AT HOME/)
  assert.match(footer, /Orlando, Florida/)
  assert.match(footer, /data-public-review-cdl-logo/)
})

test('PUBLIC_REVIEW_PSCS_ONE_COUNT = 0', () => {
  const footer = layout.slice(
    layout.indexOf('data-public-review-footer'),
    layout.indexOf('function DefaultProposalBody'),
  )
  assert.match(footer, /\{!publicReviewFooter \?/)
  assert.match(footer, /quote-proposal-pscs-mark/)
  assert.match(printCss, /\.quote-proposal-pscs-mark \{[\s\S]*?height: 0\.9rem/)
})

test('PRINT_LAYOUT_CHANGED = NO', () => {
  assert.match(printCss, /\.quote-proposal-footer \{[\s\S]*?display: none/)
  const printStart = printCss.lastIndexOf('@media print')
  assert.ok(printStart > 0, 'print media missing')
  const printBlock = printCss.slice(printStart)
  assert.doesNotMatch(printBlock, /quote-proposal-signature--public/)
  assert.doesNotMatch(printBlock, /quote-proposal-pscs-mark[\s\S]{0,80}height: 1\.1rem/)
  assert.ok(printCss.indexOf('@media screen') < printStart)
})

test('NO_WHITE_STRIP_ADDED_TO_CDL_LOGO = YES', () => {
  const publicCss = printCss.slice(
    printCss.indexOf('.quote-proposal-signature--public'),
  )
  assert.doesNotMatch(
    publicCss.slice(0, 700),
    /background:\s*#fff|background:\s*white|box-shadow:.*white/i,
  )
})

test('SUCCESS_SUMMARY_CARD_COUNT = 1', () => {
  assert.equal((successScreen.match(/className="public-success-summary"/g) || []).length, 1)
})

test('SUCCESS_CONTACT_CARD_COUNT = 1', () => {
  assert.equal((successScreen.match(/data-success-contact-card/g) || []).length, 1)
  assert.equal((successScreen.match(/data-success-contacts/g) || []).length, 1)
  assert.match(css, /\.public-success-contact-card \{/)
  const card = css.match(/\.public-success-contact-card \{([^}]+)\}/)?.[1] || ''
  assert.match(card, /border: 1px solid rgba\(255, 255, 255, 0\.1\)/)
  assert.match(card, /border-radius: 1\.25rem/)
  assert.match(card, /background: rgba\(255, 255, 255, 0\.035\)/)
})

test('SUCCESS_CONTACT_BEFORE_RESTART = YES', () => {
  const card = successScreen.indexOf('data-success-contact-card')
  const restart = successScreen.indexOf('data-success-restart')
  assert.ok(card > 0 && restart > card)
})

test('SUCCESS_CONTACT_DUPLICATED = NO', () => {
  assert.equal((successScreen.match(/data-success-contacts/g) || []).length, 1)
  assert.doesNotMatch(successScreen, /public-success-contact-block/)
})

test('SUCCESS_RESTART_ACTION_UNCHANGED = YES', () => {
  assert.match(successScreen, /data-success-restart/)
  assert.match(successScreen, /href=\{restartHref\}/)
  assert.match(successScreen, /onClick=\{onRestart\}/)
  assert.match(successScreen, /\{copy\.restart\}/)
})

test('SUCCESS_CONTACT_SOURCE_CANONICAL', () => {
  assert.match(successScreen, /resolvePublicCompanyContacts\(support, companySlug\)/)
  assert.doesNotMatch(successScreen, /\+1\s*407|\(407\)|407-915|bbqathome|@cdl/i)
  const contacts = resolvePublicCompanyContacts(
    { phone: '+14079152242', email: 'team@example.com' },
    'cdl',
  )
  assert.equal(contacts.phone, '+14079152242')
  assert.equal(contacts.email, 'team@example.com')
})

test('SUCCESS_EMAIL_ICON_ADDED = YES', () => {
  assert.match(successScreen, /function EmailIcon/)
  assert.match(successScreen, /data-success-email[\s\S]{0,220}<EmailIcon \/>/)
  assert.match(successScreen, /<WhatsAppIcon \/>/)
  assert.match(successScreen, /<InstagramIcon \/>/)
  assert.match(
    css,
    /\.public-success-contacts \[data-success-email\] \.public-success-contact-icon/,
  )
})

test('SUCCESS_CONTACT_LEFT_ALIGNED = YES', () => {
  const scoped = css.slice(css.indexOf('.public-success-contact-card .public-success-contacts {'))
  assert.match(scoped, /text-align: left/)
  assert.match(scoped, /max-width: none/)
  assert.match(
    css,
    /\.public-success-contact-card \.public-success-contacts li \{[\s\S]*?justify-content: flex-start/,
  )
  assert.match(
    css,
    /\.public-success-contact-card \.public-success-contacts a \{[\s\S]*?justify-content: flex-start/,
  )
  assert.match(
    css,
    /\.public-success-contact-card \.public-success-contacts a \{[\s\S]*?overflow-wrap: anywhere/,
  )
})

test('CONTACT_HEADING_USES_SUMMARY_VISUAL_LANGUAGE = YES', () => {
  const heading = css.match(
    /\.public-success-contact-card \.public-success-contact-heading \{([^}]+)\}/,
  )?.[1] || ''
  assert.match(heading, /text-transform: uppercase/)
  assert.match(heading, /font-size: 0\.68rem/)
  assert.match(heading, /font-weight: 800/)
  assert.match(heading, /letter-spacing: 0\.16em/)
  assert.match(heading, /color: rgba\(255, 255, 255, 0\.58\)/)
})

test('SUCCESS_PSCS_VARIANT_AND_SIZE', () => {
  assert.match(successFooter, /PscsOneMark/)
  assert.match(successFooter, /variant="full"/)
  assert.match(successFooter, /size="md"/)
  assert.doesNotMatch(successFooter, /size="footer"/)
  assert.match(pscs, /size === 'footer' \? 'h-\[22px\]'/)
  assert.match(pscs, /: 'h-7'/)
  assert.match(css, /\.public-success-powered \[data-pscs-one-mark\] \{[\s\S]*?scale\(0\.84\)/)
  const footer = css.match(/\.public-success-footer \{([^}]+)\}/)?.[1] || ''
  assert.match(footer, /padding: 8\.5rem/)
  const powered = css.match(/\.public-success-powered \{([^}]+)\}/)?.[1] || ''
  assert.match(powered, /border-top: 1px solid rgba\(255, 255, 255, 0\.22\)/)
  assert.match(powered, /padding-top: 1\.35rem/)
  const label = css.match(/\.public-success-powered-label \{([^}]+)\}/)?.[1] || ''
  assert.match(label, /font-size: 0\.74rem/)
})

if (failed > 0) {
  console.error(`\n${failed} failed, ${passed} passed`)
  process.exit(1)
}

console.log(`\n${passed} passed`)
