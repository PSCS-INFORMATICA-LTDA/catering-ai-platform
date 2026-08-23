/**
 * RBAC fino das APIs de domínio (JWT real, DEV).
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'

const DEV = 'yasprgtlqclwsjcshtls'
const MAIN = '65fd576f-8d97-49ba-bf38-61bc1e94e94a'
const ISO = 'a1111111-1111-4111-8111-111111111111'
const BASE = process.env.QA_BASE_URL || 'http://localhost:3000'
const ADMIN_EMAIL = 'philippe.dev@pscsinformatica.com.br'

const envText = readFileSync('.env.local', 'utf8')
const get = (k) => ((envText.match(new RegExp(`^${k}=(.*)$`, 'm')) || [])[1] || '').trim()
const url = get('NEXT_PUBLIC_SUPABASE_URL')
const anon = get('NEXT_PUBLIC_SUPABASE_ANON_KEY')
const service = get('SUPABASE_SERVICE_ROLE_KEY')
const ref = (url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/) || [])[1]
if (ref !== DEV) {
  console.log('DOMAIN API RBAC: FAIL — ref inválido')
  process.exit(1)
}

let adminPw = process.env.CATERING_DEV_USER_PASSWORD || ''
const pwFile = resolve('scripts/dev/.philippe-dev-temp-password.txt')
if (!adminPw && existsSync(pwFile)) adminPw = readFileSync(pwFile, 'utf8').trim()
if (!adminPw) {
  console.log('DOMAIN API RBAC: FAIL — senha admin ausente')
  process.exit(1)
}

function fail(msg) {
  console.log('DOMAIN API RBAC: FAIL — ' + msg)
  process.exit(1)
}

const svc = createClient(url, service, {
  auth: { persistSession: false, autoRefreshToken: false },
})

async function ensureRoleUser(email, role) {
  const list = await svc.auth.admin.listUsers({ page: 1, perPage: 200 })
  let user = (list.data?.users || []).find(
    (u) => (u.email || '').toLowerCase() === email.toLowerCase(),
  )
  const pw = `QaRbac-${role}-${Math.random().toString(36).slice(2, 8)}-A1!`
  if (!user) {
    const created = await svc.auth.admin.createUser({
      email,
      password: pw,
      email_confirm: true,
      user_metadata: { qa_fixture: true, full_name: `QA ${role}` },
    })
    if (created.error) fail(`create ${role}`)
    user = created.data.user
  } else {
    await svc.auth.admin.updateUserById(user.id, { password: pw, email_confirm: true })
  }
  await svc.from('app_users').upsert(
    {
      auth_user_id: user.id,
      email,
      full_name: `QA ${role}`,
      display_name: `QA ${role}`,
      preferred_language: 'pt',
      is_pscs_master: false,
      active: true,
    },
    { onConflict: 'auth_user_id' },
  )
  const { data: mem } = await svc
    .from('company_memberships')
    .select('id')
    .eq('company_id', MAIN)
    .eq('user_id', user.id)
    .maybeSingle()
  if (mem?.id) {
    await svc
      .from('company_memberships')
      .update({ role, status: 'active', active: true })
      .eq('id', mem.id)
  } else {
    await svc.from('company_memberships').insert({
      company_id: MAIN,
      user_id: user.id,
      role,
      status: 'active',
      active: true,
    })
  }
  await svc.from('company_memberships').delete().eq('company_id', ISO).eq('user_id', user.id)
  return { email, password: pw, userId: user.id }
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

async function signIn(email, password) {
  const c = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data, error } = await c.auth.signInWithPassword({ email, password })
  if (error || !data.session) return null
  return { client: c, session: data.session, cookie: cookieFromSession(data.session) }
}

async function http(path, { method = 'GET', cookie, body } = {}) {
  const headers = { Accept: 'application/json' }
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
  return { status: res.status, json, text }
}

// anon
{
  const r = await http('/api/quotes')
  if (r.status !== 401) fail(`anon quotes expected 401 got ${r.status}`)
}

const viewer = await ensureRoleUser('qa.auth.viewer@example.test', 'viewer')
const sales = await ensureRoleUser('qa.auth.sales@example.test', 'sales')
const operator = await ensureRoleUser('qa.auth.operator@example.test', 'operator')
const finance = await ensureRoleUser('qa.auth.finance@example.test', 'finance')

const adminSession = await signIn(ADMIN_EMAIL, adminPw)
adminPw = ''
if (!adminSession) fail('admin login')

const viewerSession = await signIn(viewer.email, viewer.password)
const salesSession = await signIn(sales.email, sales.password)
const operatorSession = await signIn(operator.email, operator.password)
const financeSession = await signIn(finance.email, finance.password)
viewer.password = sales.password = operator.password = finance.password = ''
if (!viewerSession || !salesSession || !operatorSession || !financeSession) {
  fail('fixture logins')
}

// reads
for (const [name, s] of [
  ['admin', adminSession],
  ['sales', salesSession],
  ['viewer', viewerSession],
  ['operator', operatorSession],
  ['finance', financeSession],
]) {
  const q = await http('/api/quotes', { cookie: s.cookie })
  if (q.status !== 200) fail(`${name} quotes.view expected 200 got ${q.status}`)
  if (q.text.includes(ISO)) fail(`${name} quotes leaked iso`)
}

// writes denied for viewer
{
  const pkg = await http('/api/packages', {
    method: 'POST',
    cookie: viewerSession.cookie,
    body: {
      package_key: 'QA-DENY',
      label_pt: 'deny',
      company_id: MAIN,
    },
  })
  if (pkg.status !== 403) fail(`viewer packages.manage expected 403 got ${pkg.status}`)

  const quote = await http('/api/quotes', {
    method: 'POST',
    cookie: viewerSession.cookie,
    body: { packageId: '00000000-0000-4000-8000-000000000099', company_id: ISO },
  })
  if (quote.status !== 403) fail(`viewer quotes.manage expected 403 got ${quote.status}`)

  const users = await http('/api/users', { cookie: viewerSession.cookie })
  if (users.status !== 403) fail(`viewer users.view expected 403 got ${users.status}`)
}

// sales can manage quotes/customers but not catalog write / users
{
  const users = await http('/api/users', { cookie: salesSession.cookie })
  if (users.status !== 403) fail(`sales users expected 403 got ${users.status}`)

  const pkg = await http('/api/packages', {
    method: 'POST',
    cookie: salesSession.cookie,
    body: { package_key: 'QA-DENY-SALES', label_pt: 'deny', company_id: MAIN },
  })
  if (pkg.status !== 403) fail(`sales catalog.manage expected 403 got ${pkg.status}`)

  const cust = await http('/api/customers', { cookie: salesSession.cookie })
  if (cust.status !== 200) fail(`sales customers.view expected 200 got ${cust.status}`)
}

// operator cannot manage quotes
{
  const quote = await http('/api/quotes', {
    method: 'POST',
    cookie: operatorSession.cookie,
    body: { packageId: '00000000-0000-4000-8000-000000000099' },
  })
  if (quote.status !== 403) fail(`operator quotes.manage expected 403 got ${quote.status}`)
}

// spoof company_id
{
  const spoof = await http('/api/customers', {
    method: 'POST',
    cookie: salesSession.cookie,
    body: {
      phone: '+15550001111',
      full_name: 'QA Spoof',
      company_id: ISO,
    },
  })
  if (spoof.status !== 403) fail(`spoof company_id expected 403 got ${spoof.status}`)
}

// admin allowed
{
  const q = await http('/api/quotes', { cookie: adminSession.cookie })
  if (q.status !== 200) fail(`admin quotes ${q.status}`)
  const p = await http('/api/packages', { cookie: adminSession.cookie })
  if (p.status !== 200) fail(`admin packages ${p.status}`)
  const u = await http('/api/users', { cookie: adminSession.cookie })
  if (u.status !== 200) fail(`admin users ${u.status}`)
  const pdf = await http(
    '/api/quotes/f2200000-0000-4000-8000-000000000001/pdf',
    { cookie: adminSession.cookie },
  )
  if (pdf.status !== 200) fail(`admin pdf ${pdf.status}`)
}

await Promise.all([
  adminSession.client.auth.signOut(),
  viewerSession.client.auth.signOut(),
  salesSession.client.auth.signOut(),
  operatorSession.client.auth.signOut(),
  financeSession.client.auth.signOut(),
])

console.log('DOMAIN API RBAC: PASS')
process.exit(0)
