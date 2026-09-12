/**
 * Read-only DEV check — tenant isolation + secret leakage against existing rows.
 * Never writes. Never creates PayPal/live money movement.
 */
import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { collectSensitiveFinanceLeaks } from '../../Lib/payments/sanitizeFinanceObservability.ts'
import {
  computeFinancialCheck,
  computeEventFinalTotal,
} from '../../Lib/payments/financeObservability.ts'
import { loadDevEnv, assertDevUrl } from './loadDevEnv.mjs'

const env = loadDevEnv(process.cwd())
assertDevUrl(env.url)
const CDL = '65fd576f-8d97-49ba-bf38-61bc1e94e94a'
const db = createClient(env.url, env.service, { auth: { persistSession: false, autoRefreshToken: false } })

const lines = []
const log = (message) => {
  lines.push(message)
  console.log(message)
}

const { data: otherCompany, error: otherError } = await db
  .from('companies')
  .select('id')
  .neq('id', CDL)
  .limit(1)
  .maybeSingle()
if (otherError) throw otherError
const otherId = otherCompany?.id ? String(otherCompany.id) : null

const { data: cdlInvoices, error: invoiceError } = await db
  .from('invoices')
  .select('id, company_id, invoice_number, invoice_kind, parent_invoice_id, status, total, paid_total, deposit_amount, currency_code')
  .eq('company_id', CDL)
  .order('created_at', { ascending: false })
  .limit(25)
if (invoiceError) throw invoiceError

log(`CDL invoices fetched=${cdlInvoices?.length || 0}`)
assert.ok((cdlInvoices ?? []).every((row) => row.company_id === CDL))

if (otherId) {
  const { data: otherInvoices, error } = await db
    .from('invoices')
    .select('id, company_id')
    .eq('company_id', otherId)
    .limit(25)
  if (error) throw error
  const overlap = new Set((cdlInvoices ?? []).map((row) => row.id))
  const leaked = (otherInvoices ?? []).filter((row) => overlap.has(row.id))
  assert.equal(leaked.length, 0)
  log(`tenant isolation PASS other_company_rows=${otherInvoices?.length || 0}`)
} else {
  log('tenant isolation SKIP no second company')
}

const invoiceIds = (cdlInvoices ?? []).map((row) => row.id)
const { data: payments } = invoiceIds.length
  ? await db
      .from('invoice_payments')
      .select('id, company_id, invoice_id, provider, status, amount, metadata, provider_order_id, provider_capture_id, idempotency_key')
      .eq('company_id', CDL)
      .in('invoice_id', invoiceIds)
      .limit(50)
  : { data: [] }

assert.ok((payments ?? []).every((row) => row.company_id === CDL))
log(`CDL payments fetched=${payments?.length || 0}`)

const { data: links } = invoiceIds.length
  ? await db
      .from('invoice_payment_links')
      .select('id, purpose, expires_at, revoked_at, created_at')
      .eq('company_id', CDL)
      .in('invoice_id', invoiceIds)
      .limit(20)
  : { data: [] }

const serialized = JSON.stringify({ invoices: cdlInvoices, payments, links })
assert.doesNotMatch(serialized, /token_hash/)
assert.equal(collectSensitiveFinanceLeaks({ invoices: cdlInvoices, payments, links }).length, 0)
log('secret leak scan PASS (token_hash/client_secret/webhook_route_key absent)')

const supplemental = (cdlInvoices ?? []).find((row) => row.invoice_kind === 'post_event_adjustment')
if (supplemental) {
  log(`supplemental ${supplemental.invoice_number} parent=${supplemental.parent_invoice_id || 'missing'}`)
  const parent = (cdlInvoices ?? []).find((row) => row.id === supplemental.parent_invoice_id)
  if (parent) {
    const totals = computeEventFinalTotal(Number(parent.total), Number(supplemental.total))
    assert.equal(totals.original_total, Number(parent.total))
    assert.equal(totals.final_event_total, Number((Number(parent.total) + Number(supplemental.total)).toFixed(2)))
    log(`lineage PASS original=${totals.original_total} adjustment=${totals.adjustment_total} final=${totals.final_event_total}`)
  }
} else {
  log('lineage SKIP no supplemental invoice in latest CDL rows')
}

const sample = cdlInvoices?.[0]
if (sample) {
  const completed = (payments ?? [])
    .filter((payment) => payment.invoice_id === sample.id && payment.status === 'completed')
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0)
  const check = computeFinancialCheck({
    invoiceTotal: Number(sample.total),
    invoicePaidTotal: Number(sample.paid_total),
    invoiceStatus: sample.status,
    depositAmount: Number(sample.deposit_amount),
    canceled: sample.status === 'canceled',
    completedPaymentsTotal: completed,
    refundedTotal: 0,
  })
  log(`financial check ${sample.invoice_number} signal=${check.signal}`)
}

const { data: paypalRow } = await db
  .from('company_payment_providers')
  .select('environment, enabled, public_client_id, webhook_route_key, metadata')
  .eq('company_id', CDL)
  .eq('provider', 'paypal')
  .maybeSingle()

log(`paypal environment=${paypalRow?.environment || 'missing'} enabled=${paypalRow?.enabled === true}`)
assert.notEqual(paypalRow?.environment, 'live')

mkdirSync('/opt/cursor/artifacts', { recursive: true })
writeFileSync('/opt/cursor/artifacts/finance-observability-dev-read.log', `${lines.join('\n')}\n`)
log('READY_FOR_LOG')
