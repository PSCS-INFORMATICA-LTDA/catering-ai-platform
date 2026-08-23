/**
 * Screenshot matrix for public experience polish V4.
 *
 *   node scripts/dev/capture-public-quote-brand-polish-v4.mjs \
 *     --url http://127.0.0.1:3000 --out /opt/cursor/artifacts/v4
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import puppeteer from 'puppeteer-core'

const arg = (name, fallback = '') => {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : fallback
}

const BASE = (arg('--url') || process.env.PUBLIC_LAYOUT_URL || '').replace(/\/$/, '')
const OUT = arg('--out', '/opt/cursor/artifacts/v4')
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
    `--user-data-dir=/tmp/chrome-v4-shots-${Date.now()}`,
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

async function jumpToStep(page, currentStep, extraDraft = {}) {
  await page.waitForSelector('[data-landing-quick-cta]:not([disabled])', {
    timeout: 15_000,
  })
  await page.click('[data-landing-quick-cta]')
  await page.waitForSelector('[data-public-wizard-theme="light-locked"]', {
    timeout: 45_000,
  })
  const unique = String(Date.now()).slice(-4)
  const locale = await page.evaluate(() => location.pathname.split('/').pop() || 'pt')
  const patched = await page.evaluate(
    async (draftLocale, phoneTail, step, extra) => {
      const response = await fetch('/api/public/quote-intake/session', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          website: '',
          currentStep: step,
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
            ...extra,
          },
        }),
      })
      const body = await response.json().catch(() => null)
      return { ok: response.ok, status: response.status, step: body?.session?.currentStep }
    },
    locale,
    unique,
    currentStep,
    extraDraft,
  )
  if (!patched.ok) throw new Error(`session patch ${patched.status}`)
  await page.reload({ waitUntil: 'networkidle2' })
}

async function injectSuccess(page, locale) {
  await page.evaluate((lang) => {
    const payload = {
      quote: {
        id: '00000000-0000-4000-8000-000000000062',
        number: 'Q-2026-000062',
        eventName: 'Philippe Polish',
        eventDate: '2026-08-30',
        total: 1875,
        currency: 'USD',
      },
    }
    sessionStorage.setItem('public-quote-success:cdl', JSON.stringify(payload))
    sessionStorage.removeItem('public-quote-active:cdl')
    window.dispatchEvent(new Event('public-quote-success-change'))
  }, locale)
  await page.reload({ waitUntil: 'networkidle2' })
  await page.waitForSelector('[data-public-success]', { timeout: 20_000 })
}

let overflowFailed = 0

try {
  const landing = await browser.newPage()
  await openLanding(landing, 'pt', 390, 844)
  if (!(await overflow(landing, 'LANDING_390'))) overflowFailed += 1
  await landing.evaluate(() => {
    document.querySelector('[data-public-landing-footer]')?.scrollIntoView({ block: 'end' })
  })
  await new Promise((r) => setTimeout(r, 300))
  await shot(landing, '01_landing_footer_390')
  await landing.close()

  const packages = await browser.newPage()
  await openLanding(packages, 'pt', 390, 844)
  await jumpToStep(packages, 2)
  await packages.waitForSelector('[data-package-experience-intro]', { timeout: 45_000 })
  if (!(await overflow(packages, 'PACKAGE_390'))) overflowFailed += 1
  const withSides = await packages.$('[data-package-group="with_sides"]')
  if (withSides) {
    const open = await packages.$eval(
      '[data-package-group="with_sides"]',
      (node) => node.getAttribute('data-package-group-open') === 'true',
    )
    if (!open) await withSides.click()
  }
  await packages.waitForSelector('[data-package-sides-group="with_sides"]', { timeout: 15_000 })
  await packages.click('[data-package-sides-group="with_sides"]')
  await packages.waitForSelector('[data-public-package-options]', { timeout: 10_000 })
  await new Promise((r) => setTimeout(r, 400))
  await shot(packages, '02_package_open_390')

  await packages.click('[data-package-selected="true"]')
  await packages.waitForFunction(
    () => !document.querySelector('[data-public-package-options]'),
    { timeout: 10_000 },
  )
  await new Promise((r) => setTimeout(r, 250))
  await shot(packages, '03_package_closed_selected_390')

  await packages.click('[data-package-selected="true"]')
  await packages.waitForSelector('[data-public-package-options]', { timeout: 10_000 })
  await new Promise((r) => setTimeout(r, 250))
  await shot(packages, '04_package_reopened_390')

  const packageId = await packages.$eval(
    '[data-package-selected="true"]',
    (node) => node.getAttribute('data-package-key') || '',
  )
  const selectedId = await packages.evaluate(() => {
    const card = document.querySelector('[data-package-selected="true"]')
    return card?.getAttribute('data-package-key') || ''
  })
  writeFileSync(join(OUT, 'package-selected.json'), JSON.stringify({ packageId, selectedId }))
  await packages.close()

  const extras = await browser.newPage()
  await openLanding(extras, 'pt', 390, 844)
  await jumpToStep(extras, 3)
  await extras.waitForSelector('[data-additional-category-header], [data-category-key]', {
    timeout: 45_000,
  })
  if (!(await overflow(extras, 'ADDITIONALS_390'))) overflowFailed += 1
  const firstHeader = await extras.$('[data-additional-category-header], [data-additional-category-hitarea]')
  if (firstHeader) await firstHeader.click()
  await extras.waitForSelector('[data-additional-item-card]', { timeout: 15_000 })
  await extras.evaluate(() => {
    document.querySelector('[data-additional-item-card]')?.scrollIntoView({ block: 'center' })
  })
  await new Promise((r) => setTimeout(r, 300))
  await shot(extras, '05_additionals_390')
  const qtyPlus = await extras.$('[data-additional-item-card] .public-additional-qty-btn:last-of-type, [data-additional-item-card] button[aria-label]')
  if (qtyPlus) await qtyPlus.click()
  else {
    const selectBtn = await extras.$('[data-additional-item-card] button')
    if (selectBtn) await selectBtn.click()
  }
  await extras.waitForSelector('[data-additional-item-card].is-selected, .public-additional-card.is-selected', {
    timeout: 8_000,
  }).catch(() => {})
  await new Promise((r) => setTimeout(r, 250))
  await shot(extras, '06_additional_selected_390')
  await extras.close()

  for (const [locale, prefix] of [
    ['pt', ''],
    ['en', 'en_'],
    ['es', 'es_'],
  ]) {
    const success = await browser.newPage()
    await openLanding(success, locale, 390, 844)
    await injectSuccess(success, locale)
    if (!(await overflow(success, `SUCCESS_${locale.toUpperCase()}_390`))) overflowFailed += 1
    await success.evaluate(() => window.scrollTo(0, 0))
    await new Promise((r) => setTimeout(r, 250))
    const topName =
      locale === 'pt' ? '07_success_top_390' : `${prefix}success_top_390`
    await shot(success, topName)
    if (locale === 'pt') {
      await success.evaluate(() => {
        document.querySelector('[data-success-zelle]')?.scrollIntoView({ block: 'center' })
      })
      await shot(success, '08_success_zelle_390')
      await success.evaluate(() => {
        document.querySelector('[data-success-cdl-signature], [data-success-fire-logo]')
          ?.scrollIntoView({ block: 'center' })
      })
      await new Promise((r) => setTimeout(r, 400))
      await shot(success, '09_success_fire_video_START_390')
      await new Promise((r) => setTimeout(r, 2200))
      await shot(success, '10_success_fire_video_END_390')
      await success.evaluate(() => {
        document.querySelector('[data-success-contacts]')?.scrollIntoView({ block: 'center' })
      })
      await shot(success, '11_success_contacts_390')
      await success.evaluate(() => {
        document.querySelector('[data-success-footer], [data-powered-by]')
          ?.scrollIntoView({ block: 'end' })
      })
      await shot(success, '12_success_pscs_footer_390')
    }
    await success.close()
  }

  const desktop = await browser.newPage()
  await openLanding(desktop, 'pt', 1440, 900)
  await injectSuccess(desktop, 'pt')
  if (!(await overflow(desktop, 'SUCCESS_DESKTOP_1440'))) overflowFailed += 1
  await desktop.evaluate(() => window.scrollTo(0, 0))
  await shot(desktop, 'success_desktop_1440_top')
  await desktop.evaluate(() => {
    document.querySelector('[data-success-cdl-signature], [data-success-fire-logo]')
      ?.scrollIntoView({ block: 'center' })
  })
  await shot(desktop, 'success_desktop_1440_fire')
  await desktop.close()
} finally {
  await browser.close()
}

if (overflowFailed > 0) {
  console.error(`OVERFLOW failures: ${overflowFailed}`)
  process.exit(1)
}
console.log('V4 screenshots complete')
