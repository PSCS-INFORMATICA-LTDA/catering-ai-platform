/**
 * Public experience V5 gates: web-native CDL fire signature + Brazilian identity.
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
  PUBLIC_SUCCESS_CDL_LOGO_SRC,
  SUCCESS_DOES_NOT_USE_CDL_MP4,
  SUCCESS_FIRE_BACKGROUND_TRANSPARENT,
  SUCCESS_FIRE_REDUCED_MOTION_SAFE,
  SUCCESS_HAS_CDL_FIRE_SIGNATURE,
  SUCCESS_HAS_PSCS_ONE,
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
const media = source('Lib/publicQuote/successHeroMedia.ts')
const story = source('Lib/publicQuote/landingStoryCopy.ts')
const wrapper = source('components/quotes/PublicSuccessFireLogo.tsx')

const landingFooterStart = experience.indexOf('data-public-landing-footer')
const successFooterStart = experience.indexOf('data-success-footer')
const landingFooter = experience.slice(landingFooterStart, successFooterStart)
const successFooter = experience.slice(successFooterStart)
const brazilCss = css.slice(
  css.indexOf('.cdl-highlight--brazil'),
  css.indexOf('.public-landing-reveal'),
)

test('SUCCESS_DOES_NOT_USE_CDL_MP4', () => {
  assert.equal(SUCCESS_DOES_NOT_USE_CDL_MP4, true)
  assert.doesNotMatch(signature, /<video/)
  assert.doesNotMatch(successScreen, /<video/)
  assert.doesNotMatch(signature, /CDL_LOGO_FOGO/)
  assert.doesNotMatch(successScreen, /CDL_LOGO_FOGO/)
  assert.doesNotMatch(signature, /PUBLIC_SUCCESS_CDL_FIRE_MP4_SRC/)
  assert.doesNotMatch(wrapper, /<video/)
  assert.match(signature, /data-success-uses-final-cdl-mp4="false"/)
})

test('SUCCESS_HAS_CDL_FIRE_SIGNATURE', () => {
  assert.equal(SUCCESS_HAS_CDL_FIRE_SIGNATURE, true)
  assert.match(successScreen, /<CdlFireSignature/)
  assert.match(signature, /data-cdl-fire-signature/)
  assert.match(signature, /data-success-cdl-signature/)
  assert.match(signature, /cdl-fire-flames/)
  assert.match(css, /\.cdl-fire-signature/)
  assert.ok(existsSync(join(ROOT, 'public/cdl/logo.png')))
  assert.equal(PUBLIC_SUCCESS_CDL_LOGO_SRC, '/cdl/logo.png')
})

test('SUCCESS_FIRE_BACKGROUND_TRANSPARENT', () => {
  assert.equal(SUCCESS_FIRE_BACKGROUND_TRANSPARENT, true)
  assert.match(signature, /data-success-fire-transparent="true"/)
  assert.match(css, /\.cdl-fire-signature-stage/)
  assert.match(css, /\.cdl-fire-signature[\s\S]*background: transparent/)
  assert.match(css, /\.cdl-fire-signature-mark[\s\S]*background: transparent/)
  assert.doesNotMatch(css, /\.cdl-fire-signature-stage \{[\s\S]{0,180}background: #050505/)
  assert.doesNotMatch(signature, /background:\s*#050505/)
})

test('SUCCESS_FIRE_REDUCED_MOTION_SAFE', () => {
  assert.equal(SUCCESS_FIRE_REDUCED_MOTION_SAFE, true)
  assert.match(signature, /prefers-reduced-motion: reduce/)
  assert.match(signature, /data-success-fire-reduced-motion/)
  assert.match(signature, /data-success-cdl-logo/)
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/)
  assert.match(css, /\.cdl-fire-flames/)
})

test('SUCCESS_CONTACTS_AFTER_SIGNATURE', () => {
  const signatureIndex = successScreen.indexOf('<CdlFireSignature')
  const headingIndex = successScreen.indexOf('data-success-contact-heading')
  const contactsIndex = successScreen.indexOf('data-success-contacts')
  const whatsappIndex = successScreen.indexOf('data-success-whatsapp')
  const instagramIndex = successScreen.indexOf('data-success-instagram')
  const restartIndex = successScreen.indexOf('data-success-restart')
  assert.ok(signatureIndex > restartIndex)
  assert.ok(contactsIndex > signatureIndex)
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
  assert.doesNotMatch(successScreen, />WHATSAPP</)
})

test('SUCCESS_INSTAGRAM_ICON_AND_VALUE', () => {
  const contacts = resolvePublicCompanyContacts({}, 'cdl')
  assert.equal(contacts.instagramHandle, '@cdl.bbq')
  assert.ok(contacts.instagramUrl?.includes('instagram.com/cdl.bbq'))
  assert.match(successScreen, /data-success-instagram/)
  assert.match(successScreen, /<InstagramIcon/)
  assert.doesNotMatch(successScreen, />Instagram</)
  assert.doesNotMatch(successScreen, />INSTAGRAM</)
})

test('LANDING_HAS_STATIC_CDL_LOGO', () => {
  assert.equal(LANDING_HAS_STATIC_CDL_LOGO, true)
  assert.match(landingFooter, /data-landing-cdl-logo/)
  assert.match(landingFooter, /<img/)
  assert.doesNotMatch(landingFooter, /<video/)
  assert.doesNotMatch(landingFooter, /CdlFireSignature/)
})

test('LANDING_HAS_NO_FIRE_SIGNATURE', () => {
  assert.equal(LANDING_HAS_NO_FIRE_SIGNATURE, true)
  assert.doesNotMatch(landing, /CdlFireSignature/)
  assert.doesNotMatch(landing, /data-cdl-fire-signature/)
  assert.doesNotMatch(landing, /cdl-fire-flames/)
  assert.doesNotMatch(landingFooter, /cdl-fire/)
  assert.doesNotMatch(experience.slice(0, landingFooterStart), /CdlFireSignature/)
})

test('LANDING_BRAZILIAN_IDENTITY_PRESENT', () => {
  assert.equal(PUBLIC_LANDING_STORY.pt.hero.title[1].highlight, 'brazil')
  assert.equal(PUBLIC_LANDING_STORY.pt.hero.title[2].highlight, 'brazil')
  assert.equal(PUBLIC_LANDING_STORY.en.hero.title[1].highlight, 'brazil')
  assert.equal(PUBLIC_LANDING_STORY.en.hero.title[2].highlight, 'brazil')
  assert.equal(PUBLIC_LANDING_STORY.es.hero.title[1].highlight, 'brazil')
  assert.equal(PUBLIC_LANDING_STORY.es.hero.title[2].highlight, 'brazil')
  assert.equal(PUBLIC_LANDING_STORY.en.stories[2].title[0].highlight, 'brazil')
  assert.equal(PUBLIC_LANDING_STORY.es.stories[2].title[0].highlight, 'brazil')
  assert.match(highlight, /data-landing-brazil-identity/)
  assert.match(title, /data-landing-brazil-title/)
  assert.match(css, /\.cdl-highlight--brazil/)
  assert.match(brazilCss, /#009b3a|#009c3b/)
  assert.match(brazilCss, /#ffdf00|#f4c400|#f4d35e/)
  assert.match(brazilCss, /#002776|#012169/)
})

test('LANDING_BRAZILIAN_TITLE_LEGIBLE', () => {
  assert.match(brazilCss, /color: #f4d35e/)
  assert.match(brazilCss, /@supports/)
  assert.match(brazilCss, /background-clip: text/)
  assert.doesNotMatch(
    css.slice(css.indexOf('.cdl-highlight--brazil {'), css.indexOf('@supports')),
    /color:\s*transparent/,
  )
  assert.match(title, /data-landing-title/)
  assert.equal(PUBLIC_LANDING_STORY.pt.hero.title[1].text, 'churrasco')
  assert.equal(PUBLIC_LANDING_STORY.en.hero.title[1].text, 'Brazilian')
  assert.equal(PUBLIC_LANDING_STORY.es.hero.title[1].text, 'parrilla')
})

test('WIZARD_STEPS_ALWAYS_LIGHT', () => {
  assert.match(
    experience,
    /data-public-wizard-theme=\{wizardActive \? 'light-locked'/,
  )
  assert.match(experience, /data-theme=\{wizardActive \? 'light' : 'dark'\}/)
  assert.match(lock, /wizard-light/)
  assert.match(lock, /data-theme', 'light'/)
  assert.match(css, /\[data-public-wizard-theme="light-locked"\]/)
})

test('NO_HORIZONTAL_OVERFLOW', () => {
  assert.match(css, /overflow-x: clip/)
  assert.match(css, /overflow-wrap: break-word/)
  assert.doesNotMatch(signature, /width:\s*\d{4}px/)
  assert.match(css, /clamp\(11\.25rem/)
  assert.match(css, /clamp\(13\.75rem/)
})

test('LANDING_HAS_NO_PSCS_ONE', () => {
  assert.equal(LANDING_HAS_NO_PSCS_ONE, true)
  assert.doesNotMatch(landingFooter, /PscsOneMark/)
  assert.doesNotMatch(landing, /PscsOneMark/)
})

test('SUCCESS_HAS_PSCS_ONE', () => {
  assert.equal(SUCCESS_HAS_PSCS_ONE, true)
  assert.match(successFooter, /PscsOneMark/)
})

test('SUCCESS_SIGNATURE_SIZE', () => {
  assert.match(css, /clamp\(11\.25rem, 58vw, 15rem\)/)
  assert.match(css, /clamp\(13\.75rem, 22vw, 17\.5rem\)/)
  assert.doesNotMatch(css, /min\(17\.5rem, 72vw, 300px\)/)
})

test('HISTORICAL_MP4_NOT_WIRED', () => {
  assert.match(media, /Historical archive only/)
  assert.doesNotMatch(signature, /resolvePublicSuccessCdlFireVideoSrc/)
  assert.doesNotMatch(successScreen, /cdl-como-funciona/)
})

if (failed > 0) {
  console.error(`\n${failed} failed, ${passed} passed`)
  process.exit(1)
}
console.log(`\n${passed} passed`)
