/**
 * Busca/filtros /api/users (DEV, JWT real).
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
  console.log('USERS SEARCH/FILTERS: FAIL — ref inválido')
  process.exit(1)
}

let adminPw = process.env.CATERING_DEV_USER_PASSWORD || ''
const pwFile = resolve('scripts/dev/.philippe-dev-temp-password.txt')
if (!adminPw && existsSync(pwFile)) adminPw = readFileSync(pwFile, 'utf8').trim()
if (!adminPw) {
  console.log('USERS SEARCH/FILTERS: FAIL — senha admin ausente')
  process.exit(1)
}

function fail(msg) {
  console.log('USERS SEARCH/FILTERS: FAIL — ' + msg)
  process.exit(1)
}

const svc = createClient(url, service, {
  auth: { persistSession: false, autoRefreshToken: false },
})

async function ensureUser(email, role, displayName, status = 'active') {
  const list = await svc.auth.admin.listUsers({ page: 1, perPage: 200 })
  let user = (list.data?.users || []).find(
    (u) => (u.email || '').toLowerCase() === email.toLowerCase(),
  )
  const pw = `QaFilter-${Math.random().toString(36).slice(2, 8)}-A1!`
  if (!user) {
    const created = await svc.auth.admin.createUser({
      email,
      password: pw,
      email_confirm: true,
      user_metadata: { qa_fixture: true, full_name: displayName },
    })
    if (created.error) fail(`create ${email}`)
    user = created.data.user
  }
  await svc.from('app_users').upsert(
    {
      auth_user_id: user.id,
      email,
      full_name: displayName,
      display_name: displayName,
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
      .update({ role, status, active: status === 'active' })
      .eq('id', mem.id)
  } else {
    await svc.from('company_memberships').insert({
      company_id: MAIN,
      user_id: user.id,
      role,
      status,
      active: status === 'active',
    })
  }
  return user.id
}

await ensureUser('qa.filter.alpha@example.test', 'sales', 'Alpha Filter Sales', 'active')
await ensureUser('qa.filter.beta@example.test', 'viewer', 'Beta Filter Viewer', 'suspended')
await ensureUser('qa.filter.gamma@example.test', 'finance', 'Gamma Filter Finance', 'inactive')

const client = createClient(url, anon, {
  auth: { persistSession: false, autoRefreshToken: false },
})
const { data, error } = await client.auth.signInWithPassword({
  email: ADMIN_EMAIL,
  password: adminPw,
})
adminPw = ''
if (error || !data.session) fail('admin login')

const cookie = `sb-${DEV}-auth-token=${encodeURIComponent(
  JSON.stringify({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    token_type: 'bearer',
    expires_in: data.session.expires_in,
    expires_at: data.session.expires_at,
  }),
)}`

async function users(qs) {
  const res = await fetch(`${BASE}/api/users?${qs}`, {
    headers: { Cookie: cookie, Accept: 'application/json' },
  })
  const json = await res.json()
  return { status: res.status, json }
}

{
  const r = await users('q=Alpha')
  if (r.status !== 200) fail(`search name ${r.status}`)
  if (!(r.json.data || []).some((x) => (x.name || '').includes('Alpha'))) {
    fail('search name miss')
  }
}

{
  const r = await users('q=qa.filter.beta')
  if (r.status !== 200) fail(`search email ${r.status}`)
  if (!(r.json.data || []).some((x) => (x.email || '').includes('qa.filter.beta'))) {
    fail('search email miss')
  }
}

{
  const r = await users('role=finance')
  if (r.status !== 200) fail(`role filter ${r.status}`)
  if (!(r.json.data || []).every((x) => x.role === 'finance')) fail('role filter leak')
}

{
  const r = await users('status=suspended')
  if (r.status !== 200) fail(`status filter ${r.status}`)
  if (!(r.json.data || []).every((x) => x.status === 'suspended')) fail('status filter leak')
}

{
  const r = await users('q=Alpha&role=sales&status=active')
  if (r.status !== 200) fail(`combo ${r.status}`)
  if ((r.json.data || []).length < 1) fail('combo empty')
}

{
  const r = await users('q=zzzz-no-such-user-qa')
  if (r.status !== 200) fail(`empty ${r.status}`)
  if ((r.json.data || []).length !== 0 || r.json.total !== 0) fail('empty expected 0')
}

{
  const r = await users('page=1&pageSize=1')
  if (r.status !== 200) fail(`page ${r.status}`)
  if ((r.json.data || []).length > 1) fail('pageSize ignored')
  if (!r.json.totalPages || r.json.totalPages < 1) fail('totalPages')
}

{
  const r = await users(`company_id=${ISO}`)
  if (r.status !== 403) fail(`spoof company expected 403 got ${r.status}`)
}

{
  const r = await users('role=not-a-role')
  if (r.status !== 400) fail(`bad role expected 400 got ${r.status}`)
}

await client.auth.signOut()
console.log('USERS SEARCH/FILTERS: PASS')
process.exit(0)
