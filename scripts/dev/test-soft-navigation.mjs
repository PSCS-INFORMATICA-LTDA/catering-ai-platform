/**
 * Authenticated soft-navigation QA.
 * Login → Finance → Quotes → Quote detail → Orders → Packages → Coupons
 * without hard refresh. Then refresh, back, forward, and unauth redirect.
 *
 *   NAV_BASE_URL=https://... node scripts/dev/test-soft-navigation.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
let puppeteer
try {
  puppeteer = require('puppeteer-core')
} catch {
  throw new Error('puppeteer-core is required to run this QA script')
}

const BASE = (
  process.env.NAV_BASE_URL ||
  process.env.COMMERCIAL_REVIEW_BASE_URL ||
  'http://127.0.0.1:3000'
).replace(/\/$/, '')
const CHROME = process.env.CHROME_PATH || '/usr/local/bin/google-chrome'
const EMAIL = process.env.CATERING_DEV_LOGIN_EMAIL
const PASSWORD = process.env.CATERING_DEV_LOGIN_PASSWORD
const ART = process.env.NAV_ARTIFACT_DIR || ''

if (!EMAIL || !PASSWORD) throw new Error('CATERING_DEV_LOGIN_* required')
if (/cateringai\.app/i.test(BASE)) throw new Error('Refused: production host')
if (ART) mkdirSync(ART, { recursive: true })

const rows = []
function record(id, ok, detail) {
  rows.push({ id, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${id}  ${detail}`)
}

async function waitQuiet(page) {
  await page.waitForNetworkIdle({ idleTime: 600, timeout: 20000 }).catch(() => null)
}

async function snapshot(page, id) {
  if (!ART) return
  const data = await page.evaluate(() => ({
    url: location.pathname + location.search,
    finance: Boolean(document.querySelector('a.catering-sidebar-nav-btn[href="/finance"]')),
    coupons: Boolean(document.querySelector('a.catering-sidebar-nav-btn[href="/coupons"]')),
    emptyFinance: /FINANCEIRO\s+PARÂMETROS/i.test(document.body.innerText.replace(/\s+/g, ' ')),
    financePage: Boolean(document.querySelector('[data-testid="finance-control-center"]')),
    quotesPage: Boolean(document.querySelector('[data-testid="quotes-dashboard"]')),
    workspace: Boolean(document.querySelector('[data-testid="commercial-review-workspace"]')),
    ordersPage: Boolean(document.querySelector('[data-testid="orders-dashboard"]')),
    packagesPage: Boolean(document.querySelector('[data-testid="packages-dashboard"]')),
    couponsPage: Boolean(document.querySelector('[data-testid="coupons-dashboard"]')),
  }))
  writeFileSync(`${ART}/${id}.json`, JSON.stringify(data, null, 2))
  await page.screenshot({ path: `${ART}/${id}.png`, fullPage: false })
}

async function clickNav(page, href) {
  await page.waitForSelector(`a.catering-sidebar-nav-btn[href="${href}"]`, { timeout: 8000 })
  await page.click(`a.catering-sidebar-nav-btn[href="${href}"]`)
  await waitQuiet(page)
}

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2' })
  await page.waitForSelector('input[type="email"]')
  await page.type('input[type="email"]', EMAIL, { delay: 8 })
  await page.type('input[type="password"]', PASSWORD, { delay: 8 })
  await page.click('button[type="submit"]')
  await page.waitForFunction(() => location.pathname !== '/login', { timeout: 45000 })
  await waitQuiet(page)
}

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--window-size=1440,900'],
})

try {
  const page = await browser.newPage()
  page.setDefaultTimeout(45000)
  await page.setViewport({ width: 1440, height: 900 })

  await login(page)
  const afterLogin = await page.evaluate(() => ({
    url: location.pathname,
    finance: Boolean(document.querySelector('a.catering-sidebar-nav-btn[href="/finance"]')),
    coupons: Boolean(document.querySelector('a.catering-sidebar-nav-btn[href="/coupons"]')),
    quotes: Boolean(document.querySelector('[data-testid="quotes-dashboard"]')),
    emptyFinance: /FINANCEIRO\s+PARÂMETROS/i.test(document.body.innerText.replace(/\s+/g, ' ')),
  }))
  record(
    'N01-login-soft-finance-visible',
    afterLogin.finance && afterLogin.quotes && !afterLogin.emptyFinance,
    JSON.stringify(afterLogin),
  )
  await snapshot(page, '01-after-login-soft')

  await clickNav(page, '/finance')
  const financeSoft = await page.evaluate(() => ({
    url: location.pathname,
    page: Boolean(document.querySelector('[data-testid="finance-control-center"]')),
    placeholder: /ainda está por vir/i.test(document.body.innerText),
  }))
  record(
    'N02-soft-finance',
    financeSoft.url === '/finance' && financeSoft.page && !financeSoft.placeholder,
    JSON.stringify(financeSoft),
  )
  await snapshot(page, '02-soft-finance')

  await clickNav(page, '/quotes')
  const quotesSoft = await page.evaluate(() => ({
    url: location.pathname,
    page: Boolean(document.querySelector('[data-testid="quotes-dashboard"]')),
  }))
  record('N03-soft-quotes', quotesSoft.page, JSON.stringify(quotesSoft))
  await snapshot(page, '03-soft-quotes')

  const quoteHref = await page.evaluate(() => {
    const link = [...document.querySelectorAll('a[href^="/quotes/"]')].find((a) => {
      const href = a.getAttribute('href') || ''
      return /^\/quotes\/[^/]+$/.test(href) && !href.endsWith('/new')
    })
    return link ? link.getAttribute('href') : null
  })
  if (quoteHref) {
    await page.click(`a[href="${quoteHref}"]`)
    await waitQuiet(page)
    const detail = await page.evaluate(() => ({
      url: location.pathname,
      workspace: Boolean(document.querySelector('[data-testid="commercial-review-workspace"]')),
      sections: {
        client: /cliente|customer/i.test(document.body.innerText),
        event: /evento|event/i.test(document.body.innerText),
        menu: /menu|pacote|package/i.test(document.body.innerText),
        extras: /adicionais|extras|additional/i.test(document.body.innerText),
        finance: /financeiro|finance|dep[oó]sito|deposit/i.test(document.body.innerText),
        coupon: /cupom|coupon/i.test(document.body.innerText),
        capacity: /capacidade|capacity/i.test(document.body.innerText),
        notes: /notas internas|internal notes/i.test(document.body.innerText),
        proposal: /proposta|proposal|pdf|share|compartilhar/i.test(document.body.innerText),
        history: /hist[oó]rico|history/i.test(document.body.innerText),
      },
    }))
    record(
      'N04-soft-quote-detail',
      detail.workspace && /\/quotes\/[^/]+$/.test(detail.url),
      JSON.stringify(detail),
    )
    await snapshot(page, '04-soft-quote-detail')
  } else {
    record('N04-soft-quote-detail', false, 'no quote link')
  }

  await clickNav(page, '/orders')
  const orders = await page.evaluate(() => ({
    url: location.pathname,
    page: Boolean(document.querySelector('[data-testid="orders-dashboard"]')),
  }))
  record('N05-soft-orders', orders.url.startsWith('/orders') && orders.page, JSON.stringify(orders))
  await snapshot(page, '05-soft-orders')

  await clickNav(page, '/packages')
  const packages = await page.evaluate(() => ({
    url: location.pathname,
    page: Boolean(document.querySelector('[data-testid="packages-dashboard"]')),
    heading: /Pacotes|Packages|Paquetes/i.test(document.body.innerText),
  }))
  record(
    'N06-soft-packages',
    packages.url.startsWith('/packages') && (packages.page || packages.heading),
    JSON.stringify(packages),
  )
  await snapshot(page, '06-soft-packages')

  await clickNav(page, '/coupons')
  const coupons = await page.evaluate(() => ({
    url: location.pathname,
    page: Boolean(document.querySelector('[data-testid="coupons-dashboard"]')),
  }))
  record('N07-soft-coupons', coupons.url === '/coupons' && coupons.page, JSON.stringify(coupons))
  await snapshot(page, '07-soft-coupons')

  await page.reload({ waitUntil: 'networkidle2' })
  const refresh = await page.evaluate(() => ({
    url: location.pathname,
    page: Boolean(document.querySelector('[data-testid="coupons-dashboard"]')),
  }))
  record('N08-refresh-same', refresh.url === '/coupons' && refresh.page, JSON.stringify(refresh))
  await snapshot(page, '08-refresh-coupons')

  await page.goBack({ waitUntil: 'networkidle2' })
  const back = await page.evaluate(() => ({
    url: location.pathname,
    page: Boolean(document.querySelector('[data-testid="packages-dashboard"]')),
  }))
  record('N09-back', back.url.startsWith('/packages') && back.page, JSON.stringify(back))
  await snapshot(page, '09-back-packages')

  await page.goForward({ waitUntil: 'networkidle2' })
  const forward = await page.evaluate(() => ({
    url: location.pathname,
    page: Boolean(document.querySelector('[data-testid="coupons-dashboard"]')),
  }))
  record('N10-forward', forward.url === '/coupons' && forward.page, JSON.stringify(forward))
  await snapshot(page, '10-forward-coupons')

  await page.goto(`${BASE}/finance`, { waitUntil: 'networkidle2' })
  const direct = await page.evaluate(() => ({
    url: location.pathname,
    page: Boolean(document.querySelector('[data-testid="finance-control-center"]')),
  }))
  record('N11-direct-finance', direct.url === '/finance' && direct.page, JSON.stringify(direct))
  await snapshot(page, '11-direct-finance')

  const anonContext = await browser.createBrowserContext()
  const anon = await anonContext.newPage()
  await anon.setViewport({ width: 1440, height: 900 })
  await anon.goto(`${BASE}/finance`, { waitUntil: 'networkidle2' })
  const unauth = await anon.evaluate(() => location.pathname + location.search)
  const unauthFlash = await anon.evaluate(() =>
    Boolean(document.querySelector('[data-testid="finance-control-center"]')),
  )
  record('N12-unauth-redirect', unauth.startsWith('/login') && !unauthFlash, unauth)
  await anon.close()
  await anonContext.close()

  const mobileContext = await browser.createBrowserContext()
  const mobile = await mobileContext.newPage()
  mobile.setDefaultTimeout(45000)
  await mobile.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true })
  await login(mobile)
  await mobile.click('button.catering-header-menu-btn').catch(() => null)
  await new Promise((r) => setTimeout(r, 350))
  const mobileNav = await mobile.evaluate(() => ({
    finance: Boolean(document.querySelector('a.catering-sidebar-nav-btn[href="/finance"]')),
    emptyFinance: /FINANCEIRO\s+PARÂMETROS/i.test(document.body.innerText.replace(/\s+/g, ' ')),
  }))
  record(
    'N13-mobile-finance-visible',
    mobileNav.finance && !mobileNav.emptyFinance,
    JSON.stringify(mobileNav),
  )
  await snapshot(mobile, '12-mobile-after-login')
  if (mobileNav.finance) {
    await mobile.click('a.catering-sidebar-nav-btn[href="/finance"]')
    await waitQuiet(mobile)
    const mobileFinance = await mobile.evaluate(() => ({
      url: location.pathname,
      page: Boolean(document.querySelector('[data-testid="finance-control-center"]')),
    }))
    record(
      'N14-mobile-soft-finance',
      mobileFinance.url === '/finance' && mobileFinance.page,
      JSON.stringify(mobileFinance),
    )
    await snapshot(mobile, '13-mobile-soft-finance')
  } else {
    record('N14-mobile-soft-finance', false, 'finance link missing')
  }
  await mobile.close()
  await mobileContext.close()
} finally {
  await browser.close()
}

const failed = rows.filter((row) => !row.ok)
const summary = { passed: rows.filter((r) => r.ok).length, failed: failed.length, rows }
if (ART) writeFileSync(`${ART}/summary.json`, JSON.stringify(summary, null, 2))
console.log(JSON.stringify({ passed: summary.passed, failed: summary.failed }))
if (failed.length) process.exit(1)
