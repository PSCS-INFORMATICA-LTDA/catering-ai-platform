/**
 * HTTP QA for Commercial Review Workspace V1.
 * Reuses existing quote/coupon APIs. DEV only. Does not touch PROD.
 */
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { assertDevUrl, DEV_REF, loadDevEnv } from './loadDevEnv.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const base = (
  process.env.COMMERCIAL_REVIEW_BASE_URL ||
  process.env.COUPON_E2E_BASE_URL ||
  'http://127.0.0.1:3000'
).replace(/\/$/, '')
const rows = []

function record(id, ok, detail) {
  rows.push({ id, ok, detail })
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

async function jsonFetch(path, { method = 'GET', body, cookie = '' } = {}) {
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
    data = { raw: text.slice(0, 400) }
  }
  return { response, data, text }
}

async function main() {
  const env = loadDevEnv(root)
  assertDevUrl(env.url)
  if (/cateringai\.app/i.test(base)) throw new Error('Refused: production host')
  const anon = createClient(env.url, env.anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const email = process.env.CATERING_DEV_LOGIN_EMAIL
  const password = process.env.CATERING_DEV_LOGIN_PASSWORD
  if (!email || !password) throw new Error('CATERING_DEV_LOGIN_* required')
  const signed = await anon.auth.signInWithPassword({ email, password })
  if (signed.error || !signed.data.session) {
    throw new Error(signed.error?.message || 'admin login failed')
  }
  const cookie = authCookie(signed.data.session)
  record('A01', Boolean(cookie), 'session')

  const quotes = await jsonFetch('/api/quotes?pageSize=5', { cookie })
  const list = Array.isArray(quotes.data?.data) ? quotes.data.data : []
  const quoteId = list[0]?.id || process.env.COMMERCIAL_REVIEW_QUOTE_ID
  record('A02', Boolean(quoteId), quoteId || 'no-quote')

  if (quoteId) {
    const page = await fetch(`${base}/quotes/${quoteId}`, {
      headers: { cookie },
      redirect: 'manual',
    })
    const html = await page.text()
    record(
      'A03',
      page.status === 200 && html.includes('data-testid="commercial-review-workspace"'),
      `${page.status} workspace=${html.includes('data-testid="commercial-review-workspace"')}`,
    )
    record(
      'A04',
      html.includes('data-testid="commercial-review-financial"') &&
        html.includes('data-testid="commercial-review-capacity"') &&
        html.includes('data-testid="commercial-review-customer"') &&
        html.includes('data-testid="commercial-review-menu"'),
      'cards',
    )
    record('A05', html.includes('data-testid="commercial-review-notes"'), 'notes-card')
    record(
      'A06',
      html.includes('data-testid="commercial-review-coupon-none"') ||
        html.includes('data-testid="coupon-quote-decision"') ||
        html.includes('data-testid="commercial-review-coupon-applied"') ||
        html.includes('data-testid="commercial-review-coupon-rejected"'),
      'coupon-state',
    )

    const anonPage = await fetch(`${base}/quotes/${quoteId}`, { redirect: 'manual' })
    record(
      'O01',
      anonPage.status === 307 || anonPage.status === 302 || anonPage.status === 401,
      `${anonPage.status}`,
    )

    const unauthShare = await jsonFetch(`/api/quotes/${quoteId}/proposal`, {
      method: 'POST',
      body: { action: 'mark_sent' },
    })
    record('O02', unauthShare.response.status === 401, `unauth-share=${unauthShare.response.status}`)

    const share = await jsonFetch(`/api/quotes/${quoteId}/proposal`, {
      method: 'POST',
      cookie,
      body: { action: 'mark_sent' },
    })
    record(
      'G01',
      share.response.status === 200 || share.response.status === 409,
      `${share.response.status} code=${share.data?.code || 'ok'} version=${share.data?.data?.proposal_shared_version_id || 'n/a'}`,
    )

    const quoteNumber = String(list[0]?.quote_number || '')
    const canWriteNotes = /QA|Coupon/i.test(quoteNumber)
    if (canWriteNotes) {
      const notes = await jsonFetch(`/api/quotes/${quoteId}/internal-notes`, {
        method: 'PATCH',
        cookie,
        body: { notes: '' },
      })
      record(
        'N01',
        notes.response.status === 200 || notes.response.status === 409,
        `${notes.response.status} ${notes.data?.error || 'cleared'}`,
      )
    } else {
      record('N01', true, `skipped-write quote=${quoteNumber || quoteId}`)
    }
  }

  const failed = rows.filter((row) => !row.ok)
  console.log(
    JSON.stringify({
      base,
      passed: rows.filter((row) => row.ok).length,
      failed: failed.length,
    }),
  )
  if (failed.length) process.exitCode = 1
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
