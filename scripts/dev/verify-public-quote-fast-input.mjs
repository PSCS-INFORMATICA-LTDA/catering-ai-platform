/**
 * Runtime proof for the public fast-input chain.
 *
 *   node scripts/dev/verify-public-quote-fast-input.mjs \
 *     --url http://127.0.0.1:3072 --out /opt/cursor/artifacts/copy-flow-polish
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import puppeteer from 'puppeteer-core'

const arg = (name, fallback = '') => {
  const i = process.argv.indexOf(name)
  return i >= 0 ? process.argv[i + 1] : fallback
}
const BASE = (arg('--url') || '').replace(/\/$/, '')
const OUT = arg('--out', '/opt/cursor/artifacts/copy-flow-polish')
const CHROME = process.env.CHROME_PATH || '/usr/bin/google-chrome-stable'
if (!BASE) {
  console.error('Need --url')
  process.exit(1)
}
mkdirSync(OUT, { recursive: true })
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

const ADDR = {
  route: 'Lake Nona Boulevard',
  number: '',
  city: 'Orlando',
  region: 'FL',
  postalCode: '32827',
  country: 'US',
  formattedAddress: '',
  source: 'manual',
}

function activeInfo() {
  const el = document.activeElement
  if (!(el instanceof HTMLElement)) return { tag: null }
  const label = el.closest('label')?.querySelector('span, .cdl-eyebrow')?.textContent?.trim()
    || el.closest('label')?.textContent?.trim().slice(0, 40)
    || ''
  return {
    tag: el.tagName,
    type: el.getAttribute('type'),
    inputMode: el.getAttribute('inputmode') || el.inputMode || '',
    enterKeyHint: el.getAttribute('enterkeyhint') || '',
    name: el.getAttribute('name') || '',
    autocomplete: el.getAttribute('autocomplete') || '',
    addressSearch: el.hasAttribute('data-address-search'),
    addressNumber: el.hasAttribute('data-address-number'),
    guest: el.hasAttribute('data-guest-field'),
    label,
    value: el instanceof HTMLInputElement ? el.value : el.textContent?.trim().slice(0, 40),
  }
}

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    `--user-data-dir=/tmp/chrome-fast-input-${Date.now()}`,
  ],
})
const page = await browser.newPage()
await page.setUserAgent(
  `Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1 CopyFlow/${Date.now()}`,
)
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
const report = { ok: true, steps: [] }

async function seed(step, event = {}, contact = {}) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await page.goto(`${BASE}/quote/cdl/pt`, {
      waitUntil: 'domcontentloaded',
      timeout: 90_000,
    })
    await page
      .waitForSelector('[data-public-landing], [data-public-quote-shell]', {
        timeout: 30_000,
      })
      .catch(() => {})
    await wait(400 + attempt * 800)
    const seeded = await page.evaluate(
      async (address, currentStep, eventPatch, contactPatch) => {
        const tail = String(Math.floor(Math.random() * 9000) + 1000)
        const post = await fetch('/api/public/quote-intake/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ companySlug: 'cdl', locale: 'pt', website: '' }),
        })
        if (!post.ok) return { ok: false, status: post.status, stage: 'post' }
        const patch = await fetch('/api/public/quote-intake/session', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({
            website: '',
            currentStep,
            draft: {
              locale: 'pt',
              contact: {
                firstName: contactPatch.firstName ?? 'Copy',
                lastName: contactPatch.lastName ?? 'Flow',
                phone: contactPatch.phone ?? `+1407555${tail}`,
              },
              event: {
                eventName: 'Copy flow',
                eventDate: eventPatch.eventDate ?? '2026-11-14',
                startTime: eventPatch.startTime ?? '18:00',
                endTime: eventPatch.endTime ?? '22:00',
                adultCount: eventPatch.adultCount ?? 25,
                address,
              },
            },
          }),
        })
        if (!patch.ok) return { ok: false, status: patch.status, stage: 'patch' }
        sessionStorage.setItem('public-quote-active:cdl', '1')
        return { ok: true }
      },
      ADDR,
      step,
      event,
      contact,
    )
    if (!seeded.ok) {
      if (seeded.status === 429) {
        await wait(2500)
        continue
      }
      throw new Error(`seed failed ${JSON.stringify(seeded)}`)
    }
    await page.reload({ waitUntil: 'domcontentloaded' })
    try {
      await page.waitForSelector('[data-public-wizard-theme="light-locked"]', {
        timeout: 20_000,
      })
      return
    } catch {
      await wait(1500)
    }
  }
  throw new Error('seed failed after retries')
}

function record(name, data) {
  report.steps.push({ name, ...data })
  console.log(name, JSON.stringify(data))
}

await page.goto(`${BASE}/quote/cdl/pt`, {
  waitUntil: 'domcontentloaded',
  timeout: 90_000,
})
await page.waitForSelector('[data-landing-start-quote]', { timeout: 30_000 })
await page.evaluate(() => {
  document.querySelector('[data-landing-start-quote]')?.scrollIntoView({ block: 'center' })
})
await wait(200)
await page.click('[data-landing-start-quote]')
await page.waitForSelector('input[autocomplete="given-name"]', { timeout: 45_000 })
await page.click('input[autocomplete="given-name"]')
await page.type('input[autocomplete="given-name"]', 'Ana', { delay: 20 })
await page.keyboard.press('Enter')
await wait(200)
const afterFirst = await page.evaluate(activeInfo)
record('FIRST_NAME_TO_LAST_NAME', afterFirst)
if (!/sobrenome|last/i.test(afterFirst.label || '')) {
  report.ok = false
}

await page.keyboard.type('Silva', { delay: 20 })
await page.keyboard.press('Enter')
await wait(200)
const afterLast = await page.evaluate(activeInfo)
record('LAST_NAME_TO_PHONE', afterLast)
if (afterLast.type !== 'tel' || afterLast.inputMode !== 'tel') {
  report.ok = false
}
await page.keyboard.type('+14075551212', { delay: 15 })
await page.screenshot({
  path: join(OUT, 'customer-name-to-phone-390.jpg'),
  type: 'jpeg',
  quality: 88,
})
await page.evaluate(() => {
  const nav = document.querySelector('[data-wizard-step-nav]')
  const buttons = [...(nav?.querySelectorAll('button') ?? [])]
  buttons.filter((b) => !b.disabled && b.textContent.trim()).pop()?.click()
})
await page.waitForSelector('button[aria-haspopup="dialog"]', { timeout: 30_000 })
const dateBtn = await page.evaluateHandle(() => {
  const buttons = [...document.querySelectorAll('button[aria-haspopup="dialog"]')]
  return buttons.find((b) => /data|selecione/i.test(b.textContent || '')) || buttons[0]
})
await dateBtn.asElement().click()
await page.waitForSelector('[data-wizard-datepicker-panel]', { timeout: 10_000 })
await page.screenshot({
  path: join(OUT, 'event-date-open-390.jpg'),
  type: 'jpeg',
  quality: 88,
})
await page.evaluate(() => {
  const panel = document.querySelector('[data-wizard-datepicker-panel]')
  const days = [...(panel?.querySelectorAll('button[type="button"]:not([disabled])') ?? [])]
    .filter((b) => /^\d+$/.test(b.textContent.trim()))
  const pick = days[Math.min(12, days.length - 1)] || days.at(-1)
  pick?.click()
})
await wait(250)
const timeOpen = await page.evaluate(() => {
  const panel = document.querySelector('[data-wizard-timepicker-panel]')
  return {
    open: Boolean(panel),
    draft: panel?.querySelector('p')?.textContent?.trim() || '',
    endOpen: [...document.querySelectorAll('[data-wizard-timepicker-panel]')].length,
  }
})
record('DATE_COMMIT_OPENS_START_TIME', timeOpen)
if (!timeOpen.open || !/^11:00$/.test(timeOpen.draft) || timeOpen.endOpen !== 1) {
  report.ok = false
}
await page.screenshot({
  path: join(OUT, 'event-time-open-11-390.jpg'),
  type: 'jpeg',
  quality: 88,
})

await page.evaluate(() => {
  const panel = document.querySelector('[data-wizard-timepicker-panel]')
  const minutes = [...(panel?.querySelectorAll('button[type="button"]') ?? [])]
    .filter((b) => b.textContent.trim() === '00')
  minutes.at(-1)?.click()
})
await wait(250)
const afterTime = await page.evaluate(() => {
  const info = (() => {
    const el = document.activeElement
    if (!(el instanceof HTMLElement)) return {}
    const label = el.closest('label')?.textContent?.trim().slice(0, 40) || ''
    return {
      label,
      inputMode: el.getAttribute('inputmode') || '',
      pattern: el.getAttribute('pattern') || '',
      guest: el.hasAttribute('data-guest-field'),
    }
  })()
  const end = [...document.querySelectorAll('button')].find((b) =>
    /t[eé]rmino|end time/i.test(b.closest('div')?.textContent || ''),
  )
  return {
    ...info,
    timeOpen: Boolean(document.querySelector('[data-wizard-timepicker-panel]')),
    endText: end?.textContent?.trim() || '',
  }
})
record('START_TIME_CONFIRM_FOCUSES_ADULTS', afterTime)
if (!/adulto/i.test(afterTime.label || '') || afterTime.inputMode !== 'numeric') {
  report.ok = false
}
if (afterTime.timeOpen) report.ok = false
await page.screenshot({
  path: join(OUT, 'event-adults-focused-390.jpg'),
  type: 'jpeg',
  quality: 88,
})

await page.keyboard.type('25', { delay: 20 })
await page.keyboard.press('Enter')
await wait(250)
const afterAdults = await page.evaluate(activeInfo)
record('ADULTS_TO_ADDRESS_SEARCH', afterAdults)
if (
  !afterAdults.addressSearch ||
  afterAdults.addressNumber ||
  afterAdults.inputMode === 'numeric' ||
  afterAdults.type === 'tel'
) {
  report.ok = false
}
const numberField = await page.evaluate(() => {
  const el = document.querySelector('[data-address-number]')
  return {
    present: Boolean(el),
    inputMode: el?.getAttribute('inputmode') || '',
    focused: document.activeElement === el,
  }
})
record('STREET_NUMBER_NOT_AUTOFOCUSED_AFTER_ADULTS', numberField)
if (!numberField.present || numberField.focused || numberField.inputMode !== 'numeric') {
  report.ok = false
}
await page.screenshot({
  path: join(OUT, 'event-address-search-focused-390.jpg'),
  type: 'jpeg',
  quality: 88,
})

const preserved = await page.evaluate(() => {
  const start = [...document.querySelectorAll('button[aria-haspopup="dialog"], button[aria-readonly="true"]')]
  const texts = start.map((b) => b.textContent.trim())
  return {
    texts,
    timeOpen: Boolean(document.querySelector('[data-wizard-timepicker-panel]')),
    dateOpen: Boolean(document.querySelector('[data-wizard-datepicker-panel]')),
  }
})
record('END_TIME_STAYS_CLOSED', preserved)
if (preserved.timeOpen || preserved.dateOpen) report.ok = false

writeFileSync(join(OUT, 'fast-input-report.json'), JSON.stringify(report, null, 2))
await browser.close()
if (!report.ok) {
  console.error('FAST_INPUT_FLOW failed')
  process.exit(1)
}
console.log('FAST_INPUT_FLOW passed')
