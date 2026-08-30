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
import {
  resolvePublicGrillSummaryImageUrl,
  resolvePublicGrillSystemNotes,
} from '../../Lib/publicQuote/ownGrillDisplay.ts'
import { isUsablePublicPhone } from '../../Lib/publicQuote/phone.ts'
import { resolveSausageDisplayLabel } from '../../Lib/publicQuote/sausageOptions.ts'

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
  assert.match(wizard, /data-grill-photo-guidance/)
  assert.match(wizard, /grillPhotoGuidancePrimary/)
  assert.match(wizard, /grillPhotoGuidanceContinue/)
  assert.doesNotMatch(wizard, /data-grill-no-photo-warning/)
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
  assert.match(wizard, /!isPublicMode \? \(/)
  assert.match(wizard, /resolvePublicGrillSystemNotes/)
})

test('NO_PHOTO_WARNING_I18N', () => {
  assert.match(
    translations,
    /Anexe uma foto da churrasqueira para que nossa equipe possa confirmar se ela é adequada para o serviço/,
  )
  assert.match(
    translations,
    /Upload a photo of the grill so our team can confirm that it is suitable for the service/,
  )
  assert.match(
    translations,
    /Adjunte una foto de la parrilla para que nuestro equipo pueda confirmar que es adecuada para el servicio/,
  )
  assert.match(
    translations,
    /Se não tiver disponibilidade para enviar a foto agora, você pode continuar normalmente/,
  )
  assert.match(
    translations,
    /If you are unable to upload the photo now, you may continue normally/,
  )
  assert.match(
    translations,
    /Si no puede enviar la foto ahora, puede continuar normalmente/,
  )
  assert.match(
    translations,
    /Cliente informou que possui churrasqueira própria e não enviou uma foto\. A equipe CDL entrará em contato para confirmar a churrasqueira antes do evento/,
  )
  assert.match(
    translations,
    /The customer informed that they have their own grill and did not upload a photo\. The CDL team will contact them to confirm the grill before the event/,
  )
  assert.match(
    translations,
    /El cliente informó que tiene su propia parrilla y no envió una foto\. El equipo de CDL se pondrá en contacto para confirmar la parrilla antes del evento/,
  )
  assert.doesNotMatch(
    translations,
    /optou por prosseguir sem enviar foto/,
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

test('PUBLIC_BBQ_HAS_NO_EDITABLE_GRILL_NOTES', () => {
  const publicNotes = wizard.match(/!isPublicMode \? \([\s\S]*grillNotesPlaceholder/)
  assert.ok(publicNotes, 'staff may keep notes; public must hide the textarea')
  assert.match(wizard, /data-grill-photo-guidance/)
  assert.doesNotMatch(wizard, /data-grill-no-photo-warning/)
  assert.doesNotMatch(
    wizard,
    /isPublicMode \? \([\s\S]{0,200}textarea/,
  )
})

test('SYSTEM_GRILL_NOTE_ONLY_WHEN_OWN_GRILL_WITHOUT_PHOTO', () => {
  const helper = source('Lib/publicQuote/ownGrillDisplay.ts')
  assert.match(helper, /grillNoPhotoReviewNote/)
  assert.doesNotMatch(helper, /grillNoPhotoWarning/)
  assert.doesNotMatch(wizard, /grillNoPhotoReviewNote/)
  assert.doesNotMatch(wizard, /grillNoPhotoWarning/)
  assert.equal(
    resolvePublicGrillSystemNotes(
      { hasGrill: true, grillPhotoUrl: null, grillPhotoReference: null },
      'pt',
    ).includes('não enviou uma foto'),
    true,
  )
  assert.equal(
    resolvePublicGrillSystemNotes(
      {
        hasGrill: true,
        grillPhotoUrl: 'https://example.test/grill.webp',
        grillPhotoReference: 'quotes/x/grill.webp',
      },
      'pt',
    ),
    '',
  )
  assert.equal(
    resolvePublicGrillSystemNotes(
      { hasGrill: false, grillPhotoUrl: null, grillPhotoReference: null },
      'pt',
    ),
    '',
  )
})

test('REVIEW_GRILL_IMAGE_OWN_WITH_PHOTO', () => {
  assert.deepEqual(
    resolvePublicGrillSummaryImageUrl({
      hasOwnGrill: true,
      customerPhotoUrl: 'https://cdn.example/uploaded.webp',
      rentalImageUrl: 'https://cdn.example/item-084.webp',
    }),
    { kind: 'customer', url: 'https://cdn.example/uploaded.webp' },
  )
})

test('REVIEW_GRILL_IMAGE_OWN_WITHOUT_PHOTO_NO_FALLBACK', () => {
  assert.deepEqual(
    resolvePublicGrillSummaryImageUrl({
      hasOwnGrill: true,
      customerPhotoUrl: null,
      rentalImageUrl: 'https://cdn.example/item-084.webp',
    }),
    { kind: 'none', url: null },
  )
  const confirmationBody = review.slice(
    review.indexOf('function ConfirmationProposalBody'),
    review.indexOf('function DefaultProposalBody'),
  )
  assert.match(confirmationBody, /ownGrillNoPhoto/)
  assert.match(confirmationBody, /data-review-grill-observation/)
  assert.match(confirmationBody, /showGrillPhotoSection/)
  assert.doesNotMatch(confirmationBody, /data-grill-photo-pending-note/)
  assert.doesNotMatch(confirmationBody, /showOwnGrillPendingWarning/)
  assert.match(
    confirmationBody,
    /showGrillPhotoSection && grillSummaryImage\.url \? \([\s\S]*QuoteGrillPhotoFrame/,
  )
  assert.doesNotMatch(
    confirmationBody,
    /uploadedPhotoUrl\?\.trim\(\) \|\| defaultItemImageUrl/,
  )
})

test('REVIEW_GRILL_IMAGE_RENTAL_USES_ITEM_084', () => {
  assert.deepEqual(
    resolvePublicGrillSummaryImageUrl({
      hasOwnGrill: false,
      customerPhotoUrl: 'https://cdn.example/uploaded.webp',
      rentalImageUrl: 'https://cdn.example/item-084.webp',
    }),
    { kind: 'rental', url: 'https://cdn.example/item-084.webp' },
  )
  assert.match(review, /data-grill-summary-image/)
  assert.match(mapper, /grillDefaultImageUrl: input\.grillDefaultImageUrl/)
})

test('REVIEW_COVER_LOGO_AND_TEXT_CENTERED', () => {
  assert.match(review, /quote-proposal-hero-brand--review/)
  assert.match(
    source('app/quotes/[id]/quote-print.css'),
    /quote-proposal-hero-brand--review/,
  )
  assert.doesNotMatch(
    source('components/quotes/PublicQuoteSuccessScreen.tsx'),
    /quote-proposal-hero-brand--review/,
  )
})

test('EVENT_MOBILE_KEEPS_ADULTS_VISIBLE', () => {
  assert.match(wizard, /guest-counts-and-address/)
  const adultsCommit = wizard.match(
    /inputRef=\{adultsInputRef\}[\s\S]{0,1600}onCommit=\{[\s\S]{0,1400}scrollIntoView\(\{[\s\S]{0,180}?block: 'start'/,
  )
  assert.ok(adultsCommit)
  assert.match(wizard, /data-guest-children-under-3/)
  assert.match(wizard, /data-guest-children-4-12/)
  assert.match(wizard, /data-event-address-section/)
})

test('SAUSAGE_OPTIONS_NORMALIZED_CASING', () => {
  assert.equal(
    resolveSausageDisplayLabel(
      { item_key: 'ITEM_LINGUICA_TOSCANA_TRADICIONAL' },
      'pt',
    ),
    'Tradicional Porco',
  )
  assert.equal(
    resolveSausageDisplayLabel({ item_key: 'ITEM_024' }, 'pt'),
    'Tradicional Frango',
  )
  assert.equal(
    resolveSausageDisplayLabel({ option_item_key: 'tradicional_porco' }, 'pt'),
    'Tradicional Porco',
  )
  assert.doesNotMatch(
    source('Lib/publicQuote/sausageOptions.ts'),
    /TRADICIONAL PORCO/,
  )
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
