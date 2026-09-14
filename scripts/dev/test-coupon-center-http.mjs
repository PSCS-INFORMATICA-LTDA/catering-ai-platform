/**
 * HTTP QA for Coupon Center V1 against a running app + DEV Supabase.
 * Does not create commercial data and does not touch PROD.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const base = (process.env.COUPON_E2E_BASE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '')
const origin = base
const packageId = process.env.COUPON_E2E_PACKAGE_ID || '95a67f3e-3c1c-4eb1-ad5b-6012d7fbea71'
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
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      origin,
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

function completeDraft(locale) {
  return {
    locale,
    contact: {
      firstName: 'QA',
      lastName: 'Coupon',
      phone: '+14075550199',
      email: 'qa.coupon@example.com',
    },
    event: {
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
      },
    },
    selection: {
      packageId,
      additionals: [],
    },
    grill: {
      hasGrill: false,
      rentalRequired: true,
      rentalQty: 1,
    },
    cancellation: {
      accepted: true,
      version: 'cdl-cancel-v1',
    },
  }
}

async function startLocale(locale) {
  const started = await jsonFetch('/api/public/quote-intake/session', {
    method: 'POST',
    body: { companySlug: 'cdl', locale, forceNew: true },
  })
  if (!started.response.ok) {
    return { ok: false, detail: `session ${started.response.status}` }
  }
  const saved = await jsonFetch('/api/public/quote-intake/session', {
    method: 'PATCH',
    cookie: started.cookie,
    body: { draft: completeDraft(locale), currentStep: 'review' },
  })
  return {
    ok: saved.response.ok,
    cookie: saved.cookie,
    detail: saved.response.ok ? `session ${locale}` : `draft ${saved.response.status} ${JSON.stringify(saved.data)}`,
  }
}

const leaked = /postgres|PGRST|uq_|stack|permission denied|schema/i

{
  const { response, data } = await jsonFetch('/api/coupons')
  record(
    'SEC-unauthenticated-admin',
    response.status === 401 || response.status === 403,
    `${response.status} ${JSON.stringify(data).slice(0, 120)}`,
  )
}

{
  const { response, data } = await jsonFetch('/api/coupons/applications', {
    method: 'PATCH',
    body: { id: '11111111-1111-4111-8111-111111111111', action: 'approve' },
  })
  record(
    'SEC-forged-approval',
    response.status === 401 || response.status === 403,
    `${response.status} ${JSON.stringify(data).slice(0, 120)}`,
  )
}

for (const locale of ['en', 'pt', 'es']) {
  const session = await startLocale(locale)
  record(`E2E-${locale}-session`, session.ok, session.detail)
  if (!session.ok) continue

  const invalid = await jsonFetch('/api/public/coupons/preview', {
    method: 'POST',
    cookie: session.cookie,
    body: { code: 'NOT-A-REAL-CODE', discount_amount: 999, approval_status: 'applied', final_total: 1 },
  })
  record(
    `E2E-${locale}-invalid`,
    invalid.response.status >= 400 &&
      !invalid.data?.coupon &&
      !leaked.test(JSON.stringify(invalid.data)) &&
      (invalid.data?.reason === 'not_found' || invalid.data?.reason === 'invalid'),
    `${invalid.response.status} ${JSON.stringify(invalid.data).slice(0, 180)}`,
  )

  const welcome = await jsonFetch('/api/public/coupons/preview', {
    method: 'POST',
    cookie: session.cookie,
    body: { code: 'welcome', discountAmount: 1 },
  })
  record(
    `E2E-${locale}-welcome`,
    welcome.response.ok &&
      welcome.data?.coupon?.code === 'WELCOME' &&
      Number(welcome.data.coupon.appliedDiscountAmount) > 0 &&
      Number(welcome.data.pricing?.total) < Number(welcome.data.coupon.totalBeforeCoupon || welcome.data.pricing?.subtotal || 1e9) &&
      !leaked.test(JSON.stringify(welcome.data)),
    `${welcome.response.status} ${JSON.stringify({
      code: welcome.data?.coupon?.code,
      reason: welcome.data?.reason,
      applied: welcome.data?.coupon?.appliedDiscountAmount,
      total: welcome.data?.pricing?.total,
      deposit: welcome.data?.pricing?.deposit,
      balance: welcome.data?.pricing?.balance,
    })}`,
  )

  const cdl10 = await jsonFetch('/api/public/coupons/preview', {
    method: 'POST',
    cookie: session.cookie,
    body: { code: 'CDL10' },
  })
  record(
    `E2E-${locale}-manual-pending`,
    cdl10.response.ok &&
      cdl10.data?.coupon?.approvalStatus === 'pending' &&
      Number(cdl10.data.coupon.appliedDiscountAmount) === 0 &&
      Number(cdl10.data.pricing?.total) === Number(cdl10.data.coupon.totalBeforeCoupon) &&
      Number(cdl10.data.coupon.projectedTotalAfterApproval) < Number(cdl10.data.pricing?.total || 0),
    `${cdl10.response.status} ${JSON.stringify({
      code: cdl10.data?.coupon?.code,
      reason: cdl10.data?.reason,
      status: cdl10.data?.coupon?.approvalStatus,
      applied: cdl10.data?.coupon?.appliedDiscountAmount,
      potential: cdl10.data?.coupon?.potentialDiscountAmount,
    })}`,
  )

  const removed = await jsonFetch('/api/public/coupons/preview', {
    method: 'POST',
    cookie: session.cookie,
    body: { code: '' },
  })
  record(
    `E2E-${locale}-remove`,
    removed.response.ok && removed.data?.coupon == null,
    `${removed.response.status} ${JSON.stringify(removed.data).slice(0, 120)}`,
  )

  const first = await jsonFetch('/api/public/coupons/preview', {
    method: 'POST',
    cookie: session.cookie,
    body: { code: 'WELCOME' },
  })
  const second = await jsonFetch('/api/public/coupons/preview', {
    method: 'POST',
    cookie: session.cookie,
    body: { code: 'WELCOME' },
  })
  record(
    `E2E-${locale}-duplicate`,
    first.data?.coupon?.code === 'WELCOME' &&
      second.data?.coupon?.code === 'WELCOME' &&
      first.data?.coupon?.appliedDiscountAmount === second.data?.coupon?.appliedDiscountAmount,
    `first=${first.data?.coupon?.appliedDiscountAmount} second=${second.data?.coupon?.appliedDiscountAmount}`,
  )
}

{
  const quoteReview = readFileSync(join(root, 'components/quotes/QuoteCouponDecisionCard.tsx'), 'utf8')
  const sharePanel = readFileSync(join(root, 'components/quotes/QuoteProposalSharePanel.tsx'), 'utf8')
  const proposalApi = readFileSync(join(root, 'app/api/quotes/[id]/proposal/route.ts'), 'utf8')
  const dashboard = readFileSync(join(root, 'components/coupons/CouponsDashboard.tsx'), 'utf8')
  record(
    'SRC-quote-review-same-decide-api',
    quoteReview.includes('/api/coupons/applications') &&
      quoteReview.includes('decideCouponApplicationClient') &&
      dashboard.includes('decideCouponApplicationClient'),
    'quote review and coupon center share decideCouponApplicationClient',
  )
  record(
    'SRC-share-blocked-pending',
    sharePanel.includes('pendingManualCoupon') &&
      sharePanel.includes('shareBlockedPending') &&
      sharePanel.includes('coupon-share-blocked') &&
      proposalApi.includes('quoteHasPendingCoupon') &&
      proposalApi.includes('coupon_approval_pending'),
    'share UI + proposal API guard pending coupons',
  )
}

const failed = rows.filter((row) => !row.ok)
console.log(`\nCOUPON HTTP QA: ${rows.length - failed.length}/${rows.length} passed`)
if (failed.length) process.exit(1)
