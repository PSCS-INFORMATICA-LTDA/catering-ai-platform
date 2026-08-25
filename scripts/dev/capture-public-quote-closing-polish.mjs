/**
 * Closing-polish screenshots: experience title, rebuilt plus art, extras hint.
 *
 *   node scripts/dev/capture-public-quote-closing-polish.mjs \
 *     --url http://127.0.0.1:3078 --out /opt/cursor/artifacts/closing-polish
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import puppeteer from 'puppeteer-core'

const arg = (name, fallback = '') => {
  const i = process.argv.indexOf(name)
  return i >= 0 ? process.argv[i + 1] : fallback
}
const BASE = (arg('--url') || '').replace(/\/$/, '')
const OUT = arg('--out', '/opt/cursor/artifacts/closing-polish')
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
    `--user-data-dir=/tmp/chrome-closing-polish-${Date.now()}`,
  ],
})
const page = await browser.newPage()
await page.setUserAgent(
  `Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1 ClosingPolish/${Date.now()}`,
)

const report = { ok: true, checks: [] }
function record(name, pass, extra = {}) {
  report.checks.push({ name, pass, ...extra })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}`, extra)
  if (!pass) report.ok = false
}

async function seed(locale, step) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await page.goto(`${BASE}/quote/cdl/${locale}`, {
      waitUntil: 'domcontentloaded',
      timeout: 90_000,
    })
    await page
      .waitForSelector('[data-public-landing], [data-public-quote-shell]', {
        timeout: 30_000,
      })
      .catch(() => {})
    const seeded = await page.evaluate(
      async (address, currentStep, loc) => {
        const tail = String(Math.floor(Math.random() * 9000) + 1000)
        const post = await fetch('/api/public/quote-intake/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ companySlug: 'cdl', locale: loc, website: '' }),
        })
        if (!post.ok) return { ok: false, status: post.status }
        const patch = await fetch('/api/public/quote-intake/session', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({
            website: '',
            currentStep,
            draft: {
              locale: loc,
              contact: {
                firstName: 'Close',
                lastName: 'Polish',
                phone: `+1407555${tail}`,
              },
              event: {
                eventName: 'Closing polish',
                eventDate: '2026-11-14',
                startTime: '18:00',
                endTime: '22:00',
                adultCount: 25,
                address,
              },
            },
          }),
        })
        if (!patch.ok) return { ok: false, status: patch.status }
        sessionStorage.setItem('public-quote-active:cdl', '1')
        return { ok: true }
      },
      ADDR,
      step,
      locale,
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

async function shot(name) {
  await page.screenshot({
    path: join(OUT, `${name}.jpg`),
    type: 'jpeg',
    quality: 88,
  })
}

for (const [w, h] of [
  [390, 844],
  [430, 932],
]) {
  await page.setViewport({
    width: w,
    height: h,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  })
  await seed('pt', 2)
  await page.waitForSelector('[data-package-experience-title]', { timeout: 45_000 })
  await wait(500)
  const title = await page.$eval('[data-package-experience-title]', (n) => {
    const css = getComputedStyle(n)
    const bar = getComputedStyle(n, '::before')
    return {
      text: n.textContent.trim(),
      color: css.color,
      weight: css.fontWeight,
      bar: bar.backgroundColor || bar.backgroundImage,
      display: bar.content,
    }
  })
  record(
    `PACKAGE_EXPERIENCE_TITLE_${w}`,
    /experi[eê]ncia/i.test(title.text) && Number(title.weight) >= 700,
    title,
  )
  const intro = await page.$('[data-package-experience-intro]')
  await intro.screenshot({
    path: join(OUT, `package-experience-title-pt-${w}.jpg`),
    type: 'jpeg',
    quality: 90,
  })
  await shot(`package-step-pt-${w}`)

  await page.evaluate(() => {
    const toggle = document.querySelector('[data-package-group="with_sides"]')
    if (toggle && toggle.getAttribute('aria-expanded') !== 'true') toggle.click()
  })
  await page.waitForSelector('[data-package-key="BBQPERS+"]', { timeout: 25_000 })
  await page.evaluate(() => {
    document
      .querySelector('[data-package-key="BBQPERS+"]')
      ?.scrollIntoView({ block: 'center' })
  })
  await wait(1400)
  const card = await page.$('[data-package-key="BBQPERS+"]')
  await card.screenshot({
    path: join(OUT, `custom-plus-card-pt-${w}.jpg`),
    type: 'jpeg',
    quality: 90,
  })
  const art = await page.$eval('[data-package-key="BBQPERS+"] img', (img) => img.src)
  record(`CUSTOM_PLUS_ART_${w}`, /bbqpers-plus-pt-v7\.webp/.test(art), { art })

  await page.evaluate(() => {
    document.querySelector('[data-package-key="BBQPERS+"]')?.click()
  })
  await wait(800)
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
    await wait(350)
  }
  await wait(400)
  const advanced = await page.evaluate(() => {
    const nav = document.querySelector('[data-wizard-step-nav]')
    const buttons = [...(nav?.querySelectorAll('button') ?? [])]
    const next = buttons.filter((b) => !b.disabled && b.textContent.trim()).pop()
    next?.click()
    return Boolean(next)
  })
  if (!advanced) throw new Error('could not advance to extras')
  await page.waitForSelector('[data-suggested-extras-title-band]', { timeout: 40_000 })
  await page.waitForSelector('[data-post-suggested-category-hint]', { timeout: 20_000 })
  await wait(400)
  const extras = await page.$('[data-suggested-extras]')
  if (extras) {
    await extras.screenshot({
      path: join(OUT, `extras-sugeridos-pt-${w}.jpg`),
      type: 'jpeg',
      quality: 90,
    })
  }
  await page.evaluate(() => {
    document
      .querySelector('[data-post-suggested-category-hint]')
      ?.scrollIntoView({ block: 'center' })
  })
  await wait(250)
  const hint = await page.$('[data-post-suggested-category-hint]')
  await hint.screenshot({
    path: join(OUT, `category-hint-pt-${w}.jpg`),
    type: 'jpeg',
    quality: 90,
  })
  await shot(`extras-hint-context-pt-${w}`)
  const hintCopy = await page.$eval('[data-post-suggested-category-hint]', (n) =>
    n.textContent.replace(/\s+/g, ' ').trim(),
  )
  record(
    `CATEGORY_HINT_PT_${w}`,
    /Explore mais opções/i.test(hintCopy) && /categoria/i.test(hintCopy),
    { hintCopy },
  )
}

await page.setViewport({
  width: 390,
  height: 844,
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
})
await seed('en', 2)
await page.waitForSelector('[data-package-experience-title]', { timeout: 45_000 })
const enTitle = await page.$eval('[data-package-experience-title]', (n) =>
  n.textContent.trim(),
)
record('PACKAGE_EXPERIENCE_TITLE_EN', /experience/i.test(enTitle), { enTitle })
const enIntro = await page.$('[data-package-experience-intro]')
await enIntro.screenshot({
  path: join(OUT, 'package-experience-title-en-390.jpg'),
  type: 'jpeg',
  quality: 90,
})

writeFileSync(join(OUT, 'closing-polish-report.json'), JSON.stringify(report, null, 2))
await browser.close()
if (!report.ok) {
  console.error('CLOSING_POLISH failed')
  process.exit(1)
}
console.log('CLOSING_POLISH passed')
