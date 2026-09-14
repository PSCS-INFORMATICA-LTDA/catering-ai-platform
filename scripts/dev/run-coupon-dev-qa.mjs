/**
 * Controlled DEV/QA persist proof for Coupon Center V1.
 * Creates clearly tagged public quotes. Approves CDL10 through the
 * authenticated PATCH so the atomic decide RPC is exercised. Does not
 * delete commercial rows. Does not touch PROD. Does not use PayPal Live.
 *
 *   COUPON_E2E_BASE_URL=https://... node scripts/dev/run-coupon-dev-qa.mjs
 */
import { randomUUID } from 'node:crypto'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { assertDevUrl, DEV_REF, loadDevEnv } from './loadDevEnv.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const COMPANY = '65fd576f-8d97-49ba-bf38-61bc1e94e94a'
const PACKAGE_ID = process.env.COUPON_E2E_PACKAGE_ID || '95a67f3e-3c1c-4eb1-ad5b-6012d7fbea71'
const BASE = (process.env.COUPON_E2E_BASE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '')
const CDL_CANCEL_POLICY_VERSION = 'CDL_CANCEL_2026_V1'
const TAG = 'QA Coupon Center'
const QA_UA = `CouponPersistQA/${randomUUID()}`

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
      eventDate: '2026-10-10',
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
        formattedAddress: '100 Orange Ave, Orlando, FL 32801, US',
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

async function submitQuote(cookie, payload, consentVersion, idempotencyKey = `qa-coupon-center-${randomUUID()}`) {
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

async function loadQuoteEvidence(db, quoteId) {
  const quote = await db
    .from('quotes')
    .select(
      'id, quote_number, customer_id, event_id, quote_total, reservation_amount, deposit_amount, balance_due, discount_amount, pricing_breakdown, source',
    )
    .eq('id', quoteId)
    .eq('company_id', COMPANY)
    .single()
  const version = await db
    .from('quote_versions')
    .select('id, quote_total, reservation_amount, balance_due, discount_amount, commercial_snapshot, is_current')
    .eq('quote_id', quoteId)
    .eq('company_id', COMPANY)
    .eq('is_current', true)
    .maybeSingle()
  const application = await db
    .from('quote_coupon_applications')
    .select('*')
    .eq('quote_id', quoteId)
    .eq('company_id', COMPANY)
    .maybeSingle()
  return { quote: quote.data, version: version.data, application: application.data }
}

async function main() {
  const env = loadDevEnv(root)
  assertDevUrl(env.url)
  if (/cateringai\.app/i.test(BASE)) {
    throw new Error('Refused: production host')
  }
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
  const evidence = {
    base: BASE,
    welcome: null,
    cdl10: null,
    rejectShare: null,
    concurrency: null,
  }

  {
    const admin = await jsonFetch('/api/coupons')
    record(
      'SEC-admin-unauthenticated',
      admin.response.status === 401 || admin.response.status === 403,
      String(admin.response.status),
    )
  }

  {
    const phone = await unusedPhone(db, '140755502')
    const payload = draft({
      locale: 'en',
      firstName: 'QA',
      lastName: 'CouponWelcome',
      phone,
      email: 'qa.coupon.welcome@example.invalid',
      eventName: `${TAG} WELCOME`,
    })
    payload.selection.packageSelections = selections
    const started = await startSession('en')
    const saved = await saveDraft(started.cookie, payload)
    const preview = await applyCoupon(saved.cookie, 'WELCOME')
    const forgedIgnored =
      preview.data?.coupon?.code === 'WELCOME' &&
      Number(preview.data?.coupon?.appliedDiscountAmount) === 100 &&
      Number(preview.data?.pricing?.total) > 1
    record(
      'E2E-welcome-preview-forged-ignored',
      forgedIgnored,
      JSON.stringify({
        status: preview.response.status,
        applied: preview.data?.coupon?.appliedDiscountAmount,
        total: preview.data?.pricing?.total,
      }),
    )
    const welcomeKey = `qa-coupon-center-${randomUUID()}`
    const submitted = await submitQuote(saved.cookie, payload, settings.data.consent_version, welcomeKey)
    const quoteId = submitted.data?.quote?.id || ''
    record(
      'E2E-welcome-submit',
      submitted.response.ok && Boolean(quoteId),
      `${submitted.response.status} ${JSON.stringify(submitted.data).slice(0, 240)}`,
    )
    if (quoteId) {
      const loaded = await loadQuoteEvidence(db, quoteId)
      const couponSnap =
        loaded.quote?.pricing_breakdown?.coupon ||
        loaded.version?.commercial_snapshot?.coupon ||
        null
      const deposit = Number(loaded.quote?.reservation_amount ?? loaded.quote?.deposit_amount)
      const balance = Number(loaded.quote?.balance_due)
      const total = Number(loaded.quote?.quote_total)
      const ok =
        loaded.application?.approval_status === 'applied' &&
        Number(loaded.application?.applied_discount_amount) === 100 &&
        couponSnap?.code === 'WELCOME' &&
        Math.abs(deposit + balance - total) < 0.01 &&
        total > 0
      record(
        'E2E-welcome-persisted',
        ok,
        JSON.stringify({
          quoteId,
          versionId: loaded.version?.id,
          applicationId: loaded.application?.id,
          customerId: loaded.quote?.customer_id,
          total,
          deposit,
          balance,
          discount: loaded.application?.applied_discount_amount,
          status: loaded.application?.approval_status,
        }),
      )
      evidence.welcome = {
        quoteId,
        versionId: loaded.version?.id,
        applicationId: loaded.application?.id,
        customerId: loaded.quote?.customer_id,
        total,
        deposit,
        balance,
      }
      const retry = await submitQuote(saved.cookie, payload, settings.data.consent_version, welcomeKey)
      record(
        'E2E-welcome-duplicate-submit',
        retry.response.ok && retry.data?.alreadySubmitted === true && retry.data?.quote?.id === quoteId,
        `${retry.response.status} alreadySubmitted=${retry.data?.alreadySubmitted}`,
      )
    }
  }

  {
    const phone = await unusedPhone(db, '140755503')
    const payload = draft({
      locale: 'pt',
      firstName: 'QA',
      lastName: 'CouponManual',
      phone,
      email: 'qa.coupon.manual@example.invalid',
      eventName: `${TAG} CDL10`,
    })
    payload.selection.packageSelections = selections
    const started = await startSession('pt')
    const saved = await saveDraft(started.cookie, payload)
    const preview = await applyCoupon(saved.cookie, 'CDL10')
    record(
      'E2E-cdl10-preview-pending',
      preview.response.ok &&
        preview.data?.coupon?.approvalStatus === 'pending' &&
        Number(preview.data?.coupon?.appliedDiscountAmount) === 0,
      JSON.stringify({
        status: preview.response.status,
        approval: preview.data?.coupon?.approvalStatus,
        applied: preview.data?.coupon?.appliedDiscountAmount,
        potential: preview.data?.coupon?.potentialDiscountAmount,
      }),
    )
    const submitted = await submitQuote(saved.cookie, payload, settings.data.consent_version)
    const quoteId = submitted.data?.quote?.id || ''
    record(
      'E2E-cdl10-submit',
      submitted.response.ok && Boolean(quoteId) && submitted.data?.coupon?.approvalStatus === 'pending',
      `${submitted.response.status} ${JSON.stringify(submitted.data).slice(0, 240)}`,
    )
    if (quoteId) {
      const loaded = await loadQuoteEvidence(db, quoteId)
      record(
        'E2E-cdl10-pending-row',
        loaded.application?.approval_status === 'pending' &&
          Number(loaded.application?.applied_discount_amount) === 0,
        JSON.stringify({
          quoteId,
          versionId: loaded.version?.id,
          applicationId: loaded.application?.id,
          status: loaded.application?.approval_status,
        }),
      )
      const invoice = await db.from('invoices').insert({
        company_id: COMPANY,
        quote_id: quoteId,
        invoice_number: `QA-CC-BLOCK-${randomUUID().slice(0, 8)}`,
        invoice_kind: 'original',
        status: 'awaiting_deposit',
        locale: 'pt',
        currency_code: 'USD',
        snapshot: { qa: true, purpose: 'pending_coupon_guard' },
        subtotal: 1,
        total: 1,
        deposit_amount: 1,
        balance_amount: 0,
        paid_total: 0,
      })
      record(
        'E2E-cdl10-invoice-guard',
        Boolean(invoice.error) && /coupon_approval_pending/i.test(invoice.error?.message || ''),
        invoice.error?.message || 'invoice inserted',
      )
      const serviceOrder = await db.from('service_orders').insert({
        company_id: COMPANY,
        quote_id: quoteId,
        quote_version_id: loaded.version?.id,
        status: 'planned',
        currency_code: 'USD',
        service_order_total: 1,
        commercial_snapshot: { qa: true },
        service_order_number: `QA-CC-SO-${randomUUID().slice(0, 8)}`,
      })
      record(
        'E2E-cdl10-service-order-guard',
        Boolean(serviceOrder.error) && /coupon_approval_pending/i.test(serviceOrder.error?.message || ''),
        serviceOrder.error?.message || 'service order inserted',
      )
      const quotePage = await fetch(`${BASE}/quotes/${quoteId}`, {
        headers: { cookie: adminCookie, 'user-agent': QA_UA },
      })
      const quoteHtml = await quotePage.text()
      record(
        'E2E-cdl10-quote-review-card',
        quotePage.ok &&
          quoteHtml.includes('data-testid="coupon-quote-decision"') &&
          quoteHtml.includes('data-testid="coupon-quote-approve"') &&
          (quoteHtml.includes('data-testid="coupon-share-blocked"') ||
            quoteHtml.includes('data-testid="coupon-quote-share-hint"')),
        `${quotePage.status} card=${quoteHtml.includes('data-testid="coupon-quote-decision"')} share=${quoteHtml.includes('data-testid="coupon-share-blocked"') || quoteHtml.includes('data-testid="coupon-quote-share-hint"')}`,
      )
      const anonymousPage = await fetch(`${BASE}/quotes/${quoteId}`, {
        headers: { 'user-agent': QA_UA },
        redirect: 'manual',
      })
      record(
        'E2E-cdl10-quote-review-unauthenticated',
        anonymousPage.status === 307 || anonymousPage.status === 302 || anonymousPage.status === 401,
        String(anonymousPage.status),
      )
      const blockedShare = await jsonFetch(`/api/quotes/${quoteId}/proposal`, {
        method: 'POST',
        cookie: adminCookie,
        body: { action: 'ensure_token' },
      })
      record(
        'E2E-cdl10-share-blocked-pending',
        blockedShare.response.status === 409 && blockedShare.data?.code === 'coupon_approval_pending',
        `${blockedShare.response.status} ${blockedShare.data?.code || blockedShare.data?.error || ''}`,
      )
      const approve = await jsonFetch('/api/coupons/applications', {
        method: 'PATCH',
        cookie: adminCookie,
        body: { id: loaded.application.id, action: 'approve' },
      })
      const after = await loadQuoteEvidence(db, quoteId)
      const total = Number(after.quote?.quote_total)
      const deposit = Number(after.quote?.reservation_amount ?? after.quote?.deposit_amount)
      const balance = Number(after.quote?.balance_due)
      record(
        'E2E-cdl10-approved',
        approve.response.ok &&
          approve.data?.via === 'rpc' &&
          after.application?.approval_status === 'applied' &&
          Number(after.application?.applied_discount_amount) > 0 &&
          Math.abs(deposit + balance - total) < 0.01 &&
          Math.abs(total - Number(approve.data?.total)) < 0.01,
        JSON.stringify({
          quoteId,
          versionId: after.version?.id,
          applicationId: after.application?.id,
          via: approve.data?.via ?? null,
          http: approve.response.status,
          status: after.application?.approval_status,
          applied: after.application?.applied_discount_amount,
          total,
          deposit,
          balance,
        }),
      )
      record('E2E-cdl10-via-rpc', approve.data?.via === 'rpc', String(approve.data?.via ?? 'missing'))
      const releasedShare = await jsonFetch(`/api/quotes/${quoteId}/proposal`, {
        method: 'POST',
        cookie: adminCookie,
        body: { action: 'ensure_token' },
      })
      record(
        'E2E-cdl10-share-released-after-approve',
        releasedShare.response.ok && Boolean(releasedShare.data?.data?.token || releasedShare.data?.data?.proposal_token),
        `${releasedShare.response.status} ${JSON.stringify(releasedShare.data).slice(0, 180)}`,
      )
      const approveAgain = await jsonFetch('/api/coupons/applications', {
        method: 'PATCH',
        cookie: adminCookie,
        body: { id: loaded.application.id, action: 'approve' },
      })
      const rejectAfterApprove = await jsonFetch('/api/coupons/applications', {
        method: 'PATCH',
        cookie: adminCookie,
        body: { id: loaded.application.id, action: 'reject' },
      })
      record(
        'E2E-cdl10-already-decided',
        approveAgain.response.ok &&
          approveAgain.data?.idempotent === true &&
          rejectAfterApprove.response.status === 409,
        JSON.stringify({
          approveAgain: approveAgain.response.status,
          idempotent: approveAgain.data?.idempotent ?? null,
          reject: rejectAfterApprove.response.status,
        }),
      )
      const afterPage = await fetch(`${BASE}/quotes/${quoteId}`, {
        headers: { cookie: adminCookie, 'user-agent': QA_UA },
      })
      const afterHtml = await afterPage.text()
      record(
        'E2E-cdl10-quote-review-card-gone',
        afterPage.ok && !afterHtml.includes('data-testid="coupon-quote-decision"'),
        `${afterPage.status} pendingCard=${afterHtml.includes('data-testid="coupon-quote-decision"')}`,
      )
      evidence.cdl10 = {
        quoteId,
        versionId: after.version?.id,
        applicationId: after.application?.id,
        customerId: after.quote?.customer_id,
        via: approve.data?.via ?? null,
        total,
        deposit,
        balance,
        applied: after.application?.applied_discount_amount,
      }
    }
  }

  {
    const phone = await unusedPhone(db, '140755505')
    const payload = draft({
      locale: 'en',
      firstName: 'QA',
      lastName: 'CouponRejectShare',
      phone,
      email: 'qa.coupon.reject.share@example.invalid',
      eventName: `${TAG} reject share`,
    })
    payload.selection.packageSelections = selections
    const started = await startSession('en')
    const saved = await saveDraft(started.cookie, payload)
    await applyCoupon(saved.cookie, 'CDL10')
    const submitted = await submitQuote(saved.cookie, payload, settings.data.consent_version)
    const quoteId = submitted.data?.quote?.id || ''
    const loaded = quoteId ? await loadQuoteEvidence(db, quoteId) : { application: null, quote: null, version: null }
    const blocked = quoteId
      ? await jsonFetch(`/api/quotes/${quoteId}/proposal`, {
          method: 'POST',
          cookie: adminCookie,
          body: { action: 'ensure_token' },
        })
      : { response: { status: 0 }, data: null }
    const reject = loaded.application?.id
      ? await jsonFetch('/api/coupons/applications', {
          method: 'PATCH',
          cookie: adminCookie,
          body: { id: loaded.application.id, action: 'reject' },
        })
      : { response: { status: 0 }, data: null }
    const released = quoteId
      ? await jsonFetch(`/api/quotes/${quoteId}/proposal`, {
          method: 'POST',
          cookie: adminCookie,
          body: { action: 'ensure_token' },
        })
      : { response: { status: 0 }, data: null }
    const after = quoteId ? await loadQuoteEvidence(db, quoteId) : loaded
    record(
      'E2E-cdl10-share-released-after-reject',
      Boolean(quoteId) &&
        blocked.response.status === 409 &&
        reject.response.ok &&
        reject.data?.via === 'rpc' &&
        after.application?.approval_status === 'rejected' &&
        released.response.ok &&
        Boolean(released.data?.data?.token || released.data?.data?.proposal_token),
      JSON.stringify({
        quoteId,
        applicationId: after.application?.id,
        blocked: blocked.response.status,
        reject: reject.response.status,
        via: reject.data?.via ?? null,
        released: released.response.status,
        snapshot: after.quote?.pricing_breakdown?.coupon?.approval_status ?? null,
      }),
    )
    evidence.rejectShare = {
      quoteId,
      applicationId: after.application?.id,
      via: reject.data?.via ?? null,
    }
  }

  {
    const couponCode = 'QA-HTTP-1'
    const existing = await db
      .from('coupons')
      .select('id')
      .eq('company_id', COMPANY)
      .eq('code', couponCode)
      .maybeSingle()
    if (!existing.data?.id) {
      const created = await db.from('coupons').insert({
        company_id: COMPANY,
        code: couponCode,
        campaign_name: `${TAG} HTTP concurrency`,
        description: 'DEV/QA HTTP concurrency fixture. Not commercial.',
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
        metadata: { qa: true, purpose: 'coupon_center_http_concurrency' },
      })
      if (created.error) throw new Error(created.error.message)
    }
    const phone = await unusedPhone(db, '140755504')
    async function prepared(applyCode) {
      const payload = draft({
        locale: 'es',
        firstName: 'QA',
        lastName: 'CouponRace',
        phone,
        email: 'qa.coupon.race@example.invalid',
        eventName: `${TAG} HTTP concurrency`,
      })
      payload.selection.packageSelections = selections
      const started = await startSession('es')
      const saved = await saveDraft(started.cookie, payload)
      if (applyCode) await applyCoupon(saved.cookie, applyCode)
      return { cookie: saved.cookie, payload }
    }
    const seeded = await prepared(null)
    const seedSubmit = await submitQuote(
      seeded.cookie,
      seeded.payload,
      settings.data.consent_version,
    )
    record(
      'E2E-http-concurrency-seed-customer',
      seedSubmit.response.ok && Boolean(seedSubmit.data?.quote?.id),
      `${seedSubmit.response.status} ${seedSubmit.data?.quote?.id || ''}`,
    )
    const [left, right] = await Promise.all([prepared(couponCode), prepared(couponCode)])
    const [first, second] = await Promise.all([
      submitQuote(left.cookie, left.payload, settings.data.consent_version),
      submitQuote(right.cookie, right.payload, settings.data.consent_version),
    ])
    const successes = [first, second].filter((row) => row.response.ok && row.data?.quote?.id)
    const failures = [first, second].filter((row) => !row.response.ok)
    const quoteIds = successes.map((row) => row.data.quote.id)
    const applications = quoteIds.length
      ? await db
          .from('quote_coupon_applications')
          .select('id, quote_id, approval_status')
          .eq('company_id', COMPANY)
          .in('quote_id', quoteIds)
          .in('approval_status', ['pending', 'applied'])
      : { data: [] }
    const live = applications.data ?? []
    record(
      'E2E-http-concurrency-limit-1',
      successes.length === 1 &&
        live.length === 1 &&
        failures.length === 1 &&
        (failures[0].data?.code === 'usage_limit_reached' ||
          failures[0].response.status === 409 ||
          failures[0].response.status === 422),
      JSON.stringify({
        statuses: [first.response.status, second.response.status],
        codes: [first.data?.code, second.data?.code],
        quoteIds,
        applications: live.map((row) => row.id),
      }),
    )
    evidence.concurrency = {
      quoteIds,
      applicationIds: live.map((row) => row.id),
      statuses: [first.response.status, second.response.status],
    }
  }

  console.log(JSON.stringify({ evidence }, null, 2))
  const failed = rows.filter((row) => !row.ok)
  console.log(`\nCOUPON DEV QA: ${rows.length - failed.length}/${rows.length} passed`)
  if (failed.length) process.exit(1)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
