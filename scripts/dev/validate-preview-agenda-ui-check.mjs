/**
 * Validação UI (via APIs do Preview) — demo PREVIEW-UI-DEPOSIT-001
 */
import { createClient } from '@supabase/supabase-js'
import { existsSync, readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..', '..')
const PREVIEW = 'https://catering-ai-agenda-dev.vercel.app'
const DEV_REF = 'yasprgtlqclwsjcshtls'
const EMAIL = 'philippe.dev@pscsinformatica.com.br'
const DEMO_QUOTE_ID = 'f3300000-0000-4000-8000-000000000099'
const EVENT_DATE = '2026-11-16'

const env = readFileSync(join(ROOT, '.env.local'), 'utf8')
const get = (k) => {
  const m = env.match(new RegExp(`^${k}=(.*)$`, 'm'))
  return m ? m[1].trim().replace(/^["']|["']$/g, '') : ''
}
const url = get('NEXT_PUBLIC_SUPABASE_URL')
const anon = get('NEXT_PUBLIC_SUPABASE_ANON_KEY')
const ref = (url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/) || [])[1]
if (ref !== DEV_REF) process.exit(2)

let password = process.env.CATERING_DEV_USER_PASSWORD || ''
const pwFile = join(__dirname, '.philippe-dev-temp-password.txt')
if (!password && existsSync(pwFile)) password = readFileSync(pwFile, 'utf8').trim()
if (!password) process.exit(2)

function authCookie(session) {
  return `sb-${ref}-auth-token=${encodeURIComponent(
    JSON.stringify({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_in: session.expires_in,
      expires_at: session.expires_at,
      token_type: 'bearer',
      user: session.user,
    }),
  )}`
}

async function previewFetch(path, session) {
  const res = await fetch(`${PREVIEW}${path}`, {
    headers: { Cookie: authCookie(session), Accept: 'application/json' },
  })
  return { res, json: await res.json().catch(() => ({})) }
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
  console.log('UI CHECK: FAIL auth')
  process.exit(1)
}
const session = authData.session

const checks = []

const agenda = await previewFetch(
  `/api/agenda/events?from=${EVENT_DATE}&to=${EVENT_DATE}`,
  session,
)
const ev = (agenda.json?.data ?? []).find((e) => e.quote_id === DEMO_QUOTE_ID)
checks.push(['Agenda API lista evento demo', Boolean(ev)])
checks.push(['Status = reserved', ev?.status === 'reserved'])
checks.push(['Sem equipe (team_id null)', ev?.team_id == null])
checks.push(['Sem OS (service_order_id null)', ev?.service_order_id == null])
checks.push(['Horário 12:00–16:00', String(ev?.start_time).startsWith('12:') && String(ev?.end_time).startsWith('16:')])

const team = await previewFetch(`/api/quotes/${DEMO_QUOTE_ID}/team-assignment`, session)
checks.push(['Cotação: reservation_confirmed_at preenchido', Boolean(team.json?.data?.reservation_confirmed_at)])
checks.push(['Cotação: aceita', team.json?.data?.proposal_response === 'accepted'])
checks.push(['Sem designação ainda', team.json?.data?.assignment == null || team.json?.data?.assignment?.team_id == null])

let fail = 0
for (const [label, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`)
  if (!ok) fail++
}

if (fail) {
  console.log(`\nUI CHECK: FAIL (${fail})`)
  process.exit(1)
}

console.log('\nUI CHECK: PASS — dados que a tela deve renderizar')
console.log(`Agenda: ${PREVIEW}/agenda  (navegar semana de ${EVENT_DATE})`)
console.log(`Cotação: ${PREVIEW}/quotes/${DEMO_QUOTE_ID}`)
console.log('Linha esperada: "Reservado (sem equipe)" · bloco âmbar · legenda "Reservado — sinal confirmado"')
