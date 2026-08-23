#!/usr/bin/env node
/**
 * Screenshot matrix for public landing polish + package editorial step.
 *
 *   node scripts/dev/capture-public-landing-polish-matrix.mjs \
 *     --url http://127.0.0.1:3000 --out /opt/cursor/artifacts
 */
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import puppeteer from 'puppeteer-core'

const arg = (name, fallback = '') => {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : fallback
}

const BASE = (arg('--url') || process.env.PUBLIC_LAYOUT_URL || '').replace(/\/$/, '')
const OUT = arg('--out', '/opt/cursor/artifacts')
const CHROME = process.env.CHROME_PATH || '/usr/bin/google-chrome-stable'

if (!BASE) {
  console.error('Need --url')
  process.exit(1)
}

mkdirSync(OUT, { recursive: true })

function localePath(locale) {
  if (BASE.includes('/quote/')) return `${BASE.replace(/\/(pt|en|es)$/, '')}/${locale}`
  return `${BASE}/quote/cdl/${locale}`
}

const CHAPTERS = {
  intro: '01_hero',
  'how-it-works': '02_how_it_works',
  'more-than-catering': '03_more_than_catering',
  'full-setup': '04_structure',
  'live-bbq': '05_live',
  buffet: '06_buffet',
  'since-2017': '07_since_2017',
  'final-cta': '08_final_cta',
}

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    `--user-data-dir=/tmp/chrome-landing-shots-${Date.now()}`,
  ],
})

async function shot(page, name) {
  const dest = join(OUT, `${name}.png`)
  await page.screenshot({ path: dest, fullPage: false })
  console.log(`SHOT  ${dest}`)
}

async function openLanding(page, locale, width, height) {
  await page.setViewport({ width, height, deviceScaleFactor: 2 })
  await page.goto(localePath(locale), { waitUntil: 'networkidle2', timeout: 60_000 })
  await page.waitForSelector('[data-public-landing-story]', { timeout: 30_000 })
  await page.waitForSelector('[data-landing-title-line]', { timeout: 15_000 })
}

async function captureLanding(locale, width, height, prefix, ids) {
  const page = await browser.newPage()
  await openLanding(page, locale, width, height)
  for (const id of ids) {
    await page.evaluate((chapterId) => {
      const chapter = document.querySelector(`[data-landing-chapter="${chapterId}"]`)
      if (!chapter) return
      if (chapterId === 'intro') {
        window.scrollTo(0, 0)
        return
      }
      chapter.scrollIntoView({ block: 'center' })
    }, id)
    await page.waitForFunction(
      (chapterId) => {
        const chapter = document.querySelector(`[data-landing-chapter="${chapterId}"]`)
        const reveal = chapter?.querySelector('[data-landing-reveal]')
        return !reveal || reveal.getAttribute('data-visible') === 'true'
      },
      { timeout: 10_000 },
      id,
    )
    await new Promise((resolve) => setTimeout(resolve, 200))
    const slug = CHAPTERS[id] || id
    await shot(page, `${prefix}_${slug}`)
  }
  await page.close()
}

async function fillLabeledInput(page, labelPart, value) {
  const handle = await page.evaluateHandle((label) => {
    const needle = label.toLowerCase()
    const labels = [...document.querySelectorAll('label')]
    const match = labels.find((node) => node.textContent?.toLowerCase().includes(needle))
    return match?.querySelector('input, textarea') || null
  }, labelPart)
  const element = handle.asElement()
  if (!element) throw new Error(`input not found: ${labelPart}`)
  await element.click({ clickCount: 3 })
  await element.type(value, { delay: 20 })
  await page.evaluate((node) => node.blur(), element)
}

async function clickNext(page) {
  await page.click('[data-testid="wizard-global-next"]')
}

async function jumpToPackages(page) {
  await page.waitForSelector('[data-landing-quick-cta]:not([disabled])', {
    timeout: 15_000,
  })
  await page.click('[data-landing-quick-cta]')
  await page.waitForSelector('[data-public-wizard-theme="light-locked"]', {
    timeout: 45_000,
  })
  const unique = String(Date.now()).slice(-4)
  const locale = await page.evaluate(() => location.pathname.split('/').pop() || 'pt')
  const patched = await page.evaluate(async (draftLocale, phoneTail) => {
    const response = await fetch('/api/public/quote-intake/session', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({
        website: '',
        currentStep: 2,
        draft: {
          locale: draftLocale,
          contact: {
            firstName: 'Philippe',
            lastName: 'Polish',
            phone: `+1407555${phoneTail}`,
          },
          event: {
            eventName: 'Philippe Polish',
            eventDate: '2026-08-30',
            startTime: '18:00',
            endTime: '22:00',
            adultCount: 25,
            address: {
              route: 'Vineland Avenue',
              number: '8500',
              city: 'Orlando',
              region: 'FL',
              postalCode: '32821',
              country: 'US',
              formattedAddress: '8500 Vineland Avenue, Orlando, FL 32821, USA',
              source: 'manual',
            },
          },
        },
      }),
    })
    const body = await response.json().catch(() => null)
    return { ok: response.ok, status: response.status, step: body?.session?.currentStep }
  }, locale, unique)
  if (!patched.ok) throw new Error(`session patch ${patched.status}`)
  await page.reload({ waitUntil: 'networkidle2' })
  await page.waitForSelector('[data-package-experience-intro]', { timeout: 45_000 })
}

async function capturePackages(locale, width, height, prefix) {
  const page = await browser.newPage()
  await openLanding(page, locale, width, height)
  await jumpToPackages(page)
  await new Promise((resolve) => setTimeout(resolve, 400))
  await shot(page, `${prefix}_09_package_intro`)

  const withSides = await page.$('[data-package-group="with_sides"]')
  if (withSides) {
    const open = await page.$eval(
      '[data-package-group="with_sides"]',
      (node) => node.getAttribute('data-package-group-open') === 'true',
    )
    if (!open) await withSides.click()
    await new Promise((resolve) => setTimeout(resolve, 350))
    await shot(page, `${prefix}_10_package_with_sides_open`)
    const card = await page.$('[data-package-sides-group="with_sides"]')
    if (card) {
      await card.click()
      await new Promise((resolve) => setTimeout(resolve, 400))
      await shot(page, `${prefix}_12_package_selected_with_sides`)
      await withSides.click()
      await new Promise((resolve) => setTimeout(resolve, 250))
    }
  }

  const withoutSides = await page.$('[data-package-group="without_sides"]')
  if (withoutSides) {
    await withoutSides.click()
    await new Promise((resolve) => setTimeout(resolve, 350))
    await shot(page, `${prefix}_11_package_without_sides_open`)
  }

  const theme = await page.evaluate(() => ({
    theme: document.documentElement.getAttribute('data-theme') ||
      document.querySelector('[data-public-quote-shell]')?.getAttribute('data-theme'),
    lock: document
      .querySelector('[data-public-quote-shell]')
      ?.getAttribute('data-public-wizard-theme'),
    bg: getComputedStyle(document.querySelector('[data-public-quote-shell]') || document.body)
      .getPropertyValue('--cdl-bg')
      .trim(),
  }))
  console.log(`THEME ${locale} ${width} ${JSON.stringify(theme)}`)
  await page.close()
}

try {
  const pt390 = ['intro', 'how-it-works', 'more-than-catering', 'full-setup', 'live-bbq', 'buffet', 'since-2017', 'final-cta']
  await captureLanding('pt', 390, 844, 'pt390', pt390)
  await captureLanding('pt', 320, 568, 'pt320', ['intro', 'more-than-catering', 'live-bbq', 'since-2017'])
  await captureLanding('en', 390, 844, 'en390', ['intro', 'since-2017'])
  await captureLanding('es', 390, 844, 'es390', ['intro', 'since-2017'])
  await captureLanding('pt', 1440, 900, 'desktop1440', ['intro', 'more-than-catering'])
  await capturePackages('pt', 390, 844, 'pt390')
  await capturePackages('en', 390, 844, 'en390')
  await capturePackages('es', 390, 844, 'es390')
  await capturePackages('pt', 1440, 900, 'desktop1440')
} finally {
  await browser.close()
}
