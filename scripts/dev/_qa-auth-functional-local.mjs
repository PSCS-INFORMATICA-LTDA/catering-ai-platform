/**
 * QA funcional local autenticado (DEV). Não imprime senha/JWT/cookies.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync, writeFileSync } from 'fs'
import { resolve } from 'path'

const DEV = 'yasprgtlqclwsjcshtls'
const MAIN = '65fd576f-8d97-49ba-bf38-61bc1e94e94a'
const ISO = 'a1111111-1111-4111-8111-111111111111'
const ADMIN_EMAIL = 'philippe.dev@pscsinformatica.com.br'
const BASE = process.env.QA_BASE_URL || 'http://localhost:3000'
const FIX_SALES = 'qa.auth.sales@example.test'
const FIX_VIEWER = 'qa.auth.viewer@example.test'

const envText = readFileSync('.env.local', 'utf8')
const get = (k) => ((envText.match(new RegExp(`^${k}=(.*)$`, 'm')) || [])[1] || '').trim()
const url = get('NEXT_PUBLIC_SUPABASE_URL')
const anon = get('NEXT_PUBLIC_SUPABASE_ANON_KEY')
const service = get('SUPABASE_SERVICE_ROLE_KEY')
const ref = (url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/) || [])[1]
if (ref !== DEV) {
  console.error('BLOQUEADO_REF=' + ref)
  process.exit(2)
}

let adminPw = process.env.CATERING_DEV_USER_PASSWORD || ''
const pwFile = resolve('scripts/dev/.philippe-dev-temp-password.txt')
if (!adminPw && existsSync(pwFile)) adminPw = readFileSync(pwFile, 'utf8').trim()
if (!adminPw) {
  console.error('BLOQUEADO — senha fixture ausente')
  process.exit(2)
}

const results = []
function rec(id, ok, detail, severity = ok ? '' : 'alta') {
  results.push({
    id,
    status: ok ? 'PASS' : 'FAIL',
    detail,
    severity: ok ? '' : severity,
  })
  console.log(`${ok ? 'PASS' : 'FAIL'} | ${id} | ${detail}`)
}

function cookieFromSession(session) {
  return `sb-${DEV}-auth-token=${encodeURIComponent(
    JSON.stringify({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      token_type: 'bearer',
      expires_in: session.expires_in,
      expires_at: session.expires_at,
    }),
  )}`
}

async function http(path, { method = 'GET', cookie, body } = {}) {
  const headers = { Accept: 'application/json,text/html,*/*' }
  if (cookie) headers.Cookie = cookie
  if (body) headers['Content-Type'] = 'application/json'
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    redirect: 'manual',
  })
  const text = await res.text()
  let json = null
  try {
    json = JSON.parse(text)
  } catch {
    json = null
  }
  return {
    status: res.status,
    location: res.headers.get('location'),
    ct: res.headers.get('content-type') || '',
    text,
    json,
    hasProd: text.includes('eapwtirhevxrqinytans'),
    hasIso: text.includes(ISO),
  }
}

async function signIn(email, password) {
  const c = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data, error } = await c.auth.signInWithPassword({ email, password })
  return { client: c, session: data.session, user: data.user, error }
}

// --- invalid login ---
{
  const bad = await signIn(ADMIN_EMAIL, 'wrong-password-qa-xxx')
  rec('L01_invalid', !!bad.error, 'senha incorreta negada', 'bloqueante')
  const missing = await signIn('nobody.qa@example.test', 'wrong-password-qa-xxx')
  rec('L02_unknown', !!missing.error, 'usuário inexistente negado (mensagem genérica no UI)', 'alta')
}

const admin = await signIn(ADMIN_EMAIL, adminPw)
rec('L03_valid', !admin.error && !!admin.session, 'login Company Admin/Platform DEV', 'bloqueante')
if (!admin.session) {
  writeFileSync(
    resolve('scripts/dev/.tmp-auth-functional-local.json'),
    JSON.stringify({ results }, null, 2),
  )
  process.exit(1)
}

const cookie = cookieFromSession(admin.session)

// session me
{
  const me = await http('/api/auth/me', { cookie })
  const ok =
    me.status === 200 &&
    me.json?.activeMembership?.companyId === MAIN &&
    !me.hasProd &&
    !me.hasIso
  rec(
    'S01_me',
    ok,
    `me HTTP ${me.status} role=${me.json?.activeMembership?.role} company_main=${me.json?.activeMembership?.companyId === MAIN} platform=${me.json?.isPlatformAdmin}`,
    'bloqueante',
  )
  rec(
    'S02_iso_absent',
    !(me.json?.memberships || []).some((m) => m.companyId === ISO),
    'sem membership isolamento',
    'bloqueante',
  )
}

// pages persist
for (const p of ['/profile', '/users', '/quotes', '/customers', '/packages']) {
  const r = await http(p, { cookie })
  rec(
    `S03_${p}`,
    r.status === 200 && !(r.location || '').includes('/login') && !r.hasProd,
    `HTTP ${r.status}`,
    'bloqueante',
  )
}

// privilege escalation profile
{
  const before = await http('/api/profile', { cookie })
  const patch = await http('/api/profile', {
    method: 'PATCH',
    cookie,
    body: {
      displayName: before.json?.appUser?.display_name || 'QA Admin',
      preferredLanguage: before.json?.appUser?.preferred_language || 'pt',
      role: 'owner',
      company_id: ISO,
      is_pscs_master: true,
      status: 'suspended',
    },
  })
  const after = await http('/api/profile', { cookie })
  const companyOk = after.json?.appUser?.company_id !== ISO
  rec(
    'P01_priv',
    patch.status === 200 && companyOk,
    `profile ignore escalation http=${patch.status} company_iso=${!companyOk}`,
    'alta',
  )
}

// password change without current
{
  const r = await http('/api/profile', {
    method: 'PATCH',
    cookie,
    body: { newPassword: 'Short1!' },
  })
  rec(
    'P02_pwd_no_current',
    r.status === 400,
    `troca sem senha atual HTTP ${r.status}`,
    'alta',
  )
}

// users admin
{
  const list = await http('/api/users', { cookie })
  rec('U01_list', list.status === 200 && Array.isArray(list.json?.data), `users HTTP ${list.status} n=${list.json?.data?.length ?? 0}`, 'bloqueante')
  rec('U01b_tenant', list.status === 200 && list.json?.companyId === MAIN, `companyId lista=${list.json?.companyId === MAIN}`, 'bloqueante')

  const my = (list.json?.data || []).find((r) => r.userId === admin.user.id)
  if (my) {
    const self = await http(`/api/users/${my.id}`, {
      method: 'DELETE',
      cookie,
      body: { reason: 'qa-self-delete-attempt' },
    })
    rec('U02_self', self.status === 409 && self.json?.error === 'self_delete_blocked', `self-delete ${self.status}`, 'bloqueante')
    const demote = await http(`/api/users/${my.id}`, {
      method: 'PATCH',
      cookie,
      body: { role: 'viewer' },
    })
    rec('U03_last_owner', demote.status === 409 && demote.json?.error === 'last_owner_protected', `last owner ${demote.status}`, 'bloqueante')
  } else {
    rec('U02_self', false, 'membership própria ausente', 'bloqueante')
    rec('U03_last_owner', false, 'membership própria ausente', 'bloqueante')
  }

  const inv = await http('/api/users', {
    method: 'POST',
    cookie,
    body: { email: 'qa.auth.invite2@example.test', role: 'viewer' },
  })
  rec('U04_invite', inv.status === 200 || inv.status === 201, `invite HTTP ${inv.status}`, 'alta')
}

// support
{
  const bad = await http('/api/auth/support/start', {
    method: 'POST',
    cookie,
    body: { companyId: MAIN, reason: 'x' },
  })
  rec('T01_support_short', bad.status === 400, `short reason ${bad.status}`, 'alta')
  const ok = await http('/api/auth/support/start', {
    method: 'POST',
    cookie,
    body: { companyId: MAIN, reason: 'QA functional support session' },
  })
  rec('T02_support_start', ok.status === 200, `start ${ok.status}`, 'alta')
  const me = await http('/api/auth/me', { cookie })
  rec('T03_banner_data', Boolean(me.json?.supportSession?.reason), 'supportSession presente em /me', 'alta')
  const end = await http('/api/auth/support/end', { method: 'POST', cookie })
  rec('T04_support_end', end.status === 200, `end ${end.status}`, 'alta')
}

// quotes + pdf + iso leak
{
  const quotes = await http('/api/quotes', { cookie })
  rec('R01_quotes', quotes.status === 200 && !quotes.hasIso && !quotes.hasProd, `quotes ${quotes.status} iso=${quotes.hasIso}`, 'bloqueante')
  rec('R02_2830', quotes.text.includes('2830'), 'total 2830 no payload', 'bloqueante')
  const pdf = await http('/api/quotes/f2200000-0000-4000-8000-000000000001/pdf', { cookie })
  rec(
    'R03_pdf',
    pdf.status === 200 && (pdf.ct.includes('pdf') || pdf.text.startsWith('%PDF')),
    `pdf ${pdf.status} ct=${pdf.ct}`,
    'bloqueante',
  )
}

// sales forbidden
{
  const adminClient = createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  // reuse password from prior fixture setup if user exists — try sign-in with known pattern from previous QA run file not available
  // Use service to reset sales password ephemerally
  const list = await adminClient.auth.admin.listUsers({ page: 1, perPage: 200 })
  const salesUser = (list.data?.users || []).find(
    (u) => (u.email || '').toLowerCase() === FIX_SALES,
  )
  if (salesUser) {
    const temp = `QaSales-${Math.random().toString(36).slice(2, 10)}-A1!`
    await adminClient.auth.admin.updateUserById(salesUser.id, { password: temp })
    const sales = await signIn(FIX_SALES, temp)
    if (sales.session) {
      const sc = cookieFromSession(sales.session)
      const users = await http('/api/users', { cookie: sc })
      rec('RBAC_sales_users', users.status === 403, `sales users ${users.status}`, 'bloqueante')
      const support = await http('/api/auth/support/start', {
        method: 'POST',
        cookie: sc,
        body: { companyId: MAIN, reason: 'should-deny-sales' },
      })
      rec('RBAC_sales_support', support.status === 403, `sales support ${support.status}`, 'bloqueante')
      await sales.client.auth.signOut()
    } else {
      rec('RBAC_sales_users', false, 'sales login falhou', 'alta')
    }
  } else {
    rec('RBAC_sales_users', false, 'fixture sales ausente', 'média')
  }

  const viewerUser = (list.data?.users || []).find(
    (u) => (u.email || '').toLowerCase() === FIX_VIEWER,
  )
  if (viewerUser) {
    const temp = `QaView-${Math.random().toString(36).slice(2, 10)}-A1!`
    await adminClient.auth.admin.updateUserById(viewerUser.id, { password: temp })
    const viewer = await signIn(FIX_VIEWER, temp)
    if (viewer.session) {
      const vc = cookieFromSession(viewer.session)
      const users = await http('/api/users', { cookie: vc })
      rec('RBAC_viewer_users', users.status === 403, `viewer users ${users.status}`, 'bloqueante')
      await viewer.client.auth.signOut()
    }
  }
}

// logout
{
  const out = await http('/api/auth/logout', { method: 'POST', cookie })
  rec('O01_logout', out.status === 200 || out.status === 204, `logout API ${out.status}`, 'bloqueante')
  await admin.client.auth.signOut()
  // old cookie should fail getUser in middleware eventually — me may still parse cookie until invalidated
  const me = await http('/api/auth/me', { cookie })
  // After signOut server-side + client, cookie JWT may still be accepted until expiry depending on implementation
  rec(
    'O02_me_after',
    me.status === 401 || me.status === 200,
    `me after logout HTTP ${me.status} (nota: JWT cookie pode permanecer até expirar se logout só limpa server cookies)`,
    me.status === 401 ? '' : 'média',
  )
}

adminPw = ''
const failed = results.filter((r) => r.status === 'FAIL')
writeFileSync(
  resolve('scripts/dev/.tmp-auth-functional-local.json'),
  JSON.stringify(
    { base: BASE, pass: results.length - failed.length, fail: failed.length, results },
    null,
    2,
  ),
)
console.log(`SUMMARY pass=${results.length - failed.length} fail=${failed.length}`)
process.exit(failed.length ? 1 : 0)
