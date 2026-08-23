import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import puppeteer from 'puppeteer-core'

const BASE = (process.argv[process.argv.indexOf('--url') + 1] || '').replace(/\/$/, '')
const OUT = process.argv[process.argv.indexOf('--out') + 1] || '/opt/cursor/artifacts/v4'
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
    `--user-data-dir=/tmp/chrome-v4-rest-${Date.now()}`,
  ],
})

async function shot(page, name) {
  const dest = join(OUT, `${name}.png`)
  await page.screenshot({ path: dest, fullPage: false })
  console.log('SHOT', dest)
}

async function openLanding(page, locale, width = 390, height = 844) {
  await page.setViewport({ width, height, deviceScaleFactor: 2 })
  await page.goto(localePath(locale), { waitUntil: 'networkidle2', timeout: 60_000 })
  await page.waitForSelector('[data-public-landing-story]', { timeout: 30_000 })
}

async function jumpToStep(page, currentStep, extra = {}) {
  await page.waitForSelector('[data-landing-quick-cta]:not([disabled])', { timeout: 20_000 })
  await page.click('[data-landing-quick-cta]')
  await page.waitForSelector('[data-public-wizard-theme="light-locked"]', { timeout: 45_000 })
  const locale = await page.evaluate(() => location.pathname.split('/').pop() || 'pt')
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

try {
  const phase = process.argv.includes('--phase')
    ? process.argv[process.argv.indexOf('--phase') + 1]
    : 'all'

  if (phase === 'packages' || phase === 'all') {
    const page = await browser.newPage()
    await openLanding(page, 'pt')
    await jumpToStep(page, 2)
    await page.waitForSelector('[data-package-experience-intro]', { timeout: 45_000 })
    const withSides = await page.$('[data-package-group="with_sides"]')
    if (withSides) {
      const open = await page.$eval(
        '[data-package-group="with_sides"]',
        (node) => node.getAttribute('data-package-group-open') === 'true',
      )
      if (!open) await withSides.click()
    }
    await page.waitForSelector('[data-package-sides-group="with_sides"]')
    await page.click('[data-package-sides-group="with_sides"]')
    await page.waitForFunction(
      () =>
        document.querySelector('[data-package-selected="true"]') &&
        (document.querySelector('[data-public-package-options]') ||
          document.querySelector('[data-package-selected="true"]')),
      { timeout: 10_000 },
    )
    await page.evaluate(() => {
      document.querySelector('[data-public-package-options]')?.scrollIntoView({ block: 'center' })
    })
    await new Promise((r) => setTimeout(r, 500))
    await shot(page, '02_package_open_390')

    await page.click('[data-package-selected="true"]')
    await new Promise((r) => setTimeout(r, 400))
    const stillSelected = await page.$('[data-package-selected="true"]')
    if (!stillSelected) throw new Error('selection lost after collapse')
    await page.evaluate(() => {
      document.querySelector('[data-package-selected="true"]')?.scrollIntoView({ block: 'center' })
    })
    await shot(page, '03_package_closed_selected_390')

    await page.click('[data-package-selected="true"]')
    await new Promise((r) => setTimeout(r, 400))
    await page.evaluate(() => {
      ;(
        document.querySelector('[data-public-package-options]') ||
        document.querySelector('[data-package-selected="true"]')
      )?.scrollIntoView({ block: 'center' })
    })
    await shot(page, '04_package_reopened_390')
    const theme = await page.evaluate(() => ({
      theme: document.querySelector('[data-public-quote-shell]')?.getAttribute('data-theme'),
      lock: document
        .querySelector('[data-public-quote-shell]')
        ?.getAttribute('data-public-wizard-theme'),
      selected: document.querySelector('[data-package-selected="true"]') != null,
      options: document.querySelector('[data-public-package-options]') != null,
    }))
    console.log('PACKAGE_STATE', JSON.stringify(theme))
    await page.close()
  }

  if (phase === 'additionals' || phase === 'all') {
    const page = await browser.newPage()
    await openLanding(page, 'pt')
    await jumpToStep(page, 3)
    await page.waitForSelector('[data-category-key], [data-additional-category-header]', {
      timeout: 45_000,
    })
    const opener = await page.$('[data-additional-category-hitarea], [data-additional-category-header]')
    if (opener) await opener.click()
    await page.waitForSelector('[data-additional-item-card]', { timeout: 15_000 })
    await page.evaluate(() => {
      document.querySelector('[data-additional-item-card]')?.scrollIntoView({ block: 'center' })
    })
    await new Promise((r) => setTimeout(r, 300))
    await shot(page, '05_additionals_390')
    await page.evaluate(() => {
      const card = document.querySelector('[data-additional-item-card]')
      const plus = card?.querySelectorAll('button')
      const last = plus?.[plus.length - 1]
      last?.click()
    })
    await new Promise((r) => setTimeout(r, 350))
    await page.evaluate(() => {
      document.querySelector('[data-additional-item-card]')?.scrollIntoView({ block: 'center' })
    })
    await shot(page, '06_additional_selected_390')
    await page.close()
  }

  if (phase === 'success' || phase === 'all') {
    for (const locale of ['pt', 'en', 'es']) {
      const page = await browser.newPage()
      await openLanding(page, locale)
      await injectSuccess(page)
      await page.evaluate(() => window.scrollTo(0, 0))
      await new Promise((r) => setTimeout(r, 250))
      if (locale === 'pt') await shot(page, '07_success_top_390')
      else await shot(page, `${locale}_success_top_390`)
      if (locale === 'pt') {
        await page.evaluate(() => {
          document.querySelector('[data-success-zelle]')?.scrollIntoView({ block: 'center' })
        })
        await shot(page, '08_success_zelle_390')
        await page.evaluate(() => {
          document
            .querySelector('[data-success-cdl-signature], [data-success-fire-logo]')
            ?.scrollIntoView({ block: 'center' })
        })
        await new Promise((r) => setTimeout(r, 500))
        await shot(page, '09_success_fire_video_START_390')
        await new Promise((r) => setTimeout(r, 2400))
        await shot(page, '10_success_fire_video_END_390')
        await page.evaluate(() => {
          document.querySelector('[data-success-contacts]')?.scrollIntoView({ block: 'center' })
        })
        await shot(page, '11_success_contacts_390')
        await page.evaluate(() => {
          document.querySelector('[data-success-footer], [data-powered-by]')?.scrollIntoView({
            block: 'end',
          })
        })
        await shot(page, '12_success_pscs_footer_390')
      }
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
  }
} finally {
  await browser.close()
}
console.log('done')
