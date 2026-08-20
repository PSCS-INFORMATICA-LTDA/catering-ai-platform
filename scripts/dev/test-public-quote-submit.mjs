/**
 * DEV-only end-to-end submission test for the public quote API.
 * The fixture uses reserved fictional contact data and removes every record
 * it creates after verifying atomic finalization and idempotency.
 */
import { createHash, createHmac, randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const DEV_REF = 'yasprgtlqclwsjcshtls'
const TEST_AGENT = 'public-quote-submit-test'
const TEST_IP = '127.0.0.249'

function loadEnvironment() {
  const contents = readFileSync(join(ROOT, '.env.local'), 'utf8')
  const get = (key) => {
    const match = contents.match(new RegExp(`^${key}=(.*)$`, 'm'))
    return match?.[1]?.trim().replace(/^['"]|['"]$/g, '') ?? ''
  }
  const env = {
    url: get('NEXT_PUBLIC_SUPABASE_URL'),
    service: get('SUPABASE_SERVICE_ROLE_KEY'),
  }
  const ref = env.url ? new URL(env.url).hostname.split('.')[0] : ''
  if (ref !== DEV_REF || !env.service) {
    throw new Error(`BLOQUEADO: Supabase DEV ${DEV_REF} é obrigatório`)
  }
  return env
}

function resolveBaseUrl() {
  const argument = process.argv.find((value) => value.startsWith('--base-url='))
  const parsed = new URL(argument?.slice('--base-url='.length) || 'http://127.0.0.1:3100')
  if (!['127.0.0.1', 'localhost', '::1'].includes(parsed.hostname)) {
    throw new Error('BLOQUEADO: este teste aceita apenas um servidor local')
  }
  return parsed.origin
}

function assertPass(condition, label, detail = '') {
  if (!condition) throw new Error(`FAIL ${label}${detail ? `: ${detail}` : ''}`)
  console.log(`PASS ${label}`)
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

function futureDate(days) {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

async function chooseUnusedPhone(service, companyId) {
  for (let suffix = 10; suffix < 100; suffix += 1) {
    const phone = `120255501${String(suffix).padStart(2, '0')}`
    const existing = await service
      .from('customers')
      .select('id')
      .eq('company_id', companyId)
      .eq('phone_normalized', phone)
      .limit(1)
    if (existing.error) throw existing.error
    if (!existing.data?.length) return `+${phone}`
  }
  throw new Error('Nenhum telefone fictício reservado disponível')
}

async function selectCatalogFixture(service, companyId) {
  const packageResult = await service
    .from('packages')
    .select('id, package_key, price_per_person, active')
    .eq('company_id', companyId)
    .eq('active', true)
    .order('display_order', { ascending: true })
  if (packageResult.error) throw packageResult.error
  const pkg = (packageResult.data ?? []).find(
    (row) => Number(row.price_per_person) > 0 && !String(row.package_key).toUpperCase().includes('PERS'),
  )
  if (!pkg) throw new Error('Nenhum pacote público com preço válido')

  const groupResult = await service
    .from('package_option_groups')
    .select('id, required, active')
    .eq('company_id', companyId)
    .eq('package_id', pkg.id)
    .eq('active', true)
  if (groupResult.error) throw groupResult.error
  const requiredGroups = (groupResult.data ?? []).filter((row) => row.required === true)
  const packageSelections = {}
  for (const group of requiredGroups) {
    const itemResult = await service
      .from('package_option_group_items')
      .select('id')
      .eq('company_id', companyId)
      .eq('option_group_id', group.id)
      .eq('active', true)
      .order('display_order', { ascending: true })
      .limit(1)
      .maybeSingle()
    if (itemResult.error) throw itemResult.error
    if (!itemResult.data) throw new Error(`Grupo obrigatório ${group.id} sem item ativo`)
    packageSelections[group.id] = itemResult.data.id
  }
  return { packageId: pkg.id, packageSelections }
}

async function cleanup(service, ids, fingerprint) {
  if (ids.quoteId) {
    for (const table of [
      'quote_package_selections',
      'quote_additional_items',
      'quote_versions',
    ]) {
      const result = await service.from(table).delete().eq('quote_id', ids.quoteId)
      if (result.error) console.warn(`CLEANUP_WARN ${table}: ${result.error.message}`)
    }
    const quote = await service.from('quotes').delete().eq('id', ids.quoteId)
    if (quote.error) console.warn(`CLEANUP_WARN quotes: ${quote.error.message}`)
  }
  if (ids.sessionId) {
    const session = await service
      .from('public_quote_intake_sessions')
      .delete()
      .eq('id', ids.sessionId)
    if (session.error) console.warn(`CLEANUP_WARN session: ${session.error.message}`)
  }
  if (ids.eventId) {
    const media = await service
      .from('media_assets')
      .delete()
      .eq('entity_type', 'event')
      .eq('entity_id', ids.eventId)
    if (media.error) console.warn(`CLEANUP_WARN media: ${media.error.message}`)
    const event = await service.from('events').delete().eq('id', ids.eventId)
    if (event.error) console.warn(`CLEANUP_WARN event: ${event.error.message}`)
  }
  if (ids.customerId) {
    const customer = await service
      .from('customers')
      .delete()
      .eq('id', ids.customerId)
      .eq('source', 'public_self_service')
    if (customer.error) console.warn(`CLEANUP_WARN customer: ${customer.error.message}`)
  }
  if (ids.companyId) {
    const rates = await service
      .from('public_quote_rate_limits')
      .delete()
      .eq('company_id', ids.companyId)
      .eq('fingerprint_hash', fingerprint)
    if (rates.error) console.warn(`CLEANUP_WARN rates: ${rates.error.message}`)
  }
  console.log('CLEANUP=COMPLETE')
}

async function main() {
  const env = loadEnvironment()
  const base = resolveBaseUrl()
  const service = createClient(env.url, env.service, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const fingerprint = createHmac('sha256', env.service)
    .update(`${TEST_IP}|${TEST_AGENT}`)
    .digest('hex')
  const ids = { companyId: '', sessionId: '', quoteId: '', eventId: '', customerId: '' }
  const headers = {
    'content-type': 'application/json',
    origin: base,
    'user-agent': TEST_AGENT,
    'x-forwarded-for': TEST_IP,
  }

  try {
    const company = await service
      .from('companies')
      .select('id')
      .eq('slug', 'cdl')
      .single()
    if (company.error) throw company.error
    ids.companyId = company.data.id
    const settings = await service
      .from('company_public_quote_settings')
      .select('enabled, consent_version')
      .eq('company_id', ids.companyId)
      .single()
    if (settings.error) throw settings.error
    assertPass(settings.data.enabled === true, 'tenant_public_switch_enabled')

    const phone = await chooseUnusedPhone(service, ids.companyId)
    const fixture = await selectCatalogFixture(service, ids.companyId)
    const draft = {
      locale: 'pt',
      contact: {
        firstName: 'QA',
        lastName: 'Finalização',
        phone,
        email: 'public-quote-submit@example.invalid',
      },
      event: {
        eventName: 'QA Finalização',
        eventDate: futureDate(30),
        startTime: '18:00',
        endTime: '22:00',
        adultCount: 20,
        childrenUnder3Count: 2,
        children4To12Count: 4,
        address: {
          route: 'South Orange Avenue',
          number: '400',
          city: 'Orlando',
          region: 'FL',
          postalCode: '32801',
          country: 'US',
          formattedAddress: '400 South Orange Avenue, Orlando, FL 32801, US',
          placeId: null,
          latitude: null,
          longitude: null,
          source: 'manual',
        },
      },
      selection: {
        packageId: fixture.packageId,
        packageSelections: fixture.packageSelections,
        additionals: [],
      },
      grill: {
        hasGrill: false,
        photoReference: null,
        rentalRequired: false,
        rentalQty: 0,
        notes: 'QA automatizado; não contatar.',
      },
    }

    const started = await jsonRequest(`${base}/api/public/quote-intake/session`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ companySlug: 'cdl', locale: 'pt', website: '' }),
    })
    assertPass(started.response.status === 200, 'submission_session_created', JSON.stringify(started.body))
    const cookieMatch = /catering_public_quote=([^;]+)/.exec(
      started.response.headers.get('set-cookie') || '',
    )
    assertPass(Boolean(cookieMatch?.[1]), 'submission_cookie_set')
    const token = decodeURIComponent(cookieMatch[1])
    const cookie = `catering_public_quote=${encodeURIComponent(token)}`
    const session = await service
      .from('public_quote_intake_sessions')
      .select('id')
      .eq('token_hash', createHash('sha256').update(token).digest('hex'))
      .single()
    if (session.error) throw session.error
    ids.sessionId = session.data.id

    const saved = await jsonRequest(`${base}/api/public/quote-intake/session`, {
      method: 'PATCH',
      headers: { ...headers, cookie },
      body: JSON.stringify({ draft, currentStep: 5, website: '' }),
    })
    assertPass(saved.response.status === 200, 'complete_draft_saved', JSON.stringify(saved.body))

    const pricingInput = {
      packageId: fixture.packageId,
      additionals: [],
      adultCount: 20,
      childrenUnder3Count: 2,
      children4To12Count: 4,
      eventDate: draft.event.eventDate,
      grillRentalRequired: false,
      grillRentalQty: 0,
      language: 'pt',
    }
    const preview = await jsonRequest(`${base}/api/public/quote-intake/preview`, {
      method: 'POST',
      headers: { ...headers, cookie },
      body: JSON.stringify({
        ...pricingInput,
        mileageDistance: 99999,
        reservationPercentage: 99,
        reservationAmount: 1,
        useCustomReservation: true,
        discountAmount: 99999,
      }),
    })
    assertPass(preview.response.status === 200, 'server_pricing_preview', JSON.stringify(preview.body))
    assertPass(Number(preview.body?.breakdown?.total) > 0, 'server_pricing_positive')
    assertPass(Number(preview.body?.breakdown?.total) !== 1, 'browser_total_overrides_ignored')

    const idempotencyKey = `qa-public-quote-${randomUUID()}`
    const submitBody = {
      idempotencyKey,
      submission: draft,
      consent: { accepted: true, version: settings.data.consent_version },
      website: '',
    }
    const submitted = await jsonRequest(`${base}/api/public/quote-intake/submit`, {
      method: 'POST',
      headers: { ...headers, cookie },
      body: JSON.stringify(submitBody),
    })
    assertPass(submitted.response.status === 200, 'atomic_submission', JSON.stringify(submitted.body))
    ids.quoteId = submitted.body?.quote?.id || ''
    assertPass(Boolean(ids.quoteId), 'quote_id_returned')
    assertPass(submitted.body?.alreadySubmitted === false, 'first_submission_not_retry')

    const retry = await jsonRequest(`${base}/api/public/quote-intake/submit`, {
      method: 'POST',
      headers: { ...headers, cookie },
      body: JSON.stringify(submitBody),
    })
    assertPass(retry.response.status === 200, 'idempotent_retry_accepted', JSON.stringify(retry.body))
    assertPass(retry.body?.alreadySubmitted === true, 'idempotent_retry_reused_quote')
    assertPass(retry.body?.quote?.id === ids.quoteId, 'idempotent_retry_same_quote')

    const quote = await service
      .from('quotes')
      .select('id, event_id, customer_id, source, quote_status, language, quote_total')
      .eq('id', ids.quoteId)
      .single()
    if (quote.error) throw quote.error
    ids.eventId = quote.data.event_id
    ids.customerId = quote.data.customer_id
    assertPass(quote.data.source === 'public_self_service', 'quote_source_public')
    assertPass(quote.data.quote_status === 'ready_for_review', 'quote_ready_for_review')
    assertPass(quote.data.language === 'pt', 'quote_language_preserved')
    assertPass(Number(quote.data.quote_total) > 0, 'quote_total_persisted')

    const version = await service
      .from('quote_versions')
      .select('id', { count: 'exact', head: true })
      .eq('quote_id', ids.quoteId)
    if (version.error) throw version.error
    assertPass((version.count ?? 0) >= 1, 'quote_version_snapshot_created')
    const sessionAfter = await service
      .from('public_quote_intake_sessions')
      .select('status, quote_id, consent_version, consent_at')
      .eq('id', ids.sessionId)
      .single()
    if (sessionAfter.error) throw sessionAfter.error
    assertPass(sessionAfter.data.status === 'submitted', 'session_marked_submitted')
    assertPass(sessionAfter.data.quote_id === ids.quoteId, 'session_linked_to_quote')
    assertPass(Boolean(sessionAfter.data.consent_at), 'consent_timestamp_persisted')
    console.log('RESULT=PASS')
  } finally {
    await cleanup(service, ids, fingerprint)
  }
}

main().catch((error) => {
  console.error(error.message || error)
  process.exit(1)
})
