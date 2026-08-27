/**
 * Reads package and additional prices straight off the running public quote so
 * the same numbers can be compared before and after the commercial UX change.
 *
 * Usage: node scripts/dev/capture-upsell-price-snapshot.mjs <base-url> <out.json>
 */
import { writeFileSync } from 'node:fs'
import puppeteer from 'puppeteer-core'

const BASE = process.argv[2] ?? 'https://catering-ai-agenda-dev.vercel.app'
const OUT = process.argv[3] ?? '/tmp/price-snapshot.json'
const SLUG = process.env.PUBLIC_QUOTE_SLUG ?? 'cdl-services'

const CHROME = process.env.CHROME_PATH || '/usr/bin/google-chrome-stable'

const browser = await puppeteer.launch({
  headless: 'new',
  executablePath: CHROME,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
})

const money = (text) => {
  const m = String(text ?? '').match(/\$\s?([\d,]+(?:\.\d{2})?)/)
  return m ? Number(m[1].replace(/,/g, '')) : null
}

try {
  const page = await browser.newPage()
  await page.setViewport({ width: 430, height: 932, deviceScaleFactor: 2 })

  const url = `${BASE}/quote/${SLUG}/pt`
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 120_000 })

  const api = await page.evaluate(async () => {
    const grab = async (path) => {
      const res = await fetch(path, { headers: { accept: 'application/json' } })
      if (!res.ok) return { error: res.status }
      return res.json()
    }
    return {
      packages: await grab('/api/public/packages?company=cdl-services'),
      additionals: await grab('/api/public/additional-items?company=cdl-services'),
    }
  })

  const snapshot = { url, capturedAt: new Date().toISOString() }

  const packages = api.packages?.packages ?? api.packages?.data ?? api.packages
  if (Array.isArray(packages)) {
    snapshot.packages = Object.fromEntries(
      packages
        .map((p) => [p.package_key ?? p.key, p.price_per_person ?? p.pricePerPerson])
        .filter(([k, v]) => k && v != null)
        .sort(),
    )
  }

  const items = api.additionals?.items ?? api.additionals?.data ?? api.additionals
  if (Array.isArray(items)) {
    const byCategory = {}
    for (const item of items) {
      const key = item.category_key ?? item.categoryKey ?? 'OUTROS'
      const price = Number(
        item.unit_price ?? item.price ?? item.price_per_unit ?? 0,
      )
      const label = item.name_pt ?? item.name ?? item.label ?? item.id
      ;(byCategory[key] ??= []).push({ label, price })
    }
    snapshot.additionalsByCategory = Object.fromEntries(
      Object.entries(byCategory).map(([key, list]) => [
        key,
        list.sort((a, b) => b.price - a.price || a.label.localeCompare(b.label)),
      ]),
    )
  }

  // Whatever the API shape, also read what the customer actually sees.
  snapshot.renderedPackagePrices = await page.evaluate(() =>
    [...document.querySelectorAll('[data-package-card]')].map((card) => ({
      name: card.querySelector('[data-package-card-name]')?.textContent?.trim(),
      price: card.querySelector('[data-package-display-total]')?.textContent?.trim(),
    })),
  )

  snapshot.sidesUpsell = await page.evaluate(() => ({
    block: !!document.querySelector('[data-package-sides-editorial]'),
    included: document
      .querySelector('[data-package-included-items]')
      ?.textContent?.trim(),
    upsell: document.querySelector('[data-package-sides-upsell]')?.textContent?.trim(),
    sides: document.querySelector('[data-package-sides-items]')?.textContent?.trim(),
  }))

  writeFileSync(OUT, `${JSON.stringify(snapshot, null, 2)}\n`)
  console.log(`wrote ${OUT}`)
  console.log('sides upsell:', snapshot.sidesUpsell.upsell ?? '(not rendered)')
  console.log('package prices:', JSON.stringify(snapshot.packages ?? {}))
  console.log(
    'rendered:',
    snapshot.renderedPackagePrices
      .map((p) => `${p.name}=${p.price}`)
      .join('  '),
  )
} finally {
  await browser.close()
}
