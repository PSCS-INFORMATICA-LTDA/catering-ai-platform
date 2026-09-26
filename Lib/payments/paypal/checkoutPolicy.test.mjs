import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import {
  decideInternalSandboxCheckout,
  decideLivePaypalCheckout,
  isRealFinancialPayment,
  isRecordedSandboxTestCapture,
  isSandboxCapturedPayment,
  isSandboxTestPayment,
  PAYPAL_LIVE_API_BASE,
  PAYPAL_LIVE_NOT_AVAILABLE,
  PAYPAL_SANDBOX_API_BASE,
  paypalEnvironmentMatches,
  paypalPaymentEnvironment,
  SANDBOX_TEST_CAPTURE_STATUS,
} from './checkoutPolicy.ts'
import {
  buildFinanceTrend,
  excludeSandboxFromFinance,
  groupFinanceTotalsByCurrency,
  summarizeProviders,
} from '../financeControlCenter.ts'
import { paidByPurposeFromLedger } from '../amountDue.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const read = (path) => readFileSync(join(root, path), 'utf8')

const LIVE_READY = Object.freeze({
  requestedEnv: 'live',
  runtimeEnv: 'production',
  activeApiBase: PAYPAL_LIVE_API_BASE,
  liveAdapterAvailable: true,
  platformEnabled: true,
  publicCheckoutFlag: true,
  companyConfigured: true,
  companyEnvironment: 'live',
  companyEnabled: true,
  credentialsPresent: true,
  connectionValidated: true,
  webhookConfigured: true,
})

// The exact configuration the DEV public domain ran with during the incident.
const CURRENT_DEV_SANDBOX = Object.freeze({
  requestedEnv: 'sandbox',
  runtimeEnv: 'preview',
  activeApiBase: PAYPAL_SANDBOX_API_BASE,
  liveAdapterAvailable: false,
  platformEnabled: true,
  publicCheckoutFlag: true,
  companyConfigured: true,
  companyEnvironment: 'sandbox',
  companyEnabled: true,
  credentialsPresent: true,
  connectionValidated: true,
  webhookConfigured: true,
})

function sandboxInternal(overrides = {}) {
  return {
    sandboxRuntimeAllowed: true,
    platformEnabled: true,
    companyConfigured: true,
    companyEnvironment: 'sandbox',
    companyEnabled: true,
    credentialsPresent: true,
    internalViewer: false,
    ...overrides,
  }
}

function indexOrFail(source, needle) {
  const index = source.indexOf(needle)
  assert.ok(index >= 0, `missing: ${needle}`)
  return index
}

test('A. public checkout with the Sandbox configuration is BLOCKED', () => {
  const decision = decideLivePaypalCheckout(CURRENT_DEV_SANDBOX)
  assert.equal(decision.allowed, false)
  assert.equal(decision.error, PAYPAL_LIVE_NOT_AVAILABLE)
  assert.equal(decision.reason, 'paypal_env_not_live')
  // Anonymous customer on the public link never gets the internal Sandbox fallback.
  assert.equal(decideInternalSandboxCheckout(sandboxInternal({ internalViewer: false })), false)

  const page = read('app/pay/[token]/page.tsx')
  const view = read('components/payments/PublicPaymentPage.tsx')
  assert.match(page, /resolvePaypalCheckoutAccess\(resolved\.invoice\.company_id\)/)
  assert.match(page, /paypalAccess\.allowed && purposeAvailable \? paypalAccess\.mode : 'blocked'/)
  assert.doesNotMatch(page, /searchParams[\s\S]{0,80}paypal/i)
  assert.match(view, /paypalMode !== 'blocked' && Boolean\(paypalClientId\)/)
  assert.match(view, /\{paypalReady && paypalClientId \? \(\s*<PaypalSandboxCheckout/)
  // Alternative methods are always rendered, independently of PayPal.
  const methods = indexOrFail(view, '<section data-payment-methods')
  assert.ok(methods > indexOrFail(view, '<PaypalSandboxCheckout'))
  assert.match(view, /data-method-zelle/)
  assert.match(view, /data-method-bank-transfer/)
})

test('A. customer copy never mentions Sandbox details', () => {
  const payments = read('Lib/i18n/payments.ts')
  const block = payments.slice(payments.indexOf('paypalUnavailable:'), payments.indexOf('paypalSandboxReady:'))
  assert.match(block, /PayPal is temporarily unavailable\. Please use the available alternative payment method\./)
  assert.doesNotMatch(block, /sandbox|homolog/i)
  const guard = read('Lib/payments/paypal/publicCheckout.ts')
  assert.match(guard, /PAYPAL_LIVE_NOT_AVAILABLE_MESSAGE =\s*'PayPal is temporarily unavailable\. Please use the available alternative payment method\.'/)
  const body = guard.slice(guard.indexOf('export function paypalLiveNotAvailableResponse'))
  assert.doesNotMatch(body, /reason|sandbox/i)
})

test('B. direct create-order API call with Sandbox is BLOCKED before any PayPal/DB write', () => {
  const orders = read('app/api/payments/paypal/orders/route.ts')
  const guard = indexOrFail(orders, 'const access = await resolvePaypalCheckoutAccess(resolved.invoice.company_id)')
  const deny = indexOrFail(orders, 'if (!access.allowed) return paypalLiveNotAvailableResponse()')
  assert.ok(guard < deny)
  assert.ok(deny < indexOrFail(orders, 'acquirePaymentScheduleHold({'))
  assert.ok(deny < indexOrFail(orders, 'createPaypalAdapter('))
  assert.ok(deny < indexOrFail(orders, 'adapter.createOrder('))
  assert.ok(deny < indexOrFail(orders, 'recordPaymentAttempt({'))
  assert.doesNotMatch(orders, /resolvePublicPaypalCheckoutReadiness/)
  assert.doesNotMatch(orders, /body\??\.(environment|mode|sandbox)/)
})

test('C. direct capture API call with Sandbox is BLOCKED before PayPal capture', () => {
  const capture = read('app/api/payments/paypal/capture/route.ts')
  const deny = indexOrFail(capture, 'if (!access.allowed) return paypalLiveNotAvailableResponse()')
  assert.ok(deny < indexOrFail(capture, 'findPaymentByProviderOrder('))
  assert.ok(deny < indexOrFail(capture, 'adapter.captureOrder('))
  assert.ok(deny < indexOrFail(capture, 'recordPaymentAttempt({'))
  assert.doesNotMatch(capture, /body\??\.(environment|mode|sandbox)/)
})

test('D. Sandbox capture is an auditable TEST record, never financial PAID', () => {
  assert.equal(SANDBOX_TEST_CAPTURE_STATUS, 'approved')
  const testCapture = {
    id: 'p-test',
    invoice_id: 'inv-1',
    provider: 'paypal',
    purpose: 'deposit',
    amount: 555.3,
    status: SANDBOX_TEST_CAPTURE_STATUS,
    provider_capture_id: 'SANDBOX-CAPTURE',
    metadata: { environment: 'sandbox', test_transaction: true },
  }
  assert.equal(isRecordedSandboxTestCapture(testCapture), true)
  assert.equal(isSandboxCapturedPayment(testCapture), true)
  assert.equal(isRealFinancialPayment(testCapture), false)
  // The ledger that drives amount due / paid_total ignores the TEST capture.
  assert.deepEqual(paidByPurposeFromLedger([testCapture]), { deposit: 0, balance: 0, full: 0 })

  const capture = read('app/api/payments/paypal/capture/route.ts')
  const sandboxBranch = indexOrFail(capture, "if (environment !== 'live') {")
  assert.ok(sandboxBranch < indexOrFail(capture, 'const recorded = await recordPaymentAttempt({'))
  assert.match(capture, /recordSandboxTestCapture\(\{[\s\S]*source: 'paypal_capture'/)
  assert.match(capture, /reason: 'paypal_sandbox_test_capture'/)
  assert.match(capture, /financialCompleted: false/)
  assert.match(capture, /testTransaction: true/)

  const record = read('Lib/payments/recordPayment.ts')
  const fn = record.slice(record.indexOf('export async function recordSandboxTestCapture'), record.indexOf('export async function findPaymentByIdempotency'))
  assert.match(fn, /status: SANDBOX_TEST_CAPTURE_STATUS/)
  assert.match(fn, /environment: 'sandbox'/)
  assert.match(fn, /test_transaction: true/)
  assert.match(fn, /sandbox_capture: \{/)
  assert.doesNotMatch(fn, /status: 'completed'/)
  assert.doesNotMatch(fn, /from\('invoices'\)/)
  assert.doesNotMatch(fn, /completedPaymentResult|ensurePaidContract|reconcile_invoice_ledger/)
})

test('D. financial recorder refuses a completed PayPal row that is not stamped LIVE', () => {
  const record = read('Lib/payments/recordPayment.ts')
  const start = record.indexOf('export async function recordPaymentAttempt(')
  const body = record.slice(start)
  const guard = indexOrFail(body, "input.metadata?.environment !== 'live'")
  assert.ok(guard < indexOrFail(body, 'findPaymentByIdempotency('))
  assert.match(body, /error: 'paypal_sandbox_not_financial'/)
})

test('E. LIVE configuration + valid payment keeps the normal financial flow', () => {
  assert.deepEqual(decideLivePaypalCheckout(LIVE_READY), { allowed: true, environment: 'live' })
  const livePayment = { provider: 'paypal', status: 'completed', metadata: { environment: 'live' } }
  assert.equal(paypalPaymentEnvironment(livePayment.metadata), 'live')
  assert.equal(isSandboxTestPayment(livePayment), false)
  assert.equal(isRealFinancialPayment(livePayment), true)
  assert.equal(paypalEnvironmentMatches(livePayment.metadata, 'live'), true)
  const capture = read('app/api/payments/paypal/capture/route.ts')
  assert.match(capture, /metadata: \{\s*mock: captured\.mock,\s*environment,/)
  assert.match(capture, /recorded\.reservation/)
  // Offline methods are real money and unaffected by the PayPal rule.
  assert.equal(isRealFinancialPayment({ provider: 'zelle', status: 'completed', metadata: {} }), true)
})

test('F. invalid or missing PayPal environment FAILS CLOSED', () => {
  const cases = [
    [{ requestedEnv: null }, 'paypal_env_missing'],
    [{ requestedEnv: '' }, 'paypal_env_missing'],
    [{ requestedEnv: 'LIVE' }, 'paypal_env_not_live'],
    [{ requestedEnv: 'production' }, 'paypal_env_not_live'],
    [{ requestedEnv: 'sandbox' }, 'paypal_env_not_live'],
    [{ runtimeEnv: 'preview' }, 'paypal_production_runtime_required'],
    [{ runtimeEnv: null }, 'paypal_production_runtime_required'],
    [{ activeApiBase: PAYPAL_SANDBOX_API_BASE }, 'paypal_live_endpoint_inactive'],
    [{ liveAdapterAvailable: false }, 'paypal_live_adapter_unavailable'],
    [{ platformEnabled: false }, 'paypal_disabled'],
    [{ publicCheckoutFlag: false }, 'paypal_public_checkout_off'],
    [{ companyConfigured: false }, 'paypal_not_configured'],
    [{ companyEnvironment: 'sandbox' }, 'paypal_company_not_live'],
    [{ companyEnvironment: null }, 'paypal_company_not_live'],
    [{ companyEnabled: false }, 'paypal_company_disabled'],
    [{ credentialsPresent: false }, 'paypal_credentials_missing'],
    [{ connectionValidated: false }, 'paypal_test_required'],
    [{ webhookConfigured: false }, 'paypal_webhook_required'],
  ]
  for (const [override, reason] of cases) {
    const decision = decideLivePaypalCheckout({ ...LIVE_READY, ...override })
    assert.equal(decision.allowed, false, JSON.stringify(override))
    assert.equal(decision.error, PAYPAL_LIVE_NOT_AVAILABLE)
    assert.equal(decision.reason, reason)
  }
  // Unknown/legacy environment on a stored row is Sandbox, never LIVE.
  assert.equal(paypalPaymentEnvironment(undefined), 'sandbox')
  assert.equal(paypalPaymentEnvironment({ environment: 'LIVE' }), 'sandbox')
  // The shipped adapter is Sandbox-only, so the flag that unlocks LIVE is off.
  assert.match(read('Lib/payments/paypal/config.ts'), /PAYPAL_LIVE_ADAPTER_AVAILABLE: boolean = false/)
})

test('internal Sandbox checkout stays available only to authorized staff in DEV/QA', () => {
  assert.equal(decideInternalSandboxCheckout(sandboxInternal({ internalViewer: true })), true)
  assert.equal(decideInternalSandboxCheckout(sandboxInternal({ internalViewer: true, sandboxRuntimeAllowed: false })), false)
  assert.equal(decideInternalSandboxCheckout(sandboxInternal({ internalViewer: true, companyEnvironment: 'live' })), false)
  assert.equal(decideInternalSandboxCheckout(sandboxInternal({ internalViewer: true, credentialsPresent: false })), false)
  const guard = read('Lib/payments/paypal/publicCheckout.ts')
  assert.match(guard, /resolveSessionCompanyId\(session\) !== companyId/)
  assert.match(guard, /PAYPAL_INTERNAL_SANDBOX_PERMISSION = 'quotes\.manage'/)
  const checkout = read('components/payments/PaypalSandboxCheckout.tsx')
  assert.match(checkout, /TEST TRANSACTIONS — NO REAL MONEY/)
  assert.match(checkout, /data-testid="paypal-sandbox-test-banner"/)
})

test('G. duplicate click/capture is idempotent and cannot create a second financial payment', () => {
  const orders = read('app/api/payments/paypal/orders/route.ts')
  const key = orders.slice(orders.indexOf('const requestId = paypalRequestId(['), orders.indexOf('const adapter = createPaypalAdapter('))
  assert.doesNotMatch(key, /paymentLinkId/)
  assert.match(key, /invoiceId,\s*purpose,\s*due\.amount\.toFixed\(2\)/)

  const capture = read('app/api/payments/paypal/capture/route.ts')
  const captureCall = indexOrFail(capture, 'adapter.captureOrder(')
  assert.ok(indexOrFail(capture, "if (due.amount <= 0) {") < captureCall)
  assert.ok(indexOrFail(capture, "invoice.status === 'paid'") < captureCall)
  assert.ok(indexOrFail(capture, 'isRecordedSandboxTestCapture(existing)') < captureCall)
  assert.ok(indexOrFail(capture, "existing.status === 'completed'") < captureCall)
  assert.match(capture, /error: 'payment_already_completed'/)

  const record = read('Lib/payments/recordPayment.ts')
  assert.match(record, /\.is\('provider_capture_id', null\)/)
  assert.match(record, /error: 'paypal_capture_mismatch'/)

  const attemptA = { provider: 'paypal', status: 'created', metadata: {} }
  const attemptB = { provider: 'paypal', status: 'completed', metadata: {} }
  assert.equal(isRealFinancialPayment(attemptA), false)
  assert.equal(isRealFinancialPayment(attemptB), false)
})

test('H. Sandbox webhook can never mark a real order paid', () => {
  // A Sandbox-verified event can never confirm a LIVE-stamped payment.
  assert.equal(paypalEnvironmentMatches({ environment: 'live' }, 'sandbox'), false)
  assert.equal(paypalEnvironmentMatches({}, 'live'), false)

  const route = read('app/api/payments/paypal/webhook/[connectionKey]/route.ts')
  assert.ok(indexOrFail(route, 'verifyPaypalWebhookSignature(') < indexOrFail(route, 'processVerifiedPaypalCapture('))
  assert.match(route, /environment: 'sandbox'/)

  const webhook = read('Lib/payments/paypal/processWebhook.ts')
  const capture = webhook.slice(webhook.indexOf('export async function processVerifiedPaypalCapture'))
  const amountCheck = indexOrFail(capture, "error: 'paypal_webhook_amount_mismatch'")
  const envCheck = indexOrFail(capture, 'paypalEnvironmentMatches(payment.metadata, input.environment)')
  const captureRel = indexOrFail(capture, 'payment.provider_capture_id !== captureId')
  const sandboxBranch = indexOrFail(capture, "if (input.environment !== 'live') {")
  const financial = indexOrFail(capture, 'const recorded = await recordPaymentAttempt({')
  const confirm = indexOrFail(capture, 'confirmPaidDepositReservation(')
  assert.ok(amountCheck < envCheck && envCheck < captureRel && captureRel < sandboxBranch)
  assert.ok(sandboxBranch < financial && sandboxBranch < confirm)
  const branch = capture.slice(sandboxBranch, Math.min(financial, confirm))
  assert.match(branch, /recordSandboxTestCapture\(/)
  assert.match(branch, /reason: 'sandbox_legacy_completed'/)
  assert.doesNotMatch(branch, /recordPaymentAttempt|confirmPaidDepositReservation/)
  assert.match(capture, /metadata: \{\s*eventType,\s*eventId,\s*environment: input\.environment,/)
})

test('I. financial dashboard excludes Sandbox from real totals', () => {
  const invoices = [
    { id: 'inv-sandbox', status: 'partially_paid', invoice_kind: 'original', currency_code: 'USD', total: 1851, paid_total: 555.3, created_at: '2026-09-24T19:09:31Z' },
    { id: 'inv-zelle', status: 'partially_paid', invoice_kind: 'original', currency_code: 'USD', total: 1000, paid_total: 300, created_at: '2026-09-20T10:00:00Z' },
  ]
  const payments = [
    // Pre-hotfix incident row: completed Sandbox capture (no environment stamp).
    { id: 'p1', invoice_id: 'inv-sandbox', provider: 'paypal', status: 'completed', amount: 555.3, currency_code: 'USD', metadata: { mock: false }, created_at: '2026-09-24T19:12:32Z', captured_at: '2026-09-24T19:13:45Z' },
    // Post-hotfix TEST capture.
    { id: 'p2', invoice_id: 'inv-sandbox', provider: 'paypal', status: 'approved', amount: 555.3, currency_code: 'USD', provider_capture_id: 'CAP', metadata: { environment: 'sandbox', test_transaction: true }, created_at: '2026-09-24T19:20:00Z', captured_at: '2026-09-24T19:21:00Z' },
    { id: 'p3', invoice_id: 'inv-zelle', provider: 'zelle', status: 'completed', amount: 300, currency_code: 'USD', metadata: {}, created_at: '2026-09-21T10:00:00Z', captured_at: '2026-09-21T10:00:00Z' },
  ]
  const real = excludeSandboxFromFinance({ invoices, payments })
  assert.deepEqual(real.payments.map((payment) => payment.id), ['p3'])
  assert.deepEqual(real.sandboxPayments.map((payment) => payment.id), ['p1', 'p2'])
  assert.equal(real.invoices[0].paid_total, 0)
  assert.equal(real.invoices[0].sandbox_paid_total, 555.3)
  assert.equal(real.invoices[1].paid_total, 300)

  const [usd] = groupFinanceTotalsByCurrency({ invoices: real.invoices, payments: real.payments, refunds: [] })
  assert.equal(usd.received_total, 300)
  assert.equal(usd.billed_total, 2851)
  assert.equal(usd.outstanding_total, 2551)
  assert.equal(usd.partially_paid_count, 1)

  const [trend] = buildFinanceTrend({
    invoices: real.invoices,
    payments: real.payments,
    from: '2026-09-01T00:00:00Z',
    to: '2026-09-30T00:00:00Z',
  })
  const received = trend.points.reduce((sum, point) => sum + point.received_total, 0)
  assert.equal(received, 300)

  const providers = summarizeProviders({
    configured: [{ provider: 'paypal', enabled: true, environment: 'sandbox' }],
    payments: real.payments,
  })
  assert.equal(providers.find((row) => row.provider === 'paypal').received_total, 0)
  assert.equal(providers.find((row) => row.provider === 'zelle').received_total, 300)

  const fetcher = read('Lib/payments/fetchFinanceControlCenter.ts')
  assert.match(fetcher, /excludeSandboxFromFinance\(/)
  assert.match(fetcher, /isRealFinancialPayment\(/)
  assert.match(fetcher, /test_mode: paypal\.health\?\.sandbox !== false/)
  const control = read('Lib/payments/fetchPaypalControl.ts')
  assert.match(control, /isSandboxCapturedPayment\(asPolicyRow\(payment\)\)/)
  assert.match(control, /test_mode: true/)
  assert.match(read('components/payments/PaypalControlCenter.tsx'), /sandboxTestBannerSubtitle/)
})
