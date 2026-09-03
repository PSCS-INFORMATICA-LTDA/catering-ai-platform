/**
 * DEV-only: reproduce public quote SEND REQUEST against the live DEV app.
 * Cleans up every QA row it creates.
 *
 *   node scripts/dev/repro-public-quote-submit-v4.mjs
 */
import { createHash, randomUUID } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { assertDevUrl, loadDevEnv } from './loadDevEnv.mjs'

const CDL_CANCEL_POLICY_VERSION = 'CDL_CANCEL_2026_V1'

const ROOT = process.cwd()
const BASE = 'https://catering-ai-agenda-dev.vercel.app'
const COMPANY_SLUG = 'cdl'
const TEST_AGENT = `public-quote-submit-repro-v4-${Date.now()}`
const TEST_IP = '203.0.113.40'
const OUT = '/opt/cursor/artifacts/submit-repro-v4.json'

const env = loadDevEnv(ROOT)
assertDevUrl(env.url)
const sb = createClient(env.url, env.service, {
  auth: { persistSession: false, autoRefreshToken: false },
})

function futureDate(days) {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

async function jsonRequest(path, init) {
  const response = await fetch(`${BASE}${path}`, init)
  let body = null
  try {
    body = await response.json()
  } catch {
    body = null
  }
  return { response, body }
}

function sanitizeDraft(draft) {
  return {
    locale: draft.locale,
    contact: {
      firstName: draft.contact.firstName,
      lastName: draft.contact.lastName,
      phone: draft.contact.phone ? '[redacted]' : null,
      email: draft.contact.email ? '[redacted]' : null,
    },
    event: {
      eventDate: draft.event.eventDate,
      startTime: draft.event.startTime,
      endTime: draft.event.endTime,
      adultCount: draft.event.adultCount,
      childrenUnder3Count: draft.event.childrenUnder3Count,
      children4To12Count: draft.event.children4To12Count,
      address: {
        city: draft.event.address.city,
        region: draft.event.address.region,
        country: draft.event.address.country,
        source: draft.event.address.source,
      },
    },
    selection: {
      packageId: draft.selection.packageId ? '[uuid]' : null,
      packageSelectionCount: Object.keys(draft.selection.packageSelections || {})
        .length,
      additionalCount: draft.selection.additionals.length,
      additionalKeys: draft.selection.additionals.map((row) => row.itemKey),
    },
    grill: {
      setupAnswered: draft.grill.setupAnswered,
      hasGrill: draft.grill.hasGrill,
      photoReference: draft.grill.photoReference,
      rentalRequired: draft.grill.rentalRequired,
      rentalQty: draft.grill.rentalQty,
    },
  }
}

async function choosePhone() {
  for (let suffix = 20; suffix < 90; suffix += 1) {
    const phone = `120255503${String(suffix).padStart(2, '0')}`
    const existing = await sb
      .from('customers')
      .select('id')
      .eq('company_id', companyId)
      .eq('phone_normalized', phone)
      .limit(1)
    if (!existing.data?.length) return `+${phone}`
  }
  throw new Error('no unused QA phone')
}

async function cleanup(ids) {
  if (ids.quoteId) {
    for (const table of [
      'quote_package_selections',
      'quote_additional_items',
      'quote_versions',
    ]) {
      await sb.from(table).delete().eq('quote_id', ids.quoteId)
    }
    await sb.from('quotes').delete().eq('id', ids.quoteId)
  }
  if (ids.eventId) {
    await sb
      .from('media_assets')
      .delete()
      .eq('entity_type', 'event')
      .eq('entity_id', ids.eventId)
    await sb.from('events').delete().eq('id', ids.eventId)
  }
  if (ids.sessionId) {
    await sb.from('public_quote_intake_sessions').delete().eq('id', ids.sessionId)
  }
  if (ids.customerId) {
    await sb
      .from('customers')
      .delete()
      .eq('id', ids.customerId)
      .eq('source', 'public_self_service')
  }
}

let companyId = ''

async function selectFixture() {
  const company = await sb.from('companies').select('id').eq('slug', COMPANY_SLUG).single()
  if (company.error) throw company.error
  companyId = company.data.id
  const settings = await sb
    .from('company_public_quote_settings')
    .select('enabled, consent_version')
    .eq('company_id', companyId)
    .single()
  if (settings.error) throw settings.error

  const packages = await sb
    .from('packages')
    .select('id, package_key, price_per_person, active')
    .eq('company_id', companyId)
    .eq('active', true)
    .order('display_order', { ascending: true })
  if (packages.error) throw packages.error
  const withoutSides = (packages.data ?? []).find((row) => {
    const key = String(row.package_key || '').toUpperCase()
    return (
      Number(row.price_per_person) > 0 &&
      !key.includes('PERS') &&
      !key.endsWith('+')
    )
  })
  const withSides = (packages.data ?? []).find((row) => {
    const key = String(row.package_key || '').toUpperCase()
    return Number(row.price_per_person) > 0 && key.endsWith('+')
  })
  if (!withoutSides) throw new Error('no without-sides package')

  async function selectionsFor(packageId) {
    const groups = await sb
      .from('package_option_groups')
      .select('id, required, active')
      .eq('company_id', companyId)
      .eq('package_id', packageId)
      .eq('active', true)
    if (groups.error) throw groups.error
    const required = (groups.data ?? []).filter((row) => row.required === true)
    const packageSelections = {}
    for (const group of required) {
      const item = await sb
        .from('package_option_group_items')
        .select('id, option_item_key')
        .eq('company_id', companyId)
        .eq('option_group_id', group.id)
        .eq('active', true)
        .order('display_order', { ascending: true })
        .limit(1)
        .maybeSingle()
      if (item.error) throw item.error
      if (item.data) packageSelections[group.id] = item.data.id
    }
    return packageSelections
  }

  const extras = await sb
    .from('catalog_items')
    .select(
      'id, item_key, price, can_be_additional, customer_visible, operational_item, active',
    )
    .eq('company_id', companyId)
    .in('item_key', ['KIT_DESCARTAVEIS', 'CDL_WAITER_SERVICE', 'ITEM_061'])
  if (extras.error) throw extras.error

  return {
    companyId,
    consentVersion: settings.data.consent_version,
    withoutSides,
    withSides,
    withoutSidesSelections: await selectionsFor(withoutSides.id),
    withSidesSelections: withSides ? await selectionsFor(withSides.id) : {},
    extras: Object.fromEntries((extras.data ?? []).map((row) => [row.item_key, row])),
  }
}

async function runCase(name, fixture, mutate) {
  const ids = { sessionId: '', quoteId: '', eventId: '', customerId: '' }
  const headers = {
    'content-type': 'application/json',
    origin: BASE,
    'user-agent': `${TEST_AGENT}-${name}`,
    'x-forwarded-for': TEST_IP,
  }
  const phone = await choosePhone()
  const draft = {
    locale: 'pt',
    contact: {
      firstName: 'QA',
      lastName: 'SubmitV4',
      phone,
      email: 'qa-submit-v4@example.invalid',
    },
    event: {
      eventName: 'QA Submit V4',
      eventDate: futureDate(21),
      startTime: '18:00',
      endTime: '22:00',
      adultCount: 20,
      childrenUnder3Count: 0,
      children4To12Count: 0,
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
      packageId: fixture.withoutSides.id,
      packageSelections: fixture.withoutSidesSelections,
      additionals: [],
      reviewedCategoryKeys: [],
    },
    grill: {
      setupAnswered: true,
      hasGrill: true,
      photoReference: null,
      rentalRequired: false,
      rentalQty: 0,
      notes: 'QA submit repro; do not contact.',
    },
  }
  mutate(draft, fixture)

  try {
    const started = await jsonRequest('/api/public/quote-intake/session', {
      method: 'POST',
      headers,
      body: JSON.stringify({ companySlug: COMPANY_SLUG, locale: 'pt', website: '', forceNew: true }),
    })
    const cookieMatch = /catering_public_quote=([^;]+)/.exec(
      started.response.headers.get('set-cookie') || '',
    )
    const token = cookieMatch?.[1] ? decodeURIComponent(cookieMatch[1]) : ''
    const cookie = token ? `catering_public_quote=${encodeURIComponent(token)}` : ''
    if (token) {
      const session = await sb
        .from('public_quote_intake_sessions')
        .select('id')
        .eq('token_hash', createHash('sha256').update(token).digest('hex'))
        .maybeSingle()
      ids.sessionId = session.data?.id || ''
    }

    const submitBody = {
      idempotencyKey: `qa-v4-${name}-${randomUUID()}`,
      submission: draft,
      consent: { accepted: true, version: fixture.consentVersion },
      cancellationConsent: {
        accepted: true,
        version: CDL_CANCEL_POLICY_VERSION,
        locale: 'pt',
        acceptedAt: new Date().toISOString(),
      },
      website: '',
    }
    const submitted = await jsonRequest('/api/public/quote-intake/submit', {
      method: 'POST',
      headers: { ...headers, cookie },
      body: JSON.stringify(submitBody),
    })
    ids.quoteId = submitted.body?.quote?.id || ''
    if (ids.quoteId) {
      const quote = await sb
        .from('quotes')
        .select('id, event_id, customer_id')
        .eq('id', ids.quoteId)
        .maybeSingle()
      ids.eventId = quote.data?.event_id || ''
      ids.customerId = quote.data?.customer_id || ''
    }

    let rpcError = null
    if (ids.sessionId && submitted.response.status >= 400) {
      const rpc = await sb.rpc('finalize_public_quote', {
        p_token_hash: createHash('sha256').update(token).digest('hex'),
        p_idempotency_key_hash: createHash('sha256').update(submitBody.idempotencyKey).digest('hex'),
        p_submission_hash: createHash('sha256').update(`rpc-probe-${name}`).digest('hex'),
        p_payload: draft,
        p_pricing: {
          breakdown: { total: 1 },
          totals: { total: 1 },
          packagePricePerPerson: 1,
          resolvedAdditionals: draft.selection.additionals.map((row) => ({
            itemId: row.itemId,
            quantity: row.quantity,
          })),
          mileageDistance: 0,
          mileageStatus: 'ok',
        },
        p_consent_version: fixture.consentVersion,
      })
      rpcError = {
        error: rpc.error?.message ?? null,
        data: rpc.data ?? null,
      }
      const leftover = await sb
        .from('quotes')
        .select('id', { count: 'exact', head: true })
        .eq('source', 'public_self_service')
        .eq('customer_id', ids.customerId || '00000000-0000-0000-0000-000000000000')
      void leftover
    }

    return {
      name,
      endpoint: '/api/public/quote-intake/submit',
      method: 'POST',
      sessionStatus: started.response.status,
      httpStatus: submitted.response.status,
      response: submitted.body,
      sanitizedDraft: sanitizeDraft(draft),
      rpcProbe: rpcError,
      quoteCreated: Boolean(ids.quoteId),
    }
  } finally {
    await cleanup(ids)
  }
}

const fixture = await selectFixture()
const kit = fixture.extras.KIT_DESCARTAVEIS
const waiter = fixture.extras.CDL_WAITER_SERVICE

const cases = []
cases.push(
  await runCase('own_grill_no_photo', fixture, () => {}),
)
cases.push(
  await runCase('rental_grill', fixture, (draft) => {
    draft.grill.hasGrill = false
    draft.grill.photoReference = null
    draft.grill.rentalRequired = true
    draft.grill.rentalQty = 1
  }),
)
if (kit) {
  cases.push(
    await runCase('no_sides_kit_on', fixture, (draft) => {
      draft.grill.hasGrill = false
      draft.grill.rentalRequired = true
      draft.grill.rentalQty = 1
      draft.selection.additionals = [
        { itemId: kit.id, quantity: 1, itemKey: kit.item_key },
      ]
    }),
  )
}
if (waiter) {
  cases.push(
    await runCase('waiter_qty_1', fixture, (draft) => {
      draft.grill.hasGrill = false
      draft.grill.rentalRequired = true
      draft.grill.rentalQty = 1
      draft.selection.additionals = [
        { itemId: waiter.id, quantity: 1, itemKey: waiter.item_key },
      ]
    }),
  )
}

const report = {
  base: BASE,
  catalog: {
    kit: kit
      ? {
          item_key: kit.item_key,
          can_be_additional: kit.can_be_additional,
          customer_visible: kit.customer_visible,
          operational_item: kit.operational_item,
          price: kit.price,
        }
      : null,
    waiter: waiter
      ? {
          item_key: waiter.item_key,
          can_be_additional: waiter.can_be_additional,
          customer_visible: waiter.customer_visible,
          operational_item: waiter.operational_item,
          price: waiter.price,
        }
      : null,
    goiabada: fixture.extras.ITEM_061
      ? {
          item_key: fixture.extras.ITEM_061.item_key,
          price: fixture.extras.ITEM_061.price,
        }
      : null,
  },
  cases,
}
writeFileSync(OUT, JSON.stringify(report, null, 2))
console.log(JSON.stringify(report, null, 2))
