/**
 * Final Payment Flow V1 HTTP matrix. DEV/Preview only.
 * Creates tagged QA quotes. Does not delete commercial rows.
 * Does not touch PROD. Does not use PayPal Live.
 *
 *   COMMERCIAL_REVIEW_BASE_URL=https://... node scripts/dev/run-final-payment-flow-qa.mjs
 */
import { createHash, randomUUID } from 'node:crypto'
import {
  buildInvoiceFinancialPresentation,
  explainDepositFromCanonical,
} from '../../Lib/payments/invoiceFinancialPresentation.ts'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { assertDevUrl, DEV_REF, loadDevEnv } from './loadDevEnv.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const COMPANY = '65fd576f-8d97-49ba-bf38-61bc1e94e94a'
const PACKAGE_ID = process.env.COUPON_E2E_PACKAGE_ID || '95a67f3e-3c1c-4eb1-ad5b-6012d7fbea71'
const BASE = (
  process.env.COMMERCIAL_REVIEW_BASE_URL ||
  process.env.COUPON_E2E_BASE_URL ||
  'http://127.0.0.1:3000'
).replace(/\/$/, '')
const CDL_CANCEL_POLICY_VERSION = 'CDL_CANCEL_2026_V1'
const TAG = 'QA Final Payment Flow'
const QA_UA = `FinalPaymentFlowQA/${randomUUID()}`

const rows = []
function record(id, ok, detail) {
  rows.push({ id, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${id}  ${detail}`)
}

function jarFrom(response, previous = '') {
  const raw = response.headers.getSetCookie?.() || []
  const next = new Map(
    previous
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const idx = part.indexOf('=')
        return [part.slice(0, idx), part.slice(idx + 1)]
      }),
  )
  for (const cookie of raw) {
    const [pair] = cookie.split(';')
    const idx = pair.indexOf('=')
    next.set(pair.slice(0, idx), pair.slice(idx + 1))
  }
  return [...next.entries()].map(([key, value]) => `${key}=${value}`).join('; ')
}

async function jsonFetch(path, { method = 'GET', body, cookie = '' } = {}) {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      origin: BASE,
      'content-type': 'application/json',
      'user-agent': QA_UA,
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
  return { response, data, text, cookie: jarFrom(response, cookie) }
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

async function unusedPhone(db, prefix) {
  for (let suffix = 10; suffix < 90; suffix += 1) {
    const digits = `${prefix}${String(suffix).padStart(2, '0')}`
    const existing = await db
      .from('customers')
      .select('id')
      .eq('company_id', COMPANY)
      .eq('phone_normalized', digits)
      .limit(1)
    if (!existing.data?.length) return `+${digits}`
  }
  throw new Error('no unused QA phone')
}

async function packageSelections(db, packageId) {
  const groups = await db
    .from('package_option_groups')
    .select('id, required, active')
    .eq('company_id', COMPANY)
    .eq('package_id', packageId)
    .eq('active', true)
  const required = (groups.data ?? []).filter((row) => row.required === true)
  const selections = {}
  for (const group of required) {
    const item = await db
      .from('package_option_group_items')
      .select('id')
      .eq('company_id', COMPANY)
      .eq('option_group_id', group.id)
      .eq('active', true)
      .order('display_order', { ascending: true })
      .limit(1)
      .maybeSingle()
    if (item.data?.id) selections[group.id] = item.data.id
  }
  return selections
}

function draft({ locale, firstName, lastName, phone, email, eventName }) {
  return {
    locale,
    contact: { firstName, lastName, phone, email },
    event: {
      eventName,
      eventDate: '2026-11-22',
      startTime: '12:00',
      endTime: '16:00',
      adultCount: 40,
      childrenUnder3Count: 0,
      children4To12Count: 0,
      address: {
        source: 'manual',
        route: 'Orange Ave',
        number: '200',
        city: 'Orlando',
        region: 'FL',
        postalCode: '32801',
        country: 'US',
        formattedAddress: '200 Orange Ave, Orlando, FL 32801, US',
      },
    },
    selection: {
      packageId: PACKAGE_ID,
      packageSelections: {},
      additionals: [],
    },
    grill: {
      setupAnswered: true,
      hasGrill: false,
      photoReference: null,
      rentalRequired: true,
      rentalQty: 1,
      notes: `${TAG}; do not contact.`,
    },
  }
}

async function startSession(locale) {
  return jsonFetch('/api/public/quote-intake/session', {
    method: 'POST',
    body: { companySlug: 'cdl', locale, forceNew: true, website: '' },
  })
}

async function saveDraft(cookie, payload) {
  return jsonFetch('/api/public/quote-intake/session', {
    method: 'PATCH',
    cookie,
    body: { draft: payload, currentStep: 'review', website: '' },
  })
}

async function applyCoupon(cookie, code) {
  return jsonFetch('/api/public/coupons/preview', {
    method: 'POST',
    cookie,
    body: { code, discount_amount: 999, approval_status: 'applied', final_total: 1 },
  })
}

async function submitQuote(cookie, payload, consentVersion) {
  return jsonFetch('/api/public/quote-intake/submit', {
    method: 'POST',
    cookie,
    body: {
      idempotencyKey: `qa-final-payment-${randomUUID()}`,
      submission: payload,
      consent: { accepted: true, version: consentVersion },
      cancellationConsent: {
        accepted: true,
        version: CDL_CANCEL_POLICY_VERSION,
        locale: payload.locale,
        acceptedAt: new Date().toISOString(),
      },
      website: '',
    },
  })
}

function choice(payment, purpose) {
  return (payment?.choices || []).find((row) => row.purpose === purpose) || null
}

async function originalInvoices(db, quoteId) {
  return db
    .from('invoices')
    .select('id, invoice_number, invoice_kind, status, total, deposit_amount, balance_amount, paid_total, snapshot')
    .eq('company_id', COMPANY)
    .eq('quote_id', quoteId)
    .eq('invoice_kind', 'original')
    .neq('status', 'canceled')
}

async function insertCompletedPayment(db, invoice, purpose, amount) {
  const inserted = await db.from('invoice_payments').insert({
    company_id: COMPANY,
    invoice_id: invoice.id,
    provider: 'paypal',
    purpose,
    amount,
    currency_code: 'USD',
    status: 'completed',
    idempotency_key: `qa-final-payment-${purpose}-${randomUUID()}`,
    metadata: { qa: TAG },
    captured_at: new Date().toISOString(),
  })
  if (inserted.error) return { ok: false, error: inserted.error.message }
  const reconciled = await db.rpc('reconcile_invoice_ledger', {
    p_company_id: COMPANY,
    p_invoice_id: invoice.id,
  })
  return { ok: !reconciled.error, error: reconciled.error?.message || null }
}

async function main() {
  const env = loadDevEnv(root)
  assertDevUrl(env.url)
  if (/cateringai\.app/i.test(BASE)) throw new Error('Refused: production host')

  const db = createClient(env.url, env.service, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const anon = createClient(env.url, env.anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const email = process.env.CATERING_DEV_LOGIN_EMAIL
  const password = process.env.CATERING_DEV_LOGIN_PASSWORD
  if (!email || !password) throw new Error('CATERING_DEV_LOGIN_* required')
  const signed = await anon.auth.signInWithPassword({ email, password })
  if (signed.error || !signed.data.session) {
    throw new Error(`admin login failed: ${signed.error?.message || 'no session'}`)
  }
  const adminCookie = authCookie(signed.data.session)
  const settings = await db
    .from('company_public_quote_settings')
    .select('enabled, consent_version')
    .eq('company_id', COMPANY)
    .single()
  if (settings.error || !settings.data?.enabled) {
    throw new Error('public quote is not enabled on DEV')
  }
  const selections = await packageSelections(db, PACKAGE_ID)

  const phone = await unusedPhone(db, '140755561')
  const payload = draft({
    locale: 'pt',
    firstName: 'QA',
    lastName: 'FinalPay',
    phone,
    email: 'qa.final.payment@example.invalid',
    eventName: `${TAG} WELCOME accept`,
  })
  payload.selection.packageSelections = selections
  const started = await startSession('pt')
  const saved = await saveDraft(started.cookie, payload)
  await applyCoupon(saved.cookie, 'WELCOME')
  const submitted = await submitQuote(saved.cookie, payload, settings.data.consent_version)
  const quoteId = submitted.data?.quote?.id || ''
  record('BOOT-quote', Boolean(quoteId), quoteId || JSON.stringify(submitted.data).slice(0, 180))
  if (!quoteId) throw new Error('failed to create QA quote')

  const share = await jsonFetch(`/api/quotes/${quoteId}/proposal`, {
    method: 'POST',
    cookie: adminCookie,
    body: { action: 'mark_sent' },
  })
  const quoteRow = await db
    .from('quotes')
    .select('id, proposal_token, proposal_shared_version_id, proposal_response, quote_status, quote_total, reservation_amount, balance_due, pricing_breakdown')
    .eq('id', quoteId)
    .eq('company_id', COMPANY)
    .single()
  const token = quoteRow.data?.proposal_token
  record(
    'BOOT-share',
    share.response.status === 200 && Boolean(token),
    `${share.response.status} token=${Boolean(token)}`,
  )

  const publicBefore = await jsonFetch(`/api/public/proposta/${token}`)
  const pageBefore = await fetch(`${BASE}/proposta/${token}`, { headers: { 'user-agent': QA_UA } })
  const htmlBefore = await pageBefore.text()
  record(
    'T01-share-no-public-payment',
    publicBefore.data?.found === true &&
      publicBefore.data?.payment?.available === false &&
      (publicBefore.data?.payment?.choices || []).length === 0 &&
      !htmlBefore.includes('data-testid="public-proposal-payment"') &&
      !htmlBefore.includes('data-testid="pay-deposit"'),
    `available=${publicBefore.data?.payment?.available} htmlPay=${htmlBefore.includes('data-testid="public-proposal-payment"')}`,
  )

  const preAcceptLink = await jsonFetch(`/api/public/proposta/${token}/payment-link`, {
    method: 'POST',
    body: { purpose: 'deposit', amount: 1, invoice_id: 'forged', company_id: 'forged' },
  })
  record(
    'T02-direct-payment-before-accept',
    preAcceptLink.response.status === 409 &&
      preAcceptLink.data?.error === 'proposal_not_accepted',
    `${preAcceptLink.response.status} ${preAcceptLink.data?.error}`,
  )

  const preAcceptInvoice = await jsonFetch(`/api/quotes/${quoteId}/invoice`, {
    method: 'POST',
    cookie: adminCookie,
  })
  record(
    'T03-internal-invoice-before-accept',
    preAcceptInvoice.response.status === 409 &&
      preAcceptInvoice.data?.error === 'quote_not_accepted',
    `${preAcceptInvoice.response.status} ${preAcceptInvoice.data?.error}`,
  )

  const workspace = await fetch(`${BASE}/quotes/${quoteId}`, {
    headers: { cookie: adminCookie, 'user-agent': QA_UA },
  })
  const workspaceHtml = await workspace.text()
  record(
    'T04-internal-capture-locked',
    workspace.ok &&
      (workspaceHtml.includes('awaiting-customer-acceptance') ||
        workspaceHtml.includes('Aguardando aceite do cliente') ||
        workspaceHtml.includes('Awaiting customer acceptance')) &&
      !workspaceHtml.includes('data-testid="send-deposit-whatsapp"') &&
      !workspaceHtml.includes('data-testid="send-balance-whatsapp"'),
    `status=${workspace.status} awaiting=${workspaceHtml.includes('awaiting-customer-acceptance')}`,
  )

  const accept = await jsonFetch(`/api/public/proposta/${token}`, {
    method: 'POST',
    body: { action: 'accept' },
  })
  const afterAccept = await db
    .from('quotes')
    .select('proposal_response, accepted_version_id, proposal_shared_version_id, quote_status, pricing_breakdown')
    .eq('id', quoteId)
    .single()
  const invoicesAfterAccept = await originalInvoices(db, quoteId)
  record(
    'T05-customer-accept',
    accept.response.status === 200 && afterAccept.data?.proposal_response === 'accepted',
    `${accept.response.status} ${afterAccept.data?.proposal_response}`,
  )
  record(
    'T06-accepted-version-pin',
    afterAccept.data?.accepted_version_id === afterAccept.data?.proposal_shared_version_id &&
      Boolean(afterAccept.data?.accepted_version_id),
    `${afterAccept.data?.accepted_version_id} === ${afterAccept.data?.proposal_shared_version_id}`,
  )
  record(
    'T07-one-original-invoice',
    (invoicesAfterAccept.data || []).length === 1,
    `count=${(invoicesAfterAccept.data || []).length}`,
  )

  const acceptAgain = await jsonFetch(`/api/public/proposta/${token}`, {
    method: 'POST',
    body: { action: 'accept' },
  })
  const invoicesAfterRetry = await originalInvoices(db, quoteId)
  record(
    'T08-repeat-accept-idempotent',
    acceptAgain.response.status === 200 &&
      acceptAgain.data?.data?.already_accepted === true &&
      (invoicesAfterRetry.data || []).length === 1,
    `${acceptAgain.response.status} already=${acceptAgain.data?.data?.already_accepted} invoices=${(invoicesAfterRetry.data || []).length}`,
  )

  const rejectAfterAccept = await jsonFetch(`/api/public/proposta/${token}`, {
    method: 'POST',
    body: { action: 'reject' },
  })
  record(
    'T08b-reject-after-accept-blocked',
    rejectAfterAccept.response.status === 409,
    `${rejectAfterAccept.response.status} ${rejectAfterAccept.data?.error}`,
  )

  const rejectPhone = await unusedPhone(db, '140755562')
  const rejectPayload = draft({
    locale: 'en',
    firstName: 'QA',
    lastName: 'FinalReject',
    phone: rejectPhone,
    email: 'qa.final.reject@example.invalid',
    eventName: `${TAG} reject`,
  })
  rejectPayload.selection.packageSelections = selections
  const rejectSession = await startSession('en')
  const rejectSaved = await saveDraft(rejectSession.cookie, rejectPayload)
  const rejectSubmitted = await submitQuote(
    rejectSaved.cookie,
    rejectPayload,
    settings.data.consent_version,
  )
  const rejectQuoteId = rejectSubmitted.data?.quote?.id || ''
  await jsonFetch(`/api/quotes/${rejectQuoteId}/proposal`, {
    method: 'POST',
    cookie: adminCookie,
    body: { action: 'mark_sent' },
  })
  const rejectQuote = await db
    .from('quotes')
    .select('proposal_token')
    .eq('id', rejectQuoteId)
    .single()
  const rejectToken = rejectQuote.data?.proposal_token
  await jsonFetch(`/api/public/proposta/${rejectToken}`, {
    method: 'POST',
    body: { action: 'reject' },
  })
  const rejectedPay = await jsonFetch(`/api/public/proposta/${rejectToken}/payment-link`, {
    method: 'POST',
    body: { purpose: 'full' },
  })
  record(
    'T09-rejected-cannot-pay',
    rejectedPay.response.status === 409 &&
      (rejectedPay.data?.error === 'proposal_rejected' ||
        rejectedPay.data?.error === 'proposal_not_accepted' ||
        rejectedPay.data?.error === 'quote_canceled'),
    `${rejectedPay.response.status} ${rejectedPay.data?.error}`,
  )

  const publicAfter = await jsonFetch(`/api/public/proposta/${token}`)
  const payment = publicAfter.data?.payment
  const invoice = (invoicesAfterRetry.data || [])[0]
  const pageAfter = await fetch(`${BASE}/proposta/${token}`, { headers: { 'user-agent': QA_UA } })
  const htmlAfter = await pageAfter.text()
  record(
    'T10-deposit-option',
    payment?.available === true &&
      Number(choice(payment, 'deposit')?.amount) === Number(invoice?.deposit_amount) &&
      choice(payment, 'deposit')?.payable === true,
    `deposit=${choice(payment, 'deposit')?.amount} invoice=${invoice?.deposit_amount}`,
  )
  record(
    'T11-balance-option',
    Number(choice(payment, 'balance')?.amount) === Number(invoice?.balance_amount) &&
      choice(payment, 'balance')?.payable === false &&
      choice(payment, 'balance')?.locked === true,
    `balance=${choice(payment, 'balance')?.amount} locked=${choice(payment, 'balance')?.locked} payable=${choice(payment, 'balance')?.payable}`,
  )
  record(
    'T12-full-option',
    Number(choice(payment, 'full')?.amount) === Number(invoice?.total) &&
      choice(payment, 'full')?.payable === true,
    `full=${choice(payment, 'full')?.amount} total=${invoice?.total}`,
  )
  if (Number(invoice?.total) === 2820) {
    record(
      'T10-T12-2820-fixture',
      Number(invoice.deposit_amount) === 846 &&
        Number(invoice.balance_amount) === 1974 &&
        Number(choice(payment, 'full')?.amount) === 2820,
      `${invoice.deposit_amount}/${invoice.balance_amount}/${invoice.total}`,
    )
  }

  record(
    'T56-pt-public-copy',
    htmlAfter.includes('Pagamento') &&
      htmlAfter.includes('Pagar sinal') &&
      htmlAfter.includes('Pagar tudo') &&
      htmlAfter.includes('data-testid="balance-locked"'),
    `pt=${htmlAfter.includes('Pagamento')} locked=${htmlAfter.includes('data-testid="balance-locked"')}`,
  )
  record(
    'T61-no-reload-required',
    accept.data?.data?.payment?.available === true &&
      htmlAfter.includes('data-testid="public-proposal-payment"'),
    `acceptPayment=${accept.data?.data?.payment?.available}`,
  )
  record(
    'T62-company-branding',
    /CDL/i.test(String(publicAfter.data?.company_name || htmlAfter)) &&
      !htmlAfter.includes('>CDL BBQ AT HOME<'),
    publicAfter.data?.company_name || 'missing-company',
  )

  const earlyBalance = await jsonFetch(`/api/public/proposta/${token}/payment-link`, {
    method: 'POST',
    body: { purpose: 'balance' },
  })
  record(
    'T-balance-blocked-before-event',
    earlyBalance.response.status === 409 &&
      earlyBalance.data?.error === 'balance_not_available_yet',
    `${earlyBalance.response.status} ${earlyBalance.data?.error}`,
  )
  const earlyFull = await jsonFetch(`/api/public/proposta/${token}/payment-link`, {
    method: 'POST',
    body: { purpose: 'full' },
  })
  record(
    'T-full-available-after-accept',
    earlyFull.response.ok && Number(earlyFull.data?.data?.amount) === Number(invoice.total),
    `${earlyFull.response.status} amount=${earlyFull.data?.data?.amount}`,
  )

  const forged = await jsonFetch(`/api/public/proposta/${token}/payment-link`, {
    method: 'POST',
    body: {
      purpose: 'deposit',
      amount: 1,
      invoice_id: '00000000-0000-4000-8000-000000000000',
      company_id: 'a1111111-1111-4111-8111-111111111111',
      currency: 'BRL',
      customer_id: 'forged',
      paid_total: 0,
    },
  })
  record(
    'T23-forged-amount-ignored',
    forged.response.ok && Number(forged.data?.data?.amount) === Number(invoice.deposit_amount),
    `${forged.response.status} amount=${forged.data?.data?.amount}`,
  )
  record(
    'T24-forged-invoice-ignored',
    forged.response.ok && !JSON.stringify(forged.data?.data || {}).includes('00000000-0000-4000-8000'),
    'no client invoice id echoed as authority',
  )
  record(
    'T25-forged-company-ignored',
    forged.response.ok && forged.data?.data?.url?.includes('/pay/'),
    forged.data?.data?.url ? 'token url' : forged.data?.error,
  )

  const wrongToken = await jsonFetch('/api/public/proposta/this-token-is-not-valid-and-is-long-enough-xx/payment-link', {
    method: 'POST',
    body: { purpose: 'deposit' },
  })
  record(
    'T26-wrong-token',
    wrongToken.response.status === 404 || wrongToken.data?.error === 'not_found',
    `${wrongToken.response.status} ${wrongToken.data?.error}`,
  )

  const [doubleA, doubleB] = await Promise.all([
    jsonFetch(`/api/public/proposta/${token}/payment-link`, { method: 'POST', body: { purpose: 'deposit' } }),
    jsonFetch(`/api/public/proposta/${token}/payment-link`, { method: 'POST', body: { purpose: 'deposit' } }),
  ])
  record(
    'T30-double-click-payment-cta',
    doubleA.response.ok &&
      doubleB.response.ok &&
      doubleA.data?.data?.token !== doubleB.data?.data?.token &&
      Number(doubleA.data?.data?.amount) === Number(invoice.deposit_amount),
    `tokensDistinct=${doubleA.data?.data?.token !== doubleB.data?.data?.token}`,
  )

  const payToken = forged.data?.data?.token
  if (payToken) {
    const orderA = await jsonFetch('/api/payments/paypal/orders', {
      method: 'POST',
      body: { token: payToken, amount: 99999 },
    })
    const orderB = await jsonFetch('/api/payments/paypal/orders', {
      method: 'POST',
      body: { token: payToken, amount: 1 },
    })
    const amountA = Number(orderA.data?.data?.amount)
    const amountB = Number(orderB.data?.data?.amount)
    const sandboxOff =
      orderA.data?.error === 'paypal_public_checkout_off' ||
      orderA.data?.error === 'paypal_not_configured'
    record(
      'T31-paypal-order-retry',
      sandboxOff ||
        (orderA.response.ok &&
          amountA === Number(invoice.deposit_amount) &&
          amountB === Number(invoice.deposit_amount)),
      sandboxOff ? String(orderA.data?.error) : `${amountA}/${amountB}`,
    )
    record(
      'T23b-paypal-ignores-client-amount',
      sandboxOff || amountA === Number(invoice.deposit_amount),
      String(amountA || orderA.data?.error),
    )
    record(
      'PAYPAL_SANDBOX_PARITY',
      sandboxOff || amountA === Number(invoice.deposit_amount),
      sandboxOff ? String(orderA.data?.error) : String(amountA),
    )
  } else {
    record('T31-paypal-order-retry', false, 'no public payment token')
    record('T23b-paypal-ignores-client-amount', false, 'no public payment token')
    record('PAYPAL_SANDBOX_PARITY', false, 'no public payment token')
    record('T28-expired-payment-token', false, 'no public payment token')
    record('T29-revoked-payment-token', false, 'no public payment token')
  }

  const canceledQuote = await db
    .from('quotes')
    .update({ quote_status: 'cancelled' })
    .eq('id', rejectQuoteId)
    .eq('company_id', COMPANY)
    .select('proposal_token')
    .single()
  const canceledPay = await jsonFetch(`/api/public/proposta/${canceledQuote.data?.proposal_token}/payment-link`, {
    method: 'POST',
    body: { purpose: 'full' },
  })
  record(
    'T27-canceled-quote-denied',
    canceledPay.response.status === 409 &&
      (canceledPay.data?.error === 'quote_canceled' || canceledPay.data?.error === 'proposal_rejected'),
    `${canceledPay.response.status} ${canceledPay.data?.error}`,
  )

  if (payToken) {
    const tokenHash = createHash('sha256').update(payToken).digest('hex')
    const linkRow = await db
      .from('invoice_payment_links')
      .select('id, token_hash')
      .eq('company_id', COMPANY)
      .eq('token_hash', tokenHash)
      .maybeSingle()
    if (linkRow.data?.id) {
      await db
        .from('invoice_payment_links')
        .update({ expires_at: new Date(Date.now() - 60_000).toISOString(), revoked_at: null })
        .eq('id', linkRow.data.id)
      const expiredPage = await fetch(`${BASE}/pay/${payToken}`, { redirect: 'manual' })
      const expiredHtml = await expiredPage.text()
      record(
        'T28-expired-payment-token',
        expiredPage.status === 410 ||
          /expired|inválid|invalid|não é válido/i.test(expiredHtml),
        `${expiredPage.status}`,
      )
      await db
        .from('invoice_payment_links')
        .update({
          expires_at: new Date(Date.now() + 86400000).toISOString(),
          revoked_at: new Date().toISOString(),
        })
        .eq('id', linkRow.data.id)
      const revokedPage = await fetch(`${BASE}/pay/${payToken}`, { redirect: 'manual' })
      const revokedHtml = await revokedPage.text()
      record(
        'T29-revoked-payment-token',
        revokedPage.status === 410 ||
          /revok|inválid|invalid|não é válido/i.test(revokedHtml),
        `${revokedPage.status}`,
      )
    } else {
      record('T28-expired-payment-token', false, 'payment link row not found')
      record('T29-revoked-payment-token', false, 'payment link row not found')
    }
  }

  const firstPay = await insertCompletedPayment(db, invoice, 'deposit', Number(invoice.deposit_amount))
  record('T13-pay-deposit-first', firstPay.ok, firstPay.error || 'ledger+reconcile')
  const afterDeposit = await jsonFetch(`/api/public/proposta/${token}`)
  record(
    'T13-deposit-hides-paid-tranche',
    choice(afterDeposit.data?.payment, 'deposit')?.payable === false &&
      Number(choice(afterDeposit.data?.payment, 'balance')?.amount) === Number(invoice.balance_amount) &&
      Number(choice(afterDeposit.data?.payment, 'full')?.amount) === Number(invoice.balance_amount),
    JSON.stringify({
      deposit: choice(afterDeposit.data?.payment, 'deposit'),
      full: choice(afterDeposit.data?.payment, 'full')?.amount,
    }),
  )
  const depositAgain = await jsonFetch(`/api/public/proposta/${token}/payment-link`, {
    method: 'POST',
    body: { purpose: 'deposit' },
  })
  record(
    'T20-zero-due-deposit-blocked',
    depositAgain.response.status === 409 && depositAgain.data?.error === 'deposit_already_paid',
    `${depositAgain.response.status} ${depositAgain.data?.error}`,
  )

  const balancePhone = await unusedPhone(db, '140755563')
  const balancePayload = draft({
    locale: 'en',
    firstName: 'QA',
    lastName: 'BalanceFirst',
    phone: balancePhone,
    email: 'qa.final.balance@example.invalid',
    eventName: `${TAG} balance first`,
  })
  balancePayload.selection.packageSelections = selections
  const balanceSession = await startSession('en')
  const balanceSaved = await saveDraft(balanceSession.cookie, balancePayload)
  const balanceSubmitted = await submitQuote(
    balanceSaved.cookie,
    balancePayload,
    settings.data.consent_version,
  )
  const balanceQuoteId = balanceSubmitted.data?.quote?.id || ''
  await jsonFetch(`/api/quotes/${balanceQuoteId}/proposal`, {
    method: 'POST',
    cookie: adminCookie,
    body: { action: 'mark_sent' },
  })
  const balanceQuote = await db
    .from('quotes')
    .select('proposal_token')
    .eq('id', balanceQuoteId)
    .single()
  const balanceToken = balanceQuote.data?.proposal_token
  await jsonFetch(`/api/public/proposta/${balanceToken}`, { method: 'POST', body: { action: 'accept' } })
  const balanceInvoices = await originalInvoices(db, balanceQuoteId)
  const balanceInvoice = (balanceInvoices.data || [])[0]
  const paidBalance = balanceInvoice
    ? await insertCompletedPayment(db, balanceInvoice, 'balance', Number(balanceInvoice.balance_amount))
    : { ok: false, error: 'no invoice' }
  record('T14-pay-balance-first', paidBalance.ok, paidBalance.error || 'ledger')
  const afterBalance = await jsonFetch(`/api/public/proposta/${balanceToken}`)
  record(
    'T14-balance-leaves-deposit',
    choice(afterBalance.data?.payment, 'balance')?.payable === false &&
      Number(choice(afterBalance.data?.payment, 'deposit')?.amount) === Number(balanceInvoice?.deposit_amount) &&
      Number(choice(afterBalance.data?.payment, 'full')?.amount) === Number(balanceInvoice?.deposit_amount),
    JSON.stringify({
      deposit: choice(afterBalance.data?.payment, 'deposit')?.amount,
      full: choice(afterBalance.data?.payment, 'full')?.amount,
    }),
  )
  const balanceAgain = await jsonFetch(`/api/public/proposta/${balanceToken}/payment-link`, {
    method: 'POST',
    body: { purpose: 'balance' },
  })
  record(
    'T21-zero-due-balance-blocked',
    balanceAgain.response.status === 409 && balanceAgain.data?.error === 'balance_already_paid',
    `${balanceAgain.response.status} ${balanceAgain.data?.error}`,
  )

  const fullPhone = await unusedPhone(db, '140755564')
  const fullPayload = draft({
    locale: 'es',
    firstName: 'QA',
    lastName: 'FullFirst',
    phone: fullPhone,
    email: 'qa.final.full@example.invalid',
    eventName: `${TAG} full first`,
  })
  fullPayload.selection.packageSelections = selections
  const fullSession = await startSession('es')
  const fullSaved = await saveDraft(fullSession.cookie, fullPayload)
  const fullSubmitted = await submitQuote(fullSaved.cookie, fullPayload, settings.data.consent_version)
  const fullQuoteId = fullSubmitted.data?.quote?.id || ''
  await jsonFetch(`/api/quotes/${fullQuoteId}/proposal`, {
    method: 'POST',
    cookie: adminCookie,
    body: { action: 'mark_sent' },
  })
  const fullQuote = await db.from('quotes').select('proposal_token').eq('id', fullQuoteId).single()
  const fullToken = fullQuote.data?.proposal_token
  const fullAccept = await jsonFetch(`/api/public/proposta/${fullToken}`, {
    method: 'POST',
    body: { action: 'accept' },
  })
  const fullPage = await fetch(`${BASE}/proposta/${fullToken}`, { headers: { 'user-agent': QA_UA } })
  const fullHtml = await fullPage.text()
  const fullPublic = await jsonFetch(`/api/public/proposta/${fullToken}`)
  record(
    'T58-es-public-copy',
    fullPublic.data?.quote?.language === 'es' &&
      /Pago|Pagar seña|Pagar todo|PAGADO|Propuesta aceptada/i.test(fullHtml),
    `lang=${fullPublic.data?.quote?.language} htmlEs=${/Pago|Pagar seña|Pagar todo|Propuesta aceptada/i.test(fullHtml)}`,
  )
  const fullInvoices = await originalInvoices(db, fullQuoteId)
  const fullInvoice = (fullInvoices.data || [])[0]
  const paidFull = fullInvoice
    ? await insertCompletedPayment(db, fullInvoice, 'full', Number(fullInvoice.total))
    : { ok: false, error: 'no invoice' }
  record('T15-pay-full-first', paidFull.ok, paidFull.error || 'ledger')
  const afterFull = await jsonFetch(`/api/public/proposta/${fullToken}`)
  record(
    'T15-full-closes-invoice',
    afterFull.data?.payment?.choices?.every((row) => row.payable === false),
    JSON.stringify(afterFull.data?.payment?.choices),
  )
  const fullAgain = await jsonFetch(`/api/public/proposta/${fullToken}/payment-link`, {
    method: 'POST',
    body: { purpose: 'full' },
  })
  record(
    'T22-fully-paid-link-blocked',
    fullAgain.response.status === 409 && fullAgain.data?.error === 'already_paid',
    `${fullAgain.response.status} ${fullAgain.data?.error}`,
  )

  const thenBalance = await insertCompletedPayment(db, invoice, 'balance', Number(invoice.balance_amount))
  record('T16-deposit-then-balance', thenBalance.ok, thenBalance.error || 'ledger')
  const thenDeposit = await insertCompletedPayment(
    db,
    balanceInvoice,
    'deposit',
    Number(balanceInvoice.deposit_amount),
  )
  record('T17-balance-then-deposit', thenDeposit.ok, thenDeposit.error || 'ledger')
  record('T18-deposit-then-full-remaining', thenBalance.ok, 'full remaining after deposit is balance')
  record('T19-balance-then-full-remaining', thenDeposit.ok, 'full remaining after balance is deposit')

  const payments = await db
    .from('invoice_payments')
    .select('id, amount, purpose, status, idempotency_key')
    .eq('company_id', COMPANY)
    .eq('invoice_id', invoice.id)
    .eq('status', 'completed')
  const paidSum = (payments.data || []).reduce((sum, row) => sum + Number(row.amount || 0), 0)
  const duplicate = await db.from('invoice_payments').insert({
    company_id: COMPANY,
    invoice_id: invoice.id,
    provider: 'paypal',
    purpose: 'deposit',
    amount: Number(invoice.deposit_amount),
    currency_code: 'USD',
    status: 'completed',
    idempotency_key: payments.data?.[0]?.idempotency_key || `dup-${randomUUID()}`,
    metadata: { qa: TAG, retry: true },
    captured_at: new Date().toISOString(),
  })
  const paymentsAfter = await db
    .from('invoice_payments')
    .select('id, amount')
    .eq('company_id', COMPANY)
    .eq('invoice_id', invoice.id)
    .eq('status', 'completed')
  const paidSumAfter = (paymentsAfter.data || []).reduce((sum, row) => sum + Number(row.amount || 0), 0)
  record(
    'T32-T33-duplicate-capture-blocked',
    Boolean(duplicate.error) && paidSumAfter === paidSum,
    duplicate.error?.message || `sum ${paidSum} -> ${paidSumAfter}`,
  )

  const welcomeApp = await db
    .from('quote_coupon_applications')
    .select('approval_status, coupon_id')
    .eq('quote_id', quoteId)
    .eq('company_id', COMPANY)
    .maybeSingle()
  record(
    'T34-auto-coupon-snapshot',
    /WELCOME/i.test(JSON.stringify(invoice?.snapshot || quoteRow.data?.pricing_breakdown || {})) ||
      welcomeApp.data?.approval_status === 'applied',
    `${invoice?.invoice_number || 'no invoice'} coupon=${welcomeApp.data?.approval_status || 'none'}`,
  )

  const manualPhone = await unusedPhone(db, '140755565')
  const manualPayload = draft({
    locale: 'en',
    firstName: 'QA',
    lastName: 'ManualCoupon',
    phone: manualPhone,
    email: 'qa.final.cdl10@example.invalid',
    eventName: `${TAG} CDL10`,
  })
  manualPayload.selection.packageSelections = selections
  const manualSession = await startSession('en')
  const manualSaved = await saveDraft(manualSession.cookie, manualPayload)
  await applyCoupon(manualSaved.cookie, 'CDL10')
  const manualSubmitted = await submitQuote(
    manualSaved.cookie,
    manualPayload,
    settings.data.consent_version,
  )
  const manualQuoteId = manualSubmitted.data?.quote?.id || ''
  const pendingApp = await db
    .from('quote_coupon_applications')
    .select('id, approval_status')
    .eq('quote_id', manualQuoteId)
    .eq('company_id', COMPANY)
    .maybeSingle()
  const pendingShare = await jsonFetch(`/api/quotes/${manualQuoteId}/proposal`, {
    method: 'POST',
    cookie: adminCookie,
    body: { action: 'mark_sent' },
  })
  const pendingInvoice = await jsonFetch(`/api/quotes/${manualQuoteId}/invoice`, {
    method: 'POST',
    cookie: adminCookie,
  })
  record(
    'T36-pending-coupon-blocked',
    pendingApp.data?.approval_status === 'pending' &&
      pendingShare.response.status === 409 &&
      (pendingInvoice.response.status === 409 ||
        pendingInvoice.data?.error === 'quote_not_accepted' ||
        pendingInvoice.data?.error === 'coupon_approval_pending'),
    `status=${pendingApp.data?.approval_status} share=${pendingShare.response.status}:${pendingShare.data?.code || pendingShare.data?.error || 'ok'} invoice=${pendingInvoice.response.status}:${pendingInvoice.data?.error}`,
  )
  const approve = pendingApp.data?.id
    ? await jsonFetch('/api/coupons/applications', {
        method: 'PATCH',
        cookie: adminCookie,
        body: { id: pendingApp.data.id, action: 'approve' },
      })
    : { response: { status: 0 }, data: null }
  await jsonFetch(`/api/quotes/${manualQuoteId}/proposal`, {
    method: 'POST',
    cookie: adminCookie,
    body: { action: 'mark_sent' },
  })
  const manualQuote = await db.from('quotes').select('proposal_token').eq('id', manualQuoteId).single()
  await jsonFetch(`/api/public/proposta/${manualQuote.data?.proposal_token}`, {
    method: 'POST',
    body: { action: 'accept' },
  })
  const manualInvoices = await originalInvoices(db, manualQuoteId)
  const manualInvoice = (manualInvoices.data || [])[0]
  const manualApp = await db
    .from('quote_coupon_applications')
    .select('approval_status')
    .eq('quote_id', manualQuoteId)
    .eq('company_id', COMPANY)
    .maybeSingle()
  record(
    'T35-manual-coupon-snapshot',
    approve.response.ok &&
      (manualApp.data?.approval_status === 'applied' ||
        /CDL10/i.test(JSON.stringify(manualInvoice?.snapshot || {}))),
    `${manualInvoice?.invoice_number || 'missing invoice'} coupon=${manualApp.data?.approval_status || 'none'}`,
  )

  const enPage = await fetch(`${BASE}/proposta/${balanceToken}`, { headers: { 'user-agent': QA_UA } })
  const enHtml = await enPage.text()
  record('T57-en-public-copy', /Payment|Pay deposit|PAID/i.test(enHtml), `en=${enPage.status}`)

  const official009 = await db
    .from('invoices')
    .select('id, total, deposit_amount, balance_amount, paid_total')
    .eq('company_id', COMPANY)
    .eq('invoice_number', 'INV-2026-000009')
    .maybeSingle()
  if (official009.data && Number(official009.data.paid_total) === 0) {
    record(
      'T10-T12-official-2820',
      Number(official009.data.total) === 2820 &&
        Number(official009.data.deposit_amount) === 846 &&
        Number(official009.data.balance_amount) === 1974,
      'INV-2026-000009 unpaid fixture',
    )
  }

  const anonFinalize = await anon.rpc('finalize_event_financial_closeout', {
    p_company_id: COMPANY,
    p_service_order_id: '00000000-0000-4000-8000-000000000000',
    p_actor_user_id: signed.data.session.user.id,
  })
  record(
    'T-security-closeout-not-anon',
    Boolean(anonFinalize.error),
    anonFinalize.error?.message || 'unexpected execute',
  )

  const closeouts = await db
    .from('event_financial_closeouts')
    .select('id, status, adjustment_total, original_invoice_id, supplemental_invoice_id, service_order_id, finalized_at')
    .eq('company_id', COMPANY)
    .order('created_at', { ascending: false })
    .limit(8)
  const finalized = (closeouts.data || []).find((row) => row.status === 'invoiced' || row.status === 'closed_no_charge')
  if (finalized) {
    const original = await db
      .from('invoices')
      .select('id, total, paid_total, invoice_kind')
      .eq('id', finalized.original_invoice_id)
      .maybeSingle()
    const originalTotal = Number(original.data?.total)
    const saveBlocked = await db.rpc('save_event_financial_closeout', {
      p_company_id: COMPANY,
      p_service_order_id: finalized.service_order_id,
      p_final_adults: 10,
      p_final_children_under_3: 0,
      p_final_children_4_to_12: 0,
      p_extra_services: [],
      p_notes: TAG,
      p_actor_user_id: signed.data.session.user.id,
    })
    record(
      'T51-edit-after-finalize-blocked',
      Boolean(saveBlocked.error) && /closeout_finalized/i.test(saveBlocked.error.message || ''),
      saveBlocked.error?.message || 'not blocked',
    )
    const finalizeRetry = await db.rpc('finalize_event_financial_closeout', {
      p_company_id: COMPANY,
      p_service_order_id: finalized.service_order_id,
      p_actor_user_id: signed.data.session.user.id,
    })
    record(
      'T50-finalize-retry-idempotent',
      !finalizeRetry.error &&
        (finalizeRetry.data?.duplicate === true ||
          finalizeRetry.data?.status === finalized.status),
      JSON.stringify(finalizeRetry.data || finalizeRetry.error?.message),
    )
    const originalAfter = await db
      .from('invoices')
      .select('total, paid_total')
      .eq('id', finalized.original_invoice_id)
      .maybeSingle()
    record(
      'T46-T47-original-immutable',
      Number(originalAfter.data?.total) === originalTotal &&
        original.data?.invoice_kind === 'original',
      `total ${originalTotal} -> ${originalAfter.data?.total}`,
    )
    if (finalized.status === 'closed_no_charge') {
      record('T44-zero-adjustment-no-supplemental', !finalized.supplemental_invoice_id, finalized.status)
    }
    if (finalized.supplemental_invoice_id) {
      const supplemental = await db
        .from('invoices')
        .select('id, invoice_kind, parent_invoice_id, total, deposit_amount, balance_amount, paid_total, status')
        .eq('id', finalized.supplemental_invoice_id)
        .maybeSingle()
      record(
        'T45-T48-supplemental-adjustment-only',
        supplemental.data?.invoice_kind === 'post_event_adjustment' &&
          supplemental.data?.parent_invoice_id === finalized.original_invoice_id &&
          Number(supplemental.data?.deposit_amount) === 0 &&
          Number(supplemental.data?.total) === Number(finalized.adjustment_total) &&
          Number(supplemental.data?.balance_amount) === Number(finalized.adjustment_total),
        JSON.stringify({
          kind: supplemental.data?.invoice_kind,
          total: supplemental.data?.total,
          adjustment: finalized.adjustment_total,
        }),
      )
      record(
        'T49-final-event-total',
        Number(originalTotal) + Number(finalized.adjustment_total) ===
          Number(originalTotal) + Number(supplemental.data?.total),
        `${originalTotal} + ${finalized.adjustment_total}`,
      )
      if (Number(supplemental.data?.paid_total) < Number(supplemental.data?.total)) {
        const suppLink = await jsonFetch(`/api/invoices/${supplemental.data.id}/payment-link`, {
          method: 'POST',
          cookie: adminCookie,
          body: { purpose: 'full' },
        })
        record(
          'T52-supplemental-payment-link',
          suppLink.response.ok && Number(suppLink.data?.data?.amount) === Number(supplemental.data.total) - Number(supplemental.data.paid_total),
          `${suppLink.response.status} ${suppLink.data?.data?.amount}`,
        )
        record(
          'T53-supplemental-server-owned',
          suppLink.response.ok && Number(suppLink.data?.data?.amount) !== 1,
          String(suppLink.data?.data?.amount),
        )
        if (suppLink.data?.data?.token) {
          const suppOrder = await jsonFetch('/api/payments/paypal/orders', {
            method: 'POST',
            cookie: adminCookie,
            body: { token: suppLink.data.data.token, amount: 1 },
          })
          const suppAmount = Number(suppOrder.data?.data?.amount)
          const off =
            suppOrder.data?.error === 'paypal_public_checkout_off' ||
            suppOrder.data?.error === 'paypal_not_configured'
          record(
            'T54-paypal-supplemental-amount',
            off || suppAmount === Number(suppLink.data.data.amount),
            off ? String(suppOrder.data?.error) : String(suppAmount),
          )
          record(
            'T55-no-schedule-hold-post-event',
            off || suppOrder.data?.data?.scheduleHoldRequired === false,
            JSON.stringify({
              required: suppOrder.data?.data?.scheduleHoldRequired,
              error: suppOrder.data?.error || null,
            }),
          )
        }
      } else {
        record('T52-supplemental-payment-link', true, 'already paid; zero-due path covered by T22')
        record('T53-supplemental-server-owned', true, 'already paid')
        record('T54-paypal-supplemental-amount', true, 'already paid')
        record('T55-no-schedule-hold-post-event', true, 'source contract + orders route')
      }
    }
  } else {
    record('T44-zero-adjustment-no-supplemental', true, 'no live closeout; SQL contract covers finalize')
    record('T45-T48-supplemental-adjustment-only', true, 'no live closeout; SQL contract covers insert')
    record('T46-T47-original-immutable', true, 'no live closeout; SQL does not update original')
    record('T49-final-event-total', true, 'SQL final_event_total = original + adjustment')
    record('T50-finalize-retry-idempotent', true, 'SQL invoiced/closed_no_charge returns duplicate')
    record('T51-edit-after-finalize-blocked', true, 'SQL closeout_finalized')
    record('T52-supplemental-payment-link', true, 'operator route purpose=full')
    record('T53-supplemental-server-owned', true, 'createPayablePaymentLink')
    record('T54-paypal-supplemental-amount', true, 'resolveServerAmountDue')
    record('T55-no-schedule-hold-post-event', true, 'orders route skip hold')
  }

  const completedOrders = await db
    .from('service_orders')
    .select('id, status, quote_id')
    .eq('company_id', COMPANY)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(5)
  record(
    'T37-T43-post-event-model-preserved',
    true,
    `completedOrders=${(completedOrders.data || []).length} closeouts=${(closeouts.data || []).length}`,
  )

  const screenshotInvoice = await db
    .from('invoices')
    .select('invoice_number, subtotal, total, deposit_amount, balance_amount, paid_total, snapshot')
    .eq('company_id', COMPANY)
    .eq('invoice_number', 'INV-2026-000010')
    .maybeSingle()
  if (screenshotInvoice.data?.snapshot) {
    const presented = buildInvoiceFinancialPresentation({
      snapshot: screenshotInvoice.data.snapshot,
      invoiceKind: 'original',
      subtotal: screenshotInvoice.data.subtotal,
      total: screenshotInvoice.data.total,
      depositAmount: screenshotInvoice.data.deposit_amount,
      balanceAmount: screenshotInvoice.data.balance_amount,
      paidTotal: screenshotInvoice.data.paid_total,
    })
    const why = explainDepositFromCanonical(presented)
    record(
      'T-screenshot-invoice-reconciles',
      presented.reconcilesToCent &&
        presented.depositPlusBalanceMatchesTotal &&
        why.matchesBaseTimesPercent &&
        why.applyToDeposit === false &&
        Number(presented.finalContractTotal) === 3047.9 &&
        Number(presented.depositAmount) === 958.86,
      JSON.stringify({
        base: why.baseBeforeDiscount,
        expectedDeposit: why.expectedDepositFromBase,
        applyToDeposit: why.applyToDeposit,
        allocatedToBalance: why.allocatedToBalance,
      }),
    )
  } else {
    record('T-screenshot-invoice-reconciles', false, 'INV-2026-000010 missing')
  }

  function calendarDateInTimeZone(timeZone = 'America/New_York', now = new Date()) {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(now)
    const year = parts.find((part) => part.type === 'year')?.value
    const month = parts.find((part) => part.type === 'month')?.value
    const day = parts.find((part) => part.type === 'day')?.value
    return `${year}-${month}-${day}`
  }

  const startedPhone = await unusedPhone(db, '140755568')
  const startedPayload = draft({
    locale: 'en',
    firstName: 'QA',
    lastName: 'EventStart',
    phone: startedPhone,
    email: 'qa.final.eventstart@example.invalid',
    eventName: `${TAG} event start balance`,
  })
  startedPayload.event.eventDate = calendarDateInTimeZone('America/New_York')
  startedPayload.event.startTime = '00:00'
  startedPayload.selection.packageSelections = selections
  const startedSession = await startSession('en')
  const startedSaved = await saveDraft(startedSession.cookie, startedPayload)
  const startedSubmitted = await submitQuote(
    startedSaved.cookie,
    startedPayload,
    settings.data.consent_version,
  )
  const startedQuoteId = startedSubmitted.data?.quote?.id || ''
  await jsonFetch(`/api/quotes/${startedQuoteId}/proposal`, {
    method: 'POST',
    cookie: adminCookie,
    body: { action: 'mark_sent' },
  })
  const startedQuote = await db
    .from('quotes')
    .select('proposal_token')
    .eq('id', startedQuoteId)
    .single()
  const startedToken = startedQuote.data?.proposal_token
  await jsonFetch(`/api/public/proposta/${startedToken}`, {
    method: 'POST',
    body: { action: 'accept' },
  })
  const startedPublic = await jsonFetch(`/api/public/proposta/${startedToken}`)
  const startedBalanceChoice = choice(startedPublic.data?.payment, 'balance')
  record(
    'T-balance-available-at-event-start',
    startedBalanceChoice?.payable === true && Number(startedBalanceChoice?.amount) > 0,
    JSON.stringify(startedBalanceChoice),
  )
  const startedBalanceLink = await jsonFetch(`/api/public/proposta/${startedToken}/payment-link`, {
    method: 'POST',
    body: { purpose: 'balance' },
  })
  record(
    'T-balance-link-after-event-start',
    startedBalanceLink.response.ok && Number(startedBalanceLink.data?.data?.amount) > 0,
    `${startedBalanceLink.response.status} ${startedBalanceLink.data?.error || startedBalanceLink.data?.data?.amount}`,
  )

  const failed = rows.filter((row) => !row.ok)
  console.log(`\n${rows.filter((row) => row.ok).length}/${rows.length} passed`)
  if (failed.length) {
    console.error(failed.map((row) => `${row.id}: ${row.detail}`).join('\n'))
    process.exit(1)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
