/**
 * Public quote submit blocker + success screen.
 * Run: node --experimental-strip-types scripts/dev/test-public-quote-submit-gate.mjs
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getQuoteStrings } from '../../Lib/quoteTranslations.ts'
import {
  calendarDateInTimeZone,
  isPublicEventDateBookable,
} from '../../Lib/publicQuote/eventDate.ts'

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
const confirm = source(
  'components/quote-review/PublicQuoteConfirmationStep.tsx',
)
const experience = source(
  'app/quote/[companySlug]/[locale]/PublicQuoteExperience.tsx',
)
const successScreen = source(
  'components/quotes/PublicQuoteSuccessScreen.tsx',
)
const successCopy = source('Lib/publicQuote/successCopy.ts')
const submitRoute = source('app/api/public/quote-intake/submit/route.ts')
const validation = source('Lib/publicQuote/validation.ts')
const stepStatus = source('app/quotes/new/wizardStepStatus.ts')

test('TEST 6 Submit zero extras is valid', () => {
  assert.match(validation, /\.filter\(\(line\) => validUuid\(line\.itemId\) && line\.quantity > 0\)/)
  assert.doesNotMatch(validation, /additionals\.length\s*[><=]/)
  assert.doesNotMatch(submitRoute, /additionals\.length > 0/)
})

test('TEST 7 Submit with extras keeps selected lines', () => {
  assert.match(wizard, /additionals: Object\.entries\(state\.additionals\)/)
})

test('TEST 8 Privacy unchecked blocks submit', () => {
  assert.match(confirm, /state\.publicConsentAccepted/)
  assert.match(confirm, /!canSubmit/)
  assert.match(wizard, /!state\.publicConsentAccepted/)
})

test('TEST 9 Privacy checked allows submit', () => {
  assert.match(confirm, /canSubmit =/)
  assert.match(confirm, /state\.publicConsentAccepted/)
  assert.match(wizard, /consent: \{\s*accepted: true/)
})

test('TEST 10 Quote persistence requires RPC', () => {
  assert.match(submitRoute, /finalize_public_quote/)
  assert.match(wizard, /!result\.quote\?\.id/)
})

test('TEST 11 Correct company_id from session', () => {
  assert.match(submitRoute, /session\.company_id/)
  assert.match(submitRoute, /companyId: session\.company_id/)
})

test('TEST 12 Pricing snapshot is server-side', () => {
  assert.match(submitRoute, /p_pricing: \{/)
  assert.match(submitRoute, /resolvedAdditionals: pricing\.resolvedAdditionals/)
  assert.doesNotMatch(submitRoute, /body\.total/)
})

test('TEST 13 Submit failure releases loading state', () => {
  assert.match(wizard, /publicSubmitLockRef\.current = false/)
  assert.match(wizard, /finally \{[\s\S]*setSaving\(false\)/)
})

test('TEST 14 Retry after failure is possible', () => {
  assert.match(confirm, /disabled=\{!canSubmit\}/)
  assert.match(confirm, /!saving/)
})

test('TEST 15 Double submit protection', () => {
  assert.match(wizard, /publicSubmitLockRef/)
  assert.match(wizard, /publicIdempotencyKeyRef/)
  assert.match(submitRoute, /p_idempotency_key_hash/)
})

test('TEST 16 Success screen only after persisted quote', () => {
  assert.match(wizard, /onPublicSuccess\?\.\(result\)/)
  assert.match(experience, /success \? \(/)
  assert.match(successScreen, /success\.quote\.number/)
  assert.match(successScreen, /data-success-screen/)
})

test('TEST 17 Success localized PT', () => {
  assert.match(successCopy, /kicker: 'SOLICITAÇÃO RECEBIDA'/)
  assert.match(successCopy, /entrar em contato/)
})

test('TEST 18 Success localized EN', () => {
  assert.match(successCopy, /kicker: 'REQUEST RECEIVED'/)
  assert.match(successCopy, /get in touch/)
})

test('TEST 19 Success localized ES', () => {
  assert.match(successCopy, /kicker: 'SOLICITUD RECIBIDA'/)
  assert.match(successCopy, /pondrá en contacto/)
})

test('TEST 20 Past event date is the submit blocker', () => {
  assert.equal(isPublicEventDateBookable('2026-08-16', new Date('2026-08-20T12:00:00-04:00')), false)
  assert.equal(isPublicEventDateBookable('2026-08-20', new Date('2026-08-20T12:00:00-04:00')), true)
  assert.match(calendarDateInTimeZone('America/New_York'), /^\d{4}-\d{2}-\d{2}$/)
  assert.match(validation, /isPublicEventDateBookable/)
  assert.match(validation, /invalid_event_date/)
  assert.match(wizard, /w\.publicEventDatePast/)
  assert.match(stepStatus, /isPublicEventDateBookable/)
  assert.ok(getQuoteStrings('pt').wizard.publicEventDatePast.includes('hoje'))
  assert.ok(getQuoteStrings('en').wizard.publicEventDatePast.toLowerCase().includes('today'))
  assert.ok(getQuoteStrings('es').wizard.publicEventDatePast.includes('hoy'))
})

test('Success uses official CDL fire logo, not grill photography', () => {
  assert.match(successScreen, /PublicSuccessFireLogo/)
  assert.match(source('components/quotes/PublicSuccessFireLogo.tsx'), /data-success-fire-logo/)
  assert.doesNotMatch(successScreen, /cdl-grill-flames/)
  assert.match(source('app/globals.css'), /public-success-cdl-signature/)
  assert.match(source('components/quotes/PublicQuoteBrandLockup.tsx'), /CDL_FLAME_EMBLEM_SRC/)
})

if (failed > 0) {
  console.error(`\n${failed} failed, ${passed} passed`)
  process.exit(1)
}
console.log(`\n${passed} passed`)
