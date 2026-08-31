/**
 * Public package-step QA for BBQ Luxury.
 *
 *   node scripts/dev/capture-cdl-bbq-luxury.mjs \
 *     https://catering-ai-agenda-dev.vercel.app \
 *     /tmp/bbqlux/public-qa
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import puppeteer from 'puppeteer-core'

const BASE = process.argv[2] ?? 'https://catering-ai-agenda-dev.vercel.app'
const OUT = process.argv[3] ?? '/tmp/bbqlux/public-qa'
const CHROME = process.env.CHROME_PATH || '/usr/bin/google-chrome-stable'
const LOCALE = process.argv[4] ?? 'pt'

mkdirSync(OUT, { recursive: true })
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const ADDR = {
  route: 'Lake Nona Boulevard',
  number: '13801',
  city: 'Orlando',
  region: 'FL',
  postalCode: '32827',
  country: 'US',
  formattedAddress: '13801 Lake Nona Boulevard, Orlando, FL 32827, US',
  source: 'manual',
}

const results = []
const record = (name, pass, note = '') => {
  results.push({ name, pass, note })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${note ? `  — ${note}` : ''}`)
}

const browser = await puppeteer.launch({
  headless: 'new',
  executablePath: CHROME,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--font-render-hinting=none'],
})
const page = await browser.newPage()
await page.setViewport({ width: 430, height: 932, deviceScaleFactor: 2 })

await page.goto(`${BASE}/quote/cdl/${LOCALE}`, { waitUntil: 'networkidle2', timeout: 90_000 })
await page.evaluate(async (payload) => {
  const tail = String(Math.floor(Math.random() * 9000) + 1000)
  await fetch('/api/public/quote-intake/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ companySlug: 'cdl', locale: payload.locale, website: '' }),
  })
  await fetch('/api/public/quote-intake/session', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({
      website: '',
      currentStep: 2,
      draft: {
        locale: payload.locale,
        contact: {
          firstName: 'Luxury',
          lastName: 'QA',
          phone: `+1407555${tail}`,
        },
        event: {
          eventName: 'BBQ Luxury QA',
          eventDate: '2026-11-21',
          startTime: '18:00',
          endTime: '22:00',
          adultCount: 25,
          address: payload.address,
        },
      },
    }),
  })
  sessionStorage.setItem('public-quote-active:cdl', '1')
}, { locale: LOCALE, address: ADDR })
await page.reload({ waitUntil: 'networkidle2' })
await page.waitForSelector('[data-package-group-controls]', { timeout: 45_000 })

async function openGroup(group) {
  await page.evaluate((key) => {
    const toggle = document.querySelector(`[data-package-group="${key}"]`)
    if (toggle && toggle.getAttribute('aria-expanded') !== 'true') toggle.click()
  }, group)
  await wait(700)
}

async function selectPackage(key) {
  const picked = await page.evaluate((packageKey) => {
    const card = document.querySelector(`[data-package-key="${packageKey}"]`)
    card?.click()
    return {
      exists: Boolean(card),
      text: card?.innerText || '',
    }
  }, key)
  await wait(900)
  return picked
}

async function fillRequiredOptions() {
  for (let round = 0; round < 8; round += 1) {
    const remaining = await page.evaluate(() => {
      let open = 0
      for (const group of document.querySelectorAll('[data-package-option-group]')) {
        const chips = [...group.querySelectorAll('button[type="button"]')]
        if (chips.some((chip) => chip.getAttribute('aria-pressed') === 'true')) continue
        open += 1
        chips[0]?.click()
      }
      return open
    })
    if (!remaining) break
    await wait(350)
  }
}

async function packageKeys(group) {
  return page.evaluate((key) => {
    const section = document.querySelector(`[data-package-group="${key}"]`)
    const root = section?.closest('.public-package-groups')?.parentElement
    return [...document.querySelectorAll(`[data-package-sides-group="${key}"]`)].map((node) =>
      node.getAttribute('data-package-key'),
    )
  }, group)
}

await openGroup('without_sides')
const withoutKeys = await packageKeys('without_sides')
record(
  'LUXURY_IN_WITHOUT_SIDES',
  withoutKeys.includes('BBQLUX'),
  withoutKeys.join(' > '),
)
record(
  'LUXURY_AFTER_PRIME_BEFORE_CUSTOM',
  withoutKeys.indexOf('BBQPRI') >= 0 &&
    withoutKeys.indexOf('BBQLUX') === withoutKeys.indexOf('BBQPRI') - 1 &&
    withoutKeys.indexOf('BBQPERS') > withoutKeys.indexOf('BBQPRI'),
  withoutKeys.join(' > '),
)

const base = await selectPackage('BBQLUX')
record('LUXURY_CARD_150', /150/.test(base.text), base.text.slice(0, 240))
await fillRequiredOptions()
await page.screenshot({ path: join(OUT, `01-luxury-base-${LOCALE}.png`), fullPage: false })

const optionLabels = await page.evaluate(() =>
  [...document.querySelectorAll('[data-package-option-group]')].map((group) => group.innerText),
)
record(
  'LUXURY_OPTIONS_PRESENT',
  optionLabels.some((text) => /lagosta|lobster|langosta/i.test(text)) &&
    optionLabels.some((text) => /salm[aã]o|salmon|camar/i.test(text)) &&
    optionLabels.some((text) => /costela|rib|costilla/i.test(text)),
  optionLabels.join(' || ').slice(0, 400),
)

await page.evaluate(() => {
  for (const group of document.querySelectorAll('[data-package-option-group]')) {
    const chips = [...group.querySelectorAll('button[type="button"]')]
    chips[1]?.click()
  }
})
await wait(500)
await page.screenshot({ path: join(OUT, `02-luxury-options-${LOCALE}.png`), fullPage: false })

await openGroup('with_sides')
const withKeys = await packageKeys('with_sides')
record(
  'LUXURY_PLUS_IN_WITH_SIDES',
  withKeys.includes('BBQLUX+'),
  withKeys.join(' > '),
)
const plus = await selectPackage('BBQLUX+')
record('LUXURY_CARD_163', /163/.test(plus.text), plus.text.slice(0, 240))
await fillRequiredOptions()
await page.screenshot({ path: join(OUT, `03-luxury-plus-${LOCALE}.png`), fullPage: false })

writeFileSync(join(OUT, `report-${LOCALE}.json`), JSON.stringify({ withoutKeys, withKeys, results }, null, 2))
await browser.close()
const failed = results.filter((row) => !row.pass).length
console.log(failed === 0 ? 'LUXURY_PUBLIC_QA PASS' : `LUXURY_PUBLIC_QA ${failed} FAIL`)
process.exit(failed === 0 ? 0 : 1)
