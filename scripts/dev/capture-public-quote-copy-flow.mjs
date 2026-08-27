/**
 * Evidence for package copy polish, Feijão plaque, additional +/-, and
 * the public fast-input flow.
 *
 *   node scripts/dev/capture-public-quote-copy-flow.mjs \
 *     --url http://127.0.0.1:3068 --out /opt/cursor/artifacts/copy-flow-polish
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import puppeteer from 'puppeteer-core'

const arg = (name, fallback = '') => {
  const i = process.argv.indexOf(name)
  return i >= 0 ? process.argv[i + 1] : fallback
}
const BASE = (arg('--url') || process.env.PUBLIC_LAYOUT_URL || '').replace(/\/$/, '')
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
  number: '13801',
  city: 'Orlando',
  region: 'FL',
  postalCode: '32827',
  country: 'US',
  formattedAddress: '13801 Lake Nona Boulevard, Orlando, FL 32827, US',
  source: 'manual',
}

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    `--user-data-dir=/tmp/chrome-copy-flow-${Date.now()}`,
  ],
})

async function seed(page, locale, step, event = {}) {
  for (let i = 0; i < 4; i += 1) {
    try {
      await page.evaluate(
        async (address, currentStep, loc, eventPatch) => {
          const tail = String(Math.floor(Math.random() * 9000) + 1000)
          await fetch('/api/public/quote-intake/session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({ companySlug: 'cdl', locale: loc, website: '' }),
          })
          await fetch('/api/public/quote-intake/session', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({
              website: '',
              currentStep,
              draft: {
                locale: loc,
                contact: {
                  firstName: 'Copy',
                  lastName: 'Flow',
                  phone: `+1407555${tail}`,
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
          sessionStorage.setItem('public-quote-active:cdl', '1')
        },
        ADDR,
        step,
        locale,
        event,
      )
      await page.reload({ waitUntil: 'domcontentloaded' })
      await page.waitForSelector('[data-public-wizard-theme="light-locked"]', {
        timeout: 30_000,
      })
      return true
    } catch {
      await wait(2500)
      await page.goto(`${BASE}/quote/cdl/${locale}`, {
        waitUntil: 'domcontentloaded',
      })
    }
  }
  return false
}

async function openLocale(page, locale, w, h) {
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 2 })
  await page.goto(`${BASE}/quote/cdl/${locale}`, {
    waitUntil: 'domcontentloaded',
    timeout: 90_000,
  })
  await page
    .waitForSelector('[data-public-landing], [data-public-quote-shell]', {
      timeout: 30_000,
    })
    .catch(() => {})
}

async function reachStep(page, locale, w, h, step, event) {
  await openLocale(page, locale, w, h)
  const ok = await seed(page, locale, step, event)
  if (!ok) throw new Error(`seed failed ${locale} step ${step}`)
}

const page = await browser.newPage()
await page.setUserAgent(
  `Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1 CaptureFlow/${Date.now()}`,
)
const report = {}

await reachStep(page, 'pt', 390, 844, 2)
await page.waitForSelector('[data-package-sides-editorial]', { timeout: 45_000 })
await wait(500)
const editorial = await page.$('[data-package-sides-editorial]')
await editorial.screenshot({
  path: join(OUT, 'package-editorial-pt-390.jpg'),
  type: 'jpeg',
  quality: 92,
})
report.included = await page.$eval('[data-package-included-items]', (n) => ({
  text: n.textContent.trim(),
  color: getComputedStyle(n).color,
  background: getComputedStyle(n).backgroundColor,
}))
report.fixed = await page.$eval('[data-package-sides-items]', (n) => ({
  text: n.textContent.trim(),
  color: getComputedStyle(n).color,
}))
report.choice = await page.$eval('[data-package-sides-choice]', (n) => ({
  text: n.textContent.trim(),
  lead: n.querySelector('.public-package-editorial-choice-lead')?.textContent.trim(),
  options: n.querySelector('.public-package-editorial-choice-options')?.textContent.trim(),
}))
report.upsell = await page.$eval('[data-package-sides-upsell]', (n) => n.textContent.trim())

if (!/Chimichurri|Farofa/.test(report.included.text)) {
  throw new Error(`included missing ${report.included.text}`)
}
if (report.included.background !== 'rgba(0, 0, 0, 0)' && report.included.background !== 'transparent') {
  throw new Error(`included has highlight ${report.included.background}`)
}
if (!/Arroz|Feij/.test(report.fixed.text)) {
  throw new Error(`fixed sides missing ${report.fixed.text}`)
}
if (/Farofa/i.test(report.fixed.text)) {
  throw new Error(`Farofa duplicated in plus ${report.fixed.text}`)
}
if (!/Vinagrete|César|Cesar/i.test(report.choice.text)) {
  throw new Error(`choice missing ${report.choice.text}`)
}

await page.evaluate(() => {
  const toggle = document.querySelector('[data-package-group="with_sides"]')
  if (toggle && toggle.getAttribute('aria-expanded') !== 'true') toggle.click()
})
await page.waitForSelector('[data-package-key="BBQPERS+"]', { timeout: 25_000 })
await page.evaluate(() => {
  document.querySelector('[data-package-key="BBQPERS+"]')?.scrollIntoView({ block: 'center' })
})
await wait(1200)
const card = await page.$('[data-package-key="BBQPERS+"]')
await card.screenshot({
  path: join(OUT, 'custom-plus-pt-390.jpg'),
  type: 'jpeg',
  quality: 92,
})

await reachStep(page, 'en', 390, 844, 2)
await page.waitForSelector('[data-package-sides-choice]', { timeout: 30_000 })
report.choiceEn = await page.$eval('[data-package-sides-choice]', (n) => n.textContent.trim())
if (!/Choose 1 option/i.test(report.choiceEn)) throw new Error(report.choiceEn)
await (await page.$('[data-package-sides-editorial]')).screenshot({
  path: join(OUT, 'package-editorial-en-390.jpg'),
  type: 'jpeg',
  quality: 90,
})

await reachStep(page, 'es', 390, 844, 2)
await page.waitForSelector('[data-package-sides-choice]', { timeout: 30_000 })
report.choiceEs = await page.$eval('[data-package-sides-choice]', (n) => n.textContent.trim())
if (!/Elige 1 opción/i.test(report.choiceEs)) throw new Error(report.choiceEs)

await reachStep(page, 'pt', 390, 844, 2)
await page.waitForSelector('[data-package-group="with_sides"]', { timeout: 45_000 })
await page.evaluate(() => {
  const toggle = document.querySelector('[data-package-group="with_sides"]')
  if (toggle && toggle.getAttribute('aria-expanded') !== 'true') toggle.click()
})
await page.waitForSelector('[data-package-key="BBQPERS+"]', { timeout: 25_000 })
await page.evaluate(() => {
  document.querySelector('[data-package-key="BBQPERS+"]')?.click()
})
await wait(1400)
for (let round = 0; round < 8; round += 1) {
  const remaining = await page.evaluate(() => {
    const groups = [...document.querySelectorAll('[data-package-option-group]')]
    let open = 0
    for (const group of groups) {
      const chips = [...group.querySelectorAll('button[type="button"]')]
      const chosen = chips.find((c) => c.getAttribute('aria-pressed') === 'true')
      if (chosen) continue
      open += 1
      chips[0]?.click()
    }
    return open
  })
  if (!remaining) break
  await wait(400)
}
await page.evaluate(() => {
  const nav = document.querySelector('[data-wizard-step-nav]')
  const buttons = [...(nav?.querySelectorAll('button') ?? [])]
  const next = buttons.filter((b) => !b.disabled && b.textContent.trim()).pop()
  next?.click()
})
await page.waitForSelector('[data-additional-item-card], .public-additional-qty', {
  timeout: 45_000,
})
const qty = await page.evaluate(() => {
  const btn = document.querySelector('.public-additional-qty-btn.is-plus')
  if (!btn) return null
  btn.scrollIntoView({ block: 'center' })
  const styles = getComputedStyle(btn)
  const minus = document.querySelector('.public-additional-qty-btn.is-minus')
  const minusStyles = minus ? getComputedStyle(minus) : null
  return {
    plusBg: styles.backgroundColor,
    plusColor: styles.color,
    plusW: btn.getBoundingClientRect().width,
    plusH: btn.getBoundingClientRect().height,
    minusDisabled: minus?.disabled ?? null,
    minusOpacity: minusStyles?.opacity,
    minusBg: minusStyles?.backgroundColor,
  }
})
if (!qty) throw new Error('qty buttons missing')
if (qty.plusW < 47 || qty.plusH < 47) throw new Error(`touch target ${qty.plusW}x${qty.plusH}`)
if (Number(qty.minusOpacity) < 0.9) throw new Error(`minus faded ${qty.minusOpacity}`)
const qtyCard = await page.$('.public-additional-qty')
if (qtyCard) {
  await qtyCard.evaluate((n) => n.scrollIntoView({ block: 'center' }))
  await wait(300)
  await qtyCard.screenshot({
    path: join(OUT, 'additional-qty-pt-390.jpg'),
    type: 'jpeg',
    quality: 92,
  })
}
report.qty = qty

await reachStep(page, 'pt', 390, 844, 0)
await page.waitForSelector('input[autocomplete="given-name"]', { timeout: 30_000 })
report.phone = await page.$eval('input[type="tel"]', (n) => ({
  type: n.type,
  inputMode: n.inputMode,
  autocomplete: n.autocomplete,
}))
if (report.phone.type !== 'tel' || report.phone.inputMode !== 'tel') {
  throw new Error(JSON.stringify(report.phone))
}
await page.screenshot({
  path: join(OUT, 'customer-step-pt-390.jpg'),
  type: 'jpeg',
  quality: 88,
})

await reachStep(page, 'pt', 390, 844, 1, {
  eventDate: '',
  startTime: '',
  endTime: '',
  adultCount: 0,
})
await page.waitForSelector('[data-wizard-datepicker-panel], button[aria-haspopup="dialog"]', {
  timeout: 30_000,
})
report.adults = await page.evaluate(() => {
  const labels = [...document.querySelectorAll('label')]
  const adults = labels.find((l) => /Adultos/i.test(l.textContent || ''))
  const input = adults?.querySelector('input')
  return input
    ? { inputMode: input.inputMode, pattern: input.getAttribute('pattern') }
    : null
})
const number = await page.evaluate(() => {
  const input = document.querySelector('input[inputmode="numeric"][enterkeyhint="next"]')
  return input
    ? { inputMode: input.inputMode, pattern: input.getAttribute('pattern') }
    : null
})
report.streetNumber = number
await page.screenshot({
  path: join(OUT, 'event-step-pt-390.jpg'),
  type: 'jpeg',
  quality: 88,
})

await page.setViewport({ width: 430, height: 932, deviceScaleFactor: 2 })
await page.screenshot({
  path: join(OUT, 'event-step-pt-430.jpg'),
  type: 'jpeg',
  quality: 88,
})

writeFileSync(join(OUT, 'report.json'), JSON.stringify(report, null, 2))
await browser.close()
console.log(`wrote ${OUT}`)
console.log(JSON.stringify(report, null, 2))
