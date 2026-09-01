/**
 * Final Confirmation V6 gates: logo first, fixed fire viewport, no payment block,
 * premium contact signature.
 * Run: node --experimental-strip-types scripts/dev/test-public-quote-success-v6.mjs
 */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PUBLIC_SUCCESS_COPY } from '../../Lib/publicQuote/successCopy.ts'
import { resolvePublicCompanyContacts } from '../../Lib/publicQuote/companyContacts.ts'
import {
  PUBLIC_SUCCESS_CDL_FIRE_CANVAS,
  PUBLIC_SUCCESS_CDL_FIRE_MP4_SRC,
  PUBLIC_SUCCESS_CDL_FIRE_SOURCE_MP4_SRC,
  SUCCESS_FIRE_FIXED_VIEWPORT,
  SUCCESS_FIRE_SAFE_AREA_TREATED,
  SUCCESS_HAS_NO_PAYMENT_BLOCK,
  SUCCESS_LOGO_IS_FIRST_VISUAL,
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

const successScreen = source('components/quotes/PublicQuoteSuccessScreen.tsx')
const signature = source('components/quotes/CdlFireSignature.tsx')
const css = source('app/globals.css')
const copySource = source('Lib/publicQuote/successCopy.ts')
const landing = source('components/quotes/PublicLandingCinematic.tsx')
const story = source('Lib/publicQuote/landingStoryCopy.ts')
const experience = source(
  'app/quote/[companySlug]/[locale]/PublicQuoteExperience.tsx',
)
const lock = source('components/quotes/usePublicQuoteThemeLock.ts')

const at = (needle) => successScreen.indexOf(needle)

test('SUCCESS_LOGO_IS_FIRST_VISUAL', () => {
  assert.equal(SUCCESS_LOGO_IS_FIRST_VISUAL, true)
  assert.match(successScreen, /data-success-logo-first="true"/)
  const fire = at('<CdlFireSignature')
  assert.ok(fire > -1, 'fire signature missing')
  for (const marker of [
    'public-success-kicker',
    'public-success-title',
    'data-success-summary',
    'data-success-restart',
    'data-success-contacts',
  ]) {
    assert.ok(at(marker) > fire, `${marker} must render after the fire signature`)
  }
})

test('SUCCESS_ORDER_CONFIRM_SUMMARY_CTA_CONTACTS', () => {
  assert.ok(at('public-success-title') > at('public-success-kicker'))
  assert.ok(at('public-success-body-copy') > at('public-success-title'))
  assert.ok(at('data-success-summary') > at('public-success-body-copy'))
  assert.ok(at('data-success-contact-heading') > at('data-success-summary'))
  assert.ok(at('data-success-restart') > at('data-success-contact-heading'))
  assert.ok(at('data-success-whatsapp') > at('data-success-contact-heading'))
  assert.ok(at('data-success-instagram') > at('data-success-whatsapp'))
})

test('SUCCESS_FIRE_FIXED_VIEWPORT', () => {
  assert.equal(SUCCESS_FIRE_FIXED_VIEWPORT, true)
  assert.match(signature, /data-success-fire-fixed-viewport="true"/)
  assert.match(signature, /data-success-fire-no-scale="true"/)
  const stage = css.match(/\.cdl-fire-signature-stage \{([^}]+)\}/)?.[1]
  assert.ok(stage, 'missing .cdl-fire-signature-stage rule')
  assert.match(stage, /aspect-ratio: 1/)
  assert.match(stage, /transform: none/)
  assert.match(stage, /animation: none/)
  assert.doesNotMatch(stage, /scale\(/)
  const video = css.match(/\.cdl-fire-signature-video \{([^}]+)\}/)?.[1]
  assert.ok(video, 'missing .cdl-fire-signature-video rule')
  assert.match(video, /object-fit: contain/)
  assert.match(video, /transform: none/)
  assert.match(video, /animation: none/)
  assert.doesNotMatch(video, /scale\(/)
  // farthest-corner (the default) would leave the square plate edge unmasked.
  assert.match(video, /mask-image: radial-gradient\(\s*circle closest-side/)
})

test('SUCCESS_FIRE_ZERO_CLIPPING', () => {
  assert.equal(SUCCESS_FIRE_SAFE_AREA_TREATED, true)
  const treated = join(ROOT, 'public', PUBLIC_SUCCESS_CDL_FIRE_MP4_SRC)
  assert.ok(existsSync(treated), 'treated safe-area plate missing')
  assert.ok(
    existsSync(join(ROOT, 'public', PUBLIC_SUCCESS_CDL_FIRE_SOURCE_MP4_SRC)),
    'official source plate must stay in the repo',
  )
  assert.match(PUBLIC_SUCCESS_CDL_FIRE_MP4_SRC, /SEM_BOOK_NOW/)
  const probe = execFileSync(
    'ffprobe',
    [
      '-v', 'error',
      '-select_streams', 'v:0',
      '-show_entries', 'stream=width,height',
      '-of', 'csv=p=0',
      treated,
    ],
    { encoding: 'utf8' },
  ).trim()
  assert.equal(
    probe,
    `${PUBLIC_SUCCESS_CDL_FIRE_CANVAS},${PUBLIC_SUCCESS_CDL_FIRE_CANVAS}`,
    `treated plate must stay a constant square canvas, got ${probe}`,
  )
})

test('SUCCESS_FIRE_NO_LAYOUT_SHIFT', () => {
  const stage = css.match(/\.cdl-fire-signature-stage \{([^}]+)\}/)?.[1]
  assert.match(stage, /width: clamp\(/)
  assert.match(stage, /aspect-ratio: 1/)
  // A square canvas in a square box cannot resize the box between frames.
  assert.equal(PUBLIC_SUCCESS_CDL_FIRE_CANVAS, 610)
  assert.doesNotMatch(css, /@keyframes cdl-fire/)
})

test('SUCCESS_HAS_NO_PAYMENT_BLOCK', () => {
  assert.equal(SUCCESS_HAS_NO_PAYMENT_BLOCK, true)
  assert.doesNotMatch(successScreen, /data-success-zelle/)
  assert.doesNotMatch(successScreen, /public-success-zelle/)
  assert.doesNotMatch(css, /\.public-success-zelle/)
  assert.doesNotMatch(successScreen, /copy\.payment/)
})

test('SUCCESS_HAS_NO_ZELLE_COPY', () => {
  assert.doesNotMatch(successScreen.toLowerCase(), /zelle/)
  assert.doesNotMatch(copySource.toLowerCase(), /zelle/)
  assert.doesNotMatch(experience.toLowerCase(), /zelle/)
  for (const locale of ['pt', 'en', 'es']) {
    const values = Object.values(PUBLIC_SUCCESS_COPY[locale]).join(' ').toLowerCase()
    assert.doesNotMatch(values, /zelle/)
    assert.doesNotMatch(values, /pagamento|payment|pago/)
  }
})

test('SUCCESS_NO_REDUNDANT_TALK_TO_TEAM', () => {
  assert.doesNotMatch(successScreen, /data-success-talk/)
  assert.doesNotMatch(successScreen, /public-success-cta-secondary/)
  assert.doesNotMatch(css, /\.public-success-cta-secondary/)
  assert.doesNotMatch(copySource, /talk:/)
  assert.doesNotMatch(copySource, /Falar com a equipe/)
  assert.doesNotMatch(copySource, /Fale com a equipe/)
})

test('SUCCESS_CONTACT_BLOCK_PREMIUM', () => {
  assert.equal(PUBLIC_SUCCESS_COPY.pt.contactTeam, 'Contate o nosso time')
  assert.equal(PUBLIC_SUCCESS_COPY.en.contactTeam, 'Contact our team')
  assert.equal(PUBLIC_SUCCESS_COPY.es.contactTeam, 'Contacta a nuestro equipo')
  const heading = css.match(/\.public-success-contact-heading \{([^}]+)\}/)?.[1]
  assert.ok(heading, 'missing contact heading rule')
  const headingSize = Number(heading.match(/font-size: ([\d.]+)rem/)?.[1]) * 16
  const headingWeight = Number(heading.match(/font-weight: (\d+)/)?.[1])
  assert.ok(headingSize >= 17 && headingSize <= 19, `heading ${headingSize}px`)
  assert.ok(headingWeight >= 650 && headingWeight <= 750, `weight ${headingWeight}`)
  assert.doesNotMatch(heading, /text-transform: uppercase/)
  const link = css.match(/\.public-success-contacts a \{([^}]+)\}/)?.[1]
  assert.ok(link, 'missing contact link rule')
  const valueSize = Number(link.match(/font-size: ([\d.]+)rem/)?.[1]) * 16
  const valueWeight = Number(link.match(/font-weight: (\d+)/)?.[1])
  assert.ok(valueSize >= 16 && valueSize <= 18, `value ${valueSize}px`)
  assert.ok(valueWeight >= 600 && valueWeight <= 700, `weight ${valueWeight}`)
  assert.match(link, /display: inline-flex/)
  const icon = css.match(/\.public-success-contact-icon \{([^}]+)\}/)?.[1]
  const iconSize = Number(icon.match(/width: ([\d.]+)rem/)?.[1]) * 16
  assert.ok(iconSize >= 21 && iconSize <= 24, `icon ${iconSize}px`)
})

test('SUCCESS_CONTACTS_CENTERED', () => {
  const block = css.match(/\.public-success-contacts \{([^}]+)\}/)?.[1]
  assert.match(block, /text-align: center/)
  assert.match(block, /max-width: 18\.75rem/)
  assert.match(block, /margin: 0 auto/)
  const list = css.match(/\.public-success-contacts ul \{([^}]+)\}/)?.[1]
  assert.match(list, /flex-direction: column/)
  assert.match(list, /align-items: center/)
  assert.doesNotMatch(
    css,
    /\.public-success-contacts ul \{[\s\S]*?flex-direction: row/,
  )
})

test('SUCCESS_WHATSAPP_LINK', () => {
  assert.match(successScreen, /data-success-whatsapp/)
  assert.match(successScreen, /aria-label=\{phoneDisplay/)
  assert.match(successScreen, /<WhatsAppIcon \/>/)
  assert.doesNotMatch(successScreen, />WHATSAPP</)
  const cdl = resolvePublicCompanyContacts({ phone: '+14079152242' }, 'cdl')
  assert.equal(cdl.whatsappUrl, 'https://wa.me/14079152242')
})

test('SUCCESS_INSTAGRAM_LINK', () => {
  assert.match(successScreen, /data-success-instagram/)
  assert.match(successScreen, /aria-label=\{contacts\.instagramHandle/)
  assert.match(successScreen, /<InstagramIcon \/>/)
  assert.doesNotMatch(successScreen, />INSTAGRAM</)
  const cdl = resolvePublicCompanyContacts({ phone: null, whatsappUrl: null }, 'cdl')
  assert.ok(cdl.instagramUrl?.includes('instagram.com'))
  assert.equal(cdl.instagramHandle, '@cdl.bbq')
})

test('LANDING_UNCHANGED', () => {
  assert.doesNotMatch(landing, /CdlFireSignature/)
  assert.doesNotMatch(landing, /CDL_LOGO_FOGO/)
  assert.doesNotMatch(landing, /PscsOneMark/)
  assert.doesNotMatch(landing.toLowerCase(), /zelle/)
  assert.equal(story.includes("highlight: 'brazil'"), false)
  assert.match(css, /\.cdl-brazil-accent/)
  assert.match(landing, /data-landing-brazil-accent/)
  assert.match(css, /\.cdl-highlight--red \{[\s\S]*?background: #e21b1b/)
})

test('WIZARD_LIGHT_UNCHANGED', () => {
  assert.match(experience, /data-theme=\{wizardActive \? 'light' : 'dark'\}/)
  assert.match(
    experience,
    /data-public-wizard-theme=\{wizardActive \? 'light-locked'/,
  )
  assert.match(lock, /wizard-light/)
  assert.match(css, /\[data-public-wizard-theme="light-locked"\]/)
})

test('PRICING_UNCHANGED', () => {
  const baseline = 'bb8432ddcc11094759726adfb7f9646ba15943cc'
  const committed = execFileSync(
    'git',
    ['diff', '--name-only', `${baseline}...HEAD`],
    { cwd: ROOT, encoding: 'utf8' },
  )
  const dirty = execFileSync('git', ['diff', '--name-only', baseline], {
    cwd: ROOT,
    encoding: 'utf8',
  })
  const touched = new Set(
    `${committed}\n${dirty}`.split('\n').map((file) => file.trim()).filter(Boolean),
  )
  const forbidden = [...touched].filter((file) =>
    /^(supabase\/|Lib\/pricing|Lib\/quotePricing|app\/api\/quotes|app\/api\/packages|app\/api\/commercial-rules)/.test(
      file,
    ),
  )
  assert.deepEqual(forbidden, [], `pricing/schema files touched: ${forbidden}`)
})

if (failed > 0) {
  console.error(`\n${failed} failed, ${passed} passed`)
  process.exit(1)
}
console.log(`\n${passed} passed`)
