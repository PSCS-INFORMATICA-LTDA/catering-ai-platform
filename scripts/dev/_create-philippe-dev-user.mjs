/**
 * Cria usuario Auth no DEV + membership na empresa principal + valida sessao/RLS.
 * Senha temporaria: gravada em scripts/dev/.philippe-dev-temp-password.txt (gitignored).
 * NAO imprime a senha no stdout.
 */
import { createClient } from '@supabase/supabase-js'
import { randomBytes } from 'crypto'
import { readFileSync, writeFileSync, unlinkSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..', '..')
const DEV_REF = 'yasprgtlqclwsjcshtls'
const PROD_REF = 'eapwtirhevxrqinytans'
const EMAIL = 'philippe.dev@pscsinformatica.com.br'
const COMPANY_MAIN = '65fd576f-8d97-49ba-bf38-61bc1e94e94a'
const COMPANY_ISO = 'a1111111-1111-4111-8111-111111111111'
const ROLE = 'admin'
const PASS_FILE = join(__dirname, '.philippe-dev-temp-password.txt')

function maskEmail(email) {
  const [user, domain] = String(email).split('@')
  const u = user.length <= 2 ? '***' : user.slice(0, 2) + '***' + user.slice(-1)
  const d = domain.length <= 4 ? '****' : domain.slice(0, 2) + '***' + domain.slice(-4)
  return `${u}@${d}`
}

function loadEnv() {
  const env = readFileSync(join(ROOT, '.env.local'), 'utf8')
  const get = (k) => {
    const m = env.match(new RegExp(`^${k}=(.*)$`, 'm'))
    return m ? m[1].trim() : ''
  }
  return {
    url: get('NEXT_PUBLIC_SUPABASE_URL'),
    anon: get('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    service: get('SUPABASE_SERVICE_ROLE_KEY'),
  }
}

function assertDev(url) {
  const ref = (url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/) || [])[1] || 'none'
  if (ref === PROD_REF) {
    console.error('BLOQUEADO — PROD')
    process.exit(2)
  }
  if (ref !== DEV_REF) {
    console.error('BLOQUEADO — ref ' + ref)
    process.exit(2)
  }
  return ref
}

function genPassword() {
  // strong temp: 24 bytes url-safe
  return randomBytes(18).toString('base64url') + 'Aa1!'
}

async function findByEmail(admin) {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 50 })
    if (error) throw new Error(error.message)
    const hit = (data?.users || []).find(
      (u) => String(u.email || '').toLowerCase() === EMAIL.toLowerCase(),
    )
    if (hit) return hit
    if ((data?.users || []).length < 50) break
  }
  return null
}

async function upsertMembership(admin, userId) {
  const existing = await admin
    .from('company_memberships')
    .select('id')
    .eq('company_id', COMPANY_MAIN)
    .eq('user_id', userId)
    .maybeSingle()
  if (existing.data?.id) {
    const { error } = await admin
      .from('company_memberships')
      .update({ role: ROLE, active: true })
      .eq('id', existing.data.id)
    if (error) throw new Error('membership update: ' + error.message)
    return 'updated'
  }
  const { error } = await admin.from('company_memberships').insert({
    company_id: COMPANY_MAIN,
    user_id: userId,
    role: ROLE,
    active: true,
  })
  if (error) throw new Error('membership insert: ' + error.message)
  return 'inserted'
}

async function main() {
  const { url, anon, service } = loadEnv()
  const ref = assertDev(url)
  console.log('ref=' + ref)
  console.log('AMBIENTE=CATERING DEV')
  console.log('email_masked=' + maskEmail(EMAIL))

  const admin = createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  let user = await findByEmail(admin)
  let password = genPassword()
  let created = false

  if (user) {
    console.log('auth_user=EXISTS')
    // ensure confirmed
    if (!user.email_confirmed_at) {
      const { error } = await admin.auth.admin.updateUserById(user.id, {
        email_confirm: true,
      })
      if (error) throw new Error('confirm: ' + error.message)
      console.log('auth_email_confirmed=UPDATED')
    } else {
      console.log('auth_email_confirmed=YES')
    }
    // reset password to known temp for session validation
    const { error } = await admin.auth.admin.updateUserById(user.id, {
      password,
    })
    if (error) throw new Error('password reset: ' + error.message)
    console.log('auth_temp_password=RESET')
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email: EMAIL,
      password,
      email_confirm: true,
      user_metadata: {
        source: 'dev_fixture_membership',
        note: 'DEV only — temporary password file local',
      },
    })
    if (error) throw new Error('createUser: ' + error.message)
    user = data.user
    created = true
    console.log('auth_user=CREATED')
    console.log('auth_email_confirmed=YES')
  }

  writeFileSync(PASS_FILE, password + '\n', { encoding: 'utf8', mode: 0o600 })
  console.log('temp_password_file=scripts/dev/.philippe-dev-temp-password.txt')

  const m1 = await upsertMembership(admin, user.id)
  const m2 = await upsertMembership(admin, user.id)
  console.log('membership_1=' + m1)
  console.log('membership_2=' + m2)

  const mainCount = await admin
    .from('company_memberships')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('company_id', COMPANY_MAIN)
  const isoCount = await admin
    .from('company_memberships')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('company_id', COMPANY_ISO)
  console.log('membership_main_count=' + mainCount.count)
  console.log('membership_iso_count=' + isoCount.count)
  if (mainCount.count !== 1 || isoCount.count !== 0) {
    throw new Error('membership counts invalid')
  }
  console.log('MEMBERSHIP=PASS')
  console.log('ROLE=' + ROLE)

  // session + RLS
  const userClient = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: sign, error: signErr } = await userClient.auth.signInWithPassword({
    email: EMAIL,
    password,
  })
  password = null
  if (signErr || !sign?.session) {
    console.error('AUTH=FAIL ' + (signErr?.message || 'no session').slice(0, 100))
    process.exit(1)
  }
  console.log('AUTH=PASS')

  const authed = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${sign.session.access_token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const pkgsMain = await authed
    .from('packages')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', COMPANY_MAIN)
    .like('package_key', 'TEST-DEV-PKG-%')
  const pkgsIso = await authed
    .from('packages')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', COMPANY_ISO)
  const custMain = await authed
    .from('customers')
    .select('id', { count: 'exact', head: true })
    .eq('id', 'f2000000-0000-4000-8000-000000000001')
  const custIso = await authed
    .from('customers')
    .select('id', { count: 'exact', head: true })
    .eq('id', 'f2000000-0000-4000-8000-000000000099')
  const quoteMain = await authed
    .from('quotes')
    .select('id', { count: 'exact', head: true })
    .eq('id', 'f2200000-0000-4000-8000-000000000001')

  console.log('rls_packages_main=' + (pkgsMain.count ?? 'null'))
  console.log('rls_packages_iso=' + (pkgsIso.count ?? 'null'))
  console.log('rls_customer_main=' + (custMain.count ?? 'null'))
  console.log('rls_customer_iso=' + (custIso.count ?? 'null'))
  console.log('rls_quote_main=' + (quoteMain.count ?? 'null'))

  const mainVisible =
    (pkgsMain.count ?? 0) > 0 ||
    (custMain.count ?? 0) > 0 ||
    (quoteMain.count ?? 0) > 0
  const isoVisible = (pkgsIso.count ?? 0) > 0 || (custIso.count ?? 0) > 0

  console.log('TENANT_PRINCIPAL=' + (mainVisible ? 'PASS' : 'FAIL_OR_STRICT'))
  console.log('EMPRESA_ISOLAMENTO_VISIVEL=' + (isoVisible ? 'SIM' : 'NAO'))
  console.log(
    'RLS_MULTIEMPRESA=' +
      (!isoVisible && mainVisible
        ? 'PASS'
        : !isoVisible && !mainVisible
          ? 'PARTIAL_STRICT'
          : 'FAIL'),
  )

  await userClient.auth.signOut()
  console.log('created_flag=' + (created ? 'YES' : 'NO_EXISTING_RESET'))
  console.log('DONE')
}

main().catch((e) => {
  console.error('FAILED:', e.message || e)
  try {
    unlinkSync(PASS_FILE)
  } catch {}
  process.exit(1)
})
