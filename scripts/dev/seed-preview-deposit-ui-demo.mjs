/**
 * Prepara cotação VISÍVEL no Preview para validação manual/UI.
 * Estado: aceita + sinal confirmado + agenda reserved (sem OS, sem equipe).
 *
 * Uso:
 *   node scripts/dev/seed-preview-deposit-ui-demo.mjs
 *   node scripts/dev/seed-preview-deposit-ui-demo.mjs --cleanup
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
const TAG = 'PREVIEW-UI-DEMO'
const DEMO_QUOTE_ID = 'f3300000-0000-4000-8000-000000000099'
const DEMO_EVENT_ID = 'f3300000-0000-4000-8000-000000000098'

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
if (!password && !process.argv.includes('--cleanup')) {
  console.error('BLOQUEADO — senha DEV ausente')
  process.exit(2)
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
  const res = await fetch(`${PREVIEW}${path}`, { ...init, headers })
  const json = await res.json().catch(() => ({}))
  return { res, json }
}

const admin = createClient(url, service, {
  auth: { persistSession: false, autoRefreshToken: false },
})

async function cleanup() {
  await admin.from('agenda_events').delete().eq('quote_id', DEMO_QUOTE_ID)
  await admin.from('quotes').delete().eq('id', DEMO_QUOTE_ID)
  await admin.from('events').delete().eq('id', DEMO_EVENT_ID)
  console.log('CLEANUP OK')
}

if (process.argv.includes('--cleanup')) {
  await cleanup()
  process.exit(0)
}

const authClient = createClient(url, anon, {
  auth: { persistSession: false, autoRefreshToken: false },
})
const { data: authData, error: authErr } = await authClient.auth.signInWithPassword({
  email: EMAIL,
  password,
})
password = ''
if (authErr || !authData.session) {
  console.error('AUTH FAIL', authErr?.message)
  process.exit(1)
}
const session = authData.session

const { data: cust } = await admin
  .from('customers')
  .select('id')
  .eq('company_id', COMPANY)
  .eq('active', true)
  .limit(1)
  .maybeSingle()
if (!cust?.id) {
  console.error('customer ausente')
  process.exit(1)
}

// Data ~3 meses à frente, horário visível no quadro semanal
const eventDate = (() => {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + 95)
  // próxima segunda
  while (d.getUTCDay() !== 1) d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
})()

await cleanup()

await admin.from('events').insert({
  id: DEMO_EVENT_ID,
  company_id: COMPANY,
  customer_id: cust.id,
  event_name: `${TAG} Validação Philippe`,
  event_date: eventDate,
  start_time: '12:00:00',
  end_time: '16:00:00',
  adults_count: 30,
  children_count: 0,
  billable_guests: 30,
  total_guests: 30,
  active: true,
  city: 'Orlando',
  state: 'FL',
  country: 'US',
  postal_code: '32801',
  notes: TAG,
})

await admin.from('quotes').insert({
  id: DEMO_QUOTE_ID,
  company_id: COMPANY,
  customer_id: cust.id,
  event_id: DEMO_EVENT_ID,
  quote_number: 'PREVIEW-UI-DEPOSIT-001',
  language: 'pt',
  quote_status: 'approved',
  proposal_response: 'accepted',
  source: TAG,
  active: true,
  adult_count: 30,
  children_under_3_count: 0,
  children_4_to_12_count: 0,
  physical_guest_count: 30,
  billable_guest_count: 30,
  package_total: 1500,
  additional_total: 0,
  quote_total: 1500,
  reservation_percentage: 30,
  reservation_amount: 450,
  balance_due: 1050,
  currency_code: 'USD',
})

const confirm = await previewFetch(
  `/api/quotes/${DEMO_QUOTE_ID}/reservation-confirm`,
  session,
  { method: 'POST' },
)
if (!confirm.res.ok) {
  console.error('confirm FAIL', confirm.json)
  process.exit(1)
}

const agendaId = confirm.json?.data?.agenda_event_id
console.log('=== PREVIEW UI DEMO (sinal → agenda, sem OS) ===')
console.log(`event_date=${eventDate} 12:00–16:00`)
console.log(`quote_id=${DEMO_QUOTE_ID}`)
console.log(`agenda_event_id=${agendaId}`)
console.log(`status=${confirm.json?.data?.agenda_status}`)
console.log('')
console.log(`Cotação: ${PREVIEW}/quotes/${DEMO_QUOTE_ID}`)
console.log(`Agenda:  ${PREVIEW}/agenda`)
console.log('')
console.log('Esperado na Agenda: linha "Reservado (sem equipe)" + bloco âmbar 12:00–16:00')
console.log('Cleanup: node scripts/dev/seed-preview-deposit-ui-demo.mjs --cleanup')
