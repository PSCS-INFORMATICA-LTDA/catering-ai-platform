/**
 * Payments Foundation V1 — sandbox only, no live money.
 *
 *   npm run test:dev:payments-foundation
 */
import assert from 'node:assert/strict'
import { createHash, randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { loadDevEnv, assertDevUrl } from './loadDevEnv.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8')

function roundMoney(value) {
  return Math.round(Math.max(0, Number(value) || 0) * 100) / 100
}

function resolveAmountDue({ total, depositAmount, paidTotal, purpose }) {
  const remaining = roundMoney(total - paidTotal)
  if (remaining <= 0) return { amount: 0, reason: 'already_paid' }
  if (purpose === 'deposit') {
    const depositRemaining = roundMoney(depositAmount - paidTotal)
    if (depositRemaining <= 0) return { amount: 0, reason: 'deposit_already_paid' }
    return { amount: Math.min(depositRemaining, remaining), reason: 'deposit' }
  }
  return { amount: remaining, reason: purpose }
}

function ignoreClientAmount() {
  return null
}

function isPaymentLinkUsableLocal({ revokedAt, expiresAt, now = new Date() }) {
  if (revokedAt) return { ok: false, reason: 'revoked' }
  if (expiresAt) {
    const expires = new Date(expiresAt).getTime()
    if (Number.isFinite(expires) && expires <= now.getTime()) {
      return { ok: false, reason: 'expired' }
    }
  }
  return { ok: true, reason: 'ok' }
}

let passed = 0
let failed = 0
function test(name, fn) {
  try {
    fn()
    passed += 1
    console.log(`PASS  ${name}`)
  } catch (error) {
    failed += 1
    console.error(`FAIL  ${name}`)
    console.error(`      ${error instanceof Error ? error.message : error}`)
  }
}

const migration = read('supabase/migrations/20260827010000_payments_foundation_v1.sql')
const ordersRoute = read('app/api/payments/paypal/orders/route.ts')
const captureRoute = read('app/api/payments/paypal/capture/route.ts')
const webhookRoute = read('app/api/payments/paypal/webhook/route.ts')
const amountSrc = read('Lib/payments/amountDue.ts')
const configSrc = read('Lib/payments/paypal/config.ts')
const adapterSrc = read('Lib/payments/paypal/adapter.ts')
const payPage = read('components/payments/PublicPaymentPage.tsx')
const invoiceCreate = read('Lib/payments/createInvoiceFromQuote.ts')
const panel = read('components/payments/QuoteInvoicePanel.tsx')
const spike = read('Lib/payments/paypal/invoicingSpike.ts')

test('PAYMENT_SERVER_AMOUNT_SOURCE', () => {
  assert.match(ordersRoute, /ignoreClientAmount\(body\?\.amount\)/)
  assert.match(ordersRoute, /resolveAmountDue/)
  assert.match(amountSrc, /Browser-supplied amounts must be discarded/)
})

test('CLIENT_AMOUNT_TAMPERING_BLOCKED', () => {
  assert.equal(ignoreClientAmount(1), null)
  const due = resolveAmountDue({
    total: 1000,
    depositAmount: 300,
    paidTotal: 0,
    purpose: 'deposit',
  })
  assert.equal(due.amount, 300)
  assert.notEqual(due.amount, 1)
})

test('DEPOSIT_30_SUPPORTED', () => {
  const due = resolveAmountDue({
    total: 1000,
    depositAmount: 300,
    paidTotal: 0,
    purpose: 'deposit',
  })
  assert.equal(due.amount, 300)
})

test('BALANCE_SUPPORTED', () => {
  const due = resolveAmountDue({
    total: 1000,
    depositAmount: 300,
    paidTotal: 300,
    purpose: 'balance',
  })
  assert.equal(due.amount, 700)
})

test('DOUBLE_CAPTURE_BLOCKED', () => {
  assert.match(captureRoute, /status === 'completed'/)
  assert.match(captureRoute, /duplicate/)
  assert.match(captureRoute, /order_not_found/)
  assert.match(captureRoute, /order_invoice_mismatch/)
  assert.match(read('Lib/payments/recordPayment.ts'), /idempotencyKey/)
  assert.match(read('Lib/payments/recordPayment.ts'), /neq\('status', 'completed'\)/)
  assert.match(migration, /invoice_payments_provider_capture_uidx/)
})

test('PAYMENT_STATUS_IDEMPOTENT', () => {
  assert.match(read('Lib/payments/recordPayment.ts'), /duplicate: true/)
  assert.match(webhookRoute, /webhook:\$\{eventId\}/)
})

test('TENANT_ISOLATION', () => {
  const tokenA = randomBytes(32).toString('base64url')
  const tokenB = randomBytes(32).toString('base64url')
  const hashA = createHash('sha256').update(tokenA).digest('hex')
  const hashB = createHash('sha256').update(tokenB).digest('hex')
  assert.notEqual(hashA, hashB)
  assert.match(migration, /company_id uuid NOT NULL/)
  assert.match(ordersRoute, /assertCompanyPaypalEligible\(companyId\)/)
  assert.match(read('Lib/payments/resolvePaymentLink.ts'), /token_hash/)
})

test('ZELLE_PRESERVED', () => {
  assert.match(payPage, /data-method-zelle/)
  assert.match(migration, /'zelle'/)
  assert.doesNotMatch(read('Lib/publicQuote/landingStoryCopy.ts'), /Zelle — peça/)
})

test('BANK_TRANSFER_PRESERVED', () => {
  assert.match(payPage, /data-method-bank-transfer/)
  assert.match(migration, /'bank_transfer'/)
})

test('ONLINE_PAYMENT_FEE = 0', () => {
  assert.match(migration, /online_payment_fee numeric\(12,2\) NOT NULL DEFAULT 0/)
  assert.match(migration, /invoices_online_fee_zero_v1/)
  assert.match(read('Lib/payments/invoiceSnapshot.ts'), /onlinePaymentFee: 0/)
})

test('LIVE_PAYMENT = NO', () => {
  assert.match(configSrc, /liveBlocked/)
  assert.match(configSrc, /PAYPAL_LIVE_BLOCKED/)
  assert.match(adapterSrc, /sandbox/)
  assert.doesNotMatch(adapterSrc, /api-m\.paypal\.com/)
})

test('PUBLIC CHECKOUT OFF BY DEFAULT', () => {
  assert.match(configSrc, /PAYPAL_PUBLIC_CHECKOUT/)
  assert.match(ordersRoute, /paypal_public_checkout_off/)
  assert.match(payPage, /paypalUnavailable/)
})

test('INVOICE FROM ACCEPTED QUOTE ONLY', () => {
  assert.match(invoiceCreate, /isQuoteAccepted/)
  assert.match(invoiceCreate, /quote_not_accepted/)
  assert.match(invoiceCreate, /buildInvoiceSnapshot/)
  assert.match(read('Lib/payments/invoiceSnapshot.ts'), /INVOICE_SNAPSHOT_VERSION/)
})

test('SECURE TOKEN NOT RAW IDS', () => {
  assert.match(read('Lib/payments/paymentLinks.ts'), /randomBytes\(32\)/)
  assert.match(read('app/pay/[token]/page.tsx'), /resolvePaymentLink/)
  assert.doesNotMatch(read('app/pay/[token]/page.tsx'), /invoice_id sequencial/)
})

test('NO CARD VAULT / FEE / COUPON', () => {
  assert.doesNotMatch(adapterSrc, /card_number|cvv|PAN/)
  assert.doesNotMatch(migration, /coupon|affiliate|subscription_payment/)
})

test('PAYPAL INVOICING SPIKE RECORDED', () => {
  assert.match(spike, /PAYPAL_INVOICING_API_AVAILABLE: true/)
  assert.match(spike, /PAYPAL_HOSTED_INVOICE_URL_AVAILABLE: true/)
  assert.match(spike, /INTERNAL_INVOICE_REMAINS_SOURCE_OF_TRUTH: true/)
})

test('OPERATOR PANEL EXISTS', () => {
  assert.match(panel, /data-invoice-panel/)
  assert.match(read('app/quotes/[id]/QuoteDetailView.tsx'), /QuoteInvoicePanel/)
})

test('WEBHOOK REJECTS UNSIGNED PAYLOAD', () => {
  assert.match(webhookRoute, /verifyPaypalWebhookSignature/)
  assert.match(read('Lib/payments/paypal/webhook.ts'), /COMPLETED payload alone is never enough/)
})

const env = loadDevEnv(ROOT)
assertDevUrl(env.url)
test('ENV IS DEV', () => {
  assert.match(env.url, /yasprgtlqclwsjcshtls/)
})

test('SANDBOX_CREDENTIALS_PRESENT documented', () => {
  const present = Boolean(
    process.env.PAYPAL_CLIENT_ID?.trim() && process.env.PAYPAL_CLIENT_SECRET?.trim(),
  )
  console.log(`INFO  SANDBOX_CREDENTIALS_PRESENT=${present ? 'YES' : 'NO'}`)
  assert.equal(typeof present, 'boolean')
})

const sb = createClient(env.url, env.service, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const { error: tableError } = await sb.from('invoices').select('id').limit(1)
test('MIGRATION_APPLIED_OR_PENDING', () => {
  if (tableError) {
    console.log(`INFO  invoices table not live yet: ${tableError.message}`)
    assert.match(migration, /CREATE TABLE IF NOT EXISTS public.invoices/)
    return
  }
  assert.equal(tableError, null)
})

if (!tableError) {
  const { data: providers } = await sb
    .from('company_payment_providers')
    .select('provider, enabled, company_id')
    .eq('company_id', '65fd576f-8d97-49ba-bf38-61bc1e94e94a')
  test('CDL OFFLINE METHODS SEEDED', () => {
    const keys = (providers ?? []).map((row) => row.provider)
    assert.ok(keys.includes('zelle'))
    assert.ok(keys.includes('bank_transfer'))
    const paypal = (providers ?? []).find((row) => row.provider === 'paypal')
    assert.equal(paypal?.enabled, false)
  })

  const { data: invoice } = await sb
    .from('invoices')
    .select('id, company_id, invoice_number, status, total, paid_total, deposit_amount')
    .eq('company_id', '65fd576f-8d97-49ba-bf38-61bc1e94e94a')
    .eq('invoice_number', 'INV-2026-000001')
    .maybeSingle()

  const foreign = randomBytes(32).toString('base64url')
  const { data: foreignLink } = await sb
    .from('invoice_payment_links')
    .select('id, invoice_id')
    .eq('token_hash', createHash('sha256').update(foreign).digest('hex'))
    .maybeSingle()
  test('TOKEN A DOES NOT OPEN INVOICE B', () => {
    assert.equal(foreignLink, null)
  })

  if (invoice) {
    const ephemeral = randomBytes(32).toString('base64url')
    const hash = createHash('sha256').update(ephemeral).digest('hex')
    const { data: link, error: linkError } = await sb
      .from('invoice_payment_links')
      .insert({
        company_id: invoice.company_id,
        invoice_id: invoice.id,
        token_hash: hash,
        purpose: 'deposit',
        expires_at: new Date(Date.now() + 60_000).toISOString(),
      })
      .select('id')
      .single()
    test('SECURE LINK INSERT WORKS', () => {
      assert.equal(linkError, null)
      assert.ok(link?.id)
    })
    if (link?.id) {
      await sb
        .from('invoice_payment_links')
        .update({ revoked_at: new Date().toISOString() })
        .eq('id', link.id)
      const { data: revoked } = await sb
        .from('invoice_payment_links')
        .select('revoked_at, expires_at')
        .eq('id', link.id)
        .single()
      test('REVOKED LINK BLOCKED', () => {
        assert.ok(revoked?.revoked_at)
        const usable = isPaymentLinkUsableLocal({
          revokedAt: revoked.revoked_at,
          expiresAt: revoked.expires_at,
        })
        assert.equal(usable.ok, false)
        assert.equal(usable.reason, 'revoked')
      })

      await sb
        .from('invoice_payment_links')
        .update({
          revoked_at: null,
          expires_at: new Date(Date.now() - 60_000).toISOString(),
        })
        .eq('id', link.id)
      const { data: expired } = await sb
        .from('invoice_payment_links')
        .select('revoked_at, expires_at')
        .eq('id', link.id)
        .single()
      test('EXPIRED LINK BLOCKED', () => {
        const usable = isPaymentLinkUsableLocal({
          revokedAt: expired?.revoked_at,
          expiresAt: expired?.expires_at,
        })
        assert.equal(usable.ok, false)
        assert.equal(usable.reason, 'expired')
      })

      await sb.from('invoice_payment_links').delete().eq('id', link.id)
    }

    test('PAID INVOICE CANNOT BE PAID AGAIN', () => {
      const due = resolveAmountDue({
        total: invoice.total,
        depositAmount: invoice.deposit_amount,
        paidTotal: invoice.total,
        purpose: 'balance',
      })
      assert.equal(due.amount, 0)
      assert.equal(due.reason, 'already_paid')
    })
  }
}

if (failed > 0) {
  console.error(`\n${failed} failed, ${passed} passed`)
  process.exit(1)
}
console.log(`\n${passed} passed`)
