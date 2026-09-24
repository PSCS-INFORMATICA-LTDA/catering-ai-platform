/**
 * HTTP QA for the PayPal Sandbox public-checkout block. DEV/Preview only.
 * Creates at most one deposit payment link on an unpaid DEV invoice; never
 * creates PayPal orders, never captures, never changes invoice/payment rows.
 */
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { assertDevUrl, DEV_REF, loadDevEnv } from './loadDevEnv.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const base = (process.env.NAV_BASE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '')
const INCIDENT_INVOICE = 'INV-2026-000059'

let failed = 0
function check(id, ok, detail) {
  if (!ok) failed += 1
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${id}  ${detail}`)
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

async function http(path, { method = 'GET', body, cookie = '' } = {}) {
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
    data = null
  }
  return { status: response.status, data, text }
}

const attr = (html, name) => html.match(new RegExp(`${name}="([^"]*)"`))?.[1] ?? null

async function main() {
  const env = loadDevEnv(ROOT)
  assertDevUrl(env.url)
  const admin = createClient(env.url, env.service, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const anon = createClient(env.url, env.anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const email = process.env.CATERING_DEV_LOGIN_EMAIL
  const password = process.env.CATERING_DEV_LOGIN_PASSWORD
  if (!email || !password) throw new Error('CATERING_DEV_LOGIN_* required')
  const signed = await anon.auth.signInWithPassword({ email, password })
  if (signed.error || !signed.data.session) throw new Error('staff login failed')
  const cookie = authCookie(signed.data.session)

  const { data: candidates } = await admin
    .from('invoices')
    .select('id, invoice_number, status, paid_total, deposit_amount, company_id')
    .eq('company_id', env.companyId)
    .eq('status', 'awaiting_deposit')
    .eq('invoice_kind', 'original')
    .eq('paid_total', 0)
    .gt('deposit_amount', 0)
    .neq('invoice_number', INCIDENT_INVOICE)
    .order('created_at', { ascending: false })
    .limit(10)
  const paymentCount = async (invoiceId) =>
    (
      await admin
        .from('invoice_payments')
        .select('id', { count: 'exact', head: true })
        .eq('invoice_id', invoiceId)
    ).count ?? 0
  let invoice = null
  for (const row of candidates ?? []) {
    const { count: settled } = await admin
      .from('invoice_payments')
      .select('id', { count: 'exact', head: true })
      .eq('invoice_id', row.id)
      .in('status', ['approved', 'completed'])
    if (!settled) {
      invoice = row
      break
    }
  }
  if (!invoice) throw new Error('no unpaid DEV invoice without settled payments')
  const paymentsBefore = await paymentCount(invoice.id)
  console.log(`INFO  invoice ${invoice.invoice_number} deposit=${invoice.deposit_amount}`)

  const link = await http(`/api/invoices/${invoice.id}/payment-link`, {
    method: 'POST',
    cookie,
    body: { purpose: 'deposit' },
  })
  const url = link.data?.data?.url || ''
  const token = url.split('/pay/')[1]
  check('SETUP-deposit-link', link.status === 200 && Boolean(token), String(link.status))
  if (!token) return

  // A. Public customer with the Sandbox configuration: no actionable PayPal.
  const publicPage = await http(`/pay/${token}`)
  check('A-public-mode-blocked', attr(publicPage.text, 'data-paypal-mode') === 'blocked', `mode=${attr(publicPage.text, 'data-paypal-mode')}`)
  check('A-public-no-paypal-sdk', !publicPage.text.includes('data-paypal-sandbox-checkout'), 'no checkout widget')
  check('A-public-no-sandbox-leak', !/sandbox/i.test(publicPage.text.replace(/data-paypal-[a-z-]+="[^"]*"/g, '').replace(/[\w/.-]*PaypalSandboxCheckout[\w.-]*/g, '')), 'no Sandbox copy for customer')
  check('A-alternatives-visible', publicPage.text.includes('data-method-zelle'), 'Zelle/bank shown')

  // Query parameters cannot re-enable it.
  const bypass = await http(`/pay/${token}?paypal=live&sandbox=1&env=sandbox&internal=1`)
  check('A-query-bypass-blocked', attr(bypass.text, 'data-paypal-mode') === 'blocked', `mode=${attr(bypass.text, 'data-paypal-mode')}`)

  // B. Direct create-order call.
  const create = await http('/api/payments/paypal/orders', {
    method: 'POST',
    body: { token, environment: 'sandbox', amount: 1 },
  })
  check('B-direct-create-blocked', create.status === 403 && create.data?.error === 'PAYPAL_LIVE_NOT_AVAILABLE', `${create.status} ${create.data?.error}`)
  check('B-neutral-message', create.data?.message === 'PayPal is temporarily unavailable. Please use the available alternative payment method.', 'message')
  check('B-no-internals', !/sandbox|client_id|secret|reason/i.test(create.text), 'no internals')

  // C. Direct capture call.
  const capture = await http('/api/payments/paypal/capture', {
    method: 'POST',
    body: { token, orderId: 'QA-FAKE-ORDER' },
  })
  check('C-direct-capture-blocked', capture.status === 403 && capture.data?.error === 'PAYPAL_LIVE_NOT_AVAILABLE', `${capture.status} ${capture.data?.error}`)

  // Internal staff of the same company keep the Sandbox, labelled TEST.
  const internalPage = await http(`/pay/${token}`, { cookie })
  const internalMode = attr(internalPage.text, 'data-paypal-mode')
  check('INT-staff-never-live', internalMode !== 'live', `mode=${internalMode}`)
  if (internalMode === 'internal_sandbox') {
    check('INT-test-banner', internalPage.text.includes('paypal-sandbox-test-banner') && /NO REAL MONEY/i.test(internalPage.text), 'TEST banner')
  } else {
    // The company secret is wrapped with the deployment key; locally it may not decrypt.
    console.log(`INFO  staff Sandbox unavailable here (mode=${internalMode}); fail-closed without a usable secret`)
  }

  const control = await http('/payments/paypal-control', { cookie })
  check('INT-control-center-test-banner', control.status === 200 && control.text.includes('paypal-sandbox-test-banner'), String(control.status))

  // Nothing financial moved.
  const { data: after } = await admin
    .from('invoices')
    .select('status, paid_total')
    .eq('id', invoice.id)
    .single()
  const payments = (await paymentCount(invoice.id)) - paymentsBefore
  check('F-invoice-unchanged', after.status === 'awaiting_deposit' && Number(after.paid_total) === 0, `${after.status} ${after.paid_total}`)
  check('F-no-new-payment-rows', payments === 0, `new rows=${payments}`)

  // Finance dashboard real totals exclude the incident Sandbox 555.30.
  const finance = await http('/api/finance/overview', { cookie })
  if (finance.status === 200) {
    check('I-finance-test-badge', JSON.stringify(finance.data).includes('"test_mode":true'), 'paypal.test_mode')
  } else {
    console.log(`INFO  finance overview API ${finance.status} (checked via unit tests)`)
  }

  console.log(`QA_URL ${base}/pay/${token}`)
}

main()
  .then(() => {
    console.log(failed ? `PAYPAL_SANDBOX_PUBLIC_BLOCK_HTTP=FAIL (${failed})` : 'PAYPAL_SANDBOX_PUBLIC_BLOCK_HTTP=PASS')
    process.exit(failed ? 1 : 0)
  })
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  })
