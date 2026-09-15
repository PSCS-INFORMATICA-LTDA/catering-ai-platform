/**
 * Payment WhatsApp share + company OG HTTP QA. DEV/Preview only.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { assertDevUrl, DEV_REF, loadDevEnv } from './loadDevEnv.mjs'
import { paymentOgDescription } from '../../Lib/payments/paymentOgCopy.ts'
import { paymentSharePhoneDigits } from '../../Lib/payments/paymentShareMessage.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const base = (
  process.env.COMMERCIAL_REVIEW_BASE_URL ||
  process.env.NAV_BASE_URL ||
  'http://127.0.0.1:3000'
).replace(/\/$/, '')

function record(id, ok, detail) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${id}  ${detail}`)
  return ok
}

function authCookie(session) {
  const payload = {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_in: session.expires_in,
    expires_at: session.expires_at,
    token_type: 'bearer',
    user: session.user,
  }
  return `sb-${DEV_REF}-auth-token=${encodeURIComponent(JSON.stringify(payload))}`
}

async function jsonFetch(path, { method = 'GET', body, cookie = '' } = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      origin: base,
      'content-type': 'application/json',
      ...(cookie ? { cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await response.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = { raw: text.slice(0, 400) }
  }
  return { response, data, text }
}

function metaContent(html, property) {
  const match = html.match(
    new RegExp(`<meta[^>]+(?:property|name)="${property}"[^>]+content="([^"]*)"`, 'i'),
  ) || html.match(
    new RegExp(`<meta[^>]+content="([^"]*)"[^>]+(?:property|name)="${property}"`, 'i'),
  )
  return match?.[1] || ''
}

const rows = []
function check(id, ok, detail) {
  rows.push({ id, ok })
  record(id, ok, detail)
}

async function main() {
  const env = loadDevEnv(ROOT)
  assertDevUrl(env.url)
  if (/cateringai\.app/i.test(base)) throw new Error('Refused: production host')

  const panel = readFileSync(join(ROOT, 'components/payments/QuoteInvoicePanel.tsx'), 'utf8')
  const payPage = readFileSync(join(ROOT, 'app/pay/[token]/page.tsx'), 'utf8')
  const orders = readFileSync(join(ROOT, 'app/api/payments/paypal/orders/route.ts'), 'utf8')
  const workspace = readFileSync(
    join(ROOT, 'components/commercial-review/CommercialReviewWorkspace.tsx'),
    'utf8',
  )

  check('SRC-reuse-quote-phone', workspace.includes('customerPhone={quote.phone}'), 'quote.phone')
  check(
    'SRC-invoice-panel-uses-quote-language',
    workspace.includes("language={quote.language ?? 'pt'}") &&
      panel.includes('invoice?.locale || quoteLanguage'),
    'customer document locale',
  )
  check(
    'SRC-no-second-phone-model',
    !panel.includes('from(\'customer_phones\')') && panel.includes('paymentSharePhoneDigits'),
    'canonical phone',
  )
  check('SRC-wa-me', panel.includes('buildPaymentWhatsAppHref'), 'wa.me helper')
  check(
    'L-client-amount-ignored',
    orders.includes('ignoreClientAmount(body?.amount)') && orders.includes('resolveServerAmountDue'),
    'server amount',
  )
  check(
    'SRC-no-cdl-hardcode',
    !readFileSync(join(ROOT, 'components/payments/PublicPaymentPage.tsx'), 'utf8').includes(
      'CDL BBQ AT HOME',
    ) && panel.includes('deposit_due'),
    'company brand + server dues',
  )
  check(
    'M-token-server-owned',
    payPage.includes('resolvePaymentLink') && payPage.includes('generateMetadata'),
    'token + metadata',
  )
  check(
    'Q-og-no-pii-source',
    payPage.includes('paymentOgMetadataIsSafe') &&
      payPage.includes('ogPaymentDescription') &&
      payPage.includes('metadataBase') &&
      !payPage.includes('/cdl/logo.png') &&
      !payPage.includes('snap.customer.phone'),
    'og sanitizer',
  )
  check(
    'R-phone-gated',
    panel.includes('canManage ?') && panel.includes('customerWhatsApp'),
    'RBAC surface',
  )

  const anon = createClient(env.url, env.anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const email = process.env.CATERING_DEV_LOGIN_EMAIL
  const password = process.env.CATERING_DEV_LOGIN_PASSWORD
  if (!email || !password) throw new Error('CATERING_DEV_LOGIN_* required')
  const signed = await anon.auth.signInWithPassword({ email, password })
  if (signed.error || !signed.data.session) {
    throw new Error(signed.error?.message || 'admin login failed')
  }
  const cookie = authCookie(signed.data.session)

  const admin = createClient(env.url, env.service, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: officialInvoice } = await admin
    .from('invoices')
    .select('id, quote_id, invoice_number, total, deposit_amount, balance_amount, paid_total, status')
    .eq('invoice_number', 'INV-2026-000009')
    .maybeSingle()

  const quotes = await jsonFetch('/api/quotes?pageSize=25', { cookie })
  const list = Array.isArray(quotes.data?.data) ? quotes.data.data : []
  let quote = null
  let invoice = null
  if (officialInvoice?.quote_id) {
    const officialFromApi = (
      await jsonFetch(`/api/quotes/${officialInvoice.quote_id}/invoice`, { cookie })
    ).data?.data
    if (officialFromApi?.id) {
      quote =
        list.find((row) => row.id === officialInvoice.quote_id) || {
          id: officialInvoice.quote_id,
          quote_number: 'Q-2026-000196',
          phone: null,
        }
      invoice = officialFromApi
    }
  }
  if (!invoice?.id) {
    for (const row of list) {
      const existing = (await jsonFetch(`/api/quotes/${row.id}/invoice`, { cookie })).data?.data
      if (existing?.id) {
        quote = row
        invoice = existing
        break
      }
    }
  }
  if (!quote) {
    quote = list.find((row) => paymentSharePhoneDigits(row.phone || row.customer_phone)) || list[0]
  }
  check('E2E-quote', Boolean(quote?.id), quote?.id || 'missing')

  if (!quote?.id) {
    throw new Error('no quote for payment share QA')
  }

  const page = await fetch(`${base}/quotes/${quote.id}`, {
    headers: { cookie },
    redirect: 'manual',
  })
  const html = await page.text()
  check(
    'E2E-workspace',
    page.status === 200 && html.includes('data-testid="commercial-review-workspace"'),
    String(page.status),
  )
  check(
    'E2E-invoice-panel',
    html.includes('data-invoice-panel'),
    html.includes('data-invoice-panel') ? 'panel' : 'missing-panel',
  )

  if (!invoice?.id) {
    const created = await jsonFetch(`/api/quotes/${quote.id}/invoice`, {
      method: 'POST',
      cookie,
    })
    invoice = created.data?.data
  }
  check('E2E-invoice', Boolean(invoice?.id), invoice?.invoice_number || createdError(invoice))

  if (invoice?.invoice_number === 'INV-2026-000009') {
    check(
      'INV-2026-000009-dues',
      Number(invoice.total) === 2820 &&
        Number(invoice.deposit_amount) === 846 &&
        Number(invoice.balance_amount) === 1974 &&
        Number(invoice.deposit_due) === 846 &&
        Number(invoice.balance_due) === 1974 &&
        Number(invoice.full_due) === 2820,
      JSON.stringify({
        total: invoice.total,
        deposit_due: invoice.deposit_due,
        balance_due: invoice.balance_due,
        full_due: invoice.full_due,
      }),
    )
  } else {
    check(
      'INV-2026-000009-dues',
      Boolean(officialInvoice) &&
        Number(officialInvoice.total) === 2820 &&
        Number(officialInvoice.deposit_amount) === 846 &&
        Number(officialInvoice.balance_amount) === 1974,
      officialInvoice?.invoice_number || 'invoice-not-in-session',
    )
  }

  if (invoice?.id) {
    const deposit = await jsonFetch(`/api/invoices/${invoice.id}/payment-link`, {
      method: 'POST',
      cookie,
      body: { purpose: 'deposit' },
    })
    const balance = await jsonFetch(`/api/invoices/${invoice.id}/payment-link`, {
      method: 'POST',
      cookie,
      body: { purpose: 'balance' },
    })
    const depositUrl = deposit.data?.data?.url || ''
    const balanceUrl = balance.data?.data?.url || ''
    check(
      'E2E-deposit-link',
      deposit.response.ok && /\/pay\/[^/]+$/.test(depositUrl),
      depositUrl ? 'url' : deposit.data?.error || String(deposit.response.status),
    )
    check(
      'E2E-balance-link',
      balance.response.status === 409 &&
        balance.data?.error === 'balance_not_available_yet',
      `${balance.response.status} ${balance.data?.error}`,
    )
    if (invoice.invoice_number === 'INV-2026-000009') {
      check(
        'INV-2026-000009-link-amounts',
        Number(deposit.data?.data?.amount) === 846 &&
          balance.response.status === 409 &&
          balance.data?.error === 'balance_not_available_yet',
        `${deposit.data?.data?.amount} / ${balance.data?.error}`,
      )
    }
    check(
      'E2E-url-has-no-phone',
      !depositUrl.includes(String(quote.phone || 'nope')) &&
        !depositUrl.includes('1407') &&
        !depositUrl.includes('amount='),
      depositUrl.slice(-24),
    )

    const token = depositUrl.split('/pay/')[1] || ''
    if (token) {
      const pay = await fetch(`${base}/pay/${token}`, {
        redirect: 'manual',
        headers: { 'user-agent': 'WhatsApp/2.23.0' },
      })
      const payHtml = await pay.text()
      check(
        'E2E-pay-company-brand',
        payHtml.includes('data-company-brand=') &&
          !payHtml.includes('>CDL BBQ AT HOME<') &&
          /data-company-brand="[^"]+"/.test(payHtml),
        (payHtml.match(/data-company-brand="([^"]*)"/) || [])[1] || 'missing-brand',
      )
      if (invoice.invoice_number === 'INV-2026-000009') {
        check(
          'INV-2026-000009-pay-amounts',
          payHtml.includes('data-amount-due-value="846.00"') &&
            payHtml.includes('data-testid="invoice-adults"') &&
            payHtml.includes('data-testid="invoice-children-4-12"'),
          payHtml.includes('data-amount-due-value="846.00"') ? '846 + breakdown' : 'missing-846',
        )
        const depositOrder = await jsonFetch('/api/payments/paypal/orders', {
          method: 'POST',
          cookie,
          body: { token, amount: 99999 },
        })
        const depositOrderAmount = Number(depositOrder.data?.data?.amount)
        check(
          'INV-2026-000009-paypal-amounts',
          (depositOrder.response.ok && depositOrderAmount === 846) ||
            depositOrder.data?.error === 'paypal_public_checkout_off' ||
            depositOrder.data?.error === 'paypal_not_configured',
          depositOrder.response.ok
            ? String(depositOrderAmount)
            : String(depositOrder.data?.error || depositOrder.response.status),
        )
      }
      const title = metaContent(payHtml, 'og:title')
      const description = metaContent(payHtml, 'og:description')
      const image = metaContent(payHtml, 'og:image')
      check('E2E-pay-page', pay.status === 200 && payHtml.includes('data-public-payment'), String(pay.status))
      check(
        'E2E-og-title-company',
        Boolean(title) && !/\+\d{8,}|@/.test(title) && !title.includes(token),
        title || 'missing-title',
      )
      check(
        'E2E-og-description',
        description === paymentOgDescription('pt') ||
          description === paymentOgDescription('en') ||
          description === paymentOgDescription('es'),
        description || 'missing-desc',
      )
      check(
        'E2E-og-image-no-token',
        /\/api\/public\/company-brand\//.test(image) && !image.includes(token),
        image.slice(-80),
      )
      const imagePath = image.startsWith('http')
        ? new URL(image).pathname
        : image.replace(/^https?:\/\/[^/]+/, '')
      const ogImage = await fetch(`${base}${imagePath}`)
      const ogType = ogImage.headers.get('content-type') || ''
      check(
        'E2E-og-image-status',
        ogImage.status === 200 && /image\//.test(ogType),
        `${ogImage.status} ${ogType}`,
      )
      check(
        'E2E-pay-html-no-customer-phone',
        !payHtml.includes('data-testid="customer-whatsapp-number"') &&
          !payHtml.includes('Enviar sinal no WhatsApp'),
        'public page isolated',
      )

      const companyA = '65fd576f-8d97-49ba-bf38-61bc1e94e94a'
      const companyB = 'a1111111-1111-4111-8111-111111111111'
      const [logoA, logoB, fallback] = await Promise.all([
        fetch(`${base}/api/public/company-brand/${companyA}/og`),
        fetch(`${base}/api/public/company-brand/${companyB}/og`),
        fetch(`${base}/api/public/company-brand/fallback/og`),
      ])
      const bytesA = Buffer.from(await logoA.arrayBuffer())
      const bytesB = Buffer.from(await logoB.arrayBuffer())
      const bytesF = Buffer.from(await fallback.arrayBuffer())
  check(
    'N-company-a-og',
    logoA.status === 200 && bytesA.length > 1000,
    `${logoA.status} ${bytesA.length}`,
  )
      check(
        'O-company-b-og',
        logoB.status === 200 && bytesB.length > 1000 && !bytesA.equals(bytesB),
        `${bytesA.length} vs ${bytesB.length}`,
      )
      check(
        'P-fallback-og',
        fallback.status === 200 && bytesF.length > 1000,
        String(fallback.status),
      )
    }
  }

  const unauth = await fetch(`${base}/quotes/${quote.id}`, { redirect: 'manual' })
  const unauthLocation = unauth.headers.get('location') || ''
  check(
    'E2E-unauth-quote',
    unauth.status === 307 || unauth.status === 302 || unauthLocation.includes('/login'),
    `${unauth.status} ${unauthLocation}`,
  )

  const failed = rows.filter((row) => !row.ok)
  console.log(JSON.stringify({ passed: rows.filter((r) => r.ok).length, failed: failed.length }))
  if (failed.length) process.exit(1)
}

function createdError(invoice) {
  return invoice?.id ? invoice.id : 'no-invoice'
}

await main()
