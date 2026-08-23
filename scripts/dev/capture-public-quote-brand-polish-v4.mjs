/**
 * Screenshot matrix for public experience polish V4 — Git asset edition.
 *
 *   node scripts/dev/capture-public-quote-brand-polish-v4.mjs \
 *     --url http://127.0.0.1:3000 --out /opt/cursor/artifacts
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import puppeteer from 'puppeteer-core'

const arg = (name, fallback = '') => {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : fallback
}

const BASE = (arg('--url') || process.env.PUBLIC_LAYOUT_URL || '').replace(/\/$/, '')
const OUT = arg('--out', '/opt/cursor/artifacts')
const CHROME = process.env.CHROME_PATH || '/usr/bin/google-chrome-stable'
const FINAL_MP4 = 'CDL_LOGO_FOGO_SEM_BOOK_NOW_FINAL'

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

async function injectSuccess(page) {
  await page.evaluate(() => {
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
  })
  await page.reload({ waitUntil: 'networkidle2' })
  await page.waitForSelector('[data-public-success]', { timeout: 20_000 })
}

async function seekSuccessVideo(page, seconds) {
  await page.waitForSelector(`video[src*="${FINAL_MP4}"]`, { timeout: 20_000 })
  await page.evaluate(async (time, name) => {
    const el = document.querySelector(`video[src*="${name}"]`)
    if (!(el instanceof HTMLVideoElement)) throw new Error('success video missing')
    el.muted = true
    el.controls = false
    if (el.readyState < 1) {
      await new Promise((resolve, reject) => {
        el.addEventListener('loadedmetadata', resolve, { once: true })
        el.addEventListener('error', () => reject(new Error('video error')), { once: true })
      })
    }
    el.pause()
    if (Math.abs(el.currentTime - time) > 0.02) {
      await new Promise((resolve, reject) => {
        const timer = window.setTimeout(() => reject(new Error(`seek ${time} timeout`)), 8000)
        el.addEventListener(
          'seeked',
          () => {
            window.clearTimeout(timer)
            resolve()
          },
          { once: true },
        )
        el.currentTime = time
      })
    }
  }, seconds, FINAL_MP4)
  await new Promise((r) => setTimeout(r, 180))
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
  await landing.evaluate(() => {
    document.querySelector('[data-landing-chapter="video"]')?.scrollIntoView({ block: 'start' })
  })
  await new Promise((r) => setTimeout(r, 300))
  await shot(landing, '02_landing_video_order_390')
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
  await packages.evaluate(() => {
    document.querySelector('[data-public-package-options]')?.scrollIntoView({ block: 'center' })
  })
  await new Promise((r) => setTimeout(r, 400))
  await shot(packages, '03_package_open_390')

  await packages.click('[data-package-selected="true"]')
  await packages.waitForFunction(
    () => !document.querySelector('[data-public-package-options]'),
    { timeout: 10_000 },
  )
  const stillSelected = await packages.$('[data-package-selected="true"]')
  if (!stillSelected) throw new Error('selection lost after collapse')
  await packages.evaluate(() => {
    document.querySelector('[data-package-selected="true"]')?.scrollIntoView({ block: 'center' })
  })
  await new Promise((r) => setTimeout(r, 250))
  await shot(packages, '04_package_closed_selected_390')

  await packages.click('[data-package-selected="true"]')
  await packages.waitForSelector('[data-public-package-options]', { timeout: 10_000 })
  await packages.evaluate(() => {
    document.querySelector('[data-public-package-options]')?.scrollIntoView({
      block: 'center',
    })
  })
  await new Promise((r) => setTimeout(r, 250))
  await shot(packages, '05_package_reopened_390')
  const packageState = await packages.evaluate(() => ({
    theme: document.querySelector('[data-public-quote-shell]')?.getAttribute('data-theme'),
    lock: document
      .querySelector('[data-public-quote-shell]')
      ?.getAttribute('data-public-wizard-theme'),
    selected: document.querySelector('[data-package-selected="true"]') != null,
    options: document.querySelector('[data-public-package-options]') != null,
  }))
  writeFileSync(join(OUT, 'package-selected.json'), JSON.stringify(packageState))

  await packages.evaluate(() => {
    document
      .querySelectorAll('[data-public-package-options] [role="group"]')
      .forEach((group) => {
        group.querySelector('button')?.click()
      })
  })
  await new Promise((r) => setTimeout(r, 400))
  const next = await packages.$('[data-testid="wizard-global-next"]')
  if (!next) throw new Error('missing wizard next')
  await packages.evaluate(() => {
    document.querySelector('[data-testid="wizard-global-next"]')?.scrollIntoView({
      block: 'center',
    })
  })
  await next.click()
  await packages.waitForSelector(
    '[data-category-key], [data-additional-category-header], [data-additional-item-card]',
    { timeout: 45_000 },
  )
  if (!(await overflow(packages, 'ADDITIONALS_390'))) overflowFailed += 1
  const firstHeader = await packages.$(
    '[data-additional-category-header], [data-additional-category-hitarea]',
  )
  if (firstHeader) await firstHeader.click()
  await packages.waitForSelector('[data-additional-item-card]', { timeout: 15_000 })
  await packages.evaluate(() => {
    document.querySelector('[data-additional-item-card]')?.scrollIntoView({ block: 'center' })
  })
  await new Promise((r) => setTimeout(r, 300))
  await shot(packages, '06_additionals_390')
  await packages.evaluate(() => {
    const card = document.querySelector('[data-additional-item-card]')
    const plus = card?.querySelector('.public-additional-qty-btn:last-of-type')
    const select = card?.querySelector('.public-additional-card-select')
    ;(plus || select)?.click()
  })
  await packages
    .waitForSelector(
      '[data-additional-item-card].is-selected, .public-additional-card.is-selected',
      { timeout: 8_000 },
    )
    .catch(() => {})
  await packages.evaluate(() => {
    document.querySelector('[data-additional-item-card]')?.scrollIntoView({ block: 'center' })
  })
  await new Promise((r) => setTimeout(r, 250))
  await shot(packages, '07_additional_selected_390')
  await packages.close()

  for (const locale of ['pt', 'en', 'es']) {
    const success = await browser.newPage()
    await openLanding(success, locale, 390, 844)
    await injectSuccess(success)
    if (!(await overflow(success, `SUCCESS_${locale.toUpperCase()}_390`))) overflowFailed += 1
    await success.evaluate(() => window.scrollTo(0, 0))
    await new Promise((r) => setTimeout(r, 250))
    if (locale === 'pt') await shot(success, '08_success_top_390')
    if (locale === 'en') await shot(success, '15_success_en')
    if (locale === 'es') await shot(success, '16_success_es')
    if (locale === 'pt') {
      await success.evaluate(() => {
        document.querySelector('[data-success-zelle]')?.scrollIntoView({ block: 'center' })
      })
      await shot(success, '09_success_zelle_390')
      await success.evaluate(() => {
        document
          .querySelector('[data-success-cdl-signature], [data-success-fire-logo]')
          ?.scrollIntoView({ block: 'center' })
      })
      await seekSuccessVideo(success, 0)
      await shot(success, '10_success_video_0s')
      await seekSuccessVideo(success, 2)
      await shot(success, '11_success_video_2s')
      await seekSuccessVideo(success, 4.9)
      await shot(success, '12_success_video_4_9s')
      await success.evaluate(() => {
        document.querySelector('[data-success-contacts]')?.scrollIntoView({ block: 'center' })
      })
      await shot(success, '13_success_contacts_after_video')
      await success.evaluate(() => {
        document.querySelector('[data-success-footer], [data-powered-by]')?.scrollIntoView({
          block: 'end',
        })
      })
      await shot(success, '14_success_pscs_footer')
    }
    await success.close()
  }

  const landingDesktop = await browser.newPage()
  await openLanding(landingDesktop, 'pt', 1440, 900)
  if (!(await overflow(landingDesktop, 'LANDING_DESKTOP_1440'))) overflowFailed += 1
  await landingDesktop.evaluate(() => window.scrollTo(0, 0))
  await shot(landingDesktop, '17_landing_desktop')
  await landingDesktop.close()

  const desktop = await browser.newPage()
  await openLanding(desktop, 'pt', 1440, 900)
  await injectSuccess(desktop)
  if (!(await overflow(desktop, 'SUCCESS_DESKTOP_1440'))) overflowFailed += 1
  await desktop.evaluate(() => window.scrollTo(0, 0))
  await shot(desktop, '18_success_desktop')
  await desktop.close()

  const widths = [320, 360, 375, 390, 393, 414, 430]
  for (const width of widths) {
    const page = await browser.newPage()
    await openLanding(page, 'pt', width, width <= 360 ? 568 : 844)
    if (!(await overflow(page, `LANDING_${width}`))) overflowFailed += 1
    await page.close()
  }
} finally {
  await browser.close()
}

if (overflowFailed > 0) {
  console.error(`OVERFLOW failures: ${overflowFailed}`)
  process.exit(1)
}
console.log('V4 screenshots complete')
