/**
 * Public quote critical fixes — extras Next always on, footer PSCS, submit.
 * Run: node --experimental-strip-types scripts/dev/test-public-quote-critical-fixes.mjs
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
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

const wizard = source('app/quotes/new/QuoteWizard.tsx')
const stepNav = source('components/quotes/QuoteWizardStepNav.tsx')
const stepStatus = source('app/quotes/new/wizardStepStatus.ts')
const advance = source('Lib/wizardStepAdvance.ts')
const experience = source(
  'app/quote/[companySlug]/[locale]/PublicQuoteExperience.tsx',
)
const mark = source('components/brand/PscsOneMark.tsx')
const confirm = source(
  'components/quote-review/PublicQuoteConfirmationStep.tsx',
)
const submitRoute = source('app/api/public/quote-intake/submit/route.ts')
const validation = source('Lib/publicQuote/validation.ts')
const types = source('Lib/quoteWizardTypes.ts')

test('TEST 1 Extras Next enabled immediately', () => {
  assert.match(wizard, /const additionalsStepNextDisabled = false/)
  assert.match(
    advance,
    /export function canAdvanceFromAdditionalsStep[\s\S]*?return true/,
  )
})

test('TEST 2 Extras Next remains fixed', () => {
  assert.match(stepNav, /sticky bottom-0/)
  assert.match(wizard, /sticky=\{isPublicMode\}/)
  assert.match(wizard, /data-wizard-cta-spacer/)
  assert.match(stepNav, /pb-\[max\(0\.75rem,env\(safe-area-inset-bottom\)\)\]/)
})

test('TEST 3 Zero review required', () => {
  assert.doesNotMatch(stepStatus, /areAllAdditionalCategoriesVisited/)
  assert.doesNotMatch(stepStatus, /categoriesReviewRequired/)
  assert.match(stepStatus, /if \(ctx\.currentStep < 3\) return 3/)
})

test('TEST 4 Zero category opened still allows Next', () => {
  assert.doesNotMatch(
    wizard,
    /if \(remaining\.length > 0\) \{\s*handleAdditionalsNextBlockedClick/,
  )
  assert.match(wizard, /const additionalsStepNextDisabled = false/)
})

test('TEST 5 Zero additional selected allows Next', () => {
  assert.doesNotMatch(stepStatus, /additionalsCount > 0/)
  assert.match(wizard, /const additionalsStepNextDisabled = false/)
})

test('TEST 6 One additional selected allows Next', () => {
  assert.match(advance, /case 3:\s*return canAdvanceFromAdditionalsStep/)
  assert.match(
    advance,
    /export function canAdvanceFromAdditionalsStep[\s\S]*?return true/,
  )
})

test('TEST 7 New quote starts with zero extras', () => {
  assert.match(types, /additionals: \{\}/)
  assert.match(experience, /draft\.selection\?\.additionals \?\? \[\]/)
})

test('TEST 8 Same quote retains selections when Back', () => {
  assert.doesNotMatch(
    wizard,
    /step !== 3[\s\S]{0,80}setVisitedAdditionalCategories\(new Set\(\)\)/,
  )
  assert.match(
    wizard,
    /if \(step !== 3\) \{\s*setOpenAdditionalCategories\(new Set\(\)\)/,
  )
})

test('TEST 9 New quote does not inherit old extras', () => {
  assert.match(experience, /forceNew/)
  assert.match(types, /additionals: \{\}/)
})

test('TEST 10 Submit with zero extras is valid', () => {
  assert.match(validation, /\.filter\(\(line\) => validUuid\(line\.itemId\) && line\.quantity > 0\)/)
  assert.doesNotMatch(validation, /additionals\.length\s*[><=]/)
  assert.doesNotMatch(submitRoute, /additionals\.length > 0/)
})

test('TEST 11 Submit with extras keeps selected lines', () => {
  assert.match(
    wizard,
    /additionals: Object\.entries\(state\.additionals\)/,
  )
  assert.match(validation, /quantity: nonNegativeInteger\(line\.quantity, 10000\)/)
})

test('TEST 12 Quote persistence requires server RPC', () => {
  assert.match(submitRoute, /finalize_public_quote/)
  assert.match(submitRoute, /computeQuotePricing/)
  assert.match(wizard, /\/api\/public\/quote-intake\/submit/)
})

test('TEST 13 Quote uses session company_id', () => {
  assert.match(submitRoute, /session\.company_id/)
  assert.match(submitRoute, /companyId: session\.company_id/)
})

test('TEST 14 Pricing snapshot is server-side', () => {
  assert.match(submitRoute, /p_pricing: \{/)
  assert.match(submitRoute, /resolvedAdditionals: pricing\.resolvedAdditionals/)
  assert.doesNotMatch(submitRoute, /body\.total/)
  assert.doesNotMatch(submitRoute, /submission\.total/)
})

test('TEST 15 Success only after persisted quote id', () => {
  assert.match(wizard, /!result\.quote\?\.id/)
  assert.match(wizard, /onPublicSuccess\?\.\(result\)/)
  assert.match(experience, /onPublicSuccess=\{setSuccess\}/)
  assert.match(experience, /success \? \(/)
})

test('TEST 16 Submit error produces visible feedback', () => {
  assert.match(confirm, /submitError \?/)
  assert.match(confirm, /w\.publicSubmitError/)
  assert.match(confirm, /data-submit-blocked-reason/)
  assert.match(confirm, /w\.consentRequired/)
  assert.ok(getQuoteStrings('pt').wizard.consentRequired.length > 0)
  assert.ok(getQuoteStrings('en').wizard.publicSubmitError.length > 0)
  assert.ok(getQuoteStrings('es').wizard.publicSubmitError.length > 0)
})

test('TEST 17 Double submit protected', () => {
  assert.match(confirm, /!saving/)
  assert.match(wizard, /publicIdempotencyKeyRef/)
  assert.match(wizard, /publicSubmitLockRef/)
  assert.match(wizard, /setSaving\(true\)/)
  assert.match(wizard, /finally \{[\s\S]*setSaving\(false\)/)
  assert.match(submitRoute, /p_idempotency_key_hash/)
})

test('TEST 18 Small colored footer mark visible', () => {
  const pscsMark = source('components/brand/PscsOneMark.tsx')
  assert.match(experience, /size="footer"/)
  assert.match(experience, /variant="icon"/)
  assert.match(pscsMark, /src="\/brand\/pscs-one\.png"/)
  assert.match(pscsMark, /h-\[22px\]/)
  assert.match(experience, /PscsOneMark/)
})

test('TEST 19 Footer contains only Powered by PSCS One', () => {
  const powered = experience.slice(experience.indexOf('data-powered-by'))
  const block = powered.slice(0, powered.indexOf('</p>') + 4)
  assert.match(block, /\{copy\.poweredBy\}/)
  assert.match(block, /PscsOneMark/)
  assert.doesNotMatch(block, /Catering App/)
  assert.equal((experience.match(/poweredBy: 'Powered by PSCS One'/g) ?? []).length, 3)
})

test('TEST 20 No horizontal overflow classes on public shell', () => {
  assert.match(experience, /min-w-0/)
  assert.match(stepNav, /min-w-0/)
})

if (failed > 0) {
  console.error(`\n${failed} failed, ${passed} passed`)
  process.exit(1)
}
console.log(`\n${passed} passed`)
