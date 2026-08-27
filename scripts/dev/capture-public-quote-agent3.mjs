import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import puppeteer from 'puppeteer-core'

const BASE = (process.argv[process.argv.indexOf('--url') + 1] || '').replace(
  /\/$/,
  '',
)
const OUT =
  process.argv[process.argv.indexOf('--out') + 1] ||
  '/opt/cursor/artifacts/agent3'
const CHROME = process.env.CHROME_PATH || '/usr/bin/google-chrome-stable'
mkdirSync(OUT, { recursive: true })

function localePath(locale) {
  return `${BASE}/quote/cdl/${locale}`
}

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    `--user-data-dir=/tmp/chrome-agent3-${Date.now()}`,
    '--autoplay-policy=no-user-gesture-required',
  ],
})

const report = {
  base: BASE,
  shots: [],
  checks: [],
  overflow: {},
  console: [],
  network: [],
}

function check(name, ok, detail) {
  report.checks.push({ name, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

async function shot(page, name) {
  const dest = join(OUT, `${name}.png`)
  await page.screenshot({ path: dest, fullPage: false })
  report.shots.push(dest)
  console.log('SHOT', dest)
}

async function openLanding(page, locale, width = 390, height = 844) {
  const errors = []
  const net = []
  page.on('pageerror', (error) => errors.push(String(error)))
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  page.on('response', (response) => {
    const status = response.status()
    const url = response.url()
    if (status >= 400) net.push({ status, url })
  })
  await page.setViewport({ width, height, deviceScaleFactor: 2 })
  await page.goto(localePath(locale), {
    waitUntil: 'networkidle2',
    timeout: 60_000,
  })
  await page.waitForSelector('[data-public-landing-story]', { timeout: 30_000 })
  return { errors, net }
}

async function jumpToStep(page, currentStep, extra = {}) {
  await page.waitForSelector('[data-landing-quick-cta]:not([disabled])', {
    timeout: 20_000,
  })
  await page.click('[data-landing-quick-cta]')
  await page.waitForSelector('[data-public-wizard-theme="light-locked"]', {
    timeout: 45_000,
  })
  const locale = await page.evaluate(
    () => location.pathname.split('/').pop() || 'pt',
  )
  const unique = String(Date.now()).slice(-4)
  const patched = await page.evaluate(
    async (draftLocale, phoneTail, step, extraDraft) => {
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
            ...extraDraft,
          },
        }),
      })
      return { ok: response.ok, status: response.status }
    },
    locale,
    unique,
    currentStep,
    extra,
  )
  if (!patched.ok) throw new Error(`session patch ${patched.status}`)
  await page.reload({ waitUntil: 'networkidle2' })
}

async function selectFirstWithSidesPackage(page) {
  await page.waitForSelector('[data-package-experience-intro]', {
    timeout: 45_000,
  })
  const withSides = await page.$('[data-package-group="with_sides"]')
  if (withSides) {
    const open = await page.$eval(
      '[data-package-group="with_sides"]',
      (node) => node.getAttribute('data-package-group-open') === 'true',
    )
    if (!open) await withSides.click()
  }
  await page.waitForSelector('[data-package-sides-group="with_sides"]', {
    timeout: 15_000,
  })
  await page.click('[data-package-sides-group="with_sides"]')
  await page.waitForFunction(
    () => document.querySelector('[data-package-selected="true"]'),
    { timeout: 10_000 },
  )
}

async function injectSuccess(page) {
  await page.evaluate(() => {
    sessionStorage.setItem(
      'public-quote-success:cdl',
      JSON.stringify({
        quote: {
          id: '00000000-0000-4000-8000-000000000062',
          number: 'Q-2026-000062',
          eventName: 'Philippe Polish',
          eventDate: '2026-08-30',
          total: 1875,
          currency: 'USD',
        },
      }),
    )
    sessionStorage.removeItem('public-quote-active:cdl')
    window.dispatchEvent(new Event('public-quote-success-change'))
  })
  await page.reload({ waitUntil: 'networkidle2' })
  await page.waitForSelector('[data-public-success]', { timeout: 20_000 })
}

async function pageMetrics(page) {
  return page.evaluate(() => {
    const shell = document.querySelector('[data-public-quote-shell]')
    const landingFooter = document.querySelector('[data-public-landing-footer]')
    const successFooter = document.querySelector('[data-success-footer]')
    const video = document.querySelector('[data-success-cdl-fire-video]')
    const staticLogo = document.querySelector('[data-success-cdl-logo]')
    const contacts = document.querySelector('[data-success-contacts]')
    const text = document.body.innerText
    return {
      theme: shell?.getAttribute('data-theme'),
      lock: shell?.getAttribute('data-public-wizard-theme'),
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      landingFooter: Boolean(landingFooter),
      landingHasPscs: Boolean(
        landingFooter?.querySelector('[data-powered-by], .pscs-one, img[src*="pscs"]'),
      ),
      landingTextHasPscs: /pscs/i.test(landingFooter?.innerText || ''),
      successFooter: Boolean(successFooter),
      poweredBy: Boolean(document.querySelector('[data-powered-by]')),
      video: Boolean(video),
      videoSrc: video?.getAttribute('src') || null,
      staticLogo: Boolean(staticLogo),
      contactsText: contacts?.innerText || '',
      hasWhatsAppLabel: /whatsapp/i.test(contacts?.innerText || ''),
      hasInstagramLabel: /instagram/i.test(contacts?.innerText || ''),
      zelle: document.querySelector('[data-success-zelle]')?.innerText || '',
      selected: Boolean(document.querySelector('[data-package-selected="true"]')),
      options: Boolean(document.querySelector('[data-public-package-options]')),
      text: text.slice(0, 400),
    }
  })
}

try {
  const landing = await browser.newPage()
  const landingProbe = await openLanding(landing, 'pt')
  await landing.evaluate(() => {
    document
      .querySelector('[data-public-landing-footer]')
      ?.scrollIntoView({ block: 'end' })
  })
  await new Promise((r) => setTimeout(r, 300))
  await shot(landing, '01_landing_footer')
  const landingMetrics = await pageMetrics(landing)
  check('LANDING_CDL_FOOTER', landingMetrics.landingFooter, JSON.stringify(landingMetrics))
  check('LANDING_PSCS_ABSENT', !landingMetrics.landingHasPscs && !landingMetrics.landingTextHasPscs)
  check(
    'LANDING_OVERFLOW',
    landingMetrics.overflow <= 2,
    `overflow=${landingMetrics.overflow}`,
  )
  report.console.push(...landingProbe.errors)
  report.network.push(...landingProbe.net)
  await landing.close()

  const packages = await browser.newPage()
  await openLanding(packages, 'pt')
  await jumpToStep(packages, 2)
  await selectFirstWithSidesPackage(packages)
  await packages.evaluate(() => {
    ;(
      document.querySelector('[data-public-package-options]') ||
      document.querySelector('[data-package-selected="true"]')
    )?.scrollIntoView({ block: 'center' })
  })
  await new Promise((r) => setTimeout(r, 400))
  await shot(packages, '02_package_open')
  const openState = await pageMetrics(packages)
  check('PACKAGE_OPEN_SELECTED', openState.selected)
  check('WIZARD_LIGHT', openState.theme === 'light' && openState.lock === 'light-locked')

  await packages.click('[data-package-selected="true"]')
  await new Promise((r) => setTimeout(r, 400))
  const closedState = await pageMetrics(packages)
  check('PACKAGE_COLLAPSE_KEEPS_SELECTED', closedState.selected && !closedState.options)
  await packages.evaluate(() => {
    document.querySelector('[data-package-selected="true"]')?.scrollIntoView({
      block: 'center',
    })
  })
  await shot(packages, '03_package_closed_selected')

  await packages.click('[data-package-selected="true"]')
  await new Promise((r) => setTimeout(r, 400))
  const reopened = await pageMetrics(packages)
  check('PACKAGE_REOPEN', reopened.selected && reopened.options)
  await packages.evaluate(() => {
    ;(
      document.querySelector('[data-public-package-options]') ||
      document.querySelector('[data-package-selected="true"]')
    )?.scrollIntoView({ block: 'center' })
  })
  await shot(packages, '04_package_reopened')
  const packageKey = await packages.evaluate(() => {
    return document
      .querySelector('[data-package-selected="true"]')
      ?.getAttribute('data-package-key')
  })
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
    '[data-category-key], [data-additional-item-card]',
    { timeout: 45_000 },
  )
  const opener = await packages.$(
    '[data-additional-category-hitarea], [data-additional-category-header]',
  )
  if (opener) await opener.click()
  await packages.waitForSelector('[data-additional-item-card]', {
    timeout: 15_000,
  })
  await packages.evaluate(() => {
    document.querySelector('[data-additional-item-card]')?.scrollIntoView({
      block: 'center',
    })
  })
  await new Promise((r) => setTimeout(r, 300))
  await shot(packages, '05_additionals')
  const extrasTheme = await pageMetrics(packages)
  check('ADDITIONALS_LIGHT', extrasTheme.theme === 'light')
  await packages.close()

  for (const locale of ['pt', 'en', 'es']) {
    const page = await browser.newPage()
    const probe = await openLanding(page, locale)
    await injectSuccess(page)
    await page.evaluate(() => window.scrollTo(0, 0))
    await new Promise((r) => setTimeout(r, 250))
    if (locale === 'pt') await shot(page, '06_success_top')
    else await shot(page, `${locale}_success_top`)
    if (locale === 'pt') {
      await page.evaluate(() => {
        document.querySelector('[data-success-zelle]')?.scrollIntoView({
          block: 'center',
        })
      })
      await shot(page, '07_success_zelle')
      await page.evaluate(() => {
        document
          .querySelector('[data-success-cdl-signature], [data-success-fire-logo]')
          ?.scrollIntoView({ block: 'center' })
      })
      await new Promise((r) => setTimeout(r, 250))
      await shot(page, '08_success_video_start')
      await page.evaluate(async () => {
        const video = document.querySelector('[data-success-cdl-fire-video]')
        if (video) {
          try {
            video.currentTime = 2.5
            await video.play()
          } catch {
            /* fallback still */
          }
        }
      })
      await new Promise((r) => setTimeout(r, 400))
      await shot(page, '09_success_video_middle')
      await page.evaluate(async () => {
        const video = document.querySelector('[data-success-cdl-fire-video]')
        if (video && Number.isFinite(video.duration) && video.duration > 0) {
          video.currentTime = Math.min(4.9, Math.max(0, video.duration - 0.05))
        }
      })
      await new Promise((r) => setTimeout(r, 400))
      await shot(page, '10_success_video_4_9_seconds')
      await page.evaluate(() => {
        document.querySelector('[data-success-contacts]')?.scrollIntoView({
          block: 'center',
        })
      })
      await shot(page, '11_success_contacts')
      await page.evaluate(() => {
        document
          .querySelector('[data-success-footer], [data-powered-by]')
          ?.scrollIntoView({ block: 'end' })
      })
      await shot(page, '12_success_pscs')
    }
    const success = await pageMetrics(page)
    check(
      `SUCCESS_${locale.toUpperCase()}`,
      success.successFooter && /zelle/i.test(success.zelle),
      success.zelle,
    )
    check(
      `CONTACT_LABELS_${locale.toUpperCase()}`,
      !success.hasWhatsAppLabel && !success.hasInstagramLabel,
      success.contactsText,
    )
    check(
      `SUCCESS_OVERFLOW_${locale.toUpperCase()}`,
      success.overflow <= 2,
      `overflow=${success.overflow}`,
    )
    report.console.push(...probe.errors)
    report.network.push(...probe.net)
    await page.close()
  }

  const desktop = await browser.newPage()
  await openLanding(desktop, 'pt', 1440, 900)
  await injectSuccess(desktop)
  await desktop.evaluate(() => window.scrollTo(0, 0))
  await shot(desktop, 'success_desktop_1440_top')
  await desktop.evaluate(() => {
    document
      .querySelector('[data-success-cdl-signature], [data-success-fire-logo]')
      ?.scrollIntoView({ block: 'center' })
  })
  await shot(desktop, 'success_desktop_1440_fire')
  await desktop.close()

  const widths = [320, 360, 375, 390, 393, 414, 430]
  for (const width of widths) {
    const page = await browser.newPage()
    await openLanding(page, 'pt', width, 844)
    const metrics = await pageMetrics(page)
    report.overflow[`landing_${width}`] = metrics.overflow
    check(
      `OVERFLOW_LANDING_${width}`,
      metrics.overflow <= 2,
      `overflow=${metrics.overflow}`,
    )
    await page.close()
  }

  check(
    'CONSOLE_CRITICAL',
    report.console.filter((item) => /critical|uncaught/i.test(item)).length === 0,
    JSON.stringify(report.console.slice(0, 8)),
  )
  const badNet = report.network.filter((item) => {
    const url = item.url || ''
    if (url.includes('CDL_LOGO_FOGO_SEM_BOOK_NOW_FINAL.mp4') && item.status >= 400) {
      return true
    }
    if (url.includes('cdl-logo-fire-spin.mp4')) return true
    return item.status >= 400 && !url.includes('favicon')
  })
  check('NETWORK', badNet.length === 0, JSON.stringify(badNet.slice(0, 8)))
  check('PACKAGE_KEY_CAPTURED', Boolean(packageKey), packageKey)
} finally {
  await browser.close()
}

writeFileSync(join(OUT, 'agent3-capture.json'), JSON.stringify(report, null, 2))
console.log('REPORT', join(OUT, 'agent3-capture.json'))
console.log('done')
