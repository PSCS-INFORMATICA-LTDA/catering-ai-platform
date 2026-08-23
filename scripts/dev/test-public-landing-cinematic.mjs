#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  groupLandingTitleLines,
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

const displayCss = css.slice(
  css.indexOf('.public-cinematic-display {'),
  css.indexOf('.public-cinematic-editorial,'),
)
const storyTitleCss = css.slice(
  css.indexOf('.public-cinematic-editorial,'),
  css.indexOf('.public-landing-title-line'),
)
const highlightCss = css.slice(
  css.indexOf('.cdl-highlight {'),
  css.indexOf('.cdl-highlight--red'),
)
const chapterCss = css.slice(
  css.indexOf('.public-cinematic-chapter {'),
  css.indexOf('.public-cinematic-chapter--intro'),
)
const heroLines = groupLandingTitleLines(PUBLIC_LANDING_STORY.pt.hero.title)
const titleSource = read('components/quotes/PublicLandingTitle.tsx')

report(
  'PUBLIC_LANDING_NO_TEXT_OVERLAP',
  /line-height:\s*1\.0[4-8]/.test(displayCss) &&
    /line-height:\s*1\.0[4-8]/.test(storyTitleCss) &&
    !/line-height:\s*0\.94/.test(displayCss) &&
    !highlightCss.includes('margin:') &&
    !highlightCss.includes('position: absolute') &&
    !highlightCss.includes('transform:') &&
    css.includes('public-landing-title-line') &&
    css.includes('padding-block: 0.12em') &&
    titleSource.includes('groupLandingTitleLines') &&
    titleSource.includes('data-landing-title-line'),
)

report(
  'PUBLIC_LANDING_NO_HORIZONTAL_OVERFLOW',
  css.includes('overflow-x: clip') &&
    css.includes('overflow-wrap: break-word') &&
    cinematic.includes('public-cinematic') &&
    !cinematic.includes('scroll-snap'),
)

report(
  'PUBLIC_LANDING_HIGHLIGHT_WITHIN_CONTAINER',
  highlightCss.includes('box-decoration-break: clone') &&
    highlightCss.includes('padding: 0.04em 0.16em') &&
    titleSource.includes('data-landing-title-line') &&
    heroLines.length === 4,
)

report(
  'PUBLIC_LANDING_COMPACT_STORY_RHYTHM',
  chapterCss.includes('min-height: 66svh') &&
    !chapterCss.includes('min-height: 78svh') &&
    !chapterCss.includes('scroll-snap') &&
    !/^\s*height:/.test(chapterCss) &&
    css.includes('public-cinematic-chapter--editorial'),
)

report(
  'PUBLIC_LANDING_PT_MOBILE_LAYOUT',
  PUBLIC_LANDING_STORY.pt.hero.title[0].breakAfter === true &&
    PUBLIC_LANDING_STORY.pt.hero.title[1].text.toLowerCase().includes('churrasco') &&
    PUBLIC_LANDING_STORY.pt.stories[0].title[0].breakAfter === true,
)

report(
  'PUBLIC_LANDING_EN_MOBILE_LAYOUT',
  PUBLIC_LANDING_STORY.en.hero.title[0].text === 'The best of' &&
    PUBLIC_LANDING_STORY.en.hero.title[0].breakAfter === true &&
    PUBLIC_LANDING_STORY.en.stories[0].title[1].text.includes('CATERING'),
)

report(
  'PUBLIC_LANDING_ES_MOBILE_LAYOUT',
  PUBLIC_LANDING_STORY.es.hero.title[0].text === 'Lo mejor de la' &&
    PUBLIC_LANDING_STORY.es.hero.title[0].breakAfter === true &&
    PUBLIC_LANDING_STORY.es.stories[2].title[1].highlight === 'red',
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
