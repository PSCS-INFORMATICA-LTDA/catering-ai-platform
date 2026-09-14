/**
 * Reproduce authenticated soft-nav vs direct/refresh/back/forward.
 * DEV/Preview only. Does not touch PROD.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import puppeteer from 'puppeteer-core'

const BASE = (
  process.env.NAV_BASE_URL ||
  process.env.COMMERCIAL_REVIEW_BASE_URL ||
  'https://catering-ai-platform-kaz5er6pw-pscs-informatica-ltda-s-projects.vercel.app'
).replace(/\/$/, '')
const CHROME = process.env.CHROME_PATH || '/usr/local/bin/google-chrome'
const EMAIL = process.env.CATERING_DEV_LOGIN_EMAIL
const PASSWORD = process.env.CATERING_DEV_LOGIN_PASSWORD
const OUT = '/opt/cursor/artifacts/soft-nav-repro'

if (!EMAIL || !PASSWORD) throw new Error('CATERING_DEV_LOGIN_* required')
if (/cateringai\.app/i.test(BASE)) throw new Error('Refused: production host')

mkdirSync(OUT, { recursive: true })

function snippet(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 280)
}

async function snapshot(page, id) {
  const data = await page.evaluate(() => {
    const links = [...document.querySelectorAll('a.catering-sidebar-nav-btn')].map((a) => ({
      href: a.getAttribute('href'),
      text: (a.textContent || '').trim(),
    }))
    const soon = [...document.querySelectorAll('.catering-sidebar-nav-btn--soon')].map((el) =>
      (el.textContent || '').trim(),
    )
    const groups = [...document.querySelectorAll('.catering-sidebar-group-label')].map((el) =>
      (el.textContent || '').trim(),
    )
    return {
      url: location.pathname + location.search,
      title: document.title,
      hasFinanceTitle: /Finance Control Center|Visão Geral|Controle de faturamento/i.test(
        document.body.innerText,
      ),
      hasQuotes: /Cotações|Quotes|data-quotes/i.test(document.body.innerText),
      hasWorkspace: Boolean(document.querySelector('[data-testid="commercial-review-workspace"]')),
      hasCoupons: /Cupons|Coupons|Coupon Center/i.test(document.body.innerText),
      hasOrders: /Ordens de Serviço|Service Orders/i.test(document.body.innerText),
      hasPackages: /Pacotes|Packages/i.test(document.body.innerText),
      comingSoon: /ainda está por vir|Em breve|Coming soon|Próximamente/i.test(
        document.body.innerText,
      ),
      comingSoonHits: (document.body.innerText.match(/ainda está por vir|Em breve|Coming soon|Próximamente/gi) || []).slice(0, 8),
      financeLinks: links.filter((l) => /finance|invoice|paypal|coupon/i.test(l.href || '')),
      allLinks: links,
      soonLabels: soon,
      groups,
      body: document.body.innerText.slice(0, 500),
    }
  })
  const file = `${OUT}/${id}.json`
  writeFileSync(file, JSON.stringify(data, null, 2))
  await page.screenshot({ path: `${OUT}/${id}.png`, fullPage: false })
  console.log(
    JSON.stringify({
      id,
      url: data.url,
      comingSoon: data.comingSoon,
      comingSoonHits: data.comingSoonHits,
      hasFinanceTitle: data.hasFinanceTitle,
      hasWorkspace: data.hasWorkspace,
      financeLinks: data.financeLinks,
      soonLabels: data.soonLabels,
      groups: data.groups,
      body: snippet(data.body),
    }),
  )
  return data
}

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2' })
  await page.waitForSelector('input[type="email"]')
  await page.type('input[type="email"]', EMAIL, { delay: 10 })
  await page.type('input[type="password"]', PASSWORD, { delay: 10 })
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle2' }),
    page.click('button[type="submit"]'),
  ])
}

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--window-size=1440,900'],
})
const page = await browser.newPage()
page.setDefaultTimeout(45000)
await page.setViewport({ width: 1440, height: 900 })

try {
  await login(page)
  const afterLogin = await snapshot(page, '01-after-login-soft')

  const financeHref =
    afterLogin.financeLinks.find((l) => l.href === '/finance')?.href || '/finance'
  await page.click(`a.catering-sidebar-nav-btn[href="${financeHref}"]`).catch(async () => {
    await page.goto(`${BASE}/finance`, { waitUntil: 'networkidle2' })
  })
  await page.waitForNetworkIdle({ idleTime: 500, timeout: 15000 }).catch(() => null)
  await snapshot(page, '02-soft-click-finance')

  await page.reload({ waitUntil: 'networkidle2' })
  await snapshot(page, '03-refresh-finance')

  await page.click('a.catering-sidebar-nav-btn[href="/quotes"]').catch(() => null)
  await page.waitForNetworkIdle({ idleTime: 500, timeout: 15000 }).catch(() => null)
  await snapshot(page, '04-soft-click-quotes')

  const quoteLink = await page.evaluate(() => {
    const a = document.querySelector('a[href^="/quotes/"]')
    return a ? a.getAttribute('href') : null
  })
  if (quoteLink && !quoteLink.includes('/new')) {
    await page.click(`a[href="${quoteLink}"]`).catch(() => page.goto(`${BASE}${quoteLink}`, { waitUntil: 'networkidle2' }))
    await page.waitForNetworkIdle({ idleTime: 800, timeout: 20000 }).catch(() => null)
    await snapshot(page, '05-soft-click-quote-detail')
  }

  await page.click('a.catering-sidebar-nav-btn[href="/orders"]').catch(() => null)
  await page.waitForNetworkIdle({ idleTime: 500, timeout: 15000 }).catch(() => null)
  await snapshot(page, '06-soft-click-orders')

  await page.click('a.catering-sidebar-nav-btn[href="/packages"]').catch(() => null)
  await page.waitForNetworkIdle({ idleTime: 500, timeout: 15000 }).catch(() => null)
  await snapshot(page, '07-soft-click-packages')

  await page.click('a.catering-sidebar-nav-btn[href="/coupons"]').catch(() => null)
  await page.waitForNetworkIdle({ idleTime: 500, timeout: 15000 }).catch(() => null)
  await snapshot(page, '08-soft-click-coupons')

  await page.goto(`${BASE}/finance`, { waitUntil: 'networkidle2' })
  await snapshot(page, '09-direct-finance')

  await page.goBack({ waitUntil: 'networkidle2' }).catch(() => null)
  await snapshot(page, '10-back')
  await page.goForward({ waitUntil: 'networkidle2' }).catch(() => null)
  await snapshot(page, '11-forward')

  const mobile = await browser.newPage()
  mobile.setDefaultTimeout(45000)
  await mobile.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true })
  await mobile.goto(`${BASE}/login`, { waitUntil: 'networkidle2' })
  await mobile.type('input[type="email"]', EMAIL, { delay: 10 })
  await mobile.type('input[type="password"]', PASSWORD, { delay: 10 })
  await Promise.all([
    mobile.waitForNavigation({ waitUntil: 'networkidle2' }),
    mobile.click('button[type="submit"]'),
  ])
  await mobile.click('button[aria-label="Abrir menu"], button[aria-label="Open menu"]').catch(() => null)
  await new Promise((r) => setTimeout(r, 400))
  const mobileSnap = await mobile.evaluate(() => ({
    url: location.pathname,
    financeVisible: Boolean(document.querySelector('a.catering-sidebar-nav-btn[href="/finance"]')),
    soon: [...document.querySelectorAll('.catering-sidebar-nav-btn--soon')].map((el) =>
      (el.textContent || '').trim(),
    ),
    comingSoon: /ainda está por vir|Em breve/i.test(document.body.innerText),
  }))
  writeFileSync(`${OUT}/12-mobile-after-login.json`, JSON.stringify(mobileSnap, null, 2))
  await mobile.screenshot({ path: `${OUT}/12-mobile-after-login.png` })
  console.log(JSON.stringify({ id: '12-mobile-after-login', ...mobileSnap }))
  await mobile.close()
} finally {
  await browser.close()
}
