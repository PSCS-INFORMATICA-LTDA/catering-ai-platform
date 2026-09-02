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

test('CHECK_ACTIVATION_PATH = CLICK', () => {
  const pointerBlock = wizardCheck.slice(
    wizardCheck.indexOf('onPointerDown'),
    wizardCheck.indexOf('onClick'),
  )
  assert.doesNotMatch(pointerBlock, /advance\(/)
  assert.match(pointerBlock, /pointerType === 'mouse'/)
  assert.match(wizardCheck, /data-field-advance-sync="click"/)
  const clickBlock = wizardCheck.slice(wizardCheck.indexOf('onClick'))
  assert.match(clickBlock, /advance\(\)/)
})

test('FOCUS_SYNCHRONOUS = YES', () => {
  assert.match(focusFn, /node\.focus\(\{ preventScroll: true \}\)/)
  const focusAt = focusFn.indexOf('node.focus({ preventScroll: true })')
  const rafAt = focusFn.indexOf('requestAnimationFrame')
  assert.ok(rafAt > focusAt, 'RAF may only follow the sync focus')
  assert.doesNotMatch(focusFn, /setTimeout/)
  assert.doesNotMatch(wizardCheck, /setTimeout|requestAnimationFrame\(|\.then\(|await |useEffect/)
})

test('ONE_TAP_ONE_ADVANCE = YES', () => {
  assert.equal((wizardCheck.match(/advance\(\)/g) || []).length, 1)
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
  assert.match(css, /\.public-success-powered \[data-pscs-one-mark\] \{[\s\S]*?scale\(1\.12\)/)
  const footer = css.match(/\.public-success-footer \{([^}]+)\}/)?.[1] || ''
  assert.match(footer, /padding: 3rem/)
  const label = css.match(/\.public-success-powered-label \{([^}]+)\}/)?.[1] || ''
  assert.match(label, /font-size: 0\.74rem/)
})

if (failed > 0) {
  console.error(`\n${failed} failed, ${passed} passed`)
  process.exit(1)
}

console.log(`\n${passed} passed`)
