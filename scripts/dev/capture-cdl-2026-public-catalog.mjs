/**
 * Public extras QA against the official DEV alias after CDL 2026 sync.
 *
 *   node scripts/dev/capture-cdl-2026-public-catalog.mjs \
 *     https://catering-ai-agenda-dev.vercel.app \
 *     /tmp/cdl-2026-sync/public-qa
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import puppeteer from 'puppeteer-core'

const BASE = process.argv[2] ?? 'https://catering-ai-agenda-dev.vercel.app'
const OUT = process.argv[3] ?? '/tmp/cdl-2026-sync/public-qa'
const CHROME = process.env.CHROME_PATH || '/usr/bin/google-chrome-stable'

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

const WANT_ORDER = [
  'SUGGESTED_EXTRAS',
  'BOVINO_NOBRE',
  'BOVINO_TRADICIONAL',
  'PORCO',
  'CORDEIRO',
  'FRANGO',
  'LINGUICAS',
  'FRUTOS_DO_MAR',
  'LEGUMES_E_VEGETAIS',
  'FRUTAS',
  'ACOMPANHAMENTOS',
  'GUARNICOES',
]
const WANT_SIDES = [
  'SALPICÃO DE FRANGO',
  'FEIJÃO PRETO',
  'MAIONESE',
  'VINAGRETE',
  'ARROZ BRANCO',
  'FAROFA TEMPERADA',
  'MANDIOCA COZIDA',
  'SALADA CÉSAR',
  'PURÊ DE BATATA',
]

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

async function seed() {
  await page.goto(`${BASE}/quote/cdl/pt`, { waitUntil: 'networkidle2', timeout: 90_000 })
  await page.evaluate(async (address) => {
    const tail = String(Math.floor(Math.random() * 9000) + 1000)
    await fetch('/api/public/quote-intake/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ companySlug: 'cdl', locale: 'pt', website: '' }),
    })
    await fetch('/api/public/quote-intake/session', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({
        website: '',
        currentStep: 2,
        draft: {
          locale: 'pt',
          contact: {
            firstName: 'CDL2026',
            lastName: 'CatalogQA',
            phone: `+1407555${tail}`,
          },
          event: {
            eventName: 'CDL 2026 catalog QA',
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
  }, ADDR)
  await page.reload({ waitUntil: 'networkidle2' })
  await page.waitForSelector('[data-package-group-controls]', { timeout: 45_000 })
}

async function advanceToExtras() {
  await page.evaluate(() => {
    const toggle = document.querySelector('[data-package-group="without_sides"]')
    if (toggle && toggle.getAttribute('aria-expanded') !== 'true') toggle.click()
  })
  await wait(800)
  const picked = await page.evaluate(() => {
    const card =
      document.querySelector('[data-package-key="BBQTRAD"]') ||
      [...document.querySelectorAll('[data-package-key]')].find((node) => {
        const key = node.getAttribute('data-package-key') || ''
        return key.startsWith('BBQ') && !key.includes('+')
      })
    card?.click()
    return card?.getAttribute('data-package-key') || null
  })
  if (!picked) throw new Error('no package card')
  await wait(1200)
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
    await wait(400)
  }
  await wait(600)
  await page.evaluate(() => {
    const nav = document.querySelector('[data-wizard-step-nav]')
    const buttons = [...(nav?.querySelectorAll('button') ?? [])]
    buttons.filter((button) => !button.disabled && button.textContent.trim()).pop()?.click()
  })
  await page.waitForSelector('[id^="additional-category-"]', { timeout: 40_000 })
  return picked
}

await seed()
const selectedPackage = await advanceToExtras()
await wait(800)
await page.screenshot({ path: join(OUT, '01-adicionais-suggested-extras.png'), fullPage: false })

const snapshot = await page.evaluate(() => {
  const sections = [...document.querySelectorAll('[id^="additional-category-"]')].filter(
    (node) => !/^additional-category-(content|summary|sentinel)-/.test(node.id),
  )
  return {
    keys: sections.map((section) => section.getAttribute('data-category-key')),
    labels: sections.map(
      (section) =>
        section.querySelector('.public-additional-category-title, .public-suggested-extras-title')
          ?.textContent?.trim() || '',
    ),
    body: document.body.innerText,
    suggested: [...document.querySelectorAll('[data-suggested-extras] [data-additional-item-card]')].map(
      (card) => ({
        name: card.querySelector('.public-additional-card-name')?.textContent?.trim(),
        price: card.querySelector('.public-additional-card-price-value')?.textContent?.trim(),
      }),
    ),
  }
})

record('SUGGESTED_EXTRAS_FIRST', snapshot.keys[0] === 'SUGGESTED_EXTRAS', snapshot.keys.slice(0, 4).join(' > '))
record(
  'CATEGORY_ORDER',
  WANT_ORDER.every((key, index) => snapshot.keys[index] === key),
  snapshot.keys.join(' > '),
)
record('NO_PEIXES_PUBLIC', !snapshot.keys.includes('PEIXES'))
record('NO_CONDIMENTOS_PUBLIC', !snapshot.keys.includes('CONDIMENTOS'))
record('NO_TROPEIRO', !/FEIJ[AÃ]O TROPEIRO/i.test(snapshot.body), 'search page text')
record('NO_MUSSARELA', !/MUSSARELA|MOZZARELLA/i.test(snapshot.body))
record('NO_HAMBURGUER', !/HAMB[UÚ]RGUER/i.test(snapshot.body))
record(
  'TOMAHAWK_WAGYU_400',
  snapshot.suggested.some((item) => /TOMAHAWK WAGYU/i.test(item.name || '') && /400/.test(item.price || '')),
  JSON.stringify(snapshot.suggested),
)
record(
  'TOMAHAWK_ANGUS_200',
  snapshot.suggested.some((item) => /TOMAHAWK ANGUS/i.test(item.name || '') && /200/.test(item.price || '')),
  snapshot.suggested.map((item) => `${item.name} ${item.price}`).join(' | '),
)

const guarnicoes = await page.evaluate(() => {
  const section = document.querySelector('[data-category-key="GUARNICOES"]')
  if (!section) return null
  section.querySelector('[data-additional-category-header]')?.click()
  const names = [...section.querySelectorAll('[data-additional-summary-item], .public-additional-card-name')]
    .map((node) => node.textContent?.trim())
    .filter(Boolean)
  return {
    title: section.querySelector('.public-additional-category-title')?.textContent?.trim(),
    names,
    text: section.innerText,
  }
})
await wait(600)
await page.evaluate(() => {
  document.querySelector('[data-category-key="GUARNICOES"]')?.scrollIntoView({ block: 'start' })
})
await wait(400)
await page.screenshot({ path: join(OUT, '02-guarnicoes.png'), fullPage: false })

const sideNames = (guarnicoes?.names || [])
  .map((name) => name.replace(/\s+\$[\d.,]+.*$/, '').trim())
  .filter((name) => /ARROZ|FEIJ|SALPIC|VINAG|MAION|SALADA|FAROFA|MANDIOCA|PUR/i.test(name))
const sideText = guarnicoes?.text || ''
const hasAllSides = WANT_SIDES.every((name) => sideText.includes(name))
const allUpper = WANT_SIDES.every((name) => name === name.toUpperCase()) && hasAllSides
record('GUARNICOES_PRESENT', Boolean(guarnicoes), `${guarnicoes?.title || 'section'} package=${selectedPackage}`)
record('GUARNICOES_EXACT_APPLICABLE', hasAllSides, WANT_SIDES.filter((name) => !sideText.includes(name)).join(',') || 'all nine')
record('GUARNICOES_UPPERCASE', allUpper && !/[a-z]/.test(WANT_SIDES.join('')), sideText.match(/[A-ZÁÉÍÓÚÂÊÔÃÕÇ ]{4,}/g)?.slice(0, 12).join(' | '))
record('GUARNICOES_NO_TROPEIRO', !/TROPEIRO/i.test(guarnicoes?.text || ''))
record(
  'GUARNICOES_HAS_PURE',
  /PUR[EÊ] DE BATATA/i.test(guarnicoes?.text || ''),
  guarnicoes?.text?.slice(0, 400),
)

writeFileSync(
  join(OUT, 'report.json'),
  JSON.stringify({ snapshot, guarnicoes, sideNames, results, wantSides: WANT_SIDES }, null, 2),
)
await page.screenshot({ path: join(OUT, '03-adicionais-full.png'), fullPage: true })
await browser.close()

const failed = results.filter((row) => !row.pass).length
console.log(`wrote ${OUT}`)
console.log(failed === 0 ? 'PUBLIC_QA PASS' : `PUBLIC_QA ${failed} FAIL`)
process.exit(failed === 0 ? 0 : 1)
