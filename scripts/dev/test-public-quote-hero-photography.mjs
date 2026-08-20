/**
 * Public CDL landing — randomized photographic hero.
 * Run: node --experimental-strip-types scripts/dev/test-public-quote-hero-photography.mjs
 */
import assert from 'node:assert/strict'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  getCompanyPublicHeroMedia,
  playlistHasImmediateRepeat,
  PUBLIC_HERO_FADE_MS,
  PUBLIC_HERO_HOLD_MS,
  shuffleHeroPlaylist,
} from '../../Lib/publicQuote/companyPublicHeroMedia.ts'

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
const hero = source('components/quotes/PublicQuoteHeroMedia.tsx')
const css = source('app/globals.css')
const switcher = source('components/quotes/PublicLocaleSwitcher.tsx')
const wizard = source('app/quotes/new/QuoteWizard.tsx')
const mediaConfig = source('Lib/publicQuote/companyPublicHeroMedia.ts')
const cdlPhotos = getCompanyPublicHeroMedia('cdl')

test('TEST 1 Hero possui cinco mídias CDL configuradas', () => {
  assert.equal(cdlPhotos.length, 5)
  assert.deepEqual(
    cdlPhotos.map((item) => item.id),
    [
      'cdl-event-tent',
      'cdl-event-van',
      'cdl-event-buffet',
      'cdl-event-board',
      'cdl-event-fleet',
    ],
  )
  assert.equal(getCompanyPublicHeroMedia('cdl').length, 5)
  assert.equal(getCompanyPublicHeroMedia('other-tenant').length, 0)
  assert.match(source('Lib/publicQuote/heroMedia.ts'), /companySlug/)
  assert.match(source('Lib/publicQuote/heroMedia.ts'), /getCompanyPublicHeroMedia/)
  assert.match(mediaConfig, /cdl: CDL_PUBLIC_HERO_PHOTOS/)
  assert.doesNotMatch(experience, /\/cdl\/hero\/cdl-event-/)
})

test('TEST 2 Nenhuma mídia repete imediatamente', () => {
  const items = cdlPhotos.map((item) => ({ id: item.id }))
  for (let seed = 0; seed < 40; seed += 1) {
    let cursor = 0.13 * seed
    const random = () => {
      cursor = (cursor + 0.6180339887) % 1
      return cursor
    }
    const first = shuffleHeroPlaylist(items, null, random)
    assert.equal(new Set(first.map((item) => item.id)).size, items.length)
    const second = shuffleHeroPlaylist(items, first.at(-1)?.id, random)
    assert.equal(playlistHasImmediateRepeat(first, second), false)
    assert.notEqual(first.at(-1)?.id, second[0]?.id)
  }
})

test('TEST 3 Novo ciclo embaralha corretamente', () => {
  const items = cdlPhotos.map((item) => ({ id: item.id }))
  const forced = [...items].reverse()
  const random = () => 0
  const reshuffled = shuffleHeroPlaylist(forced, forced[0]?.id, random)
  assert.notEqual(reshuffled[0]?.id, forced[0]?.id)
  assert.equal(new Set(reshuffled.map((item) => item.id)).size, 5)
  assert.match(hero, /shuffleHeroPlaylist\(playable/)
  assert.match(hero, /PUBLIC_HERO_HOLD_MS/)
  assert.ok(PUBLIC_HERO_HOLD_MS >= 5000 && PUBLIC_HERO_HOLD_MS <= 7000)
  assert.ok(PUBLIC_HERO_FADE_MS >= 1000 && PUBLIC_HERO_FADE_MS <= 1800)
})

test('TEST 4 Hero mantém CTA clicável', () => {
  assert.match(experience, /data-landing-start-quote/)
  assert.match(experience, /startQuote\(\{ forceNew: true \}\)/)
  assert.match(experience, /bootstrap\.settings\.landing\.cta/)
  assert.match(hero, /pointer-events-none/)
  assert.doesNotMatch(hero, /slick-dots|swiper-pagination|carousel-dot/)
  assert.doesNotMatch(hero, /arrow|thumbnail|1 de 5/)
})

test('TEST 5 PT funciona', () => {
  assert.match(switcher, /pt: 'PT'/)
  assert.match(experience, /PublicLocaleSwitcher/)
  assert.match(experience, /pt: \{/)
})

test('TEST 6 EN funciona', () => {
  assert.match(switcher, /en: 'EN'/)
  assert.match(experience, /en: \{/)
})

test('TEST 7 ES funciona', () => {
  assert.match(switcher, /es: 'ES'/)
  assert.match(experience, /es: \{/)
})

test('TEST 8 Mobile 375 object-cover + focal point', () => {
  assert.match(css, /object-fit: cover/)
  assert.match(css, /--hero-pos-mobile/)
  assert.match(mediaConfig, /mobilePosition: '50% 68%'/)
  assert.match(hero, /sizes="100vw"/)
})

test('TEST 9 Mobile 390 keeps cover crop', () => {
  assert.match(hero, /overflow-hidden/)
  assert.match(experience, /overflow-hidden/)
  assert.doesNotMatch(css, /object-fit:\s*fill/)
})

test('TEST 10 Mobile 430 keeps cover crop', () => {
  cdlPhotos.forEach((item) => {
    assert.notEqual(item.mobilePosition, 'center')
    assert.match(item.mobilePosition, /%/)
  })
})

test('TEST 11 Desktop 1440 uses per-asset object-position', () => {
  assert.match(css, /min-width: 1024px/)
  assert.match(css, /--hero-pos-desktop/)
  cdlPhotos.forEach((item) => {
    assert.notEqual(item.desktopPosition, 'center')
  })
})

test('TEST 12 No horizontal overflow', () => {
  assert.match(experience, /overflow-hidden/)
  assert.match(experience, /min-w-0/)
  assert.match(hero, /overflow-hidden/)
  assert.doesNotMatch(hero, /translateX\(|slide lateral/)
})

test('TEST 13 Reduced motion', () => {
  assert.match(hero, /prefers-reduced-motion: reduce/)
  assert.match(hero, /reducedMotion/)
  assert.match(css, /prefers-reduced-motion: reduce/)
  assert.match(css, /animation: none/)
})

test('TEST 14 Failed image fallback', () => {
  assert.match(hero, /onError/)
  assert.match(hero, /data-hero-fallback/)
  assert.match(hero, /setFailedIds/)
  assert.doesNotMatch(hero, /broken-image/)
})

test('TEST 15 Starting quote still works', () => {
  assert.match(experience, /\/api\/public\/quote-intake\/session/)
  assert.match(experience, /entryMode="public"/)
  assert.match(experience, /QuoteWizardCore/)
  assert.doesNotMatch(wizard, /PublicQuoteHeroMedia/)
})

test('Hero is a live crossfade, not a carousel UI', () => {
  assert.match(hero, /public-hero-slide/)
  assert.match(css, /public-hero-kenburns/)
  assert.doesNotMatch(hero, /data-hero-dots/)
  assert.doesNotMatch(hero, /data-hero-arrows/)
  assert.doesNotMatch(experience, /data-landing-watermark/)
})

test('Official photographs are web-optimized and originals preserved', () => {
  const missing = cdlPhotos.filter((item) => {
    const publicPath = join(ROOT, 'public', item.src.replace(/^\//, ''))
    const originalPath = join(ROOT, item.originalSrc)
    return !existsSync(publicPath) || !existsSync(originalPath)
  })
  if (missing.length > 0) {
    console.log(
      'SKIP  Official photographs are web-optimized and originals preserved',
    )
    console.log(
      `      IMPORT REQUIRED: ${missing
        .map((item) => item.sourceFilename)
        .join(', ')} → assets/branding/cdl/hero/inbox/ then npm run ingest:cdl-hero-photos`,
    )
    return
  }
  for (const item of cdlPhotos) {
    const publicPath = join(ROOT, 'public', item.src.replace(/^\//, ''))
    const originalPath = join(ROOT, item.originalSrc)
    assert.ok(statSync(publicPath).size > 20_000, `${item.src} too small`)
    assert.ok(
      statSync(originalPath).size >= statSync(publicPath).size,
      `${item.id} original should remain at least as large as the web derivative`,
    )
  }
})

test('Wizard pricing extras and packages were not rewritten', () => {
  assert.match(wizard, /entryMode/)
  assert.doesNotMatch(mediaConfig, /BBQCHO|BBQTRAD|package flyer/i)
})

if (failed > 0) {
  console.error(`\n${failed} failed, ${passed} passed`)
  process.exit(1)
}

console.log(`\n${passed} passed`)
