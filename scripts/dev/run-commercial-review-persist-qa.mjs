/**
 * Controlled DEV/QA persist proof for Commercial Review V1.
 * Creates clearly tagged public quotes. Uses mark_sent (not ensure_token)
 * so proposal_shared_version_id / proposal_shared_by are stamped.
 * Does not delete commercial rows. Does not touch PROD. Does not use PayPal Live.
 *
 *   COMMERCIAL_REVIEW_BASE_URL=https://... node scripts/dev/run-commercial-review-persist-qa.mjs
 */
import { execFileSync } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import { writeFileSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { requireShareableQuoteVersion } from '../../Lib/commercialReview/sharedProposal.ts'
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
const TAG = 'QA Commercial Review'
const QA_UA = `CommercialReviewPersistQA/${randomUUID()}`

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

function containsSecret(value, secret) {
  if (!secret) return false
  if (typeof value === 'string') return value.includes(secret)
  try {
    return JSON.stringify(value).includes(secret)
  } catch {
    return false
  }
}

function extractPdfText(bytes) {
  const tmp = join(tmpdir(), `commercial-review-pdf-${randomUUID()}.pdf`)
  writeFileSync(tmp, bytes)
  try {
    return execFileSync(
      'python3',
      [
        '-c',
        'from pypdf import PdfReader; import sys; r=PdfReader(sys.argv[1]); print("\\n".join((p.extract_text() or "") for p in r.pages))',
        tmp,
      ],
      { encoding: 'utf8' },
    )
  } catch (error) {
    try {
      execFileSync('python3', ['-m', 'pip', 'install', '--user', 'pypdf'], {
        encoding: 'utf8',
      })
      return execFileSync(
        'python3',
        [
          '-c',
          'from pypdf import PdfReader; import sys; r=PdfReader(sys.argv[1]); print("\\n".join((p.extract_text() or "") for p in r.pages))',
          tmp,
        ],
        { encoding: 'utf8' },
      )
    } catch (retry) {
      return `${bytes.toString('latin1')}\n${error instanceof Error ? error.message : ''}\n${retry instanceof Error ? retry.message : ''}`
    }
  } finally {
    try {
      unlinkSync(tmp)
    } catch {
      /* ignore */
    }
  }
}

function snapshotHash(snapshot) {
  return createHash('sha256')
    .update(JSON.stringify(snapshot ?? null))
    .digest('hex')
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

async function unusedEventWindow(db) {
  const nowIso = new Date().toISOString()
  for (let offset = 0; offset < 80; offset += 1) {
    const cursor = new Date(Date.UTC(2028, 0, 15 + offset))
    const eventDate = cursor.toISOString().slice(0, 10)
    const prev = new Date(`${eventDate}T12:00:00`)
    prev.setDate(prev.getDate() - 1)
    const next = new Date(`${eventDate}T12:00:00`)
    next.setDate(next.getDate() + 1)
    const from = prev.toISOString().slice(0, 10)
    const to = next.toISOString().slice(0, 10)
    const [agenda, holds] = await Promise.all([
      db
        .from('agenda_events')
        .select('id')
        .eq('company_id', COMPANY)
        .gte('event_date', from)
        .lte('event_date', to)
        .in('status', ['reserved', 'scheduled', 'completed'])
        .limit(1),
      db
        .from('payment_schedule_holds')
        .select('id, event_date')
        .eq('company_id', COMPANY)
        .eq('status', 'active')
        .gt('expires_at', nowIso)
        .gte('event_date', from)
        .lte('event_date', to)
        .limit(1),
    ])
    if (!agenda.data?.length && !holds.data?.length) return eventDate
  }
  throw new Error('no unused QA event window')
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

function draft({ locale, firstName, lastName, phone, email, eventName, eventDate }) {
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

async function submitQuote(cookie, payload, consentVersion, idempotencyKey = `qa-commercial-review-${randomUUID()}`) {
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
      'id, quote_number, customer_id, event_id, quote_total, reservation_amount, deposit_amount, balance_due, discount_amount, pricing_breakdown, source, internal_notes, proposal_token, proposal_shared_version_id, proposal_shared_by, proposal_sent_at, proposal_response, accepted_version_id',
    )
    .eq('id', quoteId)
    .eq('company_id', COMPANY)
    .single()
  const version = await db
    .from('quote_versions')
    .select(
      'id, version_number, quote_total, reservation_amount, balance_due, discount_amount, commercial_snapshot, is_current, created_at',
    )
    .eq('quote_id', quoteId)
    .eq('company_id', COMPANY)
    .eq('is_current', true)
    .maybeSingle()
  const versions = await db
    .from('quote_versions')
    .select('id, version_number, is_current, commercial_snapshot, quote_total')
    .eq('quote_id', quoteId)
    .eq('company_id', COMPANY)
    .order('version_number', { ascending: true })
  const application = await db
    .from('quote_coupon_applications')
    .select('*')
    .eq('quote_id', quoteId)
    .eq('company_id', COMPANY)
    .maybeSingle()
  return {
    quote: quote.data,
    version: version.data,
    versions: versions.data ?? [],
    application: application.data,
    quoteError: quote.error?.message ?? null,
  }
}

async function countAgenda(db, quoteId) {
  const [agenda, holds] = await Promise.all([
    db
      .from('agenda_events')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', COMPANY)
      .eq('quote_id', quoteId),
    db
      .from('payment_schedule_holds')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', COMPANY)
      .eq('quote_id', quoteId),
  ])
  return {
    agenda: agenda.count ?? 0,
    holds: holds.count ?? 0,
  }
}

async function createFollowUpVersion(db, quoteId, previous, marker, createdBy, extraSnapshot = {}) {
  const nextNumber = Number(previous.version_number ?? 1) + 1
  const snapshot =
    previous.commercial_snapshot && typeof previous.commercial_snapshot === 'object'
      ? { ...previous.commercial_snapshot, qa_review_marker: marker, ...extraSnapshot }
      : { qa_review_marker: marker, ...extraSnapshot }
  const cleared = await db
    .from('quote_versions')
    .update({ is_current: false })
    .eq('id', previous.id)
    .eq('company_id', COMPANY)
    .select('id, is_current, commercial_snapshot')
    .single()
  const inserted = await db
    .from('quote_versions')
    .insert({
      company_id: COMPANY,
      quote_id: quoteId,
      version_number: nextNumber,
      language: 'en',
      currency_code: 'USD',
      package_total: previous.quote_total ?? 0,
      additional_total: 0,
      mileage_fee: 0,
      discount_amount: previous.discount_amount ?? 0,
      reservation_amount: previous.reservation_amount ?? 0,
      balance_due: previous.balance_due ?? 0,
      quote_total: extraSnapshot.quote_total ?? previous.quote_total ?? 0,
      commercial_snapshot: snapshot,
      schema_version: 1,
      is_current: true,
      accepted_at: null,
      created_by: createdBy,
    })
    .select('id, version_number, is_current, commercial_snapshot')
    .single()
  return { cleared, inserted }
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
  const authUserId = signed.data.session.user.id
  const appUser = await db
    .from('app_users')
    .select('id, auth_user_id, email')
    .eq('auth_user_id', authUserId)
    .maybeSingle()
  const actorId = appUser.data?.id || authUserId
  record('BOOT-actor', Boolean(actorId), `app_users.id=${appUser.data?.id || 'fallback'} auth=${authUserId}`)

  const settings = await db
    .from('company_public_quote_settings')
    .select('enabled, consent_version')
    .eq('company_id', COMPANY)
    .single()
  if (settings.error || !settings.data?.enabled) {
    throw new Error('public quote is not enabled on DEV')
  }
  const selections = await packageSelections(db, PACKAGE_ID)
  const isolatedEventDate = await unusedEventWindow(db)
  const evidence = {
    base: BASE,
    actorId,
    authUserId,
    pin: null,
    approveShare: null,
    rejectShare: null,
  }

  {
    const probe = await db
      .from('quotes')
      .select('internal_notes, proposal_shared_version_id, proposal_shared_by')
      .eq('company_id', COMPANY)
      .limit(1)
    record(
      'SCHEMA-live-columns',
      !probe.error,
      probe.error?.message || 'internal_notes + proposal_shared_* selectable',
    )
  }

  {
    const phone = await unusedPhone(db, '140755512')
    const payload = draft({
      locale: 'en',
      firstName: 'QA',
      lastName: 'ReviewPin',
      phone,
      email: 'qa.commercial.review.pin@example.invalid',
      eventName: `${TAG} WELCOME pin`,
      eventDate: isolatedEventDate,
    })
    payload.selection.packageSelections = selections
    const started = await startSession('en')
    const saved = await saveDraft(started.cookie, payload)
    const preview = await applyCoupon(saved.cookie, 'WELCOME')
    record(
      'E2E-auto-coupon-preview',
      preview.response.ok && preview.data?.coupon?.code === 'WELCOME',
      `${preview.response.status} ${preview.data?.coupon?.code || 'none'}`,
    )
    const submitted = await submitQuote(saved.cookie, payload, settings.data.consent_version)
    const quoteId = submitted.data?.quote?.id || ''
    record(
      'E2E-auto-submit',
      submitted.response.ok && Boolean(quoteId),
      `${submitted.response.status} ${quoteId || JSON.stringify(submitted.data).slice(0, 180)}`,
    )
    if (quoteId) {
      const beforeAgenda = await countAgenda(db, quoteId)
      const before = await loadQuoteEvidence(db, quoteId)
      record(
        'E2E-auto-not-blocked',
        before.application?.approval_status === 'applied',
        `status=${before.application?.approval_status || 'none'}`,
      )
      const workspaceBefore = await fetch(`${BASE}/quotes/${quoteId}`, {
        headers: { cookie: adminCookie, 'user-agent': QA_UA },
      })
      const afterAgenda = await countAgenda(db, quoteId)
      const beforeHtml = await workspaceBefore.text()
      record(
        'E2E-capacity-no-reserve',
        workspaceBefore.ok &&
          beforeAgenda.agenda === afterAgenda.agenda &&
          beforeAgenda.holds === afterAgenda.holds,
        JSON.stringify({
          status: workspaceBefore.status,
          before: beforeAgenda,
          after: afterAgenda,
        }),
      )
      const reservedMatch = beforeHtml.match(
        /data-testid="commercial-review-capacity-reserved"[^>]*>([\s\S]*?)<\/dd>/,
      )
      const reservedValue = (reservedMatch?.[1] || '').replace(/<[^>]+>/g, '').trim()
      const configuredMatch = beforeHtml.match(
        /data-testid="commercial-review-capacity-configured"[^>]*>([\s\S]*?)<\/dd>/,
      )
      const configuredValue = (configuredMatch?.[1] || '').replace(/<[^>]+>/g, '').trim()
      record(
        'E2E-capacity-zero-literal',
        reservedValue === '0' && /^\d+$/.test(configuredValue),
        `reserved=${reservedValue || 'missing'} configured=${configuredValue || 'missing'} eventDate=${isolatedEventDate}`,
      )

      const secret = `QAINTNOTE${randomUUID().replace(/-/g, '').slice(0, 20)}`
      const savedNotes = await jsonFetch(`/api/quotes/${quoteId}/internal-notes`, {
        method: 'PATCH',
        cookie: adminCookie,
        body: { notes: `${TAG} internal only ${secret}` },
      })
      record(
        'E2E-notes-save',
        savedNotes.response.ok && containsSecret(savedNotes.data, secret),
        `${savedNotes.response.status} ${JSON.stringify(savedNotes.data).slice(0, 160)}`,
      )
      const reloaded = await loadQuoteEvidence(db, quoteId)
      record(
        'E2E-notes-persist',
        containsSecret(reloaded.quote?.internal_notes, secret),
        `quote=${reloaded.quote?.quote_number || quoteId} notes=${Boolean(reloaded.quote?.internal_notes)}`,
      )
      const workspaceAfter = await fetch(`${BASE}/quotes/${quoteId}`, {
        headers: { cookie: adminCookie, 'user-agent': QA_UA },
      })
      const workspaceHtml = await workspaceAfter.text()
      record(
        'E2E-notes-internal-visible',
        workspaceAfter.ok &&
          workspaceHtml.includes('data-testid="commercial-review-notes"') &&
          workspaceHtml.includes(secret),
        `${workspaceAfter.status} notesCard=${workspaceHtml.includes('data-testid="commercial-review-notes"')}`,
      )

      const currentBeforeShare = reloaded.version
      record('E2E-current-version-before-share', Boolean(currentBeforeShare?.id), currentBeforeShare?.id || 'missing')
      const share = await jsonFetch(`/api/quotes/${quoteId}/proposal`, {
        method: 'POST',
        cookie: adminCookie,
        body: { action: 'mark_sent' },
      })
      const afterShare = await loadQuoteEvidence(db, quoteId)
      const pinnedId = afterShare.quote?.proposal_shared_version_id || null
      const sharedBy = afterShare.quote?.proposal_shared_by || null
      const shareApiPin = share.data?.data?.proposal_shared_version_id || null
      record(
        'E2E-auto-share-released',
        share.response.status === 200 && Boolean(share.data?.data?.token || share.data?.data?.proposal_token),
        `${share.response.status} ${JSON.stringify(share.data).slice(0, 220)}`,
      )
      record(
        'E2E-proposal-version-pin',
        Boolean(currentBeforeShare?.id) &&
          pinnedId === currentBeforeShare.id &&
          shareApiPin === currentBeforeShare.id,
        JSON.stringify({
          quoteId,
          quoteNumber: afterShare.quote?.quote_number,
          currentBeforeShare: currentBeforeShare?.id,
          pinnedId,
          shareApiPin,
        }),
      )
      record(
        'E2E-proposal-shared-by',
        sharedBy === actorId,
        JSON.stringify({ sharedBy, actorId, authUserId }),
      )

      const token = afterShare.quote?.proposal_token
      const publicApi = token
        ? await jsonFetch(`/api/public/proposta/${token}`)
        : { response: { status: 0 }, data: null, text: '' }
      const publicPage = token
        ? await fetch(`${BASE}/proposta/${token}`, { headers: { 'user-agent': QA_UA } })
        : { ok: false, status: 0, text: async () => '' }
      const publicHtml = publicPage.ok || publicPage.status === 200 ? await publicPage.text() : ''
      const pdf = await fetch(`${BASE}/api/quotes/${quoteId}/pdf`, {
        headers: { cookie: adminCookie, 'user-agent': QA_UA },
      })
      const pdfBytes = Buffer.from(await pdf.arrayBuffer())
      const pdfText = pdfBytes.toString('latin1')
      const snapshot = afterShare.version?.commercial_snapshot || currentBeforeShare?.commercial_snapshot
      const snapshotText = JSON.stringify(snapshot ?? {})
      record(
        'E2E-notes-not-in-public-api',
        publicApi.response.ok &&
          publicApi.data?.found === true &&
          !containsSecret(publicApi.data, secret) &&
          !containsSecret(publicApi.data, 'internal_notes'),
        `${publicApi.response.status} found=${publicApi.data?.found}`,
      )
      record(
        'E2E-notes-not-in-public-page',
        Boolean(token) && !publicHtml.includes(secret) && !publicHtml.includes('internal_notes'),
        `status=${publicPage.status} token=${Boolean(token)}`,
      )
      record(
        'E2E-notes-not-in-pdf',
        pdf.ok && !pdfText.includes(secret) && !pdfText.includes('QAINTNOTE'),
        `${pdf.status} bytes=${pdfBytes.length}`,
      )
      record(
        'E2E-notes-not-in-snapshot',
        !snapshotText.includes(secret) && !snapshotText.includes('internal_notes'),
        `version=${afterShare.version?.id || currentBeforeShare?.id}`,
      )

      const originalSnapshot = currentBeforeShare?.commercial_snapshot ?? snapshot
      const originalHash = snapshotHash(originalSnapshot)
      const v1Total = Number(afterShare.quote?.quote_total)
      const v1Deposit = Number(afterShare.quote?.reservation_amount)
      const v1Balance = Number(afterShare.quote?.balance_due)
      const v1Discount = Number(afterShare.quote?.discount_amount ?? 100)
      const v1Coupon =
        afterShare.quote?.pricing_breakdown?.coupon?.code ||
        originalSnapshot?.pricing_breakdown?.coupon?.code ||
        'WELCOME'
      const liveTotal = v1Total + 999
      const liveDeposit = v1Deposit + 111
      const liveBalance = v1Balance + 888
      const mutatedBreakdown = {
        ...(afterShare.quote?.pricing_breakdown &&
        typeof afterShare.quote.pricing_breakdown === 'object'
          ? afterShare.quote.pricing_breakdown
          : {}),
        total: liveTotal,
        deposit: liveDeposit,
        balance: liveBalance,
        coupon: {
          code: 'LIVEFAKE',
          approval_status: 'applied',
          applied_discount_amount: 1,
        },
      }
      const mutateLive = await db
        .from('quotes')
        .update({
          quote_total: liveTotal,
          reservation_amount: liveDeposit,
          balance_due: liveBalance,
          discount_amount: 1,
          adult_count: 99,
          pricing_breakdown: mutatedBreakdown,
        })
        .eq('id', quoteId)
        .eq('company_id', COMPANY)
      const marker = `QAREVIEW${randomUUID().replace(/-/g, '').slice(0, 16)}`
      const revisedNote = `${TAG} after-share ${secret}REV`
      const noteAfterShare = await jsonFetch(`/api/quotes/${quoteId}/internal-notes`, {
        method: 'PATCH',
        cookie: adminCookie,
        body: { notes: revisedNote },
      })
      const follow = await createFollowUpVersion(
        db,
        quoteId,
        afterShare.version || currentBeforeShare,
        marker,
        authUserId,
        {
          quote_total: liveTotal,
          pricing_breakdown: mutatedBreakdown,
        },
      )
      const afterRevision = await loadQuoteEvidence(db, quoteId)
      const pinnedAfter = afterRevision.versions.find((row) => row.id === pinnedId)
      const currentAfter = afterRevision.version
      record(
        'E2E-controlled-revision',
        !mutateLive.error &&
          noteAfterShare.response.ok &&
          follow.inserted.data?.id &&
          currentAfter?.id &&
          currentAfter.id !== pinnedId &&
          Number(afterRevision.quote?.quote_total) === liveTotal,
        JSON.stringify({
          newVersion: follow.inserted.data?.id || follow.inserted.error?.message,
          currentAfter: currentAfter?.id,
          liveTotal: afterRevision.quote?.quote_total,
        }),
      )
      record(
        'E2E-pin-stable-after-revision',
        afterRevision.quote?.proposal_shared_version_id === pinnedId &&
          afterRevision.quote?.proposal_shared_by === actorId &&
          pinnedAfter?.id === pinnedId &&
          pinnedAfter?.is_current === false &&
          snapshotHash(pinnedAfter?.commercial_snapshot) === originalHash &&
          !containsSecret(pinnedAfter?.commercial_snapshot, marker) &&
          containsSecret(currentAfter?.commercial_snapshot, marker),
        JSON.stringify({
          quoteId,
          quoteNumber: afterRevision.quote?.quote_number,
          sharedVersion: pinnedId,
          currentVersion: currentAfter?.id,
          sharedBy: afterRevision.quote?.proposal_shared_by,
          originalHash,
          pinnedHash: snapshotHash(pinnedAfter?.commercial_snapshot),
        }),
      )
      const publicAfter = token ? await jsonFetch(`/api/public/proposta/${token}`) : { data: null }
      const publicQuote = publicAfter.data?.quote || {}
      record(
        'E2E-public-source-shared-version',
        publicAfter.data?.source === 'shared_version' &&
          publicAfter.data?.proposal_shared_version_id === pinnedId,
        JSON.stringify({
          source: publicAfter.data?.source,
          pin: publicAfter.data?.proposal_shared_version_id,
        }),
      )
      record(
        'E2E-public-stays-v1-totals',
        Number(publicQuote.quote_total) === v1Total &&
          Number(publicQuote.reservation_amount) === v1Deposit &&
          Number(publicQuote.balance_due) === v1Balance &&
          Number(publicQuote.quote_total) !== liveTotal,
        JSON.stringify({
          publicTotal: publicQuote.quote_total,
          publicDeposit: publicQuote.reservation_amount,
          publicBalance: publicQuote.balance_due,
          liveTotal,
          v1Total,
        }),
      )
      record(
        'E2E-public-stays-v1-coupon',
        publicQuote.coupon?.code === v1Coupon &&
          Number(publicQuote.coupon?.applied_discount_amount ?? publicQuote.discount_amount) ===
            v1Discount &&
          publicQuote.coupon?.code !== 'LIVEFAKE',
        JSON.stringify({
          publicCoupon: publicQuote.coupon,
          discount: publicQuote.discount_amount,
        }),
      )
      const publicPageAfter = token
        ? await fetch(`${BASE}/proposta/${token}`, { headers: { 'user-agent': QA_UA } })
        : { ok: false, status: 0, text: async () => '' }
      const publicHtmlAfter =
        publicPageAfter.ok || publicPageAfter.status === 200 ? await publicPageAfter.text() : ''
      record(
        'E2E-public-page-stays-v1',
        publicHtmlAfter.includes('data-testid="public-proposal-source"') &&
          publicHtmlAfter.includes('shared_version') &&
          publicHtmlAfter.includes(String(pinnedId)) &&
          !publicHtmlAfter.includes('LIVEFAKE') &&
          !publicHtmlAfter.includes(secret) &&
          !publicHtmlAfter.includes('REV'),
        `status=${publicPageAfter.status}`,
      )
      const publicPdf = token
        ? await fetch(`${BASE}/api/public/proposta/${token}/pdf`, {
            headers: { 'user-agent': QA_UA },
          })
        : { ok: false, status: 0, arrayBuffer: async () => new ArrayBuffer(0) }
      const publicPdfBytes = Buffer.from(await publicPdf.arrayBuffer())
      const publicPdfText = extractPdfText(publicPdfBytes)
      const v1Money = `$${v1Total.toFixed(2)}`
      const liveMoney = `$${liveTotal.toFixed(2)}`
      record(
        'E2E-public-pdf-stays-v1',
        publicPdf.ok &&
          publicPdfText.includes(v1Money) &&
          !publicPdfText.includes(liveMoney) &&
          !publicPdfText.includes(secret) &&
          !publicPdfText.includes('LIVEFAKE'),
        `${publicPdf.status} bytes=${publicPdfBytes.length} v1=${publicPdfText.includes(v1Money)} live=${publicPdfText.includes(liveMoney)}`,
      )
      const internalPdf = await fetch(`${BASE}/api/quotes/${quoteId}/pdf`, {
        headers: { cookie: adminCookie, 'user-agent': QA_UA },
      })
      const internalPdfBytes = Buffer.from(await internalPdf.arrayBuffer())
      const internalPdfText = extractPdfText(internalPdfBytes)
      record(
        'E2E-shared-internal-pdf-stays-v1',
        internalPdf.ok &&
          internalPdfText.includes(v1Money) &&
          !internalPdfText.includes(liveMoney) &&
          !internalPdfText.includes(secret),
        `${internalPdf.status} v1=${internalPdfText.includes(v1Money)} live=${internalPdfText.includes(liveMoney)}`,
      )
      record(
        'E2E-historical-not-rebuilt-from-live-notes',
        !containsSecret(publicAfter.data, secret) &&
          !containsSecret(publicAfter.data, 'REV') &&
          !containsSecret(pinnedAfter?.commercial_snapshot, revisedNote),
        `publicFound=${publicAfter.data?.found} pinnedHasRevisedNote=${containsSecret(pinnedAfter?.commercial_snapshot, revisedNote)}`,
      )

      const accept = token
        ? await jsonFetch(`/api/public/proposta/${token}`, {
            method: 'POST',
            body: { action: 'accept' },
          })
        : { response: { status: 0 }, data: null }
      const afterAccept = await loadQuoteEvidence(db, quoteId)
      record(
        'E2E-customer-accept-uses-shared-version',
        accept.response.status === 200 &&
          afterAccept.quote?.proposal_response === 'accepted' &&
          afterAccept.quote?.accepted_version_id === pinnedId &&
          pinnedId !== currentAfter?.id,
        JSON.stringify({
          http: accept.response.status,
          accepted: afterAccept.quote?.accepted_version_id,
          pinned: pinnedId,
          current: currentAfter?.id,
          response: afterAccept.quote?.proposal_response,
        }),
      )

      evidence.pin = {
        quoteId,
        quoteNumber: afterRevision.quote?.quote_number,
        sharedVersionId: pinnedId,
        currentVersionAfterRevision: currentAfter?.id,
        acceptedVersionId: afterAccept.quote?.accepted_version_id,
        proposalSharedBy: afterRevision.quote?.proposal_shared_by,
        actorId,
        token,
        v1Total,
        liveTotal,
      }
    }
  }

  {
    const rule = requireShareableQuoteVersion({ data: null, error: null })
    record(
      'E2E-share-fail-closed-rule',
      rule.ok === false && rule.code === 'quote_version_required',
      JSON.stringify(rule),
    )
    const phone = await unusedPhone(db, '140755515')
    const payload = draft({
      locale: 'en',
      firstName: 'QA',
      lastName: 'ReviewFailClosed',
      phone,
      email: 'qa.commercial.review.failclosed@example.invalid',
      eventName: `${TAG} fail-closed share`,
      eventDate: isolatedEventDate,
    })
    payload.selection.packageSelections = selections
    const started = await startSession('en')
    const saved = await saveDraft(started.cookie, payload)
    const submitted = await submitQuote(saved.cookie, payload, settings.data.consent_version)
    const quoteId = submitted.data?.quote?.id || ''
    const before = quoteId ? await loadQuoteEvidence(db, quoteId) : { quote: null }
    const sentBefore = before.quote?.proposal_sent_at ?? null
    if (quoteId) {
      await db.from('quote_versions').delete().eq('quote_id', quoteId).eq('company_id', COMPANY)
      const poison = await db.from('quote_versions').insert({
        company_id: COMPANY,
        quote_id: quoteId,
        version_number: 2147483647,
        language: 'en',
        currency_code: 'USD',
        package_total: 0,
        additional_total: 0,
        mileage_fee: 0,
        discount_amount: 0,
        reservation_amount: 0,
        balance_due: 0,
        quote_total: 0,
        commercial_snapshot: { qa: true, purpose: 'fail_closed_share' },
        schema_version: 1,
        is_current: false,
        created_by: authUserId,
      })
      if (poison.error) throw new Error(`fail-closed poison: ${poison.error.message}`)
    }
    const share = quoteId
      ? await jsonFetch(`/api/quotes/${quoteId}/proposal`, {
          method: 'POST',
          cookie: adminCookie,
          body: { action: 'mark_sent' },
        })
      : { response: { status: 0 }, data: null }
    const after = quoteId ? await loadQuoteEvidence(db, quoteId) : { quote: null }
    record(
      'E2E-share-fail-closed-http',
      Boolean(quoteId) &&
        share.response.status === 409 &&
        share.data?.code === 'quote_version_required' &&
        (after.quote?.proposal_sent_at ?? null) === sentBefore &&
        !after.quote?.proposal_shared_version_id,
      JSON.stringify({
        quoteId,
        http: share.response.status,
        code: share.data?.code || share.data?.error || null,
        sentBefore,
        sentAfter: after.quote?.proposal_sent_at ?? null,
        pin: after.quote?.proposal_shared_version_id ?? null,
      }),
    )
  }

  {
    const phone = await unusedPhone(db, '140755513')
    const payload = draft({
      locale: 'pt',
      firstName: 'QA',
      lastName: 'ReviewApprove',
      phone,
      email: 'qa.commercial.review.approve@example.invalid',
      eventName: `${TAG} CDL10 approve share`,
      eventDate: isolatedEventDate,
    })
    payload.selection.packageSelections = selections
    const started = await startSession('pt')
    const saved = await saveDraft(started.cookie, payload)
    await applyCoupon(saved.cookie, 'CDL10')
    const submitted = await submitQuote(saved.cookie, payload, settings.data.consent_version)
    const quoteId = submitted.data?.quote?.id || ''
    const loaded = quoteId ? await loadQuoteEvidence(db, quoteId) : { application: null, quote: null, version: null }
    const blocked = quoteId
      ? await jsonFetch(`/api/quotes/${quoteId}/proposal`, {
          method: 'POST',
          cookie: adminCookie,
          body: { action: 'mark_sent' },
        })
      : { response: { status: 0 }, data: null }
    record(
      'E2E-pending-share-blocked',
      Boolean(quoteId) &&
        loaded.application?.approval_status === 'pending' &&
        blocked.response.status === 409 &&
        blocked.data?.code === 'coupon_approval_pending',
      JSON.stringify({
        quoteId,
        status: loaded.application?.approval_status,
        http: blocked.response.status,
        code: blocked.data?.code || blocked.data?.error || null,
      }),
    )
    const approve = loaded.application?.id
      ? await jsonFetch('/api/coupons/applications', {
          method: 'PATCH',
          cookie: adminCookie,
          body: { id: loaded.application.id, action: 'approve' },
        })
      : { response: { status: 0 }, data: null }
    const afterApprove = quoteId ? await loadQuoteEvidence(db, quoteId) : loaded
    const share = quoteId
      ? await jsonFetch(`/api/quotes/${quoteId}/proposal`, {
          method: 'POST',
          cookie: adminCookie,
          body: { action: 'mark_sent' },
        })
      : { response: { status: 0 }, data: null }
    const afterShare = quoteId ? await loadQuoteEvidence(db, quoteId) : afterApprove
    record(
      'E2E-approve-then-share',
      approve.response.ok &&
        approve.data?.via === 'rpc' &&
        afterApprove.application?.approval_status === 'applied' &&
        share.response.status === 200 &&
        afterShare.quote?.proposal_shared_version_id &&
        afterShare.quote?.proposal_shared_by === actorId,
      JSON.stringify({
        quoteId,
        quoteNumber: afterShare.quote?.quote_number,
        via: approve.data?.via ?? null,
        share: share.response.status,
        pinned: afterShare.quote?.proposal_shared_version_id,
        sharedBy: afterShare.quote?.proposal_shared_by,
      }),
    )
    evidence.approveShare = {
      quoteId,
      quoteNumber: afterShare.quote?.quote_number,
      applicationId: afterShare.application?.id,
      via: approve.data?.via ?? null,
      sharedVersionId: afterShare.quote?.proposal_shared_version_id,
      proposalSharedBy: afterShare.quote?.proposal_shared_by,
    }
  }

  {
    const phone = await unusedPhone(db, '140755514')
    const payload = draft({
      locale: 'en',
      firstName: 'QA',
      lastName: 'ReviewReject',
      phone,
      email: 'qa.commercial.review.reject@example.invalid',
      eventName: `${TAG} CDL10 reject share`,
      eventDate: isolatedEventDate,
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
          body: { action: 'mark_sent' },
        })
      : { response: { status: 0 }, data: null }
    const reject = loaded.application?.id
      ? await jsonFetch('/api/coupons/applications', {
          method: 'PATCH',
          cookie: adminCookie,
          body: { id: loaded.application.id, action: 'reject' },
        })
      : { response: { status: 0 }, data: null }
    const share = quoteId
      ? await jsonFetch(`/api/quotes/${quoteId}/proposal`, {
          method: 'POST',
          cookie: adminCookie,
          body: { action: 'mark_sent' },
        })
      : { response: { status: 0 }, data: null }
    const after = quoteId ? await loadQuoteEvidence(db, quoteId) : loaded
    record(
      'E2E-reject-then-share',
      Boolean(quoteId) &&
        blocked.response.status === 409 &&
        blocked.data?.code === 'coupon_approval_pending' &&
        reject.response.ok &&
        reject.data?.via === 'rpc' &&
        after.application?.approval_status === 'rejected' &&
        share.response.status === 200 &&
        after.quote?.proposal_shared_version_id &&
        after.quote?.proposal_shared_by === actorId,
      JSON.stringify({
        quoteId,
        quoteNumber: after.quote?.quote_number,
        blocked: blocked.response.status,
        reject: reject.response.status,
        via: reject.data?.via ?? null,
        share: share.response.status,
        pinned: after.quote?.proposal_shared_version_id,
        sharedBy: after.quote?.proposal_shared_by,
      }),
    )
    evidence.rejectShare = {
      quoteId,
      quoteNumber: after.quote?.quote_number,
      applicationId: after.application?.id,
      via: reject.data?.via ?? null,
      sharedVersionId: after.quote?.proposal_shared_version_id,
      proposalSharedBy: after.quote?.proposal_shared_by,
    }
  }

  console.log(JSON.stringify({ evidence }, null, 2))
  const failed = rows.filter((row) => !row.ok)
  console.log(`\nCOMMERCIAL REVIEW PERSIST QA: ${rows.length - failed.length}/${rows.length} passed`)
  if (failed.length) process.exit(1)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
