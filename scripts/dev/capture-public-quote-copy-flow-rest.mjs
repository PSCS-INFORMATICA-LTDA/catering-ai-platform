/**
 * Remaining evidence: extras +/-, customer, event.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import puppeteer from 'puppeteer-core'

const BASE = (process.argv[process.argv.indexOf('--url') + 1] || '').replace(/\/$/, '')
const OUT = process.argv[process.argv.indexOf('--out') + 1] || '/opt/cursor/artifacts/copy-flow-polish'
const CHROME = process.env.CHROME_PATH || '/usr/bin/google-chrome-stable'
mkdirSync(OUT, { recursive: true })
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const ADDR = {
  route: 'Lake Nona Boulevard', number: '13801', city: 'Orlando', region: 'FL',
  postalCode: '32827', country: 'US',
  formattedAddress: '13801 Lake Nona Boulevard, Orlando, FL 32827, US', source: 'manual',
}

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', `--user-data-dir=/tmp/chrome-rest-${Date.now()}`],
})
const page = await browser.newPage()
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 })

async function seed(step, event = {}) {
  await page.goto(`${BASE}/quote/cdl/pt`, { waitUntil: 'domcontentloaded', timeout: 90_000 })
  await page.waitForSelector('[data-public-landing], [data-public-quote-shell]', { timeout: 30_000 }).catch(() => {})
  await page.evaluate(async (address, currentStep, eventPatch) => {
    const tail = String(Math.floor(Math.random() * 9000) + 1000)
    await fetch('/api/public/quote-intake/session', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
      body: JSON.stringify({ companySlug: 'cdl', locale: 'pt', website: '' }),
    })
    await fetch('/api/public/quote-intake/session', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
      body: JSON.stringify({
        website: '', currentStep,
        draft: {
          locale: 'pt',
          contact: { firstName: 'Copy', lastName: 'Flow', phone: `+1407555${tail}` },
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
  }, ADDR, step, event)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForSelector('[data-public-wizard-theme="light-locked"]', { timeout: 30_000 })
}

await seed(2)
await page.waitForSelector('[data-package-group="with_sides"]', { timeout: 45_000 })
await page.evaluate(() => {
  const toggle = document.querySelector('[data-package-group="with_sides"]')
  if (toggle && toggle.getAttribute('aria-expanded') !== 'true') toggle.click()
})
await page.waitForSelector('[data-package-key="BBQPERS+"]', { timeout: 25_000 })
await page.evaluate(() => document.querySelector('[data-package-key="BBQPERS+"]')?.click())
await wait(1600)
for (let round = 0; round < 8; round += 1) {
  const remaining = await page.evaluate(() => {
    let open = 0
    for (const group of document.querySelectorAll('[data-package-option-group]')) {
      const chips = [...group.querySelectorAll('button[type="button"]')]
      if (chips.some((c) => c.getAttribute('aria-pressed') === 'true')) continue
      open += 1
      chips[0]?.click()
    }
    return open
  })
  if (!remaining) break
  await wait(350)
}
await page.evaluate(() => {
  const buttons = [...(document.querySelector('[data-wizard-step-nav]')?.querySelectorAll('button') ?? [])]
  buttons.filter((b) => !b.disabled && b.textContent.trim()).pop()?.click()
})
await page.waitForSelector('.public-additional-qty-btn, [data-additional-item-card]', { timeout: 50_000 })
await wait(600)
const qty = await page.evaluate(() => {
  const plus = document.querySelector('.public-additional-qty-btn.is-plus')
  const minus = document.querySelector('.public-additional-qty-btn.is-minus')
  if (!plus) return null
  plus.scrollIntoView({ block: 'center' })
  const ps = getComputedStyle(plus)
  const ms = minus ? getComputedStyle(minus) : null
  return {
    plusBg: ps.backgroundColor, plusColor: ps.color,
    plusW: plus.getBoundingClientRect().width, plusH: plus.getBoundingClientRect().height,
    minusDisabled: minus?.disabled ?? null, minusOpacity: ms?.opacity, minusBg: ms?.backgroundColor,
  }
})
if (!qty) throw new Error('qty missing')
if (qty.plusW < 47 || qty.plusH < 47) throw new Error(`touch ${qty.plusW}x${qty.plusH}`)
if (Number(qty.minusOpacity) < 0.9) throw new Error(`minus faded ${qty.minusOpacity}`)
const qtyNode = await page.$('.public-additional-qty')
if (qtyNode) {
  await qtyNode.screenshot({ path: join(OUT, 'additional-qty-pt-390.jpg'), type: 'jpeg', quality: 92 })
}
await page.screenshot({ path: join(OUT, 'extras-step-pt-390.jpg'), type: 'jpeg', quality: 82 })

await seed(0)
await page.waitForSelector('input[type="tel"]', { timeout: 30_000 })
const phone = await page.$eval('input[type="tel"]', (n) => ({ type: n.type, inputMode: n.inputMode }))
if (phone.type !== 'tel' || phone.inputMode !== 'tel') throw new Error(JSON.stringify(phone))
await page.screenshot({ path: join(OUT, 'customer-step-pt-390.jpg'), type: 'jpeg', quality: 88 })

await seed(1, { eventDate: '', startTime: '', endTime: '', adultCount: 0 })
await wait(500)
const adults = await page.evaluate(() => {
  const labels = [...document.querySelectorAll('label')]
  const adultsLabel = labels.find((l) => /Adultos/i.test(l.textContent || ''))
  const input = adultsLabel?.querySelector('input')
  return input ? { inputMode: input.inputMode, pattern: input.getAttribute('pattern') } : null
})
const number = await page.evaluate(() => {
  const input = [...document.querySelectorAll('input')].find((n) => n.inputMode === 'numeric' && n.getAttribute('enterkeyhint') === 'next' && n.closest('label')?.textContent?.toLowerCase().includes('n'))
  const fallback = document.querySelector('input[inputmode="numeric"][enterkeyhint="next"]')
  const el = input || fallback
  return el ? { inputMode: el.inputMode, pattern: el.getAttribute('pattern') } : null
})
await page.screenshot({ path: join(OUT, 'event-step-pt-390.jpg'), type: 'jpeg', quality: 88 })
await page.setViewport({ width: 430, height: 932, deviceScaleFactor: 2 })
await page.screenshot({ path: join(OUT, 'event-step-pt-430.jpg'), type: 'jpeg', quality: 88 })

writeFileSync(join(OUT, 'report-rest.json'), JSON.stringify({ qty, phone, adults, number }, null, 2))
await browser.close()
console.log(JSON.stringify({ qty, phone, adults, number }, null, 2))
