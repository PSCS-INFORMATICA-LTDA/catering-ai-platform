/**
 * Runtime QA for the commercial UX change.
 *
 * Walks the public quote in PT, EN and ES, and records what the customer sees
 * on the package and extras steps: the accompaniments/sides explainer, the
 * suggested-extras opening, the category order, the item order inside each
 * category, and every price on both steps. The price readings are the
 * before/after evidence that nothing commercial moved.
 *
 * Usage: node scripts/dev/capture-public-quote-upsell.mjs <base-url> <out-dir>
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import puppeteer from 'puppeteer-core'

const BASE = process.argv[2] ?? 'https://catering-ai-agenda-dev.vercel.app'
const OUT = process.argv[3] ?? '/tmp/upsell-qa'
const CHROME = process.env.CHROME_PATH || '/usr/bin/google-chrome-stable'
const LOCALES = ['pt', 'en', 'es']

mkdirSync(OUT, { recursive: true })
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

const ADDR = {
  route: 'Lake Nona Boulevard', number: '13801', city: 'Orlando', region: 'FL',
  postalCode: '32827', country: 'US',
  formattedAddress: '13801 Lake Nona Boulevard, Orlando, FL 32827, US', source: 'manual',
}

const browser = await puppeteer.launch({
  headless: 'new',
  executablePath: CHROME,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--font-render-hinting=none'],
})

const results = []
const record = (name, pass, note) => {
  results.push({ name, pass, note })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${note ? `  — ${note}` : ''}`)
}

async function seed(page, locale, step) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      await page.evaluate(async (address, currentStep, loc) => {
        const tail = String(Math.floor(Math.random() * 9000) + 1000)
        await fetch('/api/public/quote-intake/session', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ companySlug: 'cdl', locale: loc, website: '' }),
        })
        await fetch('/api/public/quote-intake/session', {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({
            website: '', currentStep,
            draft: {
              locale: loc,
              contact: { firstName: 'Upsell', lastName: 'QA', phone: `+1407555${tail}` },
              event: {
                eventName: 'Upsell QA', eventDate: '2026-11-14',
                startTime: '18:00', endTime: '22:00', adultCount: 25, address,
              },
            },
          }),
        })
        sessionStorage.setItem('public-quote-active:cdl', '1')
      }, ADDR, step, locale)
      await page.reload({ waitUntil: 'networkidle2' })
      await page.waitForSelector('[data-public-wizard-theme="light-locked"]', { timeout: 30_000 })
      return true
    } catch {
      await wait(2500)
      await page.goto(`${BASE}/quote/cdl/${locale}`, { waitUntil: 'networkidle2' })
    }
  }
  return false
}

async function reach(page, locale, step, selector, w, h) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await page.setViewport({ width: w, height: h, deviceScaleFactor: 2 })
    try {
      await page.goto(`${BASE}/quote/cdl/${locale}`, {
        waitUntil: 'networkidle2', timeout: 90_000,
      })
    } catch {
      await wait(4000)
      continue
    }
    // The landing only shows on a fresh session; on a warm one we are already
    // inside the wizard and can seed straight away.
    await page
      .waitForSelector('[data-public-landing]', { timeout: 20_000 })
      .catch(() => {})
    await seed(page, locale, step)
    try {
      await page.waitForSelector(selector, { timeout: 45_000 })
      return true
    } catch {
      await wait(2000)
    }
  }
  return false
}


/** Open a sides group, pick the first package, then advance to extras. */
async function advanceToExtras(page) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await page.evaluate(() => {
        const toggle = document.querySelector('[data-package-group]')
        if (toggle && toggle.getAttribute('aria-expanded') !== 'true') toggle.click()
      })
      await wait(900)
      const picked = await page.evaluate(() => {
        const card = document.querySelector('[data-package-key]')
        if (!card) return null
        card.click()
        return card.getAttribute('data-package-key')
      })
      if (!picked) throw new Error('no package card')
      await wait(1400)

      // Every included-option group must be answered before Next enables.
      for (let round = 0; round < 8; round += 1) {
        const remaining = await page.evaluate(() => {
          const groups = [...document.querySelectorAll('[data-package-option-group]')]
          let open = 0
          for (const group of groups) {
            const chips = [...group.querySelectorAll('button[type="button"]')]
            const chosen = chips.find((c) => c.getAttribute('aria-pressed') === 'true')
            if (chosen) continue
            open += 1
            if (chips[0]) {
              chips[0].click()
              return open
            }
          }
          return 0
        })
        if (!remaining) break
        await wait(500)
      }
      await wait(900)

      const advanced = await page.evaluate(() => {
        const nav = document.querySelector('[data-wizard-step-nav]')
        const buttons = [...(nav?.querySelectorAll('button') ?? [])]
        // The forward control is the last enabled button that has a label.
        const next = buttons
          .filter((b) => !b.disabled && b.textContent.trim())
          .pop()
        if (!next) return false
        next.click()
        return true
      })
      if (!advanced) throw new Error('next still disabled')

      await page.waitForSelector('[id^="additional-category-"]', { timeout: 40_000 })
      return true
    } catch {
      await wait(2000)
    }
  }
  return false
}

const snapshot = {}

for (const locale of LOCALES) {
  const page = await browser.newPage()

  // ---- package step -------------------------------------------------------
  // Anchor on an element that exists both before and after this change, so the
  // same script can capture the baseline and the result.
  const onPackages = await reach(
    page, locale, 2, '[data-package-group-controls]', 430, 932,
  )
  record(`PACKAGE_STEP_${locale.toUpperCase()}`, onPackages,
    onPackages ? 'package step rendered' : 'never reached')

  if (onPackages) {
    const pack = await page.evaluate(() => {
      const text = (sel) => document.querySelector(sel)?.textContent?.trim() ?? null
      const block = document.querySelector('[data-package-sides-editorial]')
      return {
        titles: [...(block?.querySelectorAll('.public-package-editorial-title') ?? [])]
          .map((n) => n.textContent.trim()),
        included: text('[data-package-included-items]'),
        helper: block?.querySelector('.public-package-editorial-helper')?.textContent?.trim(),
        upsell: text('[data-package-sides-upsell]'),
        sides: text('[data-package-sides-items]'),
        beforeToggles: (() => {
          const controls = document.querySelector('[data-package-group-controls]')
          if (!block || !controls) return false
          return !!(block.compareDocumentPosition(controls) &
            Node.DOCUMENT_POSITION_FOLLOWING)
        })(),
        cards: [...document.querySelectorAll('[data-package-card]')].map((c) => ({
          name: c.querySelector('[data-package-card-name]')?.textContent?.trim(),
          total: c.querySelector('[data-package-display-total]')?.textContent?.trim(),
        })),
        overflow: document.documentElement.scrollWidth >
          document.documentElement.clientWidth,
      }
    })
    snapshot[`packages_${locale}`] = pack

    record(`ACCOMPANIMENTS_VISIBLE_${locale.toUpperCase()}`,
      !!pack.included && pack.included.split('·').length >= 6, pack.included)
    record(`SIDES_UPSELL_VISIBLE_${locale.toUpperCase()}`,
      !!pack.upsell && /\$\s?13/.test(pack.upsell), pack.upsell)
    record(`SIDES_LIST_BLACK_BEANS_${locale.toUpperCase()}`,
      !!pack.sides && !/tropeiro/i.test(pack.sides), pack.sides)
    record(`EXPLAINER_BEFORE_TOGGLES_${locale.toUpperCase()}`, pack.beforeToggles,
      'sits above the with/without sides controls')
    record(`PACKAGE_NO_OVERFLOW_${locale.toUpperCase()}`, !pack.overflow)

    await page.screenshot({ path: join(OUT, `package-${locale}-430.png`) })
  }

  // ---- extras step --------------------------------------------------------
  // Walk Package -> Extras through the UI rather than seeding a package id, so
  // selection and step navigation are exercised the way a customer does it.
  const onExtras = onPackages
    ? await advanceToExtras(page)
    : false
  record(`EXTRAS_STEP_${locale.toUpperCase()}`, onExtras,
    onExtras ? 'extras step rendered' : 'never reached')

  if (onExtras) {
    // Items only exist in the DOM while their category is open.
    await page.evaluate(async () => {
      const headers = [...document.querySelectorAll('[data-additional-category-hitarea]')]
      for (const header of headers) {
        header.click()
        await new Promise((r) => setTimeout(r, 90))
      }
    })
    await wait(1200)

    const extras = await page.evaluate(() => {
      const money = (t) => {
        const m = String(t ?? '').match(/\$\s?([\d,]+(?:\.\d{2})?)/)
        return m ? Number(m[1].replace(/,/g, '')) : null
      }
      const intro = document.querySelector('[data-suggested-extras]')
      // Each category also renders content/summary/sentinel nodes under the
      // same id prefix; only the section itself carries a bare category key.
      const sections = [...document.querySelectorAll('[id^="additional-category-"]')]
        .filter((n) => !/^additional-category-(content|summary|sentinel)-/.test(n.id))
      return {
        title: intro?.querySelector('.public-extras-intro-title')?.textContent?.trim(),
        body: intro?.querySelector('.public-extras-intro-body')?.textContent?.trim(),
        introFirst: intro && sections.length
          ? !!(intro.compareDocumentPosition(sections[0]) &
              Node.DOCUMENT_POSITION_FOLLOWING)
          : false,
        categories: sections.map((s) => ({
          key: s.id.replace('additional-category-', ''),
          label: s.querySelector('[data-additional-category-header]')
            ?.textContent?.trim()?.slice(0, 60),
          items: [...s.querySelectorAll('[data-additional-item-card]')].map((i) => ({
            label: i.querySelector('.public-additional-card-name')?.textContent?.trim(),
            price: money(
              i.querySelector('.public-additional-card-price-value')?.textContent,
            ),
          })),
        })),
        overflow: document.documentElement.scrollWidth >
          document.documentElement.clientWidth,
      }
    })
    snapshot[`extras_${locale}`] = extras

    const keys = extras.categories.map((c) => c.key).filter(Boolean)
    record(`SUGGESTED_EXTRAS_HEADER_${locale.toUpperCase()}`, !!extras.title, extras.title)
    record(`EXTRAS_HEADER_ABOVE_CATEGORIES_${locale.toUpperCase()}`, extras.introFirst)
    record(`FIRST_CATEGORY_BOVINO_NOBRE_${locale.toUpperCase()}`,
      keys[0] === 'BOVINO_NOBRE', `order: ${keys.slice(0, 4).join(' > ')}`)
    record(`SECOND_CATEGORY_BOVINO_TRADICIONAL_${locale.toUpperCase()}`,
      keys[1] === 'BOVINO_TRADICIONAL', keys[1])
    record(`THIRD_CATEGORY_PORCO_${locale.toUpperCase()}`, keys[2] === 'PORCO', keys[2])

    const WANT = [
      'BOVINO_NOBRE', 'BOVINO_TRADICIONAL', 'PORCO', 'FRANGO', 'PEIXES',
      'FRUTOS_DO_MAR', 'CORDEIRO', 'LINGUICAS', 'GUARNICOES',
      'LEGUMES_E_SALADAS', 'EQUIPAMENTOS', 'OUTROS',
    ]
    const rank = (k) => (WANT.indexOf(k) === -1 ? WANT.length : WANT.indexOf(k))
    const ordered = keys.every((k, i) => i === 0 || rank(keys[i - 1]) <= rank(k))
    record(`CATEGORY_ORDER_COMMERCIAL_${locale.toUpperCase()}`, ordered, keys.join(' > '))

    const unsorted = extras.categories.filter((c) => {
      const p = c.items.map((i) => i.price).filter((v) => v != null)
      return p.some((v, i) => i > 0 && v > p[i - 1])
    })
    record(`ITEMS_PRICE_DESC_${locale.toUpperCase()}`, unsorted.length === 0,
      unsorted.length ? `out of order: ${unsorted.map((c) => c.key).join(', ')}`
        : `${extras.categories.length} categories checked`)
    record(`EXTRAS_NO_OVERFLOW_${locale.toUpperCase()}`, !extras.overflow)

    await page.screenshot({ path: join(OUT, `extras-${locale}-430.png`) })
  }

  await page.close()
}

// ---- desktop smoke --------------------------------------------------------
{
  const page = await browser.newPage()
  if (await reach(page, 'pt', 2, '[data-package-group-controls]', 1440, 900)) {
    await page.screenshot({ path: join(OUT, 'package-pt-1440.png') })
    const width = await page.evaluate(() => {
      const b = document.querySelector('[data-package-sides-editorial]')
      return b ? Math.round(b.getBoundingClientRect().width) : null
    })
    record('DESKTOP_EXPLAINER_READING_WIDTH', width != null && width <= 700,
      `${width}px wide at 1440`)
  }
  if (await advanceToExtras(page)) {
    await page.screenshot({ path: join(OUT, 'extras-pt-1440.png') })
  }
  await page.close()
}

// ---- narrow phone ---------------------------------------------------------
{
  const page = await browser.newPage()
  if (await reach(page, 'pt', 2, '[data-package-group-controls]', 390, 844)) {
    await page.screenshot({ path: join(OUT, 'package-pt-390.png') })
  }
  if (await advanceToExtras(page)) {
    await page.screenshot({ path: join(OUT, 'extras-pt-390.png') })
  }
  await page.close()
}

writeFileSync(join(OUT, 'snapshot.json'), `${JSON.stringify(snapshot, null, 2)}\n`)
writeFileSync(join(OUT, 'gates.json'), `${JSON.stringify(results, null, 2)}\n`)

await browser.close()

const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length} passed, ${failed.length} failed`)
console.log(`artifacts in ${OUT}`)
if (failed.length) process.exit(1)
