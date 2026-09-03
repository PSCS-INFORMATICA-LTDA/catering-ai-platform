/**
 * Micro polish — source gates.
 * Run: node --experimental-strip-types scripts/dev/test-public-quote-micro-polish.mjs
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

const options = source('components/quotes/PackageIncludedOptions.tsx')
const reveal = source('Lib/revealFloatingPanel.ts')
const confirmation = source('components/quote-review/PublicQuoteConfirmationStep.tsx')
const catalog = source('components/quotes/PublicPackageCatalog.tsx')

test('PACKAGE_OPTION_SCROLL_REVEALS_NEXT', () => {
  assert.match(options, /revealNextBlockWhenReady/)
  // Only when a further group exists.
  assert.match(options, /const nextGroup = activeGroups\[groupIndex \+ 1\] \?\? null/)
  assert.match(options, /if \(!nextGroup\) return/)
  // Real geometry, never a fixed offset.
  assert.match(reveal, /export function revealNextBlock/)
  assert.match(reveal, /getBoundingClientRect/)
  assert.doesNotMatch(reveal, /scrollBy\(\{\s*top:\s*\d{2,}/)
  assert.match(reveal, /visualViewport\?\.height \?\? window\.innerHeight/)
})

test('PACKAGE_LAST_OPTION_NO_EXTRA_SCROLL', () => {
  const body = reveal.slice(reveal.indexOf('export function revealNextBlock'))
  // No next block, already-visible block, or a sub-pixel move: do nothing.
  assert.match(body, /if \(!next \|\| typeof window === 'undefined'\) return 0/)
  assert.match(body, /if \(alreadyVisible >= wanted\) return 0/)
  assert.match(body, /if \(delta < MIN_SHIFT\) return 0/)
})

test('NO_AGGRESSIVE_SCROLL', () => {
  const body = reveal.slice(reveal.indexOf('export function revealNextBlock'))
  // Never scroll when the customer could not see what they tapped.
  assert.match(body, /if \(anchorRect\.bottom <= usableTop \|\| anchorRect\.top >= usableBottom\) return 0/)
  // Keep the chosen chip on screen with room above it.
  assert.match(body, /const maxDelta = anchorRect\.top - usableTop - CONTEXT_GAP/)
  assert.match(body, /delta = Math\.min\(delta, maxDelta\)/)
  assert.match(reveal, /const CONTEXT_GAP = \d+/)
})

test('PACKAGE_ACCORDION_UNCHANGED', () => {
  // Selecting must not collapse or re-open anything.
  const click = options.slice(options.indexOf('onClick={(event) => {'))
  assert.doesNotMatch(click.slice(0, 400), /setOpen|setExpanded|toggle/i)
  // The catalog still owns open/close exactly as before.
  assert.match(catalog, /data-expanded-package=\{pkg\.id\}/)
  assert.match(catalog, /active && expanded && selectableGroups\.length > 0/)
})

test('PACKAGE_IMAGE_AND_OPTIONS_UNCHANGED', () => {
  // The reveal touched no visual property of the option chips or the card.
  assert.match(
    options,
    /className=\{`min-h-\[2\.5rem\] rounded-lg border px-2 py-2 text-center text-xs font-semibold leading-tight transition sm:text-sm/,
  )
  assert.match(options, /className="grid grid-cols-2 gap-2"/)
  assert.match(options, /rounded-xl border bg-white px-3 py-2\.5/)
  // onChange still carries the same arguments to the same handler.
  assert.match(options, /onChange\?\.\(group\.id, item\.id\)/)
})

test('REVIEW_ACCEPT_AND_NEXT_MOVE_TOGETHER', () => {
  const shell = confirmation.slice(
    confirmation.indexOf('data-public-review-actions'),
    confirmation.lastIndexOf('</div>'),
  )
  assert.match(shell, /data-public-consent/)
  assert.match(shell, /type="checkbox"/)
  assert.match(shell, /data-testid="public-quote-submit"/)
  assert.ok(
    shell.indexOf('data-public-consent') < shell.indexOf('public-quote-submit'),
    'consent renders above the submit inside the shell',
  )
})

test('REVIEW_CHECKBOX_AND_NEXT_STICKY', () => {
  const shellOpen = confirmation.slice(
    confirmation.indexOf('data-public-review-actions'),
    confirmation.indexOf('data-public-consent'),
  )
  assert.match(shellOpen, /sticky bottom-0/)
  assert.match(shellOpen, /pb-\[max\(0\.75rem,env\(safe-area-inset-bottom\)\)\]/)
  assert.match(shellOpen, /border-t border-cdl-border/)
  // Follows the content column rather than spanning the window.
  assert.match(shellOpen, /sm:mx-0/)
})

test('REVIEW_NO_DUPLICATE_ACTIONS', () => {
  assert.equal((confirmation.match(/type="checkbox"/g) ?? []).length, 1)
  assert.equal(
    (confirmation.match(/data-testid="public-quote-submit"/g) ?? []).length,
    1,
  )
  assert.equal((confirmation.match(/data-public-consent/g) ?? []).length, 1)
  // The standalone consent card in the page body is gone.
  assert.doesNotMatch(
    confirmation,
    /rounded-2xl border border-cdl-border bg-cdl-surface p-5/,
  )
})

test('REVIEW_VALIDATION_UNCHANGED', () => {
  assert.match(
    confirmation,
    /const canSubmit =\s*Boolean\(breakdown\) &&\s*!pricingLoading &&\s*!pricingError &&\s*state\.publicConsentAccepted &&\s*!saving/,
  )
  assert.match(confirmation, /disabled=\{!canSubmit\}/)
  // Same blocking conditions, only relocated into the shell.
  assert.match(
    confirmation,
    /const blockedReason =\s*canSubmit \|\| saving\s*\? null/,
  )
  assert.match(confirmation, /onChange=\{\(event\) => onConsentChange\(event\.target\.checked\)\}/)
  // No parallel state was introduced.
  assert.doesNotMatch(confirmation, /useState\(/)
})

if (failed > 0) {
  console.error(`\n${failed} failed, ${passed} passed`)
  process.exit(1)
}
console.log(`\n${passed} passed`)
