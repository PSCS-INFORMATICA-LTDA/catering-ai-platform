/**
 * Public quote final micro-polish gates.
 * Run: npm run test:dev:public-quote-final-micro-polish
 */
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { sanitizePublicAdditionalQuantity } from '../../Lib/publicQuote/extrasEligibility.ts'
import { isUsablePublicPhone } from '../../Lib/publicQuote/phone.ts'

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

const wizard = source('app/quotes/new/QuoteWizard.tsx')
const advance = source('Lib/wizardStepAdvance.ts')
const stepStatus = source('app/quotes/new/wizardStepStatus.ts')
const confirmation = source('components/quote-review/PublicQuoteConfirmationStep.tsx')
const review = source('components/quote-review/QuoteReviewLayout.tsx')
const mapper = source('components/quote-review/mapWizardToQuoteReview.ts')
const policy = source('components/CdlImportantRulesPanel.tsx')
const logo = source('components/CdlBrandLogo.tsx')
const translations = source('Lib/quoteTranslations.ts')
const fireVideo = join(
  ROOT,
  'public/cdl/video/CDL_LOGO_FOGO_SEM_BOOK_NOW_FINAL.mp4',
)
const fireSafe = join(
  ROOT,
  'public/cdl/video/CDL_LOGO_FOGO_SEM_BOOK_NOW_SAFE_V7.mp4',
)

function isGrillPhotoRequiredAndMissing(state) {
  if (!state.hasGrill) return false
  return (
    state.grillPhotoStatus !== 'received' ||
    (!state.grillPhotoUrl?.trim() && !state.grillPhotoReference?.trim())
  )
}

function grillState(overrides = {}) {
  return {
    grillSetupAnswered: true,
    hasGrill: true,
    grillPhotoStatus: 'pending',
    grillPhotoUrl: '',
    grillPhotoReference: '',
    grillRentalRequired: false,
    grillRentalQty: 0,
    ...overrides,
  }
}

test('WIZARD_ORDER_UNCHANGED', () => {
  assert.match(source('Lib/wizardStepAdvance.ts'), /export const WIZARD_STEP_COUNT = 6/)
  assert.match(
    source('app/quotes/new/wizardStepStatus.ts'),
    /WIZARD_STEP_LABELS = \[\s*'Cliente',\s*'Evento',\s*'Churrasco',\s*'Pacote',\s*'Adicionais',\s*'Confirmação',/,
  )
})

test('WAITER_VISIBLE_IN_BBQ', () => {
  assert.match(wizard, /data-bbq-waiter-slot/)
  assert.match(wizard, /\{step === 2 && \([\s\S]*QuoteBbqWaiterPanel/)
  assert.match(source('components/quotes/QuoteBbqWaiterPanel.tsx'), /data-waiter-service/)
})

test('WAITER_QTY_AND_PRICE_MATH', () => {
  assert.equal(sanitizePublicAdditionalQuantity(0) * 250, 0)
  assert.equal(sanitizePublicAdditionalQuantity(1) * 250, 250)
  assert.equal(sanitizePublicAdditionalQuantity(2) * 250, 500)
  assert.equal(sanitizePublicAdditionalQuantity(5) * 250, 1250)
  assert.equal(sanitizePublicAdditionalQuantity(1.5), 0)
})

test('PUBLIC_SUBMIT_ALLOWS_OWN_GRILL_WITHOUT_PHOTO', () => {
  const validation = source('Lib/publicQuote/validation.ts')
  assert.match(validation, /if \(\s*draft\.grill\.photoReference &&/)
  assert.match(validation, /photoReference\.startsWith\(expectedPrefix\)/)
  assert.doesNotMatch(
    validation,
    /if \(!draft\.grill\.photoReference\?\.startsWith/,
  )
})

test('HAS_GRILL_YES_WITHOUT_PHOTO_NEXT_ALLOWED', () => {
  const state = grillState()
  assert.equal(isGrillPhotoRequiredAndMissing(state), true)
  assert.match(stepStatus, /export function isGrillPhotoRequiredAndMissing/)
  assert.doesNotMatch(
    stepStatus,
    /case 2:[\s\S]*isGrillPhotoRequiredAndMissing\(state\)[\s\S]*grillPendingPhoto/,
  )
  assert.doesNotMatch(advance, /isGrillPhotoRequiredAndMissing/)
  assert.match(advance, /case 2: \{[\s\S]*grillSetupAnswered[\s\S]*return true/)
  assert.match(wizard, /data-grill-no-photo-warning/)
  assert.match(wizard, /grillNoPhotoWarning/)
})

test('HAS_GRILL_YES_WITH_PHOTO_NEXT_ALLOWED', () => {
  const state = grillState({
    grillPhotoStatus: 'received',
    grillPhotoUrl: 'https://example.test/grill.webp',
  })
  assert.equal(isGrillPhotoRequiredAndMissing(state), false)
})

test('HAS_GRILL_NO_RENTAL_REQUIRED', () => {
  const state = grillState({
    hasGrill: false,
    grillPhotoStatus: 'not_applicable',
    grillRentalRequired: true,
    grillRentalQty: 1,
  })
  assert.equal(isGrillPhotoRequiredAndMissing(state), false)
  assert.match(wizard, /data-grill-rental-mandatory="true"/)
  assert.match(wizard, /grillRentalDisplayUrl/)
})

test('OBSERVATION_NOT_REQUIRED', () => {
  assert.doesNotMatch(wizard, /grillNotes[\s\S]{0,200}required/)
  assert.match(translations, /grillNotesPlaceholder/)
})

test('NO_PHOTO_WARNING_I18N', () => {
  assert.match(
    translations,
    /Você pode continuar sem enviar a foto agora/,
  )
  assert.match(
    translations,
    /You can continue without uploading the photo now/,
  )
  assert.match(
    translations,
    /Puede continuar sin enviar la foto ahora/,
  )
  assert.match(
    translations,
    /Foto da churrasqueira pendente/,
  )
  assert.match(
    translations,
    /Grill photo pending/,
  )
  assert.match(
    translations,
    /Foto de la parrilla pendiente/,
  )
})

test('PHONE_REQUIRED_AND_MAPPED', () => {
  assert.match(stepStatus, /hasUsableContactPhone\(ctx\)/)
  assert.match(mapper, /displayPublicPhone\(state\.customerDraftPhone\)/)
  assert.match(review, /w\.customerPhone/)
  assert.equal(isUsablePublicPhone(''), false)
  assert.equal(isUsablePublicPhone('+1 407 555 1234'), true)
  assert.equal(isUsablePublicPhone('+55 11 99999-0000'), true)
})

test('CANCELLATION_SECTIONS_DEFAULT_OPEN_ON_REVIEW_ONLY', () => {
  assert.match(review, /defaultOpenAll/)
  assert.match(policy, /defaultOpenAll = false/)
  assert.match(policy, /open=\{defaultOpenAll \|\| index < 3\}/)
  const confirmationBody = review.slice(
    review.indexOf('function ConfirmationProposalBody'),
    review.indexOf('function DefaultProposalBody'),
  )
  assert.match(confirmationBody, /defaultOpenAll/)
  const defaultBody = review.slice(review.indexOf('function DefaultProposalBody'))
  assert.doesNotMatch(defaultBody, /defaultOpenAll/)
})

test('CONFIRM_BUTTONS_UNCHANGED', () => {
  assert.equal(
    (confirmation.match(/data-testid="public-quote-submit"/g) ?? []).length,
    1,
  )
  assert.match(confirmation, /data-public-review-actions/)
  assert.match(confirmation, /\{copy\.back\}/)
  assert.match(confirmation, /onClick=\{onSubmit\}/)
  assert.match(confirmation, /onClick=\{onBack\}/)
  assert.match(
    confirmation,
    /cancellationPolicyAccepted &&\s*state\.publicConsentAccepted/,
  )
  assert.doesNotMatch(confirmation, /grillNoPhoto/)
  assert.doesNotMatch(confirmation, /defaultOpenAll/)
})

test('REVIEW_LOGO_VARIANT_ONLY', () => {
  assert.match(logo, /variant === 'review' \? CDL_REVIEW_LOGO_PATH/)
  assert.match(review, /variant=\{variant === 'confirmation' \? 'review' : 'cover'\}/)
  assert.match(review, /quote-review-cover-logo/)
  assert.ok(existsSync(join(ROOT, 'public/cdl/logo-review-circle.png')))
  assert.doesNotMatch(source('components/quotes/PublicQuoteSuccessScreen.tsx'), /quote-review-cover-logo/)
  assert.doesNotMatch(source('components/quotes/CdlFireSignature.tsx'), /CDL_REVIEW_LOGO_PATH/)
})

test('POST_ACCEPT_FIRE_VIDEO_INTACT', () => {
  assert.ok(existsSync(fireVideo))
  assert.ok(existsSync(fireSafe))
  const finalHash = createHash('sha256').update(readFileSync(fireVideo)).digest('hex')
  const safeHash = createHash('sha256').update(readFileSync(fireSafe)).digest('hex')
  assert.equal(
    finalHash,
    'f4b197946278e20fea92034459f1d0f3df0ce6ae847368aea093f2288d2462df',
  )
  assert.equal(
    safeHash,
    'f0cca99c4658b86e651e5bf5e61678088604b41a38e3dd7298f3e13b9a42bd27',
  )
})

if (failed > 0) {
  console.error(`\n${failed} failed, ${passed} passed`)
  process.exit(1)
}
console.log(`\n${passed} passed`)
