#!/usr/bin/env node
/**
 * Runtime layout gates for the public cinematic landing.
 * Static source gates live in test-public-landing-cinematic.mjs.
 *
 *   node scripts/dev/test-public-landing-layout-gate.mjs --url http://127.0.0.1:3000
 */
import puppeteer from 'puppeteer-core'

const BASE =
  process.argv.includes('--url')
    ? process.argv[process.argv.indexOf('--url') + 1]
    : process.env.PUBLIC_LAYOUT_URL || ''

if (!BASE) {
  console.log('SKIP  layout gate needs --url or PUBLIC_LAYOUT_URL')
  process.exit(0)
}

const CHROME =
  process.env.CHROME_PATH ||
  '/usr/bin/google-chrome-stable'

const VIEWPORTS = [
  { name: '320', width: 320, height: 568 },
  { name: '360', width: 360, height: 800 },
  { name: '390', width: 390, height: 844 },
  { name: '430', width: 430, height: 932 },
]

const LOCALES = ['pt', 'en', 'es']
const SCALES = [1, 1.1, 1.25]
const OVERFLOW_TOLERANCE = 1
const BOX_TOLERANCE = 2
const OVERLAP_SLACK = 0.75

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

function localeUrl(locale) {
  const root = BASE.replace(/\/$/, '')
  if (root.includes('/quote/')) {
    return `${root.replace(/\/(pt|en|es)$/, '')}/${locale}`
  }
  return `${root}/quote/cdl/${locale}`
}

async function measure(page) {
  return page.evaluate(
    ({ overflowTolerance, boxTolerance, overlapSlack }) => {
      const issues = []
      const scrollWidth = document.documentElement.scrollWidth
      const innerWidth = window.innerWidth
      if (scrollWidth > innerWidth + overflowTolerance) {
        issues.push(
          `horizontal overflow ${scrollWidth} > ${innerWidth}+${overflowTolerance}`,
        )
      }

      const titles = [...document.querySelectorAll('[data-landing-title]')]
      if (titles.length === 0) issues.push('no landing titles')

      for (const title of titles) {
        const titleBox = title.getBoundingClientRect()
        if (titleBox.height < 8) issues.push('collapsed title height')

        const lines = [...title.querySelectorAll('[data-landing-title-line]')]
        for (let i = 0; i < lines.length; i += 1) {
          const current = lines[i].getBoundingClientRect()
          if (current.height < 8) issues.push('collapsed title line')
          if (i > 0) {
            const previous = lines[i - 1].getBoundingClientRect()
            const overlap = Math.min(previous.bottom, current.bottom) - Math.max(previous.top, current.top)
            if (overlap > overlapSlack) {
              issues.push(
                `title lines overlap by ${overlap.toFixed(2)}px`,
              )
            }
          }
        }

        const highlights = [...title.querySelectorAll('[data-cdl-highlight]')]
        for (const highlight of highlights) {
          const box = highlight.getBoundingClientRect()
          if (box.left < titleBox.left - boxTolerance) {
            issues.push('highlight left of title')
          }
          if (box.right > titleBox.right + boxTolerance) {
            issues.push('highlight right of title')
          }
        }
      }

      const chapters = [...document.querySelectorAll('[data-landing-chapter]')]
      for (const chapter of chapters) {
        const style = getComputedStyle(chapter)
        if (style.scrollSnapAlign && style.scrollSnapAlign !== 'none') {
          issues.push('scroll snap on chapter')
        }
        if (style.height !== 'auto' && Number.parseFloat(style.height) > 0 && style.minHeight === '0px') {
          issues.push('fixed height chapter')
        }
      }

      return { issues, scrollWidth, innerWidth, titleCount: titles.length }
    },
    { overflowTolerance: OVERFLOW_TOLERANCE, boxTolerance: BOX_TOLERANCE, overlapSlack: OVERLAP_SLACK },
  )
}

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    `--user-data-dir=/tmp/chrome-landing-layout-${Date.now()}`,
  ],
})

try {
  for (const locale of LOCALES) {
    for (const viewport of VIEWPORTS) {
      for (const scale of SCALES) {
        if (scale !== 1 && viewport.name !== '390') continue
        const page = await browser.newPage()
        await page.setViewport({
          width: viewport.width,
          height: viewport.height,
          deviceScaleFactor: 1,
        })
        await page.goto(localeUrl(locale), {
          waitUntil: 'networkidle2',
          timeout: 60_000,
        })
        await page.waitForSelector('[data-public-landing-story]', { timeout: 30_000 })
        if (scale !== 1) {
          await page.evaluate((value) => {
            document.documentElement.style.zoom = String(value)
          }, scale)
        }
        await page.evaluate(async () => {
          const chapters = [...document.querySelectorAll('[data-landing-chapter]')]
          for (const chapter of chapters) {
            chapter.scrollIntoView({ block: 'end' })
            await new Promise((resolve) => requestAnimationFrame(resolve))
          }
          window.scrollTo(0, 0)
        })
        const result = await measure(page)
        const label = `${locale.toUpperCase()} ${viewport.name} @${Math.round(scale * 100)}`
        report(
          `LIVE_LAYOUT_${locale.toUpperCase()}_${viewport.name}_${Math.round(scale * 100)}`,
          result.issues.length === 0,
          result.issues.length
            ? result.issues.slice(0, 4).join('; ')
            : `${result.titleCount} titles, ${result.scrollWidth}<=${result.innerWidth}+${OVERFLOW_TOLERANCE}`,
        )
        if (locale === 'pt' && viewport.name === '390' && scale === 1) {
          report('PUBLIC_LANDING_NO_HORIZONTAL_OVERFLOW_LIVE', result.issues.every((item) => !item.includes('overflow')))
          report('PUBLIC_LANDING_NO_TEXT_OVERLAP_LIVE', result.issues.every((item) => !item.includes('overlap')))
          report('PUBLIC_LANDING_HIGHLIGHT_WITHIN_CONTAINER_LIVE', result.issues.every((item) => !item.includes('highlight')))
        }
        await page.close()
        void label
      }
    }
  }
} finally {
  await browser.close()
}

console.log('')
console.log(`Passed: ${passed}`)
console.log(`Failed: ${failed}`)
process.exit(failed === 0 ? 0 : 1)
