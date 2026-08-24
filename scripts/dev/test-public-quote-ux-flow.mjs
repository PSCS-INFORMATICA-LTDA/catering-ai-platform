/**
 * UX flow polish — source and unit gates.
 * Run: node --experimental-strip-types scripts/dev/test-public-quote-ux-flow.mjs
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PUBLIC_LANDING_STORY } from '../../Lib/publicQuote/landingStoryCopy.ts'
import { mileageDestinationAddress } from '../../Lib/publicQuote/mileageDestination.ts'
import { formatEventAddressLines } from '../../Lib/formatEventAddress.ts'
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

const css = source('app/globals.css')
const landing = source('components/quotes/PublicLandingCinematic.tsx')
const cue = source('components/quotes/PublicLandingChapterCue.tsx')
const wizard = source('app/quotes/new/QuoteWizard.tsx')
const reveal = source('Lib/revealFloatingPanel.ts')
const reviewLayout = source('components/quote-review/QuoteReviewLayout.tsx')
const reservationCard = source('components/quote-review/QuoteReservationPaymentCard.tsx')
const confirmationStep = source('components/quote-review/PublicQuoteConfirmationStep.tsx')

test('LANDING_NEXT_CUE', () => {
  assert.equal(PUBLIC_LANDING_STORY.pt.scrollHint, 'Conheça nosso churrasco')
  assert.equal(PUBLIC_LANDING_STORY.en.scrollHint, 'Discover our BBQ experience')
  assert.equal(PUBLIC_LANDING_STORY.es.scrollHint, 'Conoce nuestra experiencia BBQ')
  for (const locale of ['pt', 'en', 'es']) {
    assert.ok(PUBLIC_LANDING_STORY[locale].scrollNext.trim().length > 0)
  }
  // Copy comes from the central store, never inlined in the component.
  assert.ok(!cue.includes('Conheça'))
  assert.match(landing, /variant="lead"[\s\S]*?label=\{story\.scrollHint\}/)
})

test('LANDING_LAST_DOT', () => {
  // Every chapter carries a cue; only the closing one is a dot.
  assert.equal((landing.match(/<PublicLandingChapterCue/g) ?? []).length, 5)
  assert.equal((landing.match(/variant="end"/g) ?? []).length, 1)
  const endIndex = landing.indexOf('variant="end"')
  const finalCta = landing.indexOf('data-landing-chapter="final-cta"')
  assert.ok(finalCta > -1 && endIndex > finalCta, 'dot must live in the last chapter')
  assert.match(cue, /public-landing-cue-dot/)
})

test('LANDING_CUE_USES_CDL_YELLOW', () => {
  assert.match(css, /\.public-landing-cue \{[^}]*color: var\(--cdl-yellow\)/)
  assert.match(css, /\.public-landing-cue-dot \{[^}]*background: var\(--cdl-yellow\)/)
  // No invented tone.
  const block = css.slice(
    css.indexOf('.public-landing-cue {'),
    css.indexOf('.wizard-section-label'),
  )
  assert.doesNotMatch(block, /#[0-9a-f]{6}/i)
})

test('LANDING_CUE_RESPECTS_REDUCED_MOTION', () => {
  assert.match(
    css,
    /@media \(prefers-reduced-motion: reduce\) \{\s*\.public-landing-cue-arrow \{\s*animation: none/,
  )
  assert.match(cue, /prefers-reduced-motion: reduce/)
  assert.match(cue, /behavior: reduced \? 'auto' : 'smooth'/)
})

test('LANDING_CUE_DOES_NOT_TRAP_SCROLL', () => {
  // Orientation only: no scroll-snap anywhere on the landing.
  assert.doesNotMatch(css, /scroll-snap-type/)
  assert.doesNotMatch(css, /scroll-snap-align/)
})

test('DATE_PICKER_AUTO_SCROLL', () => {
  assert.match(wizard, /data-wizard-datepicker-panel/)
  assert.match(
    wizard,
    /const panelRef = useRef<HTMLDivElement>\(null\)[\s\S]*?revealFloatingPanelWhenReady\(\(\) => panelRef\.current\)/,
  )
  // Derived from measured rects, never a magic offset.
  assert.match(reveal, /getBoundingClientRect/)
  assert.match(reveal, /visualViewport\?\.height \?\? window\.innerHeight/)
  assert.doesNotMatch(reveal, /scrollBy\(\{\s*top:\s*\d{2,}/)
})

test('TIME_PICKER_AUTO_SCROLL', () => {
  assert.match(wizard, /data-wizard-timepicker-panel/)
  const timeField = wizard.slice(wizard.indexOf('function TimePickerField'))
  assert.match(timeField, /revealFloatingPanelWhenReady\(\(\) => panelRef\.current\)/)
})

test('PICKER_SCROLL_CLEARS_STICKY_CHROME', () => {
  // Both the sticky header and the sticky step nav are measured live.
  assert.match(reveal, /\.public-quote-header/)
  assert.match(reveal, /\[data-wizard-step-nav\]/)
  assert.match(reveal, /position'\) === 'static'|position === 'static'/)
})

test('END_TIME_DEFAULT_CLOSED', () => {
  const timeField = wizard.slice(
    wizard.indexOf('function TimePickerField'),
    wizard.indexOf('function TimePickerField') + 3000,
  )
  assert.match(timeField, /const \[open, setOpen\] = useState\(false\)/)
  // Nothing may force a picker open.
  assert.doesNotMatch(timeField, /setOpen\(true\)/)
  // The only toggles are the explicit tap and the close paths.
  assert.match(timeField, /onClick=\{\(\) => \{\s*if \(readOnly\) return\s*setOpen\(\(current\) => !current\)/)
  assert.match(wizard, /readOnly=\{isPublicMode\}/)
})

test('END_TIME_FORMULA_UNCHANGED', () => {
  // The derivation is untouched; only the popover behaviour was in scope.
  assert.match(wizard, /deriveEventEndTime\(v, serviceDurationMinutes\)/)
  const duration = source('Lib/publicQuote/eventDuration.ts')
  assert.match(duration, /export function deriveEventEndTime/)
  assert.match(duration, /resolveServiceDurationMinutes\(durationMinutes\)/)
})

test('EVENT_ADDRESS_SECTION_LABEL', () => {
  for (const [locale, expected] of [
    ['pt', 'Endereço do evento'],
    ['en', 'Event address'],
    ['es', 'Dirección del evento'],
  ]) {
    assert.equal(getQuoteStrings(locale).wizard.eventAddressSection, expected)
  }
  assert.match(wizard, /data-event-address-section/)
  assert.match(wizard, /\{w\.eventAddressSection\}/)
  // Between the guest counts and the address block.
  const label = wizard.indexOf('data-event-address-section')
  assert.ok(wizard.indexOf('w.children4to12') < label)
  assert.ok(label < wizard.indexOf('<AddressAutocompleteFields'))
  // Discreet: a label, not a panel.
  assert.match(css, /\.wizard-section-label \{[^}]*color: var\(--cdl-subtle\)/)
  assert.doesNotMatch(css, /\.wizard-section-label \{[^}]*border:/)
  assert.doesNotMatch(css, /\.wizard-section-label \{[^}]*background:/)
})

test('DUPLICATE_DEPOSIT_COPY_REMOVED', () => {
  // The public review drops the split; the printed proposal keeps it.
  assert.match(reservationCard, /showPercentSplit = true/)
  assert.match(reservationCard, /\{showPercentSplit \? \(/)
  const confirmationBody = reviewLayout.slice(
    reviewLayout.indexOf('function ConfirmationProposalBody'),
    reviewLayout.indexOf('function DefaultProposalBody'),
  )
  assert.match(confirmationBody, /showPercentSplit=\{false\}/)
  const defaultBody = reviewLayout.slice(
    reviewLayout.indexOf('function DefaultProposalBody'),
  )
  assert.doesNotMatch(defaultBody, /showPercentSplit/)
})

test('DEPOSIT_CALCULATION_UNCHANGED', () => {
  // Amounts and percentages still come straight from the breakdown.
  const confirmationBody = reviewLayout.slice(
    reviewLayout.indexOf('function ConfirmationProposalBody'),
    reviewLayout.indexOf('function DefaultProposalBody'),
  )
  assert.match(confirmationBody, /depositAmount=\{breakdown\.deposit\}/)
  assert.match(confirmationBody, /balanceAmount=\{breakdown\.balance\}/)
  assert.match(
    confirmationBody,
    /reservationPercentage=\{breakdown\.rules_applied\.reservationPercentage\}/,
  )
  const rules = source('Lib/cdlCommercialRules.ts')
  assert.match(rules, /RESERVATION_PERCENTAGE = 30/)
  assert.match(rules, /BALANCE_PERCENTAGE = 70/)
})

test('MILEAGE_DESTINATION_EQUALS_EVENT_ADDRESS', () => {
  // Composed from the confirmed route, number, city, state and postal code.
  const lines = formatEventAddressLines({
    line: 'South Orange Avenue',
    number: '400',
    city: 'Orlando',
    state: 'FL',
    zip: '32801',
  })
  assert.equal(
    mileageDestinationAddress(lines.join('\n')),
    'South Orange Avenue 400, Orlando, FL 32801',
  )
  assert.equal(mileageDestinationAddress(''), '—')
  assert.equal(mileageDestinationAddress('  \n  '), '—')

  const confirmationBody = reviewLayout.slice(
    reviewLayout.indexOf('function ConfirmationProposalBody'),
    reviewLayout.indexOf('function DefaultProposalBody'),
  )
  assert.match(
    confirmationBody,
    /data-mileage-destination-source="event-address"[\s\S]*?mileageDestinationAddress\(eventAddressText\)/,
  )
  // The generic placeholder is gone from the public review.
  assert.doesNotMatch(confirmationBody, /mileageDestinationCopy/)
})

test('MILEAGE_CALCULATION_UNCHANGED', () => {
  const distance = source('Lib/publicQuote/distance.ts')
  assert.match(distance, /export async function resolvePublicQuoteMileageDistance/)
  // Display-only module: the code must not reach the pricing engine.
  const helperCode = source('Lib/publicQuote/mileageDestination.ts').replace(
    /\/\*[\s\S]*?\*\/|\/\/.*$/gm,
    '',
  )
  assert.doesNotMatch(helperCode, /import|require\(/)
  assert.doesNotMatch(helperCode, /distance|fetch|pricing|breakdown/i)
})

test('REVIEW_CTA_STICKY', () => {
  assert.match(confirmationStep, /data-public-review-actions/)
  assert.match(confirmationStep, /sticky bottom-0/)
  assert.match(confirmationStep, /pb-\[max\(0\.75rem,env\(safe-area-inset-bottom\)\)\]/)
  // One action shell, no second submit control.
  assert.equal(
    (confirmationStep.match(/data-testid="public-quote-submit"/g) ?? []).length,
    1,
  )
  // No longer dropped back to static on desktop.
  assert.doesNotMatch(confirmationStep, /sm:static/)
})

test('REVIEW_CTA_STILL_VALIDATED', () => {
  assert.match(
    confirmationStep,
    /const canSubmit =\s*Boolean\(breakdown\) &&\s*!pricingLoading &&\s*!pricingError &&\s*state\.publicConsentAccepted &&\s*!saving/,
  )
  assert.match(confirmationStep, /disabled=\{!canSubmit\}/)
})

if (failed > 0) {
  console.error(`\n${failed} failed, ${passed} passed`)
  process.exit(1)
}
console.log(`\n${passed} passed`)
