/**
 * Runtime QA for the virtual Suggested Extras category + grill photo.
 *
 * Usage: node scripts/dev/capture-public-quote-suggested-extras.mjs <base-url> <out-dir>
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import puppeteer from 'puppeteer-core'

const BASE = process.argv[2] ?? 'http://127.0.0.1:3042'
const OUT = process.argv[3] ?? '/opt/cursor/artifacts/suggested-extras-qa'
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
                  firstName: 'Suggested',
                  lastName: 'QA',
                  phone: `+1407555${tail}`,
                },
                event: {
                  eventName: 'Suggested extras QA',
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
      await page.reload({ waitUntil: 'networkidle2' })
      await page.waitForSelector('[data-public-wizard-theme="light-locked"]', {
        timeout: 30_000,
      })
      return true
    } catch {
      await wait(2500)
      await page.goto(`${BASE}/quote/cdl/${locale}`, { waitUntil: 'networkidle2' })
    }
  }
  return false
}

async function reachPackages(page, locale, w, h) {
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 2 })
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      await page.goto(`${BASE}/quote/cdl/${locale}`, {
        waitUntil: 'networkidle2',
        timeout: 90_000,
      })
    } catch {
      await wait(3000)
      continue
    }
    await page.waitForSelector('[data-public-landing]', { timeout: 15_000 }).catch(() => {})
    await seed(page, locale, 2)
    try {
      await page.waitForSelector('[data-package-group-controls]', { timeout: 45_000 })
      return true
    } catch {
      await wait(2000)
    }
  }
  return false
}

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
        await wait(500)
      }
      await wait(800)
      const advanced = await page.evaluate(() => {
        const nav = document.querySelector('[data-wizard-step-nav]')
        const buttons = [...(nav?.querySelectorAll('button') ?? [])]
        const next = buttons.filter((b) => !b.disabled && b.textContent.trim()).pop()
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

function categorySections() {
  return [...document.querySelectorAll('[id^="additional-category-"]')].filter(
    (n) => !/^additional-category-(content|summary|sentinel)-/.test(n.id),
  )
}

const page = await browser.newPage()
const onPackages = await reachPackages(page, 'pt', 430, 932)
record('PACKAGE_STEP_PT', onPackages)
const onExtras = onPackages ? await advanceToExtras(page) : false
record('EXTRAS_STEP_PT', onExtras)

const snapshot = {}

if (onExtras) {
  await page.screenshot({ path: join(OUT, 'suggested_extras_closed_430.png'), fullPage: false })

  const closed = await page.evaluate(() => {
    const sections = [...document.querySelectorAll('[id^="additional-category-"]')].filter(
      (n) => !/^additional-category-(content|summary|sentinel)-/.test(n.id),
    )
    return {
      keys: sections.map((s) => s.getAttribute('data-category-key')),
      firstFeatured: sections[0]?.getAttribute('data-suggested-extras') === 'true',
      title: sections[0]?.querySelector('.public-suggested-extras-title')?.textContent?.trim(),
      lead: sections[0]?.querySelector('.public-suggested-extras-lead')?.textContent?.trim(),
      bg: getComputedStyle(sections[0]?.querySelector('.public-suggested-extras-header') ?? sections[0]).backgroundImage,
    }
  })
  snapshot.closed = closed
  record('SUGGESTED_EXTRAS_CATEGORY_FIRST', closed.keys[0] === 'SUGGESTED_EXTRAS' && closed.firstFeatured, closed.keys.slice(0, 4).join(' > '))
  record('SUGGESTED_EXTRAS_TITLE_PT', closed.title === 'EXTRAS SUGERIDOS', closed.title)
  record('BOVINO_NOBRE_SECOND_VISIBLE_CATEGORY', closed.keys[1] === 'BOVINO_NOBRE', closed.keys[1])
  record('CATEGORY_ORDER_AFTER_SUGGESTED',
    closed.keys[0] === 'SUGGESTED_EXTRAS'
      && closed.keys[1] === 'BOVINO_NOBRE'
      && closed.keys[2] === 'BOVINO_TRADICIONAL'
      && closed.keys[3] === 'FRANGO'
      && closed.keys[4] === 'PORCO',
    closed.keys.join(' > '))

  const alreadyOpen = await page.evaluate(() => {
    const suggested = document.querySelector('[data-suggested-extras]')
    return {
      locked: suggested?.querySelector('[data-suggested-extras-locked]') != null,
      cards: suggested?.querySelectorAll('[data-additional-item-card]').length ?? 0,
    }
  })
  record('SUGGESTED_EXTRAS_LOCKED_OPEN', alreadyOpen.locked && alreadyOpen.cards >= 3,
    `locked=${alreadyOpen.locked} cards=${alreadyOpen.cards}`)
  await page.evaluate(() => {
    document.querySelector('[data-suggested-extras] [data-additional-category-header]')?.click()
  })
  await wait(400)
  const stillOpen = await page.evaluate(() => (
    document.querySelectorAll('[data-suggested-extras] [data-additional-item-card]').length
  ))
  record('SUGGESTED_EXTRAS_STAYS_OPEN', stillOpen >= 3, `cards after header click=${stillOpen}`)
  await page.evaluate(() => {
    document.querySelector('[data-suggested-extras]')?.scrollIntoView({ block: 'start' })
  })
  await wait(400)
  await page.screenshot({ path: join(OUT, 'suggested_extras_open_430.png') })

  const opened = await page.evaluate(() => {
    const suggested = document.querySelector('[data-suggested-extras]')
    const cards = [...(suggested?.querySelectorAll('[data-additional-item-card]') ?? [])].map((card) => ({
      name: card.querySelector('.public-additional-card-name')?.textContent?.trim(),
      price: card.querySelector('.public-additional-card-price-value')?.textContent?.trim(),
      image: card.querySelector('img')?.getAttribute('src') ?? null,
    }))
    return {
      cardCount: cards.length,
      cards,
      prices: cards.map((c) => {
        const m = String(c.price ?? '').match(/([\d.]+)/)
        return m ? Number(m[1]) : null
      }),
    }
  })
  snapshot.opened = opened
  record('SUGGESTED_EXTRAS_CARDS_VISIBLE', opened.cardCount >= 3, `${opened.cardCount} cards`)
  record('SUGGESTED_EXTRAS_HAS_TOMAHAWK',
    opened.cards.some((c) => /tomahawk/i.test(c.name ?? '')),
    opened.cards.map((c) => c.name).join(' | '))
  const numeric = opened.prices.filter((n) => n != null)
  record('SUGGESTED_EXTRAS_PRICE_DESC',
    numeric.every((n, i) => i === 0 || n <= numeric[i - 1]),
    numeric.join(' > '))

  const plus = await page.evaluate(() => {
    const suggested = document.querySelector('[data-suggested-extras]')
    const first = suggested?.querySelector('[data-additional-item-card]')
    const plusBtn = [...(first?.querySelectorAll('button') ?? [])].at(-1)
    plusBtn?.click()
    return first?.querySelector('.public-additional-card-name')?.textContent?.trim()
  })
  await wait(400)
  const qtyAfter = await page.evaluate(() => {
    const first = document.querySelector('[data-suggested-extras] [data-additional-item-card]')
    return first?.querySelector('.public-additional-qty span')?.textContent?.trim()
  })
  record('SUGGESTED_EXTRAS_SELECTION_SHARED_STATE', qtyAfter === '1', `qty=${qtyAfter} item=${plus}`)

  await page.evaluate(() => {
    document.querySelector('[data-suggested-extras] [data-additional-category-header]')?.click()
  })
  await wait(400)

  await page.evaluate(() => {
    const nobre = document.querySelector('[data-category-key="BOVINO_NOBRE"] [data-additional-category-hitarea]')
    nobre?.click()
  })
  await wait(700)
  await page.evaluate(() => {
    document.querySelector('[data-category-key="BOVINO_NOBRE"]')?.scrollIntoView({ block: 'start' })
  })
  await wait(300)
  await page.screenshot({ path: join(OUT, 'bovino_nobre_no_duplicate_430.png') })

  const nobre = await page.evaluate(() => {
    const section = document.querySelector('[data-category-key="BOVINO_NOBRE"]')
    const cards = [...(section?.querySelectorAll('[data-additional-item-card]') ?? [])].map((card) =>
      card.querySelector('.public-additional-card-name')?.textContent?.trim(),
    )
    return cards
  })
  snapshot.nobre = nobre
  record('SUGGESTED_EXTRAS_NO_DUPLICATES',
    !nobre.some((name) => /tomahawk|t-bone/i.test(name ?? '')),
    nobre.join(' | '))

  await page.evaluate(() => {
    document.querySelector('[data-category-key="BOVINO_NOBRE"] [data-additional-category-header]')?.click()
  })
  await wait(300)
  await page.evaluate(() => {
    document.querySelector('[data-suggested-extras] [data-additional-category-hitarea]')?.click()
  })
  await wait(500)
  const qtyPreserved = await page.evaluate(() => {
    const first = document.querySelector('[data-suggested-extras] [data-additional-item-card]')
    return first?.querySelector('.public-additional-qty span')?.textContent?.trim()
  })
  record('SUGGESTED_EXTRAS_RESUME_STATE', qtyPreserved === '1', `qty=${qtyPreserved}`)

  await page.evaluate(() => {
    const nav = document.querySelector('[data-wizard-step-nav]')
    const buttons = [...(nav?.querySelectorAll('button') ?? [])]
    buttons.filter((b) => !b.disabled && b.textContent.trim()).pop()?.click()
  })
  await wait(1200)
  await page.evaluate(() => {
    const nav = document.querySelector('[data-wizard-step-nav]')
    const buttons = [...(nav?.querySelectorAll('button') ?? [])]
    buttons.find((b) => /voltar|back|atrás/i.test(b.textContent ?? ''))?.click()
  })
  await wait(1000)
  await page.evaluate(() => {
    document.querySelector('[data-suggested-extras] [data-additional-category-hitarea]')?.click()
  })
  await wait(500)
  const qtyAfterNav = await page.evaluate(() => {
    const first = document.querySelector('[data-suggested-extras] [data-additional-item-card]')
    return first?.querySelector('.public-additional-qty span')?.textContent?.trim()
  })
  record('SUGGESTED_EXTRAS_NAV_PRESERVES_QTY', qtyAfterNav === '1', `qty=${qtyAfterNav}`)

  await page.evaluate(() => {
    document.querySelector('[data-category-key="EQUIPAMENTOS"] [data-additional-category-hitarea]')?.click()
  })
  await wait(600)
  await page.evaluate(() => {
    document.querySelector('[data-category-key="EQUIPAMENTOS"]')?.scrollIntoView({ block: 'center' })
  })
  await wait(300)
  await page.screenshot({ path: join(OUT, 'grill_operational_card_430.png') })
  const grill = await page.evaluate(() => {
    const section = document.querySelector('[data-category-key="EQUIPAMENTOS"]')
    const card = section?.querySelector('[data-additional-item-card]')
    return {
      name: card?.querySelector('.public-additional-card-name')?.textContent?.trim(),
      price: card?.querySelector('.public-additional-card-price-value')?.textContent?.trim(),
      image: card?.querySelector('img')?.getAttribute('src') ?? null,
      crop: card?.querySelector('[data-additional-image-crop]')?.getAttribute('data-additional-image-crop'),
    }
  })
  snapshot.grill = grill
  record('ADDITIONAL_GRILL_ITEM_FOUND', /churrasqueira|grill/i.test(grill.name ?? ''), grill.name)
  record('GRILL_IMAGE_REAL_CDL_ASSET',
    (grill.image ?? '').includes('/cdl/additionals/cdl-operational-grill.webp'),
    grill.image)
  record('GRILL_IMAGE_CARD_CROP', grill.crop === 'operational-grill', grill.crop)
  record('GRILL_PRICE_UNCHANGED', /\$?\s?100/.test(grill.price ?? ''), grill.price)

  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 })
  await page.evaluate(() => {
    document.querySelector('[data-suggested-extras]')?.scrollIntoView({ block: 'start' })
  })
  await wait(300)
  await page.screenshot({ path: join(OUT, 'suggested_extras_open_390.png') })
}

writeFileSync(join(OUT, 'snapshot.json'), `${JSON.stringify(snapshot, null, 2)}\n`)
writeFileSync(join(OUT, 'gates.json'), `${JSON.stringify(results, null, 2)}\n`)
await browser.close()

const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length} passed, ${failed.length} failed`)
console.log(`artifacts in ${OUT}`)
if (failed.length) process.exit(1)
