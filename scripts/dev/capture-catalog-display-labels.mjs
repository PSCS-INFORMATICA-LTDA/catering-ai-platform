/**
 * Local QA screenshots for editorial catalog display labels.
 * Usage: node scripts/dev/capture-catalog-display-labels.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import puppeteer from 'puppeteer-core'

const BASE = process.argv[2] ?? 'http://127.0.0.1:3100'
const OUT = process.argv[3] ?? '/opt/cursor/artifacts'
const CHROME = process.env.CHROME_PATH || '/usr/bin/google-chrome-stable'
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

const GRILL = {
  setupAnswered: true,
  hasGrill: false,
  photoReference: null,
  rentalRequired: true,
  rentalQty: 1,
  notes: null,
}
const extrasDraft = {
  grill: GRILL,
  selection: {
    packageId: 'b8808ff7-f16e-40ec-8eae-0fe62c03cc23',
    packageSelections: {
      'd906beb8-d43d-4173-b4ee-6b522541aea5': '57b6bd69-59ab-4f94-b7a0-6dead64fdbf5',
      'a43a7e3f-5b96-47f3-9811-b485e9af5dd6': 'afbb3c34-746c-47f5-9449-f8f248008f49',
      'dc6d524b-2413-4ead-92a7-b06bd5ea234d': '8caceedf-de36-4d75-9f57-2bd40206ca25',
    },
    additionals: [],
    reviewedCategoryKeys: [],
  },
}

mkdirSync(OUT, { recursive: true })

const browser = await puppeteer.launch({
  headless: 'new',
  executablePath: CHROME,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--font-render-hinting=none'],
})

const notes = []
function record(name, pass, note = '') {
  notes.push({ name, pass, note })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${note ? ` — ${note}` : ''}`)
}

async function seed(page, locale, step, extraDraft = {}) {
  await page.setUserAgent(
    `Mozilla/5.0 CatalogLabelQA/${Date.now()}/${Math.random().toString(16).slice(2)}`,
  )
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      await page.evaluate(
        async (address, currentStep, loc, extra) => {
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
                  firstName: 'Label',
                  lastName: 'QA',
                  phone: `+1407555${tail}`,
                },
                event: {
                  eventName: 'Catalog label QA',
                  eventDate: '2026-11-14',
                  startTime: '18:00',
                  endTime: '22:00',
                  adultCount: 25,
                  address,
                },
                ...extra,
              },
            }),
          })
          sessionStorage.setItem('public-quote-active:cdl', '1')
        },
        ADDR,
        step,
        locale,
        extraDraft,
      )
      await page.reload({ waitUntil: 'networkidle2' })
      return true
    } catch (error) {
      notes.push({ name: 'SEED_RETRY', pass: false, note: String(error) })
      await wait(1500)
    }
  }
  return false
}

async function pickPackage(page, preferredKeys = ['BBQCHO', 'BBQLUX', 'BBQPRI']) {
  await page.evaluate(() => {
    const toggle = document.querySelector('[data-package-group]')
    if (toggle && toggle.getAttribute('aria-expanded') !== 'true') toggle.click()
  })
  await wait(800)
  return page.evaluate((keys) => {
    const cards = [...document.querySelectorAll('[data-package-key]')]
    const preferred = keys
      .map((key) => cards.find((card) => card.getAttribute('data-package-key') === key))
      .find(Boolean)
    const card = preferred || cards[0]
    if (!card) return null
    card.click()
    return card.getAttribute('data-package-key')
  }, preferredKeys)
}

async function optionChipTexts(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll('[data-package-option-group] button, [data-package-option-group] [role="button"]')]
      .map((node) => (node.textContent || '').replace(/\s+/g, ' ').trim())
      .filter(Boolean),
  )
}

async function extraNameTexts(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll('.public-additional-card-name, .public-suggested-extras-item-name')]
      .map((node) => ({
        text: (node.textContent || '').replace(/\s+/g, ' ').trim(),
        featured: Boolean(node.closest('.public-additional-category.is-featured')),
        transform: getComputedStyle(node).textTransform,
      }))
      .filter((row) => row.text),
  )
}

const page = await browser.newPage()
await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 2 })

await page.goto(`${BASE}/quote/cdl/pt`, { waitUntil: 'networkidle2', timeout: 90_000 })
const seeded = await seed(page, 'pt', 3, extrasDraft)
record('SEED_PT', seeded)
await page.waitForSelector('[data-package-key]', { timeout: 45_000 }).catch(() => null)
await wait(800)

const packageKey = seeded ? await pickPackage(page) : null
record('PACKAGE_PICKED', Boolean(packageKey), packageKey || 'none')
await wait(1600)

for (let round = 0; round < 8; round += 1) {
  const remaining = await page.evaluate(() => {
    const groups = [...document.querySelectorAll('[data-package-option-group]')]
    let open = 0
    for (const group of groups) {
      const chips = [...group.querySelectorAll('button[type="button"]')]
      if (chips.some((chip) => chip.getAttribute('aria-pressed') === 'true')) continue
      open += 1
      if (chips[0]) chips[0].click()
    }
    return open
  })
  if (!remaining) break
  await wait(400)
}

const chips = await optionChipTexts(page)
record(
  'OPTION_COSTELA_PORCO',
  chips.some((text) => text.includes('Costela de Porco')),
  chips.filter((text) => /costela|vieira|bacon/i.test(text)).join(' | '),
)
record(
  'OPTION_COSTELA_BOVINA_ANGUS',
  chips.some((text) => text.includes('Costela Bovina (ANGUS)')),
)

const optionShot = join(OUT, 'qa-catalog-labels-options-pt.png')
await page.screenshot({ path: optionShot, fullPage: false })

const advanced = await page.evaluate(() => {
  const nav = document.querySelector('[data-wizard-step-nav]')
  const buttons = [...(nav?.querySelectorAll('button') ?? [])]
  const next = buttons.filter((button) => !button.disabled && button.textContent.trim()).pop()
  if (!next) return false
  next.click()
  return true
})
record('ADVANCE_EXTRAS', advanced)
if (advanced) {
  await page.waitForSelector('[id^="additional-category-"], .public-additional-card-name', {
    timeout: 40_000,
  }).catch(() => null)
  await wait(1500)
  await page.evaluate(() => {
    document.querySelector('.public-additional-category.is-featured')?.scrollIntoView({ block: 'start' })
  })
  await wait(400)
}

const extras = advanced ? await extraNameTexts(page) : []
record(
  'SUGGESTED_EXTRAS_UPPERCASE_CSS',
  extras.some((row) => row.featured && row.transform === 'uppercase'),
  extras
    .filter((row) => row.featured)
    .map((row) => `${row.text} [${row.transform}]`)
    .join(' | '),
)
record(
  'PICANHA_WAGYU',
  extras.some((row) => row.text.includes('Picanha (WAGYU)')),
)
record(
  'T_BONE',
  extras.some((row) => /T-Bone/i.test(row.text)),
)
record(
  'PIMENTA_DE_BICO',
  extras.some((row) => row.text.includes('Pimenta de Bico') || row.text.includes('PIMENTA DE BICO')),
)

const extrasShot = join(OUT, 'qa-catalog-labels-extras-pt.png')
await page.screenshot({ path: extrasShot, fullPage: true })

await page.goto(`${BASE}/quote/cdl/en`, { waitUntil: 'networkidle2', timeout: 90_000 })
const seededEn = await seed(page, 'en', 4, extrasDraft)
record('SEED_EN', seededEn)
await wait(1500)
const extrasEn = await extraNameTexts(page)
record(
  'EN_EDITORIAL',
  extrasEn.some((row) => /Picanha \(WAGYU\)|T-Bone|Pepper Jelly|Garlic Bread/i.test(row.text)),
  extrasEn.slice(0, 12).map((row) => row.text).join(' | '),
)
await page.screenshot({ path: join(OUT, 'qa-catalog-labels-extras-en.png'), fullPage: false })

await page.goto(`${BASE}/quote/cdl/es`, { waitUntil: 'networkidle2', timeout: 90_000 })
const seededEs = await seed(page, 'es', 4, extrasDraft)
record('SEED_ES', seededEs)
await wait(1500)
const extrasEs = await extraNameTexts(page)
record(
  'ES_EDITORIAL',
  extrasEs.some((row) => /Picaña \(WAGYU\)|T-Bone|Jalea de Pimienta|Ají/i.test(row.text)),
  extrasEs.slice(0, 12).map((row) => row.text).join(' | '),
)
await page.screenshot({ path: join(OUT, 'qa-catalog-labels-extras-es.png'), fullPage: false })

writeFileSync(join(OUT, 'qa-catalog-labels-notes.json'), JSON.stringify({ chips, extras, extrasEn, extrasEs, notes }, null, 2))
await browser.close()

const failed = notes.filter((row) => !row.pass)
if (failed.length) {
  console.error(`${failed.length} QA checks failed`)
  process.exit(1)
}
console.log('QA capture complete')
