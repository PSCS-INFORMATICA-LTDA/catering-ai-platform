/**
 * Validação E2E no Preview DEV — sinal → agenda → OS
 * Preview: https://catering-ai-agenda-dev.vercel.app
 * Supabase DEV: yasprgtlqclwsjcshtls
 *
 * Não imprime senha/JWT.
 */
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'
import { existsSync, readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..', '..')
const PREVIEW = 'https://catering-ai-agenda-dev.vercel.app'
const DEV_REF = 'yasprgtlqclwsjcshtls'
const COMPANY = '65fd576f-8d97-49ba-bf38-61bc1e94e94a'
const EMAIL = 'philippe.dev@pscsinformatica.com.br'
const TAG = 'PREVIEW-VAL-DEPOSIT'

const env = readFileSync(join(ROOT, '.env.local'), 'utf8')
const get = (k) => {
  const m = env.match(new RegExp(`^${k}=(.*)$`, 'm'))
  return m ? m[1].trim().replace(/^["']|["']$/g, '') : ''
}
const url = get('NEXT_PUBLIC_SUPABASE_URL')
const anon = get('NEXT_PUBLIC_SUPABASE_ANON_KEY')
const service = get('SUPABASE_SERVICE_ROLE_KEY')
const ref = (url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/) || [])[1]
if (ref !== DEV_REF) {
  console.error('BLOQUEADO — ref', ref)
  process.exit(2)
}

let password = process.env.CATERING_DEV_USER_PASSWORD || ''
const pwFile = join(__dirname, '.philippe-dev-temp-password.txt')
if (!password && existsSync(pwFile)) password = readFileSync(pwFile, 'utf8').trim()
if (!password) {
  console.error('BLOQUEADO — senha DEV ausente')
  process.exit(2)
}

function fail(msg) {
  console.log(`PREVIEW VALIDATION: FAIL — ${msg}`)
  process.exit(1)
}
function pass(msg) {
  console.log(`PASS  ${msg}`)
}

function dayOffset(days) {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
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
  return `sb-${ref}-auth-token=${encodeURIComponent(JSON.stringify(payload))}`
}

async function previewFetch(path, session, init = {}) {
  const headers = new Headers(init.headers || {})
  headers.set('Cookie', authCookie(session))
  headers.set('Accept', 'application/json')
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  const res = await fetch(`${PREVIEW}${path}`, { ...init, headers })
  const text = await res.text()
  let json = null
  try {
    json = JSON.parse(text)
  } catch {
    json = { raw: text.slice(0, 200) }
  }
  return { res, json }
}

const admin = createClient(url, service, {
  auth: { persistSession: false, autoRefreshToken: false },
})
const authClient = createClient(url, anon, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const { data: authData, error: authErr } = await authClient.auth.signInWithPassword({
  email: EMAIL,
  password,
})
password = ''
if (authErr || !authData.session) fail(`login DEV: ${authErr?.message || 'sem sessão'}`)
const session = authData.session
pass('Login Supabase DEV (usuário operacional)')

const me = await previewFetch('/api/auth/me', session)
if (!me.res.ok) fail(`/api/auth/me → ${me.res.status}`)
pass(`Preview autenticado (${me.json.email || 'ok'})`)

const { data: cust } = await admin
  .from('customers')
  .select('id')
  .eq('company_id', COMPANY)
  .eq('active', true)
  .limit(1)
  .maybeSingle()
if (!cust?.id) fail('customer DEV ausente')

const runId = randomUUID().slice(0, 8)
const eventDate = dayOffset(90 + (parseInt(runId.slice(0, 2), 16) % 20))
const eventId = randomUUID()
const quoteId = randomUUID()
const created = { quoteId, eventId, agendaId: null }

async function cleanup() {
  if (created.agendaId) {
    await admin.from('agenda_events').delete().eq('id', created.agendaId)
  }
  await admin.from('agenda_events').delete().eq('quote_id', quoteId)
  await admin.from('quotes').delete().eq('id', quoteId)
  await admin.from('events').delete().eq('id', eventId)
}

try {
  const { error: evErr } = await admin.from('events').insert({
    id: eventId,
    company_id: COMPANY,
    customer_id: cust.id,
    event_name: `${TAG} ${runId}`,
    event_date: eventDate,
    start_time: '11:00:00',
    end_time: '15:00:00',
    adults_count: 25,
    children_count: 0,
    billable_guests: 25,
    total_guests: 25,
    active: true,
    city: 'Orlando',
    state: 'FL',
    country: 'US',
    postal_code: '32801',
    notes: TAG,
  })
  if (evErr) fail(`event: ${evErr.message}`)

  const { error: qErr } = await admin.from('quotes').insert({
    id: quoteId,
    company_id: COMPANY,
    customer_id: cust.id,
    event_id: eventId,
    quote_number: `PV-${runId}`,
    language: 'pt',
    quote_status: 'approved',
    proposal_response: 'accepted',
    source: TAG,
    active: true,
    adult_count: 25,
    children_under_3_count: 0,
    children_4_to_12_count: 0,
    physical_guest_count: 25,
    billable_guest_count: 25,
    package_total: 100,
    additional_total: 0,
    quote_total: 100,
    reservation_percentage: 30,
    reservation_amount: 30,
    balance_due: 70,
    currency_code: 'USD',
  })
  if (qErr) fail(`quote: ${qErr.message}`)
  pass(`Cotação aceita criada (${quoteId.slice(0, 8)}…) sem sinal`)

  const beforeAgenda = await admin
    .from('agenda_events')
    .select('id')
    .eq('quote_id', quoteId)
    .neq('status', 'cancelled')
  if ((beforeAgenda.data ?? []).length > 0) {
    fail('agenda já existia antes do sinal')
  }
  pass('Sem reserva na agenda antes do sinal')

  const confirm = await previewFetch(`/api/quotes/${quoteId}/reservation-confirm`, session, {
    method: 'POST',
  })
  if (!confirm.res.ok) {
    fail(
      `reservation-confirm → ${confirm.res.status}: ${confirm.json.error || JSON.stringify(confirm.json)}`,
    )
  }
  const agendaEventId = confirm.json?.data?.agenda_event_id
  const agendaStatus = confirm.json?.data?.agenda_status
  if (!agendaEventId) fail('reservation-confirm sem agenda_event_id')
  if (agendaStatus !== 'reserved') fail(`status esperado reserved, obteve ${agendaStatus}`)
  created.agendaId = agendaEventId
  pass(`Sinal confirmado → agenda reserved (${agendaEventId.slice(0, 8)}…)`)

  const agendaList = await previewFetch(
    `/api/agenda/events?from=${eventDate}&to=${eventDate}`,
    session,
  )
  if (!agendaList.res.ok) fail(`GET agenda → ${agendaList.res.status}`)
  const found = (agendaList.json?.data ?? []).find((e) => e.id === agendaEventId)
  if (!found) fail('evento não aparece na API da Agenda')
  if (found.status !== 'reserved') fail(`Agenda API status=${found.status}`)
  if (found.team_id != null) fail('Agenda deveria estar sem equipe')
  if (found.service_order_id != null) fail('Agenda não deveria ter OS ainda')
  pass('Agenda (preview API) mostra reserva antes da OS')

  const convert = await previewFetch(`/api/quotes/${quoteId}/convert`, session, {
    method: 'POST',
  })
  if (!convert.res.ok) {
    fail(`convert → ${convert.res.status}: ${convert.json.error || JSON.stringify(convert.json)}`)
  }
  const soId = convert.json?.data?.id
  if (!soId) fail('convert sem service_order id')
  pass(`Conversão OS (${soId.slice(0, 8)}…)`)

  const { data: afterRows } = await admin
    .from('agenda_events')
    .select('id, status, service_order_id, quote_id, team_id')
    .eq('quote_id', quoteId)
    .neq('status', 'cancelled')
  if ((afterRows ?? []).length !== 1) {
    fail(`duplicidade agenda: ${(afterRows ?? []).length} eventos ativos`)
  }
  const linked = afterRows[0]
  if (linked.id !== agendaEventId) fail('convert criou outro agenda_event')
  if (linked.service_order_id !== soId) fail('service_order_id não vinculado')
  if (linked.status !== 'scheduled') fail(`pós-OS status=${linked.status}`)
  pass('Mesmo agenda_event vinculado à OS (sem duplicar)')

  const confirm2 = await previewFetch(`/api/quotes/${quoteId}/reservation-confirm`, session, {
    method: 'POST',
  })
  if (!confirm2.res.ok) fail(`re-confirm → ${confirm2.res.status}`)
  if (confirm2.json?.data?.agenda_event_id !== agendaEventId) {
    fail('re-confirm alterou agenda_event_id')
  }
  pass('Re-confirmar sinal → idempotente')

  console.log('\nPREVIEW VALIDATION: PASS')
  console.log(`preview=${PREVIEW}`)
  console.log(`quote=${PREVIEW}/quotes/${quoteId}`)
  console.log(`agenda=${PREVIEW}/agenda`)
  console.log(`order=${PREVIEW}/orders/${soId}`)
} finally {
  await cleanup()
}
