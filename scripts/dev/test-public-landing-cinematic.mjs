#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  LANDING_FORBIDDEN_COMMERCE_TERMS,
  PUBLIC_LANDING_STORY,
} from '../../Lib/publicQuote/landingStoryCopy.ts'
import {
  pickHowItWorksVideo,
  videoLocaleFromEntityKey,
} from '../../Lib/publicQuote/howItWorksVideos.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const PUBLIC_URLS = {
  pt: 'https://catering-ai-agenda-dev.vercel.app/quote/cdl/pt',
  en: 'https://catering-ai-agenda-dev.vercel.app/quote/cdl/en',
  es: 'https://catering-ai-agenda-dev.vercel.app/quote/cdl/es',
}

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

const experience = read('app/quote/[companySlug]/[locale]/PublicQuoteExperience.tsx')
const cinematic = read('components/quotes/PublicLandingCinematic.tsx')
const css = read('app/globals.css')
const lock = read('components/quotes/usePublicQuoteThemeLock.ts')
const theme = read('components/ThemeProvider.tsx')
const themeScript = read('components/ThemeScript.tsx')
const howItWorks = read('components/quotes/PublicQuoteHowItWorks.tsx')
const loader = read('Lib/media/loadPublishedPublicMedia.ts')

const storyBlob = JSON.stringify(PUBLIC_LANDING_STORY).toLowerCase()

report(
  'PUBLIC_LANDING_STICKY_STORY',
  css.includes('position: sticky') &&
    css.includes('public-cinematic-hero') &&
    css.includes('100svh') &&
    !css.includes('background-attachment: fixed') &&
    cinematic.includes('public-cinematic-hero') &&
    cinematic.includes('data-public-landing-story'),
)

report(
  'PUBLIC_LANDING_SINGLE_HERO_INSTANCE',
  (cinematic.match(/<PublicQuoteHeroMedia/g) || []).length === 1 &&
    !experience.includes('<PublicQuoteHeroMedia'),
)

report(
  'PUBLIC_LANDING_PT_COPY',
  PUBLIC_LANDING_STORY.pt.hero.eyebrow === 'ORÇAMENTO ONLINE' &&
    PUBLIC_LANDING_STORY.pt.finalCta.button === 'COMEÇAR MINHA COTAÇÃO' &&
    PUBLIC_LANDING_STORY.pt.stories.some((item) => item.id === 'more-than-catering') &&
    PUBLIC_LANDING_STORY.pt.howItWorksTitle.some((part) => part.text === 'FUNCIONA'),
)

report(
  'PUBLIC_LANDING_EN_COPY',
  PUBLIC_LANDING_STORY.en.hero.eyebrow === 'ONLINE QUOTE' &&
    PUBLIC_LANDING_STORY.en.finalCta.button === 'START MY QUOTE' &&
    PUBLIC_LANDING_STORY.en.stories.some((item) => item.id === 'live-bbq'),
)

report(
  'PUBLIC_LANDING_ES_COPY',
  PUBLIC_LANDING_STORY.es.hero.eyebrow === 'COTIZACIÓN ONLINE' &&
    PUBLIC_LANDING_STORY.es.finalCta.button === 'COMENZAR MI COTIZACIÓN' &&
    PUBLIC_LANDING_STORY.es.stories.some((item) => item.id === 'since-2017'),
)

report(
  'PUBLIC_WIZARD_ALWAYS_LIGHT',
  lock.includes("data-public-wizard-theme") &&
    lock.includes("light-locked") &&
    experience.includes("data-public-wizard-theme={wizardActive ? 'light-locked'") &&
    css.includes('[data-public-wizard-theme="light-locked"]') &&
    theme.includes("pathname.startsWith('/quote/')") &&
    themeScript.includes("path.indexOf('/quote/') === 0"),
)

report(
  'PUBLIC_WIZARD_REFRESH_STAYS_LIGHT',
  experience.includes('sessionStorage.getItem(activeStorageKey)') &&
    experience.includes('startQuote({ auto: true })') &&
    lock.includes("root.setAttribute('data-theme', 'light')") &&
    themeScript.includes('public-quote-active:') &&
    themeScript.includes("light-locked"),
)

report(
  'PUBLIC_WIZARD_SYSTEM_DARK_STAYS_LIGHT',
  themeScript.includes("path.indexOf('/quote/') === 0") &&
    !lock.includes('prefers-color-scheme') &&
    lock.includes("colorScheme = 'light'"),
)

report(
  'PUBLIC_VIDEO_LOCALE_FALLBACK',
  videoLocaleFromEntityKey('video:pt') === 'pt' &&
    videoLocaleFromEntityKey('en') === 'en' &&
    pickHowItWorksVideo(
      [{ src: '/only-pt.mp4', poster: null, locale: 'pt' }],
      'en',
      'pt',
    )?.src === '/only-pt.mp4' &&
    loader.includes('loadManagedHowItWorksVideos') &&
    howItWorks.includes('data-how-it-works-locales') &&
    howItWorks.includes('preload="none"') &&
    !howItWorks.includes('autoPlay'),
)

report(
  'LANDING_DOES_NOT_SHOW_PAYMENT_DETAILS',
  LANDING_FORBIDDEN_COMMERCE_TERMS.every((term) => !storyBlob.includes(term)) &&
    !cinematic.toLowerCase().includes('zelle') &&
    !experience.toLowerCase().includes('zelle'),
)

const live = process.argv.includes('--live')
if (live) {
  for (const [locale, url] of Object.entries(PUBLIC_URLS)) {
    const response = await fetch(url, { cache: 'no-store', redirect: 'manual' })
    const html = await response.text()
    const story = PUBLIC_LANDING_STORY[locale]
    const ok =
      response.status === 200 &&
      html.includes('data-public-landing-story') &&
      html.includes('data-public-hero-media') &&
      html.includes(story.hero.eyebrow) &&
      html.includes(story.finalCta.button) &&
      !html.toLowerCase().includes('zelle') &&
      (html.match(/data-public-hero-media/g) || []).length === 1
    report(`LIVE_${locale.toUpperCase()}_STORY`, ok, `${response.status} ${url}`)
  }
}

console.log('')
console.log(`Passed: ${passed}`)
console.log(`Failed: ${failed}`)
process.exit(failed === 0 ? 0 : 1)
