/**
 * UI/HTML smoke autenticado via cookie SSR (sem imprimir tokens).
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync, writeFileSync } from 'fs'
import { resolve } from 'path'

const DEV = 'yasprgtlqclwsjcshtls'
const EMAIL = 'philippe.dev@pscsinformatica.com.br'
const BASE = process.env.QA_BASE_URL || 'http://localhost:3000'
const envText = readFileSync('.env.local', 'utf8')
const get = (k) => {
  const m = envText.match(new RegExp(`^${k}=(.*)$`, 'm'))
  return m ? m[1].trim() : ''
}
const url = get('NEXT_PUBLIC_SUPABASE_URL')
const anon = get('NEXT_PUBLIC_SUPABASE_ANON_KEY')
const ref = (url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/) || [])[1]
if (ref !== DEV) {
  console.error('BLOQUEADO_REF=' + ref)
  process.exit(2)
}
let password = process.env.CATERING_DEV_USER_PASSWORD || ''
const pwFile = resolve('scripts/dev/.philippe-dev-temp-password.txt')
if (!password && existsSync(pwFile)) password = readFileSync(pwFile, 'utf8').trim()
if (!password) {
  console.error('BLOQUEADO — senha ausente')
  process.exit(2)
}

const client = createClient(url, anon, {
  auth: { persistSession: false, autoRefreshToken: false },
})
const { data, error } = await client.auth.signInWithPassword({ email: EMAIL, password })
password = ''
if (error || !data.session) {
  console.error('LOGIN_FAIL')
  process.exit(1)
}

const cookie = `sb-${DEV}-auth-token=${encodeURIComponent(
  JSON.stringify({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    token_type: 'bearer',
    expires_in: data.session.expires_in,
    expires_at: data.session.expires_at,
  }),
)}`

const results = []
function rec(id, ok, detail) {
  results.push({ id, status: ok ? 'PASS' : 'FAIL', detail })
  console.log(`${ok ? 'PASS' : 'FAIL'} | ${id} | ${detail}`)
}

async function req(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      ...(opts.headers || {}),
      Cookie: cookie,
      Accept: 'text/html,application/json',
    },
    redirect: 'manual',
  })
  const text = await res.text()
  return {
    status: res.status,
    location: res.headers.get('location'),
    text,
    ct: res.headers.get('content-type') || '',
  }
}

// Authenticated pages
for (const p of ['/profile', '/users', '/quotes', '/packages', '/customers']) {
  const r = await req(p)
  const redirectedLogin = (r.location || '').includes('/login')
  const ok = r.status === 200 && !redirectedLogin
  rec(`UI_${p}`, ok, `HTTP ${r.status} loc=${r.location || '-'} bytes=${r.text.length}`)
}

const profile = await req('/profile')
rec(
  'UI_profile_fields',
  profile.text.includes('Nome de exibição') || profile.text.includes('display'),
  'profile labels',
)
rec('UI_profile_pwd', /Nova senha|newPassword|Alterar senha/i.test(profile.text), 'password section')

const users = await req('/users')
rec('UI_users_invite', /Convidar|Invite|Usuários/i.test(users.text), 'users heading/invite')
const me = await req('/api/auth/me')
let isPlatform = false
try {
  isPlatform = Boolean(JSON.parse(me.text).isPlatformAdmin)
} catch {
  isPlatform = false
}
rec(
  'UI_users_support',
  isPlatform && me.status === 200,
  `platform admin session for support UI (client-rendered) me=${me.status}`,
)

const forgot = await fetch(`${BASE}/auth/forgot-password`, { redirect: 'manual' })
const forgotText = await forgot.text()
rec('UI_forgot', forgot.status === 200 && /Recuperar|Recover|redefini/i.test(forgotText), `forgot HTTP ${forgot.status}`)

const reset = await fetch(`${BASE}/auth/reset-password`, { redirect: 'manual' })
rec('UI_reset', reset.status === 200, `reset HTTP ${reset.status}`)

// Open redirect when already authenticated hitting /login?next=
const evil = await req('/login?next=//evil.example')
const evilLoc = String(evil.location || '')
rec(
  'OPEN_REDIRECT',
  !evilLoc.includes('evil.example') &&
    ((evil.status === 307 || evil.status === 302) ? evilLoc.includes('/quotes') || evilLoc.startsWith('/') : evil.status === 200),
  `login next=//evil -> HTTP ${evil.status} loc=${evilLoc || '-'}`,
)

const jsEvil = await req('/login?next=javascript:alert(1)')
rec(
  'OPEN_REDIRECT_JS',
  !(jsEvil.location || '').toLowerCase().includes('javascript:'),
  `next=javascript -> loc=${jsEvil.location || '-'}`,
)

// Quotes API + PDF with session
const quotes = await req('/api/quotes')
let qid = null
try {
  const j = JSON.parse(quotes.text)
  const row = (j.data || []).find((x) => Number(x.total) === 2830 || Number(x.grand_total) === 2830)
  qid = row?.id || (j.data || [])[0]?.id
  rec('REG_quotes', quotes.status === 200 && (j.data || []).length > 0, `quotes HTTP ${quotes.status} n=${(j.data||[]).length}`)
  rec('REG_2830', Boolean(row) || JSON.stringify(j).includes('2830'), 'total 2830 present')
} catch {
  rec('REG_quotes', false, `quotes parse fail HTTP ${quotes.status}`)
}

if (qid) {
  const pdf = await req(`/api/quotes/${qid}/pdf`)
  rec(
    'REG_pdf',
    pdf.status === 200 && (pdf.ct.includes('pdf') || pdf.text.startsWith('%PDF')),
    `pdf HTTP ${pdf.status} ct=${pdf.ct}`,
  )
} else {
  rec('REG_pdf', false, 'no quote id')
}

const loginEn = await fetch(`${BASE}/login`, { redirect: 'manual' })
const loginHtml = await loginEn.text()
rec(
  'I18N_selector',
  /<option value="en">EN<\/option>/i.test(loginHtml) &&
    /<option value="es">ES<\/option>/i.test(loginHtml),
  'login language selector PT/EN/ES',
)

// Logout API
const logout = await fetch(`${BASE}/api/auth/logout`, {
  method: 'POST',
  headers: { Cookie: cookie },
  redirect: 'manual',
})
rec('LOGOUT_api', logout.status === 200 || logout.status === 204 || logout.status === 401, `logout HTTP ${logout.status}`)

await client.auth.signOut()

const out = { base: BASE, results }
writeFileSync(resolve('scripts/dev/.tmp-auth-ui-qa-run.json'), JSON.stringify(out, null, 2))
const fail = results.filter((r) => r.status === 'FAIL').length
console.log(`SUMMARY pass=${results.length - fail} fail=${fail}`)
process.exit(fail ? 1 : 0)
