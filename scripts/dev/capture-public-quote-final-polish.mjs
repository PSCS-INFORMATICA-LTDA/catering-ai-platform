/**
 * Final micro-polish screenshots: extras tag, photo hint/lightbox, packages.
 *
 *   node scripts/dev/capture-public-quote-final-polish.mjs \
 *     --url http://127.0.0.1:3080 --out /opt/cursor/artifacts/final-polish
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import puppeteer from 'puppeteer-core'

const arg = (name, fallback = '') => {
  const i = process.argv.indexOf(name)
  return i >= 0 ? process.argv[i + 1] : fallback
}
const BASE = (arg('--url') || '').replace(/\/$/, '')
const OUT = arg('--out', '/opt/cursor/artifacts/final-polish')
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
    `--user-data-dir=/tmp/chrome-final-polish-${Date.now()}`,
  ],
})
const page = await browser.newPage()
await page.setUserAgent(
  `Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1 FinalPolish/${Date.now()}`,
)
await page.setViewport({
  width: 390,
  height: 844,
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
})

const report = { ok: true, steps: [] }
function record(name, data) {
  report.steps.push({ name, ...data })
  console.log(name, JSON.stringify(data))
}

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
                firstName: contactPatch.firstName ?? 'Final',
                lastName: contactPatch.lastName ?? 'Polish',
                phone: contactPatch.phone ?? `+1407555${tail}`,
              },
              event: {
                eventName: 'Final polish',
                eventDate: eventPatch.eventDate ?? '2026-11-21',
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
    if (seeded.ok) {
      await page.reload({ waitUntil: 'domcontentloaded' })
      await page.waitForSelector('[data-public-wizard-theme="light-locked"]', {
        timeout: 20_000,
      })
      return
    }
    if (seeded.status === 429) {
      await wait(2500)
      continue
    }
    throw new Error(`seed failed ${JSON.stringify(seeded)}`)
  }
  throw new Error('seed failed after retries')
}

await seed(2)
await wait(1200)
const plus = await page.$('[data-package-key="BBQPERS+"]')
if (plus) {
  await plus.evaluate((el) => el.scrollIntoView({ block: 'center' }))
  await wait(800)
  await plus.screenshot({ path: join(OUT, 'custom-plus-card-pt.jpg'), type: 'jpeg', quality: 90 })
  const art = await page.$eval('[data-package-key="BBQPERS+"] img', (img) => img.src)
  record('CUSTOM_PLUS_ART', /bbqpers-plus-pt-v8\.webp/.test(art), { art })
} else {
  record('CUSTOM_PLUS_ART', false, { missing: true })
  report.ok = false
}

for (const key of ['BBQTRAD', 'BBQSEL', 'BBQCHO', 'BBQPRI', 'BBQPERS']) {
  const card = await page.$(`[data-package-key="${key}"]`)
  if (!card) continue
  await card.evaluate((el) => el.scrollIntoView({ block: 'center' }))
  await wait(400)
  await card.screenshot({
    path: join(OUT, `without-sides-${key.toLowerCase()}-pt.jpg`),
    type: 'jpeg',
    quality: 88,
  })
}

await page.evaluate(() => {
  const toggle = document.querySelector('[data-package-group="with_sides"]')
  if (toggle && toggle.getAttribute('aria-expanded') !== 'true') toggle.click()
})
await wait(400)
const plusCard = await page.$('[data-package-key="BBQPERS+"]')
if (plusCard) await plusCard.click()
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
await page.evaluate(() => {
  const nav = document.querySelector('[data-wizard-step-nav]')
  const buttons = [...(nav?.querySelectorAll('button') ?? [])]
  buttons.filter((b) => !b.disabled && b.textContent.trim()).pop()?.click()
})
await page.waitForSelector('[data-suggested-extras-title-band]', { timeout: 40_000 })
await wait(600)
const extras = await page.$('[data-suggested-extras]')
if (extras) {
  await extras.evaluate((el) => el.scrollIntoView({ block: 'start' }))
  await wait(400)
  await extras.screenshot({
    path: join(OUT, 'extras-sugeridos-390.jpg'),
    type: 'jpeg',
    quality: 90,
  })
}
const tag = await page.evaluate(() => {
  const mark = document.querySelector('[data-suggested-extras-title-tag]')
  const band = document.querySelector('[data-suggested-extras-title-band]')
  if (!mark || !band) return { present: false }
  const markR = mark.getBoundingClientRect()
  const bandR = band.getBoundingClientRect()
  return {
    present: true,
    markW: Math.round(markR.width),
    bandW: Math.round(bandR.width),
    shortTag: markR.width < bandR.width * 0.92,
    text: mark.textContent?.trim(),
  }
})
record('SUGGESTED_EXTRAS_RED_TEXT_TAG', tag)
if (!tag.shortTag) report.ok = false

const hint = await page.$('[data-photo-enlarge-hint]')
if (hint) {
  await hint.evaluate((el) => el.scrollIntoView({ block: 'center' }))
  await wait(200)
  await hint.screenshot({
    path: join(OUT, 'photo-enlarge-hint-pt.jpg'),
    type: 'jpeg',
    quality: 90,
  })
  const text = await hint.evaluate((el) => el.textContent?.trim())
  record('PHOTO_ENLARGE_HINT_PT', /Toque e segure/.test(text || ''), { text })
} else {
  record('PHOTO_ENLARGE_HINT_PT', false)
  report.ok = false
}

const photo = await page.$('[data-additional-photo]')
if (photo) {
  await photo.evaluate((el) => el.scrollIntoView({ block: 'center' }))
  await wait(200)
  await photo.evaluate((el) => {
    const r = el.getBoundingClientRect()
    const x = r.left + r.width / 2
    const y = r.top + r.height / 2
    const opts = { pointerType: 'mouse', button: 0, clientX: x, clientY: y, bubbles: true }
    el.dispatchEvent(new PointerEvent('pointerdown', opts))
    el.dispatchEvent(new PointerEvent('pointerup', opts))
  })
  await wait(400)
  const open = await page.$('[data-additional-photo-lightbox]')
  record('PHOTO_PREVIEW_CLICK', Boolean(open))
  if (open) {
    await page.screenshot({
      path: join(OUT, 'photo-lightbox-open.jpg'),
      type: 'jpeg',
      quality: 90,
    })
    await page.keyboard.press('Escape')
    await wait(200)
  } else {
    report.ok = false
  }
}

writeFileSync(join(OUT, 'report.json'), JSON.stringify(report, null, 2))
await browser.close()
if (!report.ok) process.exit(1)
console.log('ok', OUT)
