/**
 * Visual QA for the short package title tag + custom-plus logo.
 *
 *   node scripts/dev/capture-package-header-micro-polish.mjs \
 *     --url http://127.0.0.1:3064 --out /opt/cursor/artifacts/package-header-micro
 */
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import puppeteer from 'puppeteer-core'

const arg = (name, fallback = '') => {
  const i = process.argv.indexOf(name)
  return i >= 0 ? process.argv[i + 1] : fallback
}
const BASE = (arg('--url') || process.env.PUBLIC_LAYOUT_URL || '').replace(/\/$/, '')
const OUT = arg('--out', '/opt/cursor/artifacts/package-header-micro')
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
    `--user-data-dir=/tmp/chrome-pkg-header-${Date.now()}`,
  ],
})

async function seed(page, locale, step) {
  for (let i = 0; i < 4; i += 1) {
    try {
      await page.evaluate(
        async (address, currentStep, loc) => {
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
                  firstName: 'Header',
                  lastName: 'Polish',
                  phone: `+1407555${tail}`,
                },
                event: {
                  eventName: 'Header polish',
                  eventDate: '2026-11-14',
                  startTime: '18:00',
                  endTime: '22:00',
                  adultCount: 25,
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

async function reachPackages(page, locale, w, h) {
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 2 })
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await page.goto(`${BASE}/quote/cdl/${locale}`, {
      waitUntil: 'domcontentloaded',
      timeout: 90_000,
    })
    await page
      .waitForSelector('[data-public-landing], [data-public-quote-shell]', {
        timeout: 30_000,
      })
      .catch(() => {})
    await seed(page, locale, 2)
    try {
      await page.waitForSelector('[data-package-experience-intro]', {
        timeout: 45_000,
      })
      return
    } catch {
      await wait(2000)
    }
  }
  throw new Error(`package step not reached for ${locale} ${w}`)
}

const page = await browser.newPage()
const shots = []

for (const [w, h] of [
  [390, 844],
  [430, 932],
]) {
  await reachPackages(page, 'pt', w, h)
  await wait(600)
  const intro = await page.$('[data-package-experience-intro]')
  await intro.screenshot({ path: join(OUT, `package-intro-pt-${w}.jpg`), type: 'jpeg', quality: 90 })
  await page.screenshot({
    path: join(OUT, `package-step-pt-${w}.jpg`),
    type: 'jpeg',
    quality: 88,
  })
  shots.push(`package-intro-pt-${w}.jpg`)

  const tag = await page.$eval('[data-package-headline-tag]', (n) => ({
    text: n.textContent.trim(),
    width: n.getBoundingClientRect().width,
    parent: n.parentElement.parentElement.getBoundingClientRect().width,
  }))
  if (tag.width > tag.parent * 0.92) {
    throw new Error(`tag still looks full-width at ${w}: ${tag.width}/${tag.parent}`)
  }
  if (tag.text !== 'ESCOLHA SEU PACOTE') {
    throw new Error(`unexpected PT headline ${tag.text}`)
  }
}

await reachPackages(page, 'en', 390, 844)
const en = await page.$eval('[data-package-headline-tag]', (n) => n.textContent.trim())
if (en !== 'CHOOSE YOUR PACKAGE') throw new Error(en)
await page.screenshot({
  path: join(OUT, 'package-intro-en-390.jpg'),
  type: 'jpeg',
  quality: 88,
})
const enIntro = await page.$('[data-package-experience-intro]')
await enIntro.screenshot({ path: join(OUT, 'package-intro-en-390-card.jpg'), type: 'jpeg', quality: 90 })

await reachPackages(page, 'es', 390, 844)
const es = await page.$eval('[data-package-headline-tag]', (n) => n.textContent.trim())
if (es !== 'ELIGE TU PAQUETE') throw new Error(es)
const esIntro = await page.$('[data-package-experience-intro]')
await esIntro.screenshot({ path: join(OUT, 'package-intro-es-390-card.jpg'), type: 'jpeg', quality: 90 })

await reachPackages(page, 'pt', 390, 844)
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
await card.screenshot({ path: join(OUT, 'card-BBQPERS-plus-pt-390.jpg'), type: 'jpeg', quality: 90 })

await page.evaluate(() => {
  const card = document.querySelector('[data-package-key="BBQPERS+"]')
  card?.click()
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
      if (chips[0]) chips[0].click()
    }
    return open
  })
  if (!remaining) break
  await wait(400)
}
await wait(600)
const advanced = await page.evaluate(() => {
  const nav = document.querySelector('[data-wizard-step-nav]')
  const buttons = [...(nav?.querySelectorAll('button') ?? [])]
  const next = buttons.filter((b) => !b.disabled && b.textContent.trim()).pop()
  if (!next) return false
  next.click()
  return true
})
if (!advanced) throw new Error('could not advance to extras')
await page.waitForSelector('[data-suggested-extras-title-band]', { timeout: 40_000 })
await wait(500)
const extras = await page.$('[data-suggested-extras]')
if (extras) {
  await extras.screenshot({ path: join(OUT, 'extras-sugeridos-pt-390.jpg'), type: 'jpeg', quality: 90 })
} else {
  await page.screenshot({
    path: join(OUT, 'extras-sugeridos-pt-390.jpg'),
    type: 'jpeg',
    quality: 88,
  })
}

await browser.close()
console.log(`wrote ${OUT}`)
console.log(shots.join('\n'))
