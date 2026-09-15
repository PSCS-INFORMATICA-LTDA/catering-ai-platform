/**
 * PayPal Sandbox proof for an approved coupon quote.
 * Never uses PayPal Live. Does not print secrets.
 *
 *   COUPON_E2E_BASE_URL=https://... node scripts/dev/test-coupon-paypal-sandbox.mjs
 */
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { assertDevUrl, DEV_REF, loadDevEnv } from './loadDevEnv.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const COMPANY = '65fd576f-8d97-49ba-bf38-61bc1e94e94a'
const BASE = (process.env.COUPON_E2E_BASE_URL || '').replace(/\/$/, '')
const QUOTE_ID = process.env.COUPON_PAYPAL_QUOTE_ID || '9ebe683e-2434-4e4a-ad62-b463af7594b6'

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
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      origin: BASE,
      'content-type': 'application/json',
      ...(cookie ? { cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await response.json().catch(() => null)
  return { response, data }
}

async function main() {
  if (!BASE) throw new Error('COUPON_E2E_BASE_URL required')
  if (/cateringai\.app/i.test(BASE)) throw new Error('Refused: production host')
  const env = loadDevEnv(root)
  assertDevUrl(env.url)
  const db = createClient(env.url, env.service, { auth: { persistSession: false, autoRefreshToken: false } })
  const anon = createClient(env.url, env.anon, { auth: { persistSession: false, autoRefreshToken: false } })

  const paypal = await db
    .from('company_payment_providers')
    .select('environment, enabled, public_client_id')
    .eq('company_id', COMPANY)
    .eq('provider', 'paypal')
    .maybeSingle()
  if (paypal.data?.environment === 'live') {
    throw new Error('Refused: PayPal LIVE')
  }

  const quote = await db
    .from('quotes')
    .select('id, quote_total, reservation_amount, balance_due, discount_amount, quote_status, proposal_response')
    .eq('id', QUOTE_ID)
    .eq('company_id', COMPANY)
    .maybeSingle()
  if (!quote.data) throw new Error('approved quote missing')

  const accepted = await db
    .from('quotes')
    .update({
      quote_status: 'accepted',
      proposal_response: 'accepted',
    })
    .eq('id', QUOTE_ID)
    .eq('company_id', COMPANY)
    .select('id, quote_total, reservation_amount')
    .maybeSingle()
  if (accepted.error) throw new Error(accepted.error.message)

  const signed = await anon.auth.signInWithPassword({
    email: process.env.CATERING_DEV_LOGIN_EMAIL,
    password: process.env.CATERING_DEV_LOGIN_PASSWORD,
  })
  if (signed.error || !signed.data.session) throw new Error('admin login failed')
  const cookie = authCookie(signed.data.session)

  const invoice = await jsonFetch(`/api/quotes/${QUOTE_ID}/invoice`, {
    method: 'POST',
    cookie,
  })
  const invoiceData = invoice.data?.data || invoice.data
  const invoiceOk = invoice.response.ok && Boolean(invoiceData?.id)
  console.log(JSON.stringify({
    step: 'invoice',
    ok: invoiceOk,
    status: invoice.response.status,
    invoiceId: invoiceData?.id || null,
    invoiceTotal: invoiceData?.total ?? null,
    invoiceDeposit: invoiceData?.deposit_amount ?? null,
    quoteTotal: quote.data.quote_total,
    quoteDeposit: quote.data.reservation_amount,
    quoteDiscount: quote.data.discount_amount,
    error: invoiceOk ? null : invoice.data,
  }, null, 2))
  if (!invoiceOk) {
    console.log('PAYPAL_SANDBOX=BLOCKED invoice_create_failed')
    process.exit(2)
  }

  const paypalOrder = await jsonFetch('/api/payments/paypal/orders', {
    method: 'POST',
    cookie,
    body: {
      invoiceId: invoiceData.id,
      purpose: 'deposit',
      amount: 1,
    },
  })
  const order = paypalOrder.data || {}
  const orderAmount = Number(order.amount ?? order.data?.amount ?? NaN)
  const expected = Number(invoiceData.deposit_amount ?? quote.data.reservation_amount)
  const amountMatches =
    paypalOrder.response.ok &&
    Number.isFinite(orderAmount) &&
    Math.abs(orderAmount - expected) < 0.01 &&
    orderAmount !== 1
  console.log(JSON.stringify({
    step: 'paypal_order',
    ok: amountMatches,
    status: paypalOrder.response.status,
    environment: paypal.data?.environment || null,
    paypalEnabled: paypal.data?.enabled === true,
    invoiceId: invoiceData.id,
    quoteId: QUOTE_ID,
    quoteTotal: quote.data.quote_total,
    invoiceTotal: invoiceData.total,
    invoiceDeposit: invoiceData.deposit_amount,
    paypalAmount: Number.isFinite(orderAmount) ? orderAmount : null,
    forgedClientAmount: 1,
    ignoredForgedAmount: amountMatches,
    error: paypalOrder.response.ok ? null : { code: order.error || order.code || null },
  }, null, 2))
  if (!amountMatches) {
    console.log('PAYPAL_SANDBOX=BLOCKED')
    process.exit(2)
  }
  console.log('PAYPAL_SANDBOX=PASS')
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  console.log('PAYPAL_SANDBOX=BLOCKED')
  process.exit(2)
})
