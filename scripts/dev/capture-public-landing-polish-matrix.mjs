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
      document
        .querySelector(`[data-landing-chapter="${chapterId}"]`)
        ?.scrollIntoView({ block: 'end' })
    }, id)
    await new Promise((resolve) => setTimeout(resolve, 350))
    const slug = CHAPTERS[id] || id
    await shot(page, `${prefix}_${slug}`)
  }
  await page.close()
}

async function jumpToPackages(page) {
  const started = await page.$('[data-landing-start-quote]')
  if (started) {
    await page.click('[data-landing-quick-cta], [data-landing-start-quote]')
  }
  await page.waitForFunction(
    () =>
      document.querySelector('[data-public-wizard-theme="light-locked"]') ||
      document.querySelector('[data-package-experience-intro]'),
    { timeout: 45_000 },
  )
  const already = await page.$('[data-package-experience-intro]')
  if (already) return
  await page.evaluate(async () => {
    const response = await fetch('/api/public/quote-intake/session', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ currentStep: 2, website: '' }),
    })
    if (!response.ok) throw new Error(`session patch ${response.status}`)
  })
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
