/**
 * Coupon Center hardening E2E against Preview/DEV.
 * Uses public HTTP + authenticated admin cookies. Does not use service_role
 * to approve/reject. Does not delete commercial rows. Never touches PROD.
 */
import { randomUUID } from 'node:crypto'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { assertDevUrl, DEV_REF, loadDevEnv } from './loadDevEnv.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const COMPANY = '65fd576f-8d97-49ba-bf38-61bc1e94e94a'
const PACKAGE_ID = process.env.COUPON_E2E_PACKAGE_ID || '95a67f3e-3c1c-4eb1-ad5b-6012d7fbea71'
const BASE = (process.env.COUPON_E2E_BASE_URL || '').replace(/\/$/, '')
const CDL_CANCEL_POLICY_VERSION = 'CDL_CANCEL_2026_V1'
const TAG = 'QA Coupon Hardening'
const rows = []
const evidence = { quotes: [], applications: [], reasons: {}, approve: null, reject: null }

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
      ...(cookie ? { cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await response.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = { raw: text.slice(0, 300) }
  }
  return { response, data, cookie: jarFrom(response, cookie) }
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

function draft({ locale, firstName, lastName, phone, email, eventName, eventDate = '2026-10-10' }) {
  return {
    locale,
    contact: { firstName, lastName, phone, email },
    event: {
      eventName,
      eventDate,
      startTime: '12:00',
      endTime: '16:00',
      adultCount: 40,
      childrenUnder3Count: 0,
      children4To12Count: 0,
      address: {
        source: 'manual',
        route: 'Orange Ave',
        number: '100',
        city: 'Orlando',
        region: 'FL',
        postalCode: '32801',
        country: 'US',
      },
    },
    selection: { packageId: PACKAGE_ID, additionals: [], packageSelections: {} },
    grill: { hasGrill: false, rentalRequired: true, rentalQty: 1 },
    cancellation: { accepted: true, version: 'cdl-cancel-v1' },
  }
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

async function packageSelections(db) {
  const groups = await db
    .from('package_option_groups')
    .select('id, required, active')
    .eq('company_id', COMPANY)
    .eq('package_id', PACKAGE_ID)
    .eq('active', true)
  const selections = {}
  for (const group of (groups.data ?? []).filter((row) => row.required === true)) {
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

async function startSession(locale) {
  const started = await jsonFetch('/api/public/quote-intake/session', {
    method: 'POST',
    body: { companySlug: 'cdl', locale, forceNew: true },
  })
  if (!started.response.ok) throw new Error(`session ${started.response.status}`)
  return started
}

async function saveDraft(cookie, payload) {
  return jsonFetch('/api/public/quote-intake/session', {
    method: 'PATCH',
    cookie,
    body: { draft: payload, currentStep: 'review', website: '' },
  })
}

async function applyCoupon(cookie, code, extra = {}) {
  return jsonFetch('/api/public/coupons/preview', {
    method: 'POST',
    cookie,
    body: { code, ...extra },
  })
}

async function submitQuote(cookie, payload, consentVersion, idempotencyKey = randomUUID()) {
  return jsonFetch('/api/public/quote-intake/submit', {
    method: 'POST',
    cookie,
    body: {
      idempotencyKey,
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

async function upsertQaCoupon(db, row) {
  const existing = await db
    .from('coupons')
    .select('id')
    .eq('company_id', COMPANY)
    .eq('code', row.code)
    .maybeSingle()
  if (existing.data?.id) {
    const updated = await db
      .from('coupons')
      .update({ ...row, updated_at: new Date().toISOString() })
      .eq('id', existing.data.id)
      .eq('company_id', COMPANY)
    if (updated.error) throw new Error(updated.error.message)
    return existing.data.id
  }
  const created = await db.from('coupons').insert(row).select('id').single()
  if (created.error) throw new Error(created.error.message)
  return created.data.id
}

async function loadQuote(db, quoteId) {
  const quote = await db.from('quotes').select('*').eq('id', quoteId).eq('company_id', COMPANY).maybeSingle()
  const application = await db
    .from('quote_coupon_applications')
    .select('*')
    .eq('quote_id', quoteId)
    .eq('company_id', COMPANY)
    .maybeSingle()
  const version = await db
    .from('quote_versions')
    .select('id, quote_total, discount_amount, reservation_amount, balance_due, commercial_snapshot, is_current')
    .eq('quote_id', quoteId)
    .eq('company_id', COMPANY)
    .eq('is_current', true)
    .maybeSingle()
  return { quote: quote.data, application: application.data, version: version.data }
}

async function main() {
  if (!BASE) throw new Error('COUPON_E2E_BASE_URL required')
  if (/cateringai\.app/i.test(BASE)) throw new Error('Refused: production host')
  const env = loadDevEnv(root)
  assertDevUrl(env.url)
  const db = createClient(env.url, env.service, { auth: { persistSession: false, autoRefreshToken: false } })
  const anon = createClient(env.url, env.anon, { auth: { persistSession: false, autoRefreshToken: false } })
  const settings = await db
    .from('company_public_quote_settings')
    .select('enabled, consent_version')
    .eq('company_id', COMPANY)
    .single()
  if (settings.error || !settings.data?.enabled) throw new Error('public quote disabled')
  const selections = await packageSelections(db)
  const consentVersion = settings.data.consent_version

  const qaBase = {
    company_id: COMPANY,
    campaign_name: TAG,
    description: 'DEV/QA hardening fixture. Not commercial.',
    discount_type: 'fixed',
    discount_value: 25,
    min_eligible_amount: 0,
    eligible_weekdays: [0, 1, 2, 3, 4, 5, 6],
    all_packages: true,
    eligible_package_ids: [],
    include_additionals: true,
    include_grill: true,
    include_additional_cuts: true,
    include_mileage: true,
    new_customer_only: false,
    max_uses_per_customer: null,
    max_uses_per_quote: 1,
    stackable: false,
    apply_to_deposit: false,
    apply_to_balance: true,
    manual_approval_required: false,
    metadata: { qa: true, purpose: 'hardening' },
  }
  await upsertQaCoupon(db, { ...qaBase, code: 'QA-HARD-PAUSE', status: 'paused' })
  await upsertQaCoupon(db, { ...qaBase, code: 'QA-HARD-EXP', status: 'active', valid_to: '2020-01-01' })
  await upsertQaCoupon(db, { ...qaBase, code: 'QA-HARD-FUT', status: 'active', valid_from: '2027-01-01' })
  await upsertQaCoupon(db, { ...qaBase, code: 'QA-HARD-DAY', status: 'active', eligible_weekdays: [0] })
  await upsertQaCoupon(db, { ...qaBase, code: 'QA-HARD-MIN', status: 'active', min_eligible_amount: 999999 })
  await upsertQaCoupon(db, {
    ...qaBase,
    code: 'QA-HARD-PKG',
    status: 'active',
    all_packages: false,
    eligible_package_ids: ['00000000-0000-4000-8000-000000000001'],
  })
  await upsertQaCoupon(db, { ...qaBase, code: 'QA-HARD-NEW', status: 'active', new_customer_only: true })

  const email = process.env.CATERING_DEV_LOGIN_EMAIL
  const password = process.env.CATERING_DEV_LOGIN_PASSWORD
  if (!email || !password) throw new Error('CATERING_DEV_LOGIN_* required')
  const signed = await anon.auth.signInWithPassword({ email, password })
  if (signed.error || !signed.data.session) throw new Error(`admin login failed: ${signed.error?.message || 'no session'}`)
  const adminCookie = authCookie(signed.data.session)
  const me = await jsonFetch('/api/auth/me', { cookie: adminCookie })
  record('AUTH-admin-me', me.response.ok === true, `${me.response.status} ${me.data?.email || me.data?.error || ''}`)

  for (const locale of ['pt', 'en', 'es']) {
    const phone = await unusedPhone(db, `14075551${locale === 'pt' ? '1' : locale === 'en' ? '2' : '3'}`)
    const payload = draft({
      locale,
      firstName: 'QA',
      lastName: `Hard${locale.toUpperCase()}`,
      phone,
      email: `qa.hard.${locale}@example.invalid`,
      eventName: `${TAG} ${locale}`,
    })
    payload.selection.packageSelections = selections
    const started = await startSession(locale)
    const saved = await saveDraft(started.cookie, payload)
    record(`E2E-${locale}-session`, saved.response.ok, String(saved.response.status))
    if (!saved.response.ok) continue

    const invalid = await applyCoupon(saved.cookie, 'NOT-A-REAL-CODE', {
      discount_amount: 999,
      approval_status: 'applied',
      final_total: 1,
    })
    record(
      `E2E-${locale}-invalid`,
      invalid.response.status >= 400 && !invalid.data?.coupon && invalid.data?.reason === 'not_found',
      `${invalid.response.status} ${invalid.data?.reason || ''}`,
    )
    evidence.reasons[`${locale}-not_found`] = invalid.data?.reason

    const cases = [
      ['QA-HARD-PAUSE', 'paused'],
      ['QA-HARD-EXP', 'expired'],
      ['QA-HARD-FUT', 'not_started'],
      ['QA-HARD-DAY', 'weekday_not_allowed'],
      ['QA-HARD-MIN', 'minimum_not_reached'],
      ['QA-HARD-PKG', 'package_not_allowed'],
    ]
    for (const [code, reason] of cases) {
      const result = await applyCoupon(saved.cookie, code)
      record(
        `E2E-${locale}-${reason}`,
        result.response.status >= 400 && result.data?.coupon == null && result.data?.reason === reason,
        `${result.response.status} ${result.data?.reason || ''}`,
      )
      evidence.reasons[`${locale}-${reason}`] = result.data?.reason
    }

    const welcome = await applyCoupon(saved.cookie, 'welcome', { discountAmount: 1, total: 1 })
    record(
      `E2E-${locale}-welcome-forged-ignored`,
      welcome.response.ok &&
        welcome.data?.coupon?.code === 'WELCOME' &&
        Number(welcome.data.coupon.appliedDiscountAmount) === 100 &&
        Number(welcome.data.pricing?.total) > 1000,
      JSON.stringify({
        applied: welcome.data?.coupon?.appliedDiscountAmount,
        total: welcome.data?.pricing?.total,
        deposit: welcome.data?.pricing?.deposit,
        balance: welcome.data?.pricing?.balance,
      }),
    )

    const removed = await applyCoupon(saved.cookie, '')
    record(`E2E-${locale}-remove`, removed.response.ok && removed.data?.coupon == null, String(removed.response.status))
    const reapplied = await applyCoupon(saved.cookie, 'WELCOME')
    record(
      `E2E-${locale}-reapply`,
      reapplied.response.ok && reapplied.data?.coupon?.code === 'WELCOME',
      String(reapplied.response.status),
    )

    const pending = await applyCoupon(saved.cookie, 'CDL10')
    record(
      `E2E-${locale}-pending-payable-unchanged`,
      pending.response.ok &&
        pending.data?.coupon?.approvalStatus === 'pending' &&
        Number(pending.data.coupon.appliedDiscountAmount) === 0 &&
        Number(pending.data.pricing?.total) === Number(pending.data.coupon.totalBeforeCoupon) &&
        Number(pending.data.coupon.projectedTotalAfterApproval) < Number(pending.data.pricing?.total || 0),
      JSON.stringify({
        applied: pending.data?.coupon?.appliedDiscountAmount,
        payable: pending.data?.pricing?.total,
        projected: pending.data?.coupon?.projectedTotalAfterApproval,
      }),
    )
  }

  {
    const existing = await db
      .from('customers')
      .select('phone_normalized')
      .eq('company_id', COMPANY)
      .not('phone_normalized', 'is', null)
      .limit(1)
      .maybeSingle()
    const started = await startSession('en')
    const payload = draft({
      locale: 'en',
      firstName: 'QA',
      lastName: 'ExistingCustomer',
      phone: existing.data?.phone_normalized ? `+${existing.data.phone_normalized}` : '+14075550111',
      email: 'qa.hard.existing@example.invalid',
      eventName: `${TAG} new customer`,
    })
    payload.selection.packageSelections = selections
    const saved = await saveDraft(started.cookie, payload)
    const result = await applyCoupon(saved.cookie, 'QA-HARD-NEW')
    record(
      'E2E-new-customer-only',
      result.response.status >= 400 && result.data?.reason === 'customer_not_eligible',
      `${result.response.status} ${result.data?.reason || ''}`,
    )
  }

  {
    const phone = await unusedPhone(db, '140755520')
    const payload = draft({
      locale: 'pt',
      firstName: 'QA',
      lastName: 'ApproveUI',
      phone,
      email: 'qa.hard.approve@example.invalid',
      eventName: `${TAG} approve`,
    })
    payload.selection.packageSelections = selections
    const started = await startSession('pt')
    const saved = await saveDraft(started.cookie, payload)
    await applyCoupon(saved.cookie, 'CDL10')
    const submitted = await submitQuote(saved.cookie, payload, consentVersion)
    const quoteId = submitted.data?.quote?.id || ''
    record(
      'E2E-approve-submit',
      submitted.response.ok && Boolean(quoteId),
      `${submitted.response.status} ${quoteId || JSON.stringify(submitted.data).slice(0, 240)}`,
    )
    const before = await loadQuote(db, quoteId)
    const beforeTotal = Number(before.quote?.quote_total)
    const approve = await jsonFetch('/api/coupons/applications', {
      method: 'PATCH',
      cookie: adminCookie,
      body: { id: before.application?.id, action: 'approve' },
    })
    const after = await loadQuote(db, quoteId)
    const ok =
      approve.response.ok &&
      after.application?.approval_status === 'applied' &&
      Number(after.application?.applied_discount_amount) > 0 &&
      Number(after.quote?.quote_total) < beforeTotal &&
      Math.abs(
        Number(after.quote?.reservation_amount ?? after.quote?.deposit_amount) +
          Number(after.quote?.balance_due) -
          Number(after.quote?.quote_total),
      ) < 0.01
    record(
      'E2E-approve-authenticated',
      ok,
      JSON.stringify({
        http: approve.response.status,
        applicationId: after.application?.id,
        quoteId,
        beforeTotal,
        afterTotal: after.quote?.quote_total,
        deposit: after.quote?.reservation_amount,
        balance: after.quote?.balance_due,
        discount: after.application?.applied_discount_amount,
      }),
    )
    evidence.approve = {
      quoteId,
      applicationId: after.application?.id,
      versionId: after.version?.id,
      beforeTotal,
      afterTotal: after.quote?.quote_total,
      deposit: after.quote?.reservation_amount,
      balance: after.quote?.balance_due,
    }
    evidence.quotes.push(quoteId)
    evidence.applications.push(after.application?.id)
  }

  {
    const phone = await unusedPhone(db, '140755521')
    const payload = draft({
      locale: 'en',
      firstName: 'QA',
      lastName: 'RejectUI',
      phone,
      email: 'qa.hard.reject@example.invalid',
      eventName: `${TAG} reject`,
    })
    payload.selection.packageSelections = selections
    const started = await startSession('en')
    const saved = await saveDraft(started.cookie, payload)
    await applyCoupon(saved.cookie, 'CDL10')
    const submitted = await submitQuote(saved.cookie, payload, consentVersion)
    const quoteId = submitted.data?.quote?.id || ''
    const before = await loadQuote(db, quoteId)
    const beforeTotal = Number(before.quote?.quote_total)
    const reject = await jsonFetch('/api/coupons/applications', {
      method: 'PATCH',
      cookie: adminCookie,
      body: { id: before.application?.id, action: 'reject' },
    })
    const after = await loadQuote(db, quoteId)
    const ok =
      reject.response.ok &&
      after.application?.approval_status === 'rejected' &&
      Number(after.application?.applied_discount_amount) === 0 &&
      Number(after.quote?.quote_total) === beforeTotal &&
      Number(after.quote?.discount_amount ?? after.quote?.discount ?? 0) === 0
    record(
      'E2E-reject-authenticated',
      ok,
      JSON.stringify({
        http: reject.response.status,
        applicationId: after.application?.id,
        quoteId,
        total: after.quote?.quote_total,
        discount: after.quote?.discount_amount,
        status: after.application?.approval_status,
      }),
    )
    evidence.reject = {
      quoteId,
      applicationId: after.application?.id,
      total: after.quote?.quote_total,
    }
    evidence.quotes.push(quoteId)
    evidence.applications.push(after.application?.id)
  }

  const failed = rows.filter((row) => !row.ok)
  console.log(`\nCOUPON HARDENING E2E: ${rows.length - failed.length}/${rows.length} passed`)
  console.log(JSON.stringify(evidence, null, 2))
  if (failed.length) process.exit(1)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
