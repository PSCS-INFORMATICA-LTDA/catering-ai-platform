/**
 * Public experience V5 + visual hotfix gates.
 * Run: node --experimental-strip-types scripts/dev/test-public-quote-brand-polish-v5.mjs
 */
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PUBLIC_SUCCESS_COPY } from '../../Lib/publicQuote/successCopy.ts'
import { PUBLIC_LANDING_STORY } from '../../Lib/publicQuote/landingStoryCopy.ts'
import { resolvePublicCompanyContacts } from '../../Lib/publicQuote/companyContacts.ts'
import { displayPublicPhone } from '../../Lib/publicQuote/phone.ts'
import {
  LANDING_HAS_NO_FIRE_SIGNATURE,
  LANDING_HAS_NO_PSCS_ONE,
  LANDING_HAS_STATIC_CDL_LOGO,
  PUBLIC_SUCCESS_CDL_FIRE_MP4_SRC,
  PUBLIC_SUCCESS_CDL_LOGO_SRC,
  SUCCESS_DOES_NOT_USE_CDL_MP4,
  SUCCESS_FIRE_BACKGROUND_TRANSPARENT,
  SUCCESS_FIRE_NO_RED_BLOB,
  SUCCESS_FIRE_REDUCED_MOTION_SAFE,
  SUCCESS_FIRE_USES_TREATED_OFFICIAL_MP4,
  SUCCESS_HAS_CDL_FIRE_SIGNATURE,
  SUCCESS_HAS_PSCS_ONE,
  SUCCESS_VIDEO_HAS_NO_BOOK_NOW,
} from '../../Lib/publicQuote/successHeroMedia.ts'

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
const signature = source('components/quotes/CdlFireSignature.tsx')
const landing = source('components/quotes/PublicLandingCinematic.tsx')
const title = source('components/quotes/PublicLandingTitle.tsx')
const highlight = source('components/quotes/CdlHighlight.tsx')
const css = source('app/globals.css')
const lock = source('components/quotes/usePublicQuoteThemeLock.ts')
const story = source('Lib/publicQuote/landingStoryCopy.ts')

const landingFooterStart = experience.indexOf('data-public-landing-footer')
const successFooterStart = experience.indexOf('data-success-footer')
const landingFooter = experience.slice(landingFooterStart, successFooterStart)
const successFooter = experience.slice(successFooterStart)
const storyBlob = JSON.stringify(PUBLIC_LANDING_STORY)

test('HERO_TITLE_RESTORED_TO_WHITE_RED', () => {
  assert.equal(PUBLIC_LANDING_STORY.pt.hero.title[0].text, 'O melhor do')
  assert.equal(PUBLIC_LANDING_STORY.pt.hero.title[0].highlight, undefined)
  assert.equal(PUBLIC_LANDING_STORY.pt.hero.title[1].text, 'churrasco')
  assert.equal(PUBLIC_LANDING_STORY.pt.hero.title[1].highlight, 'red')
  assert.equal(PUBLIC_LANDING_STORY.pt.hero.title[2].text, 'brasileiro,')
  assert.equal(PUBLIC_LANDING_STORY.pt.hero.title[2].highlight, 'red')
  assert.equal(PUBLIC_LANDING_STORY.pt.hero.title[3].text, 'onde você estiver.')
  assert.equal(PUBLIC_LANDING_STORY.en.hero.title[1].highlight, 'red')
  assert.equal(PUBLIC_LANDING_STORY.en.hero.title[2].text, 'barbecue,')
  assert.equal(PUBLIC_LANDING_STORY.es.hero.title[1].highlight, 'red')
  assert.equal(PUBLIC_LANDING_STORY.es.hero.title[2].text, 'brasileña,')
  assert.match(css, /\.cdl-highlight--red \{[\s\S]*background: #e21b1b/)
  assert.match(css, /\.cdl-highlight--red \{[\s\S]*color: #fff/)
})

test('HERO_BRAZIL_ACCENT_SUBTLE', () => {
  assert.match(landing, /data-landing-brazil-accent/)
  assert.match(landing, /data-landing-hero-kicker/)
  assert.match(css, /\.cdl-brazil-accent/)
  assert.match(css, /#009b3a/)
  assert.match(css, /#ffdf00/)
  assert.match(css, /#002776/)
  assert.match(css, /\.cdl-brazil-accent[\s\S]*width: 0\.78rem/)
})

test('HERO_NO_MULTI_COLOR_WORD_FILL', () => {
  assert.doesNotMatch(storyBlob, /"highlight":"brazil"/)
  assert.doesNotMatch(story, /highlight: 'brazil'/)
  assert.doesNotMatch(css, /\.cdl-highlight--brazil/)
  assert.doesNotMatch(css, /background-clip: text/)
  assert.doesNotMatch(highlight, /data-landing-brazil-identity/)
  assert.doesNotMatch(title, /data-landing-brazil-title/)
})

test('SUCCESS_FIRE_SIGNATURE_REPAIRED', () => {
  assert.equal(SUCCESS_HAS_CDL_FIRE_SIGNATURE, true)
  assert.equal(SUCCESS_FIRE_USES_TREATED_OFFICIAL_MP4, true)
  assert.equal(SUCCESS_DOES_NOT_USE_CDL_MP4, false)
  assert.equal(
    PUBLIC_SUCCESS_CDL_FIRE_MP4_SRC,
    '/cdl/video/CDL_LOGO_FOGO_SEM_BOOK_NOW_SAFE_V7.mp4',
  )
  assert.match(successScreen, /<CdlFireSignature/)
  assert.match(signature, /data-cdl-fire-signature/)
  assert.match(signature, /<video/)
  assert.match(signature, /PUBLIC_SUCCESS_CDL_FIRE_MP4_SRC/)
  assert.match(css, /\.cdl-fire-signature-video/)
  assert.match(css, /mask-image: radial-gradient/)
  assert.ok(existsSync(join(ROOT, 'public/cdl/logo.png')))
  assert.ok(
    existsSync(join(ROOT, 'public/cdl/video/CDL_LOGO_FOGO_SEM_BOOK_NOW_FINAL.mp4')),
  )
  assert.equal(PUBLIC_SUCCESS_CDL_LOGO_SRC, '/cdl/logo.png')
})

test('SUCCESS_FIRE_NO_RED_BLOB', () => {
  assert.equal(SUCCESS_FIRE_NO_RED_BLOB, true)
  assert.doesNotMatch(signature, /cdl-fire-flames/)
  assert.doesNotMatch(signature, /cdl-fire-flame--back/)
  assert.doesNotMatch(css, /\.cdl-fire-flames/)
  assert.doesNotMatch(css, /conic-gradient\([\s\S]*#6a0b0b/)
  assert.match(css, /\.cdl-fire-signature[\s\S]*background: transparent/)
  assert.match(css, /\.cdl-fire-signature-stage[\s\S]*background: transparent/)
})

test('SUCCESS_FIRE_NO_BOOK_NOW', () => {
  assert.equal(SUCCESS_VIDEO_HAS_NO_BOOK_NOW, true)
  assert.match(signature, /data-success-fire-no-book-now="true"/)
  assert.doesNotMatch(signature, /BOOK NOW/)
  assert.doesNotMatch(successScreen, /BOOK NOW/)
  assert.doesNotMatch(signature, /407[^\n]{0,20}915/)
})

test('SUCCESS_FIRE_PREMIUM_QUALITY', () => {
  assert.equal(SUCCESS_FIRE_BACKGROUND_TRANSPARENT, true)
  assert.match(signature, /data-success-fire-treated-mp4="true"/)
  assert.match(css, /-webkit-mask-image: radial-gradient/)
  assert.match(signature, /data-success-cdl-logo/)
  assert.match(signature, /PUBLIC_SUCCESS_CDL_LOGO_SRC/)
})

test('SUCCESS_CONTACTS_BELOW_LOGO', () => {
  const signatureIndex = successScreen.indexOf('<CdlFireSignature')
  const headingIndex = successScreen.indexOf('data-success-contact-heading')
  const contactsIndex = successScreen.indexOf('data-success-contacts')
  const whatsappIndex = successScreen.indexOf('data-success-whatsapp')
  const instagramIndex = successScreen.indexOf('data-success-instagram')
  const restartIndex = successScreen.indexOf('data-success-restart')
  // V6 lifted the signature to the top, contacts still close the screen.
  assert.ok(signatureIndex > -1 && signatureIndex < restartIndex)
  assert.ok(contactsIndex < restartIndex)
  assert.ok(headingIndex > signatureIndex)
  assert.ok(whatsappIndex > headingIndex)
  assert.ok(instagramIndex > whatsappIndex)
})

test('SUCCESS_CONTACT_HEADING_PRESENT', () => {
  assert.equal(PUBLIC_SUCCESS_COPY.pt.contactTeam, 'Contate o nosso time')
  assert.equal(PUBLIC_SUCCESS_COPY.en.contactTeam, 'Contact our team')
  assert.equal(PUBLIC_SUCCESS_COPY.es.contactTeam, 'Contacta a nuestro equipo')
  assert.match(successScreen, /copy\.contactTeam/)
  assert.match(successScreen, /data-success-contact-heading/)
})

test('SUCCESS_WHATSAPP_ICON_AND_VALUE', () => {
  const contacts = resolvePublicCompanyContacts({}, 'cdl')
  assert.equal(contacts.phone, '+14079152242')
  assert.equal(contacts.whatsappUrl, 'https://wa.me/14079152242')
  assert.equal(displayPublicPhone(contacts.phone), '+1 (407) 915-2242')
  assert.match(successScreen, /data-success-whatsapp/)
  assert.match(successScreen, /<WhatsAppIcon/)
  assert.doesNotMatch(successScreen, />WhatsApp</)
})

test('SUCCESS_INSTAGRAM_ICON_AND_VALUE', () => {
  const contacts = resolvePublicCompanyContacts({}, 'cdl')
  assert.equal(contacts.instagramHandle, '@cdl.bbq')
  assert.ok(contacts.instagramUrl?.includes('instagram.com/cdl.bbq'))
  assert.match(successScreen, /data-success-instagram/)
  assert.match(successScreen, /<InstagramIcon/)
})

test('LANDING_HAS_STATIC_CDL_LOGO', () => {
  assert.equal(LANDING_HAS_STATIC_CDL_LOGO, true)
  assert.match(landingFooter, /data-landing-cdl-logo/)
  assert.match(landingFooter, /<img/)
  assert.doesNotMatch(landingFooter, /<video/)
  assert.doesNotMatch(landingFooter, /CdlFireSignature/)
})

test('LANDING_NO_FIRE', () => {
  assert.equal(LANDING_HAS_NO_FIRE_SIGNATURE, true)
  assert.doesNotMatch(landing, /CdlFireSignature/)
  assert.doesNotMatch(landing, /data-cdl-fire-signature/)
  assert.doesNotMatch(landing, /CDL_LOGO_FOGO/)
  assert.doesNotMatch(landingFooter, /cdl-fire/)
  assert.doesNotMatch(experience.slice(0, landingFooterStart), /CdlFireSignature/)
})

test('LANDING_NO_PSCS_ONE', () => {
  assert.equal(LANDING_HAS_NO_PSCS_ONE, true)
  assert.doesNotMatch(landingFooter, /PscsOneMark/)
  assert.doesNotMatch(landing, /PscsOneMark/)
})

test('SUCCESS_HAS_PSCS_ONE', () => {
  assert.equal(SUCCESS_HAS_PSCS_ONE, true)
  assert.match(successFooter, /PscsOneMark/)
})

test('WIZARD_STEPS_LIGHT_UNCHANGED', () => {
  assert.match(
    experience,
    /data-public-wizard-theme=\{wizardActive \? 'light-locked'/,
  )
  assert.match(experience, /data-theme=\{wizardActive \? 'light' : 'dark'\}/)
  assert.match(lock, /wizard-light/)
  assert.match(lock, /data-theme', 'light'/)
  assert.match(css, /\[data-public-wizard-theme="light-locked"\]/)
})

test('SUCCESS_FIRE_REDUCED_MOTION_SAFE', () => {
  assert.equal(SUCCESS_FIRE_REDUCED_MOTION_SAFE, true)
  assert.match(signature, /prefers-reduced-motion: reduce/)
  assert.match(signature, /data-success-fire-reduced-motion/)
  assert.match(signature, /data-success-cdl-logo/)
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/)
})

test('NO_HORIZONTAL_OVERFLOW', () => {
  assert.match(css, /overflow-x: clip/)
  assert.match(css, /overflow-wrap: break-word/)
  assert.doesNotMatch(signature, /width:\s*\d{4}px/)
  assert.match(css, /clamp\(14rem/)
  assert.match(css, /clamp\(18rem/)
})

test('SUCCESS_SIGNATURE_SIZE', () => {
  assert.match(css, /clamp\(14rem, 70vw, 18rem\)/)
  assert.match(css, /clamp\(18rem, 22vw, 19\.5rem\)/)
})

if (failed > 0) {
  console.error(`\n${failed} failed, ${passed} passed`)
  process.exit(1)
}
console.log(`\n${passed} passed`)
