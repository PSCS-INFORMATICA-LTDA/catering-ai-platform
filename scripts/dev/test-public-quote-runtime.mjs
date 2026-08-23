/**
 * Runtime security/upload smoke test for a locally running public quote app.
 * Creates an isolated DEV session and removes its session, rate buckets and
 * uploaded object in a finally block.
 */
import { createHash, createHmac } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const DEV_REF = 'yasprgtlqclwsjcshtls'
const TEST_AGENT = 'public-quote-runtime-test'
const TEST_IP = '127.0.0.250'

function envFile() {
  const contents = readFileSync(join(ROOT, '.env.local'), 'utf8')
  const get = (key) => {
    const match = contents.match(new RegExp(`^${key}=(.*)$`, 'm'))
    return match?.[1]?.trim().replace(/^['"]|['"]$/g, '') ?? ''
  }
  return {
    url: get('NEXT_PUBLIC_SUPABASE_URL'),
    service: get('SUPABASE_SERVICE_ROLE_KEY'),
  }
}

function assertDev(url) {
  const ref = new URL(url).hostname.split('.')[0]
  if (ref !== DEV_REF) throw new Error(`BLOQUEADO: Supabase DEV esperado; recebido ${ref}`)
}

function baseUrl() {
  const argument = process.argv.find((value) => value.startsWith('--base-url='))
  const parsed = new URL(argument?.slice('--base-url='.length) || 'http://127.0.0.1:3100')
  if (!['127.0.0.1', 'localhost', '::1'].includes(parsed.hostname)) {
    throw new Error('BLOQUEADO: este smoke test aceita apenas um servidor local')
  }
  return parsed.origin
}

async function jsonRequest(url, init) {
  const response = await fetch(url, init)
  let body = null
  try {
    body = await response.json()
  } catch {
    body = null
  }
  return { response, body }
}

function pass(condition, label, detail = '') {
  if (!condition) throw new Error(`FAIL ${label}${detail ? `: ${detail}` : ''}`)
  console.log(`PASS ${label}`)
}

async function main() {
  const base = baseUrl()
  const env = envFile()
  if (!env.url || !env.service) throw new Error('.env.local DEV incompleto')
  assertDev(env.url)
  const service = createClient(env.url, env.service, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const commonHeaders = {
    'content-type': 'application/json',
    origin: base,
    'user-agent': TEST_AGENT,
    'x-forwarded-for': TEST_IP,
  }
  let token = ''
  let sessionId = ''
  let companyId = ''
  let storagePath = ''

  try {
    const invalidOrigin = await jsonRequest(`${base}/api/public/quote-intake/session`, {
      method: 'POST',
      headers: { ...commonHeaders, origin: 'https://invalid-origin.example' },
      body: JSON.stringify({ companySlug: 'cdl', locale: 'pt', website: '' }),
    })
    pass(invalidOrigin.response.status === 403, 'cross_origin_rejected')

    const honeypot = await jsonRequest(`${base}/api/public/quote-intake/session`, {
      method: 'POST',
      headers: commonHeaders,
      body: JSON.stringify({ companySlug: 'cdl', locale: 'pt', website: 'bot' }),
    })
    pass(honeypot.response.status === 400, 'honeypot_rejected')

    const started = await jsonRequest(`${base}/api/public/quote-intake/session`, {
      method: 'POST',
      headers: commonHeaders,
      body: JSON.stringify({ companySlug: 'cdl', locale: 'pt', website: '' }),
    })
    pass(started.response.status === 200, 'session_created', JSON.stringify(started.body))
    const setCookie = started.response.headers.get('set-cookie') || ''
    const cookieMatch = /catering_public_quote=([^;]+)/.exec(setCookie)
    pass(Boolean(cookieMatch?.[1]), 'opaque_cookie_set')
    token = decodeURIComponent(cookieMatch[1])
    const cookie = `catering_public_quote=${encodeURIComponent(token)}`
    pass(
      started.body?.session?.currentStep === 0 &&
        typeof started.body?.session?.expiresAt === 'string',
      'session_view_sanitized',
    )

    const tokenHash = createHash('sha256').update(token).digest('hex')
    const sessionLookup = await service
      .from('public_quote_intake_sessions')
      .select('id, company_id, token_hash')
      .eq('token_hash', tokenHash)
      .single()
    if (sessionLookup.error) throw sessionLookup.error
    sessionId = sessionLookup.data.id
    companyId = sessionLookup.data.company_id
    pass(sessionLookup.data.token_hash !== token, 'raw_token_not_persisted')

    const patched = await jsonRequest(`${base}/api/public/quote-intake/session`, {
      method: 'PATCH',
      headers: { ...commonHeaders, cookie },
      body: JSON.stringify({
        currentStep: 1,
        draft: {
          locale: 'pt',
          contact: { firstName: 'QA', lastName: 'Runtime', phone: '+12025550147' },
        },
        website: '',
      }),
    })
    pass(patched.response.status === 200, 'autosave_accepted', JSON.stringify(patched.body))
    pass(patched.body?.session?.currentStep === 1, 'autosave_step_persisted')

    const invalidForm = new FormData()
    invalidForm.append('photo', new File(['not an image signature'], 'fake.png', { type: 'image/png' }))
    invalidForm.append('website', '')
    const invalidUpload = await jsonRequest(`${base}/api/public/quote-intake/upload`, {
      method: 'POST',
      headers: {
        origin: base,
        cookie,
        'user-agent': TEST_AGENT,
        'x-forwarded-for': TEST_IP,
      },
      body: invalidForm,
    })
    pass(invalidUpload.response.status === 400, 'invalid_image_signature_rejected')

    const png = readFileSync(
      join(ROOT, 'public', 'brand', 'catering-logo-light.png'),
    )
    const uploadForm = new FormData()
    uploadForm.append('photo', new File([png], 'qa-grill.png', { type: 'image/png' }))
    uploadForm.append('website', '')
    const uploaded = await jsonRequest(`${base}/api/public/quote-intake/upload`, {
      method: 'POST',
      headers: {
        origin: base,
        cookie,
        'user-agent': TEST_AGENT,
        'x-forwarded-for': TEST_IP,
      },
      body: uploadForm,
    })
    pass(uploaded.response.status === 200, 'valid_image_uploaded', JSON.stringify(uploaded.body))
    pass(
      typeof uploaded.body?.photo?.reference === 'string' &&
        uploaded.body.photo.reference.startsWith(
          `public-quote-grill/${companyId}/${sessionId}/`,
        ),
      'upload_reference_tenant_scoped',
    )
    pass(
      typeof uploaded.body?.photo?.previewUrl === 'string' &&
        uploaded.body.photo.previewUrl.includes('/storage/v1/object/sign/'),
      'private_signed_preview',
    )
    storagePath = uploaded.body.photo.reference.replace(/^public-quote-grill\//, '')
    console.log('RESULT=PASS')
  } finally {
    if (storagePath) {
      const removed = await service.storage.from('public-quote-grill').remove([storagePath])
      if (removed.error) console.warn(`CLEANUP_WARN storage: ${removed.error.message}`)
    }
    if (sessionId) {
      const removedSession = await service
        .from('public_quote_intake_sessions')
        .delete()
        .eq('id', sessionId)
      if (removedSession.error) console.warn(`CLEANUP_WARN session: ${removedSession.error.message}`)
    }
    if (companyId) {
      const fingerprint = createHmac('sha256', env.service)
        .update(`${TEST_IP}|${TEST_AGENT}`)
        .digest('hex')
      const removedRates = await service
        .from('public_quote_rate_limits')
        .delete()
        .eq('company_id', companyId)
        .eq('fingerprint_hash', fingerprint)
      if (removedRates.error) console.warn(`CLEANUP_WARN rates: ${removedRates.error.message}`)
    }
    console.log('CLEANUP=COMPLETE')
  }
}

main().catch((error) => {
  console.error(error.message || error)
  process.exit(1)
})
