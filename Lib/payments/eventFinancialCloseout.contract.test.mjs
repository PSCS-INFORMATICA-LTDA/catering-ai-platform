import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const sql = readFileSync(
  join(root, 'supabase/migrations/20260912011000_post_event_financial_closeout.sql'),
  'utf8',
)
const orders = readFileSync(
  join(root, 'app/api/payments/paypal/orders/route.ts'),
  'utf8',
)
const operatorLink = readFileSync(
  join(root, 'app/api/invoices/[id]/payment-link/route.ts'),
  'utf8',
)
const publicLink = readFileSync(
  join(root, 'app/api/public/proposta/[token]/payment-link/route.ts'),
  'utf8',
)
const payable = readFileSync(
  join(root, 'Lib/payments/createPayablePaymentLink.ts'),
  'utf8',
)
const panel = readFileSync(
  join(root, 'components/payments/QuoteInvoicePanel.tsx'),
  'utf8',
)
const acceptRoute = readFileSync(
  join(root, 'app/api/public/proposta/[token]/route.ts'),
  'utf8',
)

test('post-event finalize remains the existing SECURITY DEFINER model', () => {
  assert.match(sql, /invoice_kind, parent_invoice_id, service_order_id, closeout_id/)
  assert.match(sql, /'post_event_adjustment'/)
  assert.match(sql, /deposit_amount, balance_amount, paid_total/)
  assert.match(sql, /v_closeout.adjustment_total,\s*0,\s*v_closeout.adjustment_total/s)
  assert.match(sql, /IF v_closeout.status = 'invoiced' THEN/)
  assert.match(sql, /duplicate', true/)
  assert.match(sql, /closed_no_charge/)
  assert.match(sql, /REVOKE ALL ON FUNCTION public.finalize_event_financial_closeout/)
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public.finalize_event_financial_closeout[\s\S]*TO service_role/)
  assert.match(sql, /final_event_total', round\(\(v_original.total \+ v_closeout.adjustment_total\)/)
})

test('T55: post-event PayPal checkout does not acquire a schedule hold', () => {
  assert.match(orders, /invoiceKind === 'post_event_adjustment'/)
  assert.match(orders, /not_required_post_event/)
  assert.match(orders, /must never reserve the agenda again/)
})

test('operator payment-link stays authenticated and amount-first', () => {
  assert.match(operatorLink, /requireApiPermission\('finance.invoices.view'\)/)
  assert.match(operatorLink, /createPayablePaymentLink/)
  assert.doesNotMatch(operatorLink, /export async function GET/)
  assert.match(payable, /resolveServerPurposeAmounts/)
  assert.match(payable, /paymentLinkBlockReason/)
  const blockAt = payable.indexOf('paymentLinkBlockReason')
  const insertAt = payable.indexOf('createInvoicePaymentLink')
  assert.ok(blockAt >= 0 && insertAt > blockAt)
})

test('public payment-link is token-bound and ignores client amounts', () => {
  assert.match(publicLink, /ignoreClientAmount\(body.amount\)/)
  assert.match(publicLink, /publicPaymentGate/)
  assert.match(publicLink, /void body.invoice_id/)
  assert.match(publicLink, /void body.company_id/)
  assert.doesNotMatch(publicLink, /requireApiPermission/)
})

test('T04/T08: acceptance is idempotent and CR capture is locked before accept', () => {
  assert.match(acceptRoute, /alreadyAccepted && body.action === 'accept'/)
  assert.match(acceptRoute, /already_accepted: true/)
  assert.match(acceptRoute, /coupon_approval_pending/)
  assert.match(panel, /awaiting-customer-acceptance/)
  assert.match(panel, /if \(!quoteAccepted\)/)
  assert.match(panel, /send-full-whatsapp/)
})
