/**
 * DEV concurrency proof for max_uses_per_customer.
 * Two simultaneous reserves, same customer, same coupon, limit = 1.
 * Only one may persist a pending|applied application.
 *
 * Does not delete commercial rows. Uses a clearly tagged QA coupon/customer.
 */
import { randomUUID } from 'node:crypto'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { couponCustomerUsageClaimId } from '../../Lib/coupons/couponPersistError.ts'
import { assertDevUrl, loadDevEnv } from './loadDevEnv.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const COMPANY = '65fd576f-8d97-49ba-bf38-61bc1e94e94a'
const TAG = 'QA Coupon Center concurrency'
const COUPON_CODE = 'QA-CONCUR-1'

function fail(message) {
  console.error(`FAIL ${message}`)
  process.exit(1)
}

function pass(label, detail = '') {
  console.log(`PASS ${label}${detail ? ` ${detail}` : ''}`)
}

function futureDate(days) {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function classify(error) {
  const text = [error?.message, error?.details, error?.hint, error?.code]
    .filter(Boolean)
    .join(' ')
  if (/coupon_usage_limit_reached/i.test(text)) return 'usage_limit_reached'
  if (/duplicate key|unique constraint|23505/i.test(text)) return 'unique_violation'
  return text || 'unknown'
}

function payload(quoteId, couponId, claimId) {
  return {
    id: claimId,
    company_id: COMPANY,
    quote_id: quoteId,
    coupon_id: couponId,
    coupon_code_snapshot: COUPON_CODE,
    campaign_name_snapshot: TAG,
    eligible_amount: 100,
    potential_discount_amount: 10,
    applied_discount_amount: 10,
    approval_status: 'applied',
    rules_snapshot: { qa: true, purpose: 'concurrency' },
  }
}

async function reserve(db, mode, companyId, quoteId, couponId, customerId) {
  if (mode === 'rpc') {
    return db.rpc('reserve_quote_coupon_application', {
      p_company_id: companyId,
      p_quote_id: quoteId,
      p_coupon_id: couponId,
      p_payload: {
        coupon_code_snapshot: COUPON_CODE,
        campaign_name_snapshot: TAG,
        eligible_amount: 100,
        potential_discount_amount: 10,
        applied_discount_amount: 10,
        approval_status: 'applied',
        rules_snapshot: { qa: true, purpose: 'concurrency' },
      },
    })
  }
  const claimId = couponCustomerUsageClaimId(companyId, couponId, customerId, 1)
  return db.from('quote_coupon_applications').insert(payload(quoteId, couponId, claimId)).select('id').maybeSingle()
}

async function ensureCustomer(db) {
  const suffix = randomUUID().replace(/-/g, '').slice(0, 8)
  const phone = `1407555${suffix.slice(0, 4)}`.slice(0, 11)
  const inserted = await db
    .from('customers')
    .insert({
      company_id: COMPANY,
      full_name: `${TAG} ${suffix}`,
      ab_name: `${TAG} ${suffix}`,
      phone: `+${phone}`,
      phone_normalized: phone,
      email: `qa.coupon.concurrency.${suffix}@example.invalid`,
      source: 'qa_coupon_center',
      active: true,
      is_customer: true,
      is_supplier: false,
      is_team: false,
    })
    .select('id, full_name, phone_normalized')
    .single()
  if (inserted.error) fail(`customer insert: ${inserted.error.message}`)
  return inserted.data
}

async function ensureCoupon(db) {
  const existing = await db
    .from('coupons')
    .select('id, code, max_uses_per_customer, status')
    .eq('company_id', COMPANY)
    .eq('code', COUPON_CODE)
    .maybeSingle()
  if (existing.data?.id) {
    if (existing.data.max_uses_per_customer !== 1 || existing.data.status !== 'active') {
      const updated = await db
        .from('coupons')
        .update({
          max_uses_per_customer: 1,
          status: 'active',
          metadata: { qa: true, purpose: 'coupon_center_concurrency' },
        })
        .eq('id', existing.data.id)
        .eq('company_id', COMPANY)
      if (updated.error) fail(`coupon update: ${updated.error.message}`)
    }
    return existing.data
  }
  const inserted = await db
    .from('coupons')
    .insert({
      company_id: COMPANY,
      code: COUPON_CODE,
      campaign_name: TAG,
      description: 'DEV/QA concurrency fixture. Not commercial.',
      status: 'active',
      discount_type: 'fixed',
      discount_value: 10,
      min_eligible_amount: 0,
      max_uses_per_customer: 1,
      max_uses_per_quote: 1,
      apply_to_deposit: false,
      apply_to_balance: true,
      manual_approval_required: false,
      distribution_channel: 'QA',
      metadata: { qa: true, purpose: 'coupon_center_concurrency' },
    })
    .select('id, code, max_uses_per_customer, status')
    .single()
  if (inserted.error) fail(`coupon insert: ${inserted.error.message}`)
  return inserted.data
}

async function makeQuote(db, customerId, label) {
  const eventId = randomUUID()
  const quoteId = randomUUID()
  const run = randomUUID().slice(0, 8)
  const event = await db.from('events').insert({
    id: eventId,
    company_id: COMPANY,
    customer_id: customerId,
    event_name: `${TAG} ${label} ${run}`,
    event_date: futureDate(40),
    start_time: '12:00:00',
    end_time: '16:00:00',
    adults_count: 20,
    children_count: 0,
    billable_guests: 20,
    total_guests: 20,
    active: true,
    city: 'Orlando',
    state: 'FL',
    country: 'US',
    postal_code: '32801',
    notes: TAG,
  })
  if (event.error) fail(`event insert ${label}: ${event.error.message}`)
  const quote = await db.from('quotes').insert({
    id: quoteId,
    company_id: COMPANY,
    customer_id: customerId,
    event_id: eventId,
    quote_number: `QA-CC-${run}-${label}`,
    language: 'en',
    quote_status: 'ready_for_review',
    source: 'qa_coupon_center',
    active: true,
    adult_count: 20,
    children_under_3_count: 0,
    children_4_to_12_count: 0,
    physical_guest_count: 20,
    billable_guest_count: 20,
    package_total: 100,
    additional_total: 0,
    quote_total: 100,
    reservation_percentage: 30,
    reservation_amount: 30,
    balance_due: 70,
    currency_code: 'USD',
  })
  if (quote.error) fail(`quote insert ${label}: ${quote.error.message}`)
  return { quoteId, eventId, quoteNumber: `QA-CC-${run}-${label}` }
}

async function main() {
  const env = loadDevEnv(root)
  assertDevUrl(env.url)
  const db = createClient(env.url, env.service, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const probe = await db.rpc('reserve_quote_coupon_application', {
    p_company_id: null,
    p_quote_id: null,
    p_coupon_id: null,
    p_payload: {},
  })
  const probeText = [probe.error?.message, probe.error?.details, probe.error?.code]
    .filter(Boolean)
    .join(' ')
  const mode = /PGRST202|Could not find the function/i.test(probeText) ? 'claim' : 'rpc'
  pass('reserve_mode', `${mode} ${probeText.slice(0, 80) || 'ok'}`)

  const customer = await ensureCustomer(db)
  const coupon = await ensureCoupon(db)
  const quoteA = await makeQuote(db, customer.id, 'A')
  const quoteB = await makeQuote(db, customer.id, 'B')
  pass('fixtures', `customer=${customer.id} coupon=${coupon.id} a=${quoteA.quoteId} b=${quoteB.quoteId}`)

  const started = Date.now()
  const [first, second] = await Promise.all([
    reserve(db, mode, COMPANY, quoteA.quoteId, coupon.id, customer.id),
    reserve(db, mode, COMPANY, quoteB.quoteId, coupon.id, customer.id),
  ])
  const elapsed = Date.now() - started

  const results = [
    {
      quoteId: quoteA.quoteId,
      ok: !first.error,
      reason: first.error ? classify(first.error) : 'applied',
      id: first.data?.id || first.data?.[0]?.id || null,
    },
    {
      quoteId: quoteB.quoteId,
      ok: !second.error,
      reason: second.error ? classify(second.error) : 'applied',
      id: second.data?.id || second.data?.[0]?.id || null,
    },
  ]
  const winners = results.filter((row) => row.ok)
  const losers = results.filter((row) => !row.ok)
  if (winners.length !== 1) {
    fail(`expected exactly one winner, got ${JSON.stringify(results)}`)
  }
  const acceptedLoser =
    losers[0]?.reason === 'usage_limit_reached' ||
    (mode === 'claim' && losers[0]?.reason === 'unique_violation')
  if (losers.length !== 1 || !acceptedLoser) {
    fail(`expected one usage limit/unique loser, got ${JSON.stringify(results)}`)
  }
  pass('parallel_limit_1', `${JSON.stringify(results)} elapsed_ms=${elapsed}`)

  const winner = winners[0]
  const retry = await reserve(db, mode, COMPANY, winner.quoteId, coupon.id, customer.id)
  if (retry.error && classify(retry.error) !== 'unique_violation') {
    fail(`idempotent retry failed: ${classify(retry.error)}`)
  }
  const retryId = retry.data?.id || retry.data?.[0]?.id || winner.id
  if (mode === 'rpc' && retry.error) fail(`idempotent retry failed: ${classify(retry.error)}`)
  if (winner.id && retry.data?.id && winner.id !== retry.data.id && !retry.error) {
    fail(`idempotent retry created a second row ${retry.data.id}`)
  }
  pass('same_quote_idempotent', `application=${winner.id || retryId}`)

  const { data: applications, error: listError } = await db
    .from('quote_coupon_applications')
    .select('id, quote_id, approval_status, coupon_id')
    .eq('company_id', COMPANY)
    .eq('coupon_id', coupon.id)
    .in('quote_id', [quoteA.quoteId, quoteB.quoteId])
  if (listError) fail(`list applications: ${listError.message}`)
  const live = (applications ?? []).filter((row) =>
    ['pending', 'applied'].includes(row.approval_status),
  )
  if (live.length !== 1) {
    fail(`live applications=${JSON.stringify(applications)}`)
  }
  pass('db_count_pending_applied', `count=1 application=${live[0].id}`)

  console.log(
    JSON.stringify(
      {
        ok: true,
        companyId: COMPANY,
        customerId: customer.id,
        couponId: coupon.id,
        couponCode: COUPON_CODE,
        quoteA: quoteA.quoteId,
        quoteB: quoteB.quoteId,
        winnerQuoteId: winner.quoteId,
        loserQuoteId: losers[0].quoteId,
        applicationId: live[0].id,
        elapsedMs: elapsed,
        mode,
      },
      null,
      2,
    ),
  )
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
