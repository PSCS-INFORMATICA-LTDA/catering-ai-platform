/**
 * Screenshot matrix for public experience V5 — fire signature + Brazilian identity.
 *
 *   node scripts/dev/capture-public-quote-brand-polish-v5.mjs \
 *     --url http://127.0.0.1:3016 --out /opt/cursor/artifacts
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

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    `--user-data-dir=/tmp/chrome-v5-shots-${Date.now()}`,
  ],
})

async function shot(page, name) {
  const dest = join(OUT, `${name}.png`)
  await page.screenshot({ path: dest, fullPage: false })
  console.log(`SHOT  ${dest}`)
}

async function overflow(page, label) {
  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }))
  const ok = metrics.scrollWidth <= metrics.innerWidth + 2
  console.log(
    `${ok ? 'PASS' : 'FAIL'} OVERFLOW_${label} ${metrics.scrollWidth}<=${metrics.innerWidth}+2`,
  )
  return ok
}

async function openLanding(page, locale, width, height) {
  await page.setViewport({ width, height, deviceScaleFactor: 2 })
  await page.goto(localePath(locale), { waitUntil: 'networkidle2', timeout: 60_000 })
  await page.waitForSelector('[data-public-landing-story]', { timeout: 30_000 })
}

async function injectSuccess(page) {
  await page.evaluate(() => {
    const payload = {
      quote: {
        id: '00000000-0000-4000-8000-000000000075',
        number: 'Q-2026-000075',
        eventName: 'Philippe V5',
        eventDate: '2026-08-30',
        total: 1875,
        currency: 'USD',
      },
    }
    sessionStorage.setItem('public-quote-success:cdl', JSON.stringify(payload))
    sessionStorage.removeItem('public-quote-active:cdl')
    window.dispatchEvent(new Event('public-quote-success-change'))
  })
  await page.reload({ waitUntil: 'networkidle2' })
  await page.waitForSelector('[data-public-success]', { timeout: 20_000 })
}

async function assertNoVideo(page) {
  const video = await page.$('video[src*="CDL_LOGO_FOGO"], [data-success-uses-final-cdl-mp4="true"]')
  if (video) throw new Error('Success still uses the archived CDL MP4')
  await page.waitForSelector('[data-cdl-fire-signature]', { timeout: 10_000 })
}

let overflowFailed = 0

try {
  const landing = await browser.newPage()
  await openLanding(landing, 'pt', 390, 844)
  if (!(await overflow(landing, 'LANDING_390'))) overflowFailed += 1
  await landing.evaluate(() => window.scrollTo(0, 0))
  await new Promise((r) => setTimeout(r, 400))
  await shot(landing, '01_landing_hero_brazilian_390')
  await landing.close()

  const chapter = await browser.newPage()
  await openLanding(chapter, 'en', 390, 844)
  await chapter.evaluate(() => {
    document
      .querySelector('[data-landing-chapter="live-bbq"]')
      ?.scrollIntoView({ block: 'center' })
  })
  await new Promise((r) => setTimeout(r, 400))
  await shot(chapter, '02_landing_brazilian_chapter_390')
  await chapter.close()

  const footer = await browser.newPage()
  await openLanding(footer, 'pt', 390, 844)
  await footer.evaluate(() => {
    document.querySelector('[data-public-landing-footer]')?.scrollIntoView({ block: 'end' })
  })
  await new Promise((r) => setTimeout(r, 300))
  await shot(footer, '03_landing_footer_static_cdl_390')
  await footer.close()

  const success = await browser.newPage()
  await openLanding(success, 'pt', 390, 844)
  await injectSuccess(success)
  await assertNoVideo(success)
  if (!(await overflow(success, 'SUCCESS_390'))) overflowFailed += 1
  await success.evaluate(() => window.scrollTo(0, 0))
  await new Promise((r) => setTimeout(r, 250))
  await shot(success, '04_success_top_390')
  await success.evaluate(() => {
    document.querySelector('[data-success-zelle]')?.scrollIntoView({ block: 'center' })
  })
  await shot(success, '05_success_zelle_390')
  await success.evaluate(() => {
    document.querySelector('[data-cdl-fire-signature]')?.scrollIntoView({ block: 'center' })
  })
  await new Promise((r) => setTimeout(r, 80))
  await shot(success, '06_success_fire_signature_390')
  await new Promise((r) => setTimeout(r, 900))
  await shot(success, '06b_success_fire_signature_t1_390')
  await new Promise((r) => setTimeout(r, 1100))
  await shot(success, '06c_success_fire_signature_t2_390')
  await success.evaluate(() => {
    document.querySelector('[data-success-contacts]')?.scrollIntoView({ block: 'center' })
  })
  await shot(success, '07_success_contacts_390')
  await success.evaluate(() => {
    document.querySelector('[data-success-footer], [data-powered-by]')?.scrollIntoView({
      block: 'end',
    })
  })
  await shot(success, '08_success_footer_pscs_390')
  await success.close()

  const reduced = await browser.newPage()
  await reduced.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }])
  await openLanding(reduced, 'pt', 390, 844)
  await injectSuccess(reduced)
  await reduced.waitForSelector('[data-success-fire-reduced-motion="true"]', { timeout: 10_000 })
  await reduced.evaluate(() => {
    document.querySelector('[data-cdl-fire-signature]')?.scrollIntoView({ block: 'center' })
  })
  await new Promise((r) => setTimeout(r, 250))
  await shot(reduced, '09_success_reduced_motion_390')
  await reduced.close()

  const landingDesktop = await browser.newPage()
  await openLanding(landingDesktop, 'pt', 1440, 900)
  if (!(await overflow(landingDesktop, 'LANDING_DESKTOP_1440'))) overflowFailed += 1
  await landingDesktop.evaluate(() => window.scrollTo(0, 0))
  await shot(landingDesktop, '10_landing_desktop')
  await landingDesktop.close()

  const desktop = await browser.newPage()
  await openLanding(desktop, 'pt', 1440, 900)
  await injectSuccess(desktop)
  await assertNoVideo(desktop)
  if (!(await overflow(desktop, 'SUCCESS_DESKTOP_1440'))) overflowFailed += 1
  await desktop.evaluate(() => {
    document.querySelector('[data-cdl-fire-signature]')?.scrollIntoView({ block: 'center' })
  })
  await new Promise((r) => setTimeout(r, 400))
  await shot(desktop, '11_success_desktop')
  await desktop.close()

  const widths = [320, 360, 375, 390, 393, 414, 430]
  for (const width of widths) {
    const page = await browser.newPage()
    await openLanding(page, 'pt', width, width <= 360 ? 568 : 844)
    if (!(await overflow(page, `LANDING_${width}`))) overflowFailed += 1
    await injectSuccess(page)
    if (!(await overflow(page, `SUCCESS_${width}`))) overflowFailed += 1
    await page.close()
  }
} finally {
  await browser.close()
}

if (overflowFailed > 0) {
  console.error(`OVERFLOW failures: ${overflowFailed}`)
  process.exit(1)
}
console.log('V5 screenshots complete')
