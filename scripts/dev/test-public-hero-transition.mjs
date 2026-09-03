#!/usr/bin/env node
/**
 * Public hero slideshow timing and transition — source + live DEV.
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  PUBLIC_HERO_FADE_MS,
  PUBLIC_HERO_HOLD_MS,
  PUBLIC_HERO_KENBURNS_MS,
  PUBLIC_HERO_REDUCED_FADE_MS,
} from '../../Lib/publicQuote/companyPublicHeroMedia.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const PUBLIC_URLS = [
  'https://catering-ai-agenda-dev.vercel.app/quote/cdl/pt',
  'https://catering-ai-agenda-dev.vercel.app/quote/cdl/en',
  'https://catering-ai-agenda-dev.vercel.app/quote/cdl/es',
]

function read(rel) {
  return existsSync(join(ROOT, rel)) ? readFileSync(join(ROOT, rel), 'utf8') : ''
}

let passed = 0
let failed = 0

function report(name, ok, detail = '') {
  if (ok) {
    passed += 1
    console.log(`PASS  ${name}${detail ? ` — ${detail}` : ''}`)
  } else {
    failed += 1
    console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

const hero = read('components/quotes/PublicQuoteHeroMedia.tsx')
const css = read('app/globals.css')
const heroCssStart = css.indexOf('.public-hero-slide {')
const heroCssEnd = css.indexOf('.public-success {')
const heroCss = heroCssStart >= 0 ? css.slice(heroCssStart, heroCssEnd > heroCssStart ? heroCssEnd : undefined) : ''
const reducedCss = css.slice(css.lastIndexOf('@media (prefers-reduced-motion: reduce)'))
const constants = read('Lib/publicQuote/companyPublicHeroMedia.ts')

report(
  'HERO_HOLD_IS_COMMERCIAL',
  PUBLIC_HERO_HOLD_MS >= 3800 && PUBLIC_HERO_HOLD_MS <= 4500,
  `${PUBLIC_HERO_HOLD_MS}ms`,
)
report(
  'HERO_FADE_IS_SOFT',
  PUBLIC_HERO_FADE_MS >= 700 && PUBLIC_HERO_FADE_MS <= 900,
  `${PUBLIC_HERO_FADE_MS}ms`,
)
report(
  'HERO_KENBURNS_MATCHES_HOLD',
  PUBLIC_HERO_KENBURNS_MS >= PUBLIC_HERO_HOLD_MS &&
    PUBLIC_HERO_KENBURNS_MS <= PUBLIC_HERO_HOLD_MS + PUBLIC_HERO_FADE_MS + 200,
  `${PUBLIC_HERO_KENBURNS_MS}ms`,
)
report(
  'HERO_REDUCED_FADE_IS_MINIMAL',
  PUBLIC_HERO_REDUCED_FADE_MS >= 250 && PUBLIC_HERO_REDUCED_FADE_MS <= 400,
  `${PUBLIC_HERO_REDUCED_FADE_MS}ms`,
)
report(
  'HERO_TRANSITION_IS_CROSSFADE',
  hero.includes('data-hero-transition="crossfade"') &&
    hero.includes('is-leaving') &&
    hero.includes('is-boot') &&
    heroCss.includes('cubic-bezier(0.33, 0, 0.2, 1)') &&
    heroCss.includes('.public-hero-slide.is-leaving') &&
    /is-leaving \{[\s\S]*opacity: 1/.test(heroCss) &&
    !hero.includes('rotate(') &&
    !heroCss.includes('rotateY') &&
    !heroCss.includes('cube'),
)
report(
  'HERO_KENBURNS_IS_DISCREET',
  heroCss.includes('scale(1.02)') &&
    heroCss.includes('.public-hero-slide .public-hero-photo') &&
    !heroCss.includes('scale(1.03)') &&
    !heroCss.includes('7.2s'),
)
report(
  'HERO_USES_COMPOSITOR_PROPS',
  heroCss.includes('transition-property: opacity') &&
    heroCss.includes('backface-visibility: hidden') &&
    heroCss.includes('contain: paint') &&
    !heroCss.includes('translateX(') &&
    hero.includes('PUBLIC_HERO_HOLD_MS'),
)
report(
  'REDUCED_MOTION_KEEPS_HERO',
  hero.includes('PUBLIC_HERO_REDUCED_FADE_MS') &&
    !/if \(activeVideo \|\| reducedMotion/.test(hero) &&
    reducedCss.includes('prefers-reduced-motion: reduce') &&
    reducedCss.includes('.public-hero-slide .public-hero-photo') &&
    reducedCss.includes('animation: none'),
)
report(
  'NO_LAYOUT_OR_MEDIA_MUTATION',
  !constants.includes('display_order') &&
    !hero.includes('editor_meta') &&
    !hero.includes('from(\'media_assets\')'),
)

const live = process.argv.includes('--live')
if (live) {
  const details = []
  let htmlOk = true
  for (const url of PUBLIC_URLS) {
    const response = await fetch(url, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-store' },
      redirect: 'manual',
    })
    const html = await response.text()
    const hold = Number((html.match(/data-hero-hold-ms="(\d+)"/) || [])[1] || 0)
    const fade = Number((html.match(/data-hero-fade-ms="(\d+)"/) || [])[1] || 0)
    const ok =
      response.status === 200 &&
      html.includes('data-hero-transition="crossfade"') &&
      html.includes('data-public-hero-media') &&
      hold === PUBLIC_HERO_HOLD_MS &&
      fade === PUBLIC_HERO_FADE_MS
    htmlOk = htmlOk && ok
    details.push(`${url.split('/').slice(-2).join('/')} status=${response.status} hold=${hold} fade=${fade}`)
  }
  report('LIVE_PUBLIC_HERO_TIMING', htmlOk, details.join(' | '))
}

console.log('')
console.log(`Passed: ${passed}`)
console.log(`Failed: ${failed}`)
process.exit(failed === 0 ? 0 : 1)
