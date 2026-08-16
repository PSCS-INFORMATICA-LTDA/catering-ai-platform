/**
 * Smoke Preview DEV — UI Estoque JDE (/estoque/*)
 * Uso: QA_BASE_URL=https://...-vercel.app node scripts/dev/validate-preview-inventory-ui.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { existsSync, readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..', '..')
const PREVIEW =
  process.env.QA_BASE_URL ||
  process.argv.find((a) => a.startsWith('https://')) ||
  ''
const DEV_REF = 'yasprgtlqclwsjcshtls'
const EMAIL = 'philippe.dev@pscsinformatica.com.br'

if (!PREVIEW) {
  console.error('Informe QA_BASE_URL ou URL do preview como argumento')
  process.exit(2)
}

const env = readFileSync(join(ROOT, '.env.local'), 'utf8')
const get = (k) => {
  const m = env.match(new RegExp(`^${k}=(.*)$`, 'm'))
  return m ? m[1].trim().replace(/^["']|["']$/g, '') : ''
}
const url = get('NEXT_PUBLIC_SUPABASE_URL')
const anon = get('NEXT_PUBLIC_SUPABASE_ANON_KEY')
const ref = (url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/) || [])[1]
if (ref !== DEV_REF) {
  console.error('BLOQUEADO_REF=' + ref)
  process.exit(2)
}

let password = process.env.CATERING_DEV_USER_PASSWORD || ''
const pwFile = join(__dirname, '.philippe-dev-temp-password.txt')
if (!password && existsSync(pwFile)) password = readFileSync(pwFile, 'utf8').trim()
if (!password) {
  console.error('BLOQUEADO — senha fixture ausente')
  process.exit(2)
}

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

async function previewFetch(path, session, accept = 'text/html,application/json') {
  const res = await fetch(`${PREVIEW}${path}`, {
    headers: { Cookie: authCookie(session), Accept: accept },
    redirect: 'manual',
  })
  const text = await res.text()
  let json = null
  try {
    json = JSON.parse(text)
  } catch {
    json = null
  }
  return { status: res.status, location: res.headers.get('location'), text, json }
}

console.log('=== PREVIEW INVENTORY UI SMOKE ===')
console.log('preview=' + PREVIEW)
console.log('commit=feat/inventory-jde-foundation-dev')

const authClient = createClient(url, anon, {
  auth: { persistSession: false, autoRefreshToken: false },
})
const { data: authData, error: authErr } = await authClient.auth.signInWithPassword({
  email: EMAIL,
  password,
})
password = ''
if (authErr || !authData.session) {
  console.log('FAIL  auth preview')
  process.exit(1)
}
const session = authData.session
console.log('PASS  auth session')

let fail = 0
function check(label, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ' — ' + detail : ''}`)
  if (!ok) fail++
}

// Anônimo → login
{
  const anonRes = await fetch(`${PREVIEW}/estoque`, { redirect: 'manual' })
  const loc = anonRes.headers.get('location') || ''
  check('anon /estoque → redirect login', anonRes.status === 307 || loc.includes('/login'))
}

const PAGES = [
  ['/estoque', ['Visão geral', 'Overview', 'Resumo de saldo']],
  ['/estoque/disponibilidade', ['Disponibilidade', 'Availability', 'On Hand']],
  ['/estoque/reservas', ['Reservas', 'Commitments']],
  ['/estoque/kardex', ['Kardex', 'Movimentos', 'Movements']],
  ['/estoque/documentos', ['Documentos', 'Documents']],
  ['/estoque/locais', ['Locais', 'Locations']],
  ['/estoque/lotes', ['Lotes', 'Lots']],
]

for (const [path, markers] of PAGES) {
  const r = await previewFetch(path, session)
  const hit = markers.some((m) => r.text.includes(m))
  check(`page ${path} HTTP 200`, r.status === 200, `status=${r.status}`)
  check(`page ${path} conteúdo`, hit, markers.join('|'))
}

const APIS = [
  '/api/inventory/availability?limit=5',
  '/api/inventory/branches',
  '/api/inventory/locations',
  '/api/inventory/lots?limit=5',
  '/api/inventory/commitments?limit=5',
  '/api/inventory/documents?limit=5',
  '/api/inventory/movements?limit=5',
  '/api/inventory/balances?limit=5',
]

for (const path of APIS) {
  const r = await previewFetch(path, session, 'application/json')
  check(`api ${path.split('?')[0]}`, r.status === 200 && Array.isArray(r.json?.data), `status=${r.status}${r.json?.error ? ' err=' + r.json.error : ''}`)
}

if (fail) {
  console.log(`\nPREVIEW INVENTORY SMOKE: FAIL (${fail})`)
  process.exit(1)
}

console.log('\nPREVIEW INVENTORY SMOKE: PASS')
console.log('\nURLs para validação visual:')
for (const [path] of PAGES) {
  console.log(`  ${PREVIEW}${path}`)
}
