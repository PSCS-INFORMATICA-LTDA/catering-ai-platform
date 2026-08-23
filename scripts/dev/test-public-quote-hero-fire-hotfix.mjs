/**
 * Visual hotfix gates: white+red hero title + treated official fire MP4.
 * Run: node --experimental-strip-types scripts/dev/test-public-quote-hero-fire-hotfix.mjs
 */
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PUBLIC_LANDING_STORY } from '../../Lib/publicQuote/landingStoryCopy.ts'
import {
  SUCCESS_FIRE_NO_RED_BLOB,
  SUCCESS_FIRE_USES_TREATED_OFFICIAL_MP4,
  SUCCESS_HAS_PSCS_ONE,
  SUCCESS_VIDEO_HAS_NO_BOOK_NOW,
  LANDING_HAS_NO_FIRE_SIGNATURE,
  LANDING_HAS_NO_PSCS_ONE,
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

const landing = source('components/quotes/PublicLandingCinematic.tsx')
const signature = source('components/quotes/CdlFireSignature.tsx')
const successScreen = source('components/quotes/PublicQuoteSuccessScreen.tsx')
const css = source('app/globals.css')
const experience = source(
  'app/quote/[companySlug]/[locale]/PublicQuoteExperience.tsx',
)
const lock = source('components/quotes/usePublicQuoteThemeLock.ts')
const story = source('Lib/publicQuote/landingStoryCopy.ts')
const landingFooter = experience.slice(
  experience.indexOf('data-public-landing-footer'),
  experience.indexOf('data-success-footer'),
)
const successFooter = experience.slice(experience.indexOf('data-success-footer'))

test('HERO_TITLE_RESTORED_TO_WHITE_RED', () => {
  assert.equal(PUBLIC_LANDING_STORY.pt.hero.title[1].highlight, 'red')
  assert.equal(PUBLIC_LANDING_STORY.pt.hero.title[2].text, 'brasileiro,')
  assert.equal(PUBLIC_LANDING_STORY.pt.hero.title[2].highlight, 'red')
})

test('HERO_BRAZIL_ACCENT_SUBTLE', () => {
  assert.match(landing, /data-landing-brazil-accent/)
  assert.match(css, /\.cdl-brazil-accent/)
})

test('HERO_NO_MULTI_COLOR_WORD_FILL', () => {
  assert.doesNotMatch(story, /highlight: 'brazil'/)
  assert.doesNotMatch(css, /\.cdl-highlight--brazil/)
})

test('SUCCESS_FIRE_SIGNATURE_REPAIRED', () => {
  assert.equal(SUCCESS_FIRE_USES_TREATED_OFFICIAL_MP4, true)
  assert.match(signature, /<video/)
  assert.match(signature, /CDL_LOGO_FOGO_SEM_BOOK_NOW_FINAL|PUBLIC_SUCCESS_CDL_FIRE_MP4_SRC/)
})

test('SUCCESS_FIRE_NO_RED_BLOB', () => {
  assert.equal(SUCCESS_FIRE_NO_RED_BLOB, true)
  assert.doesNotMatch(signature, /cdl-fire-flames/)
  assert.doesNotMatch(css, /\.cdl-fire-flames/)
})

test('SUCCESS_FIRE_NO_BOOK_NOW', () => {
  assert.equal(SUCCESS_VIDEO_HAS_NO_BOOK_NOW, true)
  assert.doesNotMatch(signature, /BOOK NOW/)
  assert.doesNotMatch(successScreen, /BOOK NOW/)
})

test('SUCCESS_FIRE_PREMIUM_QUALITY', () => {
  assert.match(css, /mask-image: radial-gradient/)
  assert.match(css, /\.cdl-fire-signature-video/)
  assert.ok(existsSync(join(ROOT, 'public/cdl/video/CDL_LOGO_FOGO_SEM_BOOK_NOW_FINAL.mp4')))
})

test('SUCCESS_CONTACTS_BELOW_LOGO', () => {
  const logo = successScreen.indexOf('<CdlFireSignature')
  const heading = successScreen.indexOf('data-success-contact-heading')
  assert.ok(heading > logo)
})

test('LANDING_NO_FIRE', () => {
  assert.equal(LANDING_HAS_NO_FIRE_SIGNATURE, true)
  assert.doesNotMatch(landing, /CdlFireSignature/)
  assert.doesNotMatch(landing, /CDL_LOGO_FOGO/)
})

test('LANDING_NO_PSCS_ONE', () => {
  assert.equal(LANDING_HAS_NO_PSCS_ONE, true)
  assert.doesNotMatch(landingFooter, /PscsOneMark/)
})

test('SUCCESS_HAS_PSCS_ONE', () => {
  assert.equal(SUCCESS_HAS_PSCS_ONE, true)
  assert.match(successFooter, /PscsOneMark/)
})

test('WIZARD_STEPS_LIGHT_UNCHANGED', () => {
  assert.match(experience, /data-theme=\{wizardActive \? 'light' : 'dark'\}/)
  assert.match(lock, /wizard-light/)
})

if (failed > 0) {
  console.error(`\n${failed} failed, ${passed} passed`)
  process.exit(1)
}
console.log(`\n${passed} passed`)
