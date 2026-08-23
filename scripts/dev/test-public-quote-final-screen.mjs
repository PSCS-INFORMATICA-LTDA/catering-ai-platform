/**
 * Public final confirmation screen + scroll-to-top + empty placeholders.
 * Run: node --experimental-strip-types scripts/dev/test-public-quote-final-screen.mjs
 */
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PUBLIC_SUCCESS_COPY } from '../../Lib/publicQuote/successCopy.ts'
import { resolvePublicCompanyContacts } from '../../Lib/publicQuote/companyContacts.ts'
import { PUBLIC_PHONE_EXAMPLE } from '../../Lib/publicQuote/phone.ts'
import { PUBLIC_SUCCESS_FIRE_LOGO_SRC } from '../../Lib/publicQuote/successHeroMedia.ts'
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

const experience = source(
  'app/quote/[companySlug]/[locale]/PublicQuoteExperience.tsx',
)
const successScreen = source('components/quotes/PublicQuoteSuccessScreen.tsx')
const fireLogo = source('components/quotes/PublicSuccessFireLogo.tsx')
const scroll = source('Lib/publicQuote/scrollPublicQuoteToTop.ts')
const css = source('app/globals.css')
const wizard = source('app/quotes/new/QuoteWizard.tsx')
const address = source('app/quotes/new/AddressAutocompleteFields.tsx')
const phone = source('components/quotes/PublicPhoneField.tsx')
const landing = source('components/quotes/PublicLandingCinematic.tsx')
const packages = source('components/quotes/PublicPackageCatalog.tsx')

test('FINAL_SCREEN_PREMIUM_DARK', () => {
  assert.match(successScreen, /data-public-success/)
  assert.match(successScreen, /data-success-confirm/)
  assert.match(successScreen, /public-cinematic-display/)
  assert.match(successScreen, /public-cinematic-eyebrow/)
  assert.match(css, /\.public-success \{/)
  assert.match(css, /background: #050505/)
  assert.doesNotMatch(successScreen, /min-h-\[calc\(100vh-4rem\)\]/)
  assert.match(successScreen, /className="public-success"/)
  assert.doesNotMatch(experience, /min-h-\[calc\(100vh-4rem\)\]/)
})

test('SCROLL_TO_TOP_AFTER_ACCEPT', () => {
  assert.match(scroll, /window\.scrollTo/)
  assert.match(scroll, /document\.documentElement\.scrollTop = 0/)
  assert.match(scroll, /document\.body\.scrollTop = 0/)
  assert.match(scroll, /behavior: 'auto'/)
  assert.match(successScreen, /useLayoutEffect/)
  assert.match(successScreen, /scrollPublicQuoteToTop/)
  assert.match(successScreen, /scrollRestoration = 'manual'/)
  assert.match(experience, /handlePublicSuccess/)
})

test('SCROLL_CONTAINER_RESET', () => {
  assert.match(scroll, /data-public-quote-shell/)
  assert.match(scroll, /overflowY/)
  assert.match(scroll, /location\.hash/)
  assert.match(successScreen, /pageshow/)
})

test('CDL_FIRE_LOGO_CLOSING', () => {
  assert.match(successScreen, /PublicSuccessFireLogo/)
  assert.match(fireLogo, /data-success-fire-logo/)
  assert.match(fireLogo, /data-success-cdl-fire-video/)
  assert.doesNotMatch(successScreen, /data-success-fire-poster/)
  assert.doesNotMatch(successScreen, /cdl-grill-flames/)
  assert.doesNotMatch(css, /public-success-hero-photo/)
  assert.doesNotMatch(css, /public-success-fire-flicker/)
  assert.equal(PUBLIC_SUCCESS_FIRE_LOGO_SRC, '/cdl/logo.png')
  assert.ok(existsSync(join(ROOT, 'public', PUBLIC_SUCCESS_FIRE_LOGO_SRC)))
  assert.match(css, /public-success-cdl-signature/)
  const logoIndex = successScreen.indexOf('<PublicSuccessFireLogo')
  const summaryIndex = successScreen.indexOf('data-success-summary')
  const contactsIndex = successScreen.indexOf('data-success-contacts')
  assert.ok(logoIndex > summaryIndex)
  assert.ok(contactsIndex > logoIndex)
})

test('FINAL_SUMMARY', () => {
  assert.match(successScreen, /data-success-summary/)
  assert.match(successScreen, /success\.quote\.number/)
  assert.match(successScreen, /success\.quote\.eventDate/)
  assert.match(successScreen, /success\.quote\.eventName/)
  assert.match(successScreen, /success\.quote\.total/)
})

test('CTA_FINAL', () => {
  assert.match(successScreen, /data-success-restart/)
  assert.match(successScreen, /public-cinematic-cta/)
  assert.match(successScreen, /data-success-talk/)
  assert.match(experience, /setStarted\(false\)/)
  assert.equal(PUBLIC_SUCCESS_COPY.pt.restart, 'Criar outra solicitação')
  assert.equal(PUBLIC_SUCCESS_COPY.en.restart, 'Create another request')
  assert.equal(PUBLIC_SUCCESS_COPY.es.restart, 'Crear otra solicitud')
})

test('ZELLE_INFO', () => {
  assert.match(successScreen, /data-success-zelle/)
  assert.match(PUBLIC_SUCCESS_COPY.pt.zelle, /Zelle/)
  assert.match(PUBLIC_SUCCESS_COPY.en.zelle, /Zelle/)
  assert.match(PUBLIC_SUCCESS_COPY.es.zelle, /Zelle/)
  assert.doesNotMatch(landing.toLowerCase(), /zelle/)
  assert.doesNotMatch(experience.toLowerCase(), /zelle/)
})

test('CONTACTS', () => {
  assert.match(successScreen, /data-success-contacts/)
  assert.match(successScreen, /data-success-whatsapp/)
  assert.match(successScreen, /data-success-instagram/)
  assert.match(successScreen, /resolvePublicCompanyContacts/)
  const cdl = resolvePublicCompanyContacts(
    { phone: '+14075551234', whatsappUrl: 'https://wa.me/14075551234' },
    'cdl',
  )
  assert.equal(cdl.phone, '+14075551234')
  assert.ok(cdl.instagramUrl?.includes('instagram.com'))
  const derived = resolvePublicCompanyContacts({ phone: '+14079152242' }, 'cdl')
  assert.equal(derived.whatsappUrl, 'https://wa.me/14079152242')
})

test('PHONE_PLACEHOLDER_ONLY', () => {
  assert.equal(PUBLIC_PHONE_EXAMPLE, '+1 407 555 1234')
  assert.match(phone, /placeholder=\{t\.publicPhonePlaceholder\}/)
  assert.equal(getQuoteStrings('pt').wizard.publicPhonePlaceholder, 'Ex.: +1 407 555 1234')
  assert.equal(getQuoteStrings('en').wizard.publicPhonePlaceholder, 'Ex.: +1 407 555 1234')
  assert.equal(getQuoteStrings('es').wizard.publicPhonePlaceholder, 'Ej.: +1 407 555 1234')
  const types = source('Lib/quoteWizardTypes.ts')
  assert.match(types, /customerDraftPhone: ''/)
})

test('ADDRESS_NUMBER_BLANK', () => {
  assert.match(address, /placeholder=\{placeholders\?\.number\}/)
  assert.match(wizard, /publicAddressNumberPlaceholder/)
  assert.equal(getQuoteStrings('pt').wizard.publicAddressNumberPlaceholder, 'Ex.: 250')
  const types = source('Lib/quoteWizardTypes.ts')
  assert.match(types, /addressNumber: ''/)
})

test('REQUIRED_HIGHLIGHT', () => {
  assert.match(css, /\.public-field-required/)
  assert.match(css, /color: #f6d000/)
  assert.match(phone, /data-public-required|PublicRequiredMark/)
  assert.match(wizard, /required=\{isPublicMode\}/)
  assert.match(address, /markRequired/)
  assert.match(source('components/quotes/PublicRequiredMark.tsx'), /data-public-required/)
})

test('QUANTITY_BLANK_ZERO', () => {
  assert.match(wizard, /blankZero=\{isPublicMode\}/)
  assert.match(wizard, /blankZero && next === 0 \? ''/)
  assert.match(wizard, /publicAdultsPlaceholder/)
})

test('PT_EN_ES_FINAL_COPY', () => {
  assert.equal(PUBLIC_SUCCESS_COPY.pt.kicker, 'SOLICITAÇÃO RECEBIDA')
  assert.equal(PUBLIC_SUCCESS_COPY.en.kicker, 'REQUEST RECEIVED')
  assert.equal(PUBLIC_SUCCESS_COPY.es.kicker, 'SOLICITUD RECIBIDA')
  assert.match(PUBLIC_SUCCESS_COPY.pt.title, /confirmada/)
  assert.match(PUBLIC_SUCCESS_COPY.en.title, /confirmed/)
  assert.match(PUBLIC_SUCCESS_COPY.es.title, /confirmada/)
})

test('REGRESSION_LANDING_PACKAGES', () => {
  assert.match(landing, /data-public-landing-story/)
  assert.match(landing, /public-cinematic-hero/)
  assert.match(packages, /public-package-group/)
  assert.doesNotMatch(landing, /data-success-screen/)
  const videoAt = landing.indexOf('data-landing-chapter="video"')
  const closeAt = landing.indexOf('data-landing-chapter="final-cta"')
  const howAt = landing.indexOf('data-landing-chapter="how-it-works"')
  assert.ok(howAt > -1 && videoAt > howAt && closeAt > videoAt)
})

if (failed > 0) {
  console.error(`\n${failed} failed, ${passed} passed`)
  process.exit(1)
}
console.log(`\n${passed} passed`)
