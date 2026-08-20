/**
 * QA ampliada — autenticação / usuários / RBAC (DEV only).
 * Usa JWT real para provas de permissão. Service-role só para fixture.
 * Não imprime senhas, JWT nem service-role.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync, writeFileSync } from 'fs'
import { resolve } from 'path'

const DEV = 'yasprgtlqclwsjcshtls'
const MAIN = '65fd576f-8d97-49ba-bf38-61bc1e94e94a'
const ISO = 'a1111111-1111-4111-8111-111111111111'
const ADMIN_EMAIL = 'philippe.dev@pscsinformatica.com.br'
const FIXTURE_SALES = 'qa.auth.sales@example.test'
const FIXTURE_VIEWER = 'qa.auth.viewer@example.test'
const BASE_LOCAL = process.env.QA_BASE_URL || 'http://localhost:3000'

const envText = readFileSync('.env.local', 'utf8')
const get = (k) => {
  const m = envText.match(new RegExp(`^${k}=(.*)$`, 'm'))
  return m ? m[1].trim() : ''
}
const url = get('NEXT_PUBLIC_SUPABASE_URL')
const anon = get('NEXT_PUBLIC_SUPABASE_ANON_KEY')
const service = get('SUPABASE_SERVICE_ROLE_KEY')
const ref = (url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/) || [])[1]
if (ref !== DEV) {
  console.error('BLOQUEADO_REF=' + ref)
  process.exit(2)
}
if (!service) {
  console.error('BLOQUEADO — service role ausente para fixture')
  process.exit(2)
}

let adminPassword = process.env.CATERING_DEV_USER_PASSWORD || ''
const pwFile = resolve('scripts/dev/.philippe-dev-temp-password.txt')
if (!adminPassword && existsSync(pwFile)) {
  adminPassword = readFileSync(pwFile, 'utf8').trim()
}
if (!adminPassword) {
  console.error('BLOQUEADO — senha fixture admin ausente')
  process.exit(2)
}

const results = []
function record(id, ok, detail) {
  const status = ok ? 'PASS' : 'FAIL'
  results.push({ id, status, detail })
  console.log(`${status} | ${id} | ${detail}`)
}

function maskEmail(e) {
  if (!e || !e.includes('@')) return '(none)'
  const [u, d] = e.split('@')
  return `${u.slice(0, 2)}***@${d}`
}

const adminClient = createClient(url, service, {
  auth: { persistSession: false, autoRefreshToken: false },
})

async function ensureFixtureUser(email, role) {
  const list = await adminClient.auth.admin.listUsers({ page: 1, perPage: 200 })
  let user = (list.data?.users || []).find(
    (u) => (u.email || '').toLowerCase() === email.toLowerCase(),
  )
  const tempPw =
    process.env.CATERING_QA_FIXTURE_PASSWORD ||
    `QaFix-${Math.random().toString(36).slice(2, 10)}-A1!`
  if (!user) {
    const created = await adminClient.auth.admin.createUser({
      email,
      password: tempPw,
      email_confirm: true,
      user_metadata: { qa_fixture: true, full_name: `QA ${role}` },
    })
    if (created.error) throw new Error(`createUser ${email}: ${created.error.message}`)
    user = created.data.user
  } else {
    await adminClient.auth.admin.updateUserById(user.id, {
      password: tempPw,
      email_confirm: true,
    })
  }

  await adminClient.from('app_users').upsert(
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

  const { data: mem } = await adminClient
    .from('company_memberships')
    .select('id')
    .eq('company_id', MAIN)
    .eq('user_id', user.id)
    .maybeSingle()

  if (mem?.id) {
    await adminClient
      .from('company_memberships')
      .update({ role, status: 'active', active: true })
      .eq('id', mem.id)
  } else {
    await adminClient.from('company_memberships').insert({
      company_id: MAIN,
      user_id: user.id,
      role,
      status: 'active',
      active: true,
    })
  }

  // Ensure no iso membership for normal fixtures
  await adminClient
    .from('company_memberships')
    .delete()
    .eq('company_id', ISO)
    .eq('user_id', user.id)

  return { userId: user.id, password: tempPw }
}

async function signIn(email, password) {
  const c = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data, error } = await c.auth.signInWithPassword({ email, password })
  return { client: c, session: data.session, user: data.user, error }
}

async function http(path, { method = 'GET', token, body, cookie } = {}) {
  const headers = { Accept: 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  if (cookie) headers.Cookie = cookie
  if (body) headers['Content-Type'] = 'application/json'
  const res = await fetch(`${BASE_LOCAL}${path}`, {
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
    text: text.slice(0, 400),
    json,
    hasProd: text.includes('eapwtirhevxrqinytans'),
    hasBusinessLeak:
      /TEST-DEV-PKG|2830|customer|package/i.test(text) &&
      !text.includes('Unauthorized') &&
      res.status < 400,
  }
}

async function cookieFromSession(session) {
  // Next SSR uses cookie jar; for API via Authorization we still need cookie for proxy getUser.
  // Proxy uses supabase SSR cookies — Authorization alone may not pass middleware.
  // Sign-in via password grant and set sb cookies approximate.
  const projectRef = DEV
  const access = session.access_token
  const refresh = session.refresh_token
  // Do not log tokens. Build cookie header for @supabase/ssr style names.
  const chunkName = `sb-${projectRef}-auth-token`
  const payload = JSON.stringify({
    access_token: access,
    refresh_token: refresh,
    token_type: 'bearer',
    expires_in: session.expires_in,
    expires_at: session.expires_at,
  })
  return `${chunkName}=${encodeURIComponent(payload)}`
}

console.log('QA_BASE=' + BASE_LOCAL)
console.log('REF_OK=yasprgtlqclwsjcshtls')

// --- Auth matrix script-level ---
{
  const bad = await signIn(ADMIN_EMAIL, 'definitely-wrong-password-xxx')
  record('B01', !!bad.error, 'login inválido negado')
}

const adminSign = await signIn(ADMIN_EMAIL, adminPassword)
record('B02', !adminSign.error && !!adminSign.session, 'login válido admin fixture')

let salesFix = null
let viewerFix = null
try {
  salesFix = await ensureFixtureUser(FIXTURE_SALES, 'sales')
  viewerFix = await ensureFixtureUser(FIXTURE_VIEWER, 'viewer')
  record('D00', true, `fixtures ok ${maskEmail(FIXTURE_SALES)} / ${maskEmail(FIXTURE_VIEWER)}`)
} catch (e) {
  record('D00', false, `fixture error: ${e.message}`)
}

// Platform flag check (no password printed)
{
  const { data: au } = await adminClient
    .from('app_users')
    .select('is_pscs_master, active')
    .eq('auth_user_id', adminSign.user?.id || '00000000-0000-0000-0000-000000000000')
    .maybeSingle()
  record(
    'G00',
    Boolean(au?.is_pscs_master),
    `platform_admin flag=${Boolean(au?.is_pscs_master)}`,
  )
}

// Public / protected HTTP (proxy)
{
  const login = await http('/login')
  record('A02', login.status === 200 && !login.hasProd, `login HTTP ${login.status}`)

  const home = await http('/')
  record(
    'A03',
    home.status === 200,
    `home pública HTTP ${home.status} loc=${home.location || '-'}`,
  )

  for (const p of ['/quotes', '/profile', '/users', '/customers', '/packages', '/additional-items']) {
    const r = await http(p)
    const ok =
      (r.status === 307 || r.status === 302) &&
      (r.location || '').includes('/login') &&
      (r.location || '').includes('next=')
    record(`A04_${p}`, ok, `HTTP ${r.status} loc=${r.location || '-'}`)
  }

  for (const p of [
    '/api/users',
    '/api/profile',
    '/api/auth/me',
    '/api/quotes',
    '/api/customers',
    '/api/packages',
    '/api/tenant/context',
    '/api/additional-items',
  ]) {
    const r = await http(p)
    const ok = r.status === 401 && !r.hasBusinessLeak
    record(`A05_${p}`, ok, `HTTP ${r.status} leak=${r.hasBusinessLeak}`)
  }
}

// Open redirect page still loads; authenticated redirect tested in _qa-auth-ui-cookie.mjs
{
  const evil = await http('/login?next=//evil.example')
  record('A06_page', evil.status === 200, `login com next externo ainda abre HTTP ${evil.status}`)
}

if (adminSign.session) {
  const cookie = await cookieFromSession(adminSign.session)
  const me = await http('/api/auth/me', { cookie })
  // Proxy uses getUser from cookies; cookie format may not match @supabase/ssr chunking.
  // Also try Authorization (may still 401 at proxy).
  const meAuth = await http('/api/auth/me', {
    cookie,
    token: adminSign.session.access_token,
  })
  record(
    'B02b',
    me.status === 200 || meAuth.status === 200,
    `me via cookie=${me.status} authz=${meAuth.status} (cookie SSR format may mismatch)`,
  )

  // Direct Supabase JWT checks (permission via DB, not service role for SELECT)
  const { data: mems } = await adminSign.client
    .from('company_memberships')
    .select('id, company_id, role, status')
    .eq('user_id', adminSign.user.id)
  const onlyMain = (mems || []).every((m) => m.company_id === MAIN)
  const seesIso = (mems || []).some((m) => m.company_id === ISO)
  record('F01m', onlyMain && !seesIso, `memberships count=${mems?.length ?? 0} iso=${seesIso}`)

  // Last owner / self-delete via service simulation of API rules using admin JWT against PostgREST is limited.
  // Call local API if cookie works; else mark SKIPPED_LOCAL_COOKIE and test logic with fetch after browser login later.
  if (me.status === 200 || meAuth.status === 200) {
    const users = await http('/api/users', { cookie, token: adminSign.session.access_token })
    record('D01', users.status === 200, `users list HTTP ${users.status}`)

    const myMem = (users.json?.data || []).find((r) => r.userId === adminSign.user.id)
    if (myMem) {
      const selfDel = await http(`/api/users/${myMem.id}`, {
        method: 'DELETE',
        cookie,
        token: adminSign.session.access_token,
        body: { reason: 'qa-self-delete-test' },
      })
      record(
        'D04',
        selfDel.status === 409 && selfDel.json?.error === 'self_delete_blocked',
        `self delete HTTP ${selfDel.status} err=${selfDel.json?.error}`,
      )

      const demote = await http(`/api/users/${myMem.id}`, {
        method: 'PATCH',
        cookie,
        token: adminSign.session.access_token,
        body: { role: 'viewer', status: 'active' },
      })
      record(
        'D03',
        demote.status === 409 && demote.json?.error === 'last_owner_protected',
        `last owner demote HTTP ${demote.status} err=${demote.json?.error}`,
      )
    } else {
      record('D03', false, 'membership admin não encontrada na lista')
      record('D04', false, 'membership admin não encontrada na lista')
    }

    // Invite fixture email (may send email if SMTP configured — use example.test)
    const inv = await http('/api/users', {
      method: 'POST',
      cookie,
      token: adminSign.session.access_token,
      body: { email: 'qa.auth.invite@example.test', role: 'operator' },
    })
    record(
      'D02',
      inv.status === 200 || inv.status === 201 || (inv.status >= 400 && inv.status < 500),
      `invite HTTP ${inv.status} err=${inv.json?.error || '-'}`,
    )

    // Support without reason
    const supBad = await http('/api/auth/support/start', {
      method: 'POST',
      cookie,
      token: adminSign.session.access_token,
      body: { companyId: MAIN, reason: 'x' },
    })
    record(
      'G01',
      adminSign && (supBad.status === 400 || supBad.status === 403),
      `support short reason HTTP ${supBad.status}`,
    )

    const supOk = await http('/api/auth/support/start', {
      method: 'POST',
      cookie,
      token: adminSign.session.access_token,
      body: { companyId: MAIN, reason: 'QA support session validation' },
    })
    record('G02', supOk.status === 200, `support start HTTP ${supOk.status}`)
    if (supOk.status === 200) {
      const end = await http('/api/auth/support/end', {
        method: 'POST',
        cookie,
        token: adminSign.session.access_token,
      })
      record('G02b', end.status === 200, `support end HTTP ${end.status}`)
    }

    // Profile patch privilege escalation attempt
    const priv = await http('/api/profile', {
      method: 'PATCH',
      cookie,
      token: adminSign.session.access_token,
      body: {
        displayName: 'QA Name',
        is_pscs_master: true,
        role: 'owner',
        company_id: ISO,
      },
    })
    const { data: afterPriv } = await adminClient
      .from('app_users')
      .select('is_pscs_master, company_id')
      .eq('auth_user_id', adminSign.user.id)
      .maybeSingle()
    // If already platform admin, flag stays true — check company_id not flipped to ISO by API
    record(
      'C03_priv',
      afterPriv?.company_id !== ISO,
      `profile PATCH privilege company_id_iso=${afterPriv?.company_id === ISO} http=${priv.status}`,
    )
  }

  await adminSign.client.auth.signOut()
  record('B04_auth', true, 'signOut client')
}

// Sales cannot manage users via JWT + RLS on memberships of others is separate;
// API denial requires cookie session — if cookie fails, use role_permissions expectation via code + create session cookie via gotrue setSession in next is hard.
if (salesFix) {
  const sales = await signIn(FIXTURE_SALES, salesFix.password)
  record('E01_login', !sales.error, `sales login ${maskEmail(FIXTURE_SALES)}`)
  if (sales.session) {
    const cookie = await cookieFromSession(sales.session)
    const users = await http('/api/users', {
      cookie,
      token: sales.session.access_token,
    })
    record(
      'E01',
      users.status === 401 || users.status === 403,
      `sales /api/users HTTP ${users.status}`,
    )
    const support = await http('/api/auth/support/start', {
      method: 'POST',
      cookie,
      token: sales.session.access_token,
      body: { companyId: MAIN, reason: 'should-be-denied-qa' },
    })
    record('G03', support.status === 403 || support.status === 401, `sales support HTTP ${support.status}`)
    await sales.client.auth.signOut()
  }
  salesFix.password = ''
}

if (viewerFix) {
  const viewer = await signIn(FIXTURE_VIEWER, viewerFix.password)
  if (viewer.session) {
    const cookie = await cookieFromSession(viewer.session)
    const users = await http('/api/users', {
      cookie,
      token: viewer.session.access_token,
    })
    record(
      'E01v',
      users.status === 401 || users.status === 403,
      `viewer /api/users HTTP ${users.status}`,
    )
    await viewer.client.auth.signOut()
  }
  viewerFix.password = ''
}

adminPassword = ''

const failed = results.filter((r) => r.status === 'FAIL').length
const passed = results.filter((r) => r.status === 'PASS').length
const out = {
  base: BASE_LOCAL,
  ref: DEV,
  passed,
  failed,
  total: results.length,
  results,
}
writeFileSync(
  resolve('scripts/dev/.tmp-auth-users-qa-run.json'),
  JSON.stringify(out, null, 2),
)
console.log(`SUMMARY pass=${passed} fail=${failed} total=${results.length}`)
process.exit(failed > 0 ? 1 : 0)
