/**
 * Localiza Auth user + upsert membership na empresa principal DEV.
 * Não imprime e-mail completo, senhas ou tokens.
 *
 * Uso:
 *   node scripts/dev/_membership-philippe-dev.mjs --locate
 *   node scripts/dev/_membership-philippe-dev.mjs --apply
 *   node scripts/dev/_membership-philippe-dev.mjs --validate-session --password-env CATERING_DEV_USER_PASSWORD
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..', '..')
const DEV_REF = 'yasprgtlqclwsjcshtls'
const PROD_REF = 'eapwtirhevxrqinytans'
const TARGET_EMAIL = 'philippe.dev@pscsinformatica.com.br'
const COMPANY_MAIN = '65fd576f-8d97-49ba-bf38-61bc1e94e94a'
const COMPANY_ISO = 'a1111111-1111-4111-8111-111111111111'
const COMPANY_SLUG = 'cdl-bbq-at-home-dev-validation'
const ROLE = 'admin' // menor privilégio suficiente no modelo (text role)

const args = process.argv.slice(2)
const doApply = args.includes('--apply')
const doLocate = args.includes('--locate') || doApply || args.includes('--validate-session')
const doValidateSession = args.includes('--validate-session')

function maskEmail(email) {
  const [user, domain] = String(email).split('@')
  if (!user || !domain) return '***'
  const u = user.length <= 2 ? '*'.repeat(user.length) : user.slice(0, 2) + '***' + user.slice(-1)
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

async function findUser(admin) {
  // list and filter exact email (admin getUserByEmail if available)
  if (typeof admin.auth.admin.getUserByEmail === 'function') {
    const { data, error } = await admin.auth.admin.getUserByEmail(TARGET_EMAIL)
    if (!error && data?.user) return { users: [data.user], method: 'getUserByEmail' }
  }
  const matches = []
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 50 })
    if (error) throw new Error('listUsers: ' + error.message)
    const users = data?.users || []
    for (const u of users) {
      if (String(u.email || '').toLowerCase() === TARGET_EMAIL.toLowerCase()) matches.push(u)
    }
    if (users.length < 50) break
  }
  return { users: matches, method: 'listUsers' }
}

async function probeMembershipColumns(admin) {
  const { data, error } = await admin.from('company_memberships').select('*').limit(1)
  if (error) return { error: error.message, columns: [] }
  return { error: null, columns: data?.[0] ? Object.keys(data[0]) : [] }
}

async function upsertMembership(admin, userId) {
  const existing = await admin
    .from('company_memberships')
    .select('id, company_id, user_id, role, active')
    .eq('company_id', COMPANY_MAIN)
    .eq('user_id', userId)
    .maybeSingle()

  if (existing.error && !/multiple|0 rows/i.test(existing.error.message)) {
    // maybeSingle error on 0 rows is ok in some versions
  }

  if (existing.data?.id) {
    const { error } = await admin
      .from('company_memberships')
      .update({ role: ROLE, active: true })
      .eq('id', existing.data.id)
    if (error) throw new Error('membership update: ' + error.message)
    return { action: 'updated', id: existing.data.id }
  }

  const attempts = [
    {
      company_id: COMPANY_MAIN,
      user_id: userId,
      role: ROLE,
      active: true,
    },
    {
      company_id: COMPANY_MAIN,
      user_id: userId,
      role: 'operator',
      active: true,
    },
  ]
  let last = null
  for (const row of attempts) {
    const { data, error } = await admin
      .from('company_memberships')
      .insert(row)
      .select('id')
      .maybeSingle()
    if (!error) return { action: 'inserted', id: data?.id, role: row.role }
    last = error.message
  }
  throw new Error('membership insert: ' + last)
}

async function countMemberships(admin, userId, companyId) {
  const { count, error } = await admin
    .from('company_memberships')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('company_id', companyId)
  if (error) return { ok: false, count: null, error: error.message }
  return { ok: true, count: count ?? 0 }
}

async function main() {
  const { url, anon, service } = loadEnv()
  const ref = assertDev(url)
  console.log('ref=' + ref)
  console.log('AMBIENTE=CATERING DEV')

  const admin = createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // company main
  const company = await admin
    .from('companies')
    .select('id, slug, company_name, active')
    .eq('id', COMPANY_MAIN)
    .maybeSingle()
  if (company.error || !company.data) {
    console.error('BLOQUEADO — empresa principal ausente')
    process.exit(1)
  }
  const slugOk = company.data.slug === COMPANY_SLUG
  console.log('company_main_present=YES')
  console.log('company_main_slug_ok=' + (slugOk ? 'YES' : 'NO'))
  console.log('company_main_active=' + (company.data.active ? 'YES' : 'NO'))

  const iso = await admin
    .from('companies')
    .select('id, slug')
    .eq('id', COMPANY_ISO)
    .maybeSingle()
  console.log('company_iso_present=' + (iso.data ? 'YES' : 'NO'))

  if (!doLocate) return

  const { users, method } = await findUser(admin)
  console.log('locate_method=' + method)
  console.log('match_count=' + users.length)
  if (users.length !== 1) {
    console.error('BLOQUEADO — esperado exatamente 1 usuario Auth correspondente')
    process.exit(1)
  }
  const user = users[0]
  const emailMasked = maskEmail(user.email || TARGET_EMAIL)
  console.log('auth_email_masked=' + emailMasked)
  console.log('auth_user_id_present=YES')
  console.log('auth_banned=' + (user.banned_until ? 'YES' : 'NO'))
  console.log('auth_email_confirmed=' + (user.email_confirmed_at ? 'YES' : 'NO'))
  console.log('auth_active=' + (!user.banned_until && user.email_confirmed_at ? 'YES' : 'CHECK'))

  if (!user.email_confirmed_at) {
    console.error('BLOQUEADO — e-mail Auth nao confirmado')
    process.exit(1)
  }
  if (user.banned_until) {
    console.error('BLOQUEADO — usuario banido')
    process.exit(1)
  }

  const cols = await probeMembershipColumns(admin)
  console.log(
    'membership_columns=' +
      (cols.error ? 'ERR' : cols.columns.length ? cols.columns.join(',') : 'empty_table_ok'),
  )

  if (doApply) {
    const r1 = await upsertMembership(admin, user.id)
    console.log('membership_apply1=' + r1.action + ' role=' + (r1.role || ROLE))
    const r2 = await upsertMembership(admin, user.id)
    console.log('membership_apply2=' + r2.action)
    const mainCount = await countMemberships(admin, user.id, COMPANY_MAIN)
    const isoCount = await countMemberships(admin, user.id, COMPANY_ISO)
    console.log('membership_main_count=' + mainCount.count)
    console.log('membership_iso_count=' + isoCount.count)
    if (mainCount.count !== 1) {
      console.error('BLOQUEADO — membership principal count != 1')
      process.exit(1)
    }
    if (isoCount.count !== 0) {
      console.error('BLOQUEADO — membership na empresa de isolamento')
      process.exit(1)
    }
    console.log('MEMBERSHIP=PASS')
  }

  if (doValidateSession) {
    const envName = args.includes('--password-env')
      ? args[args.indexOf('--password-env') + 1]
      : 'CATERING_DEV_USER_PASSWORD'
    const password = process.env[envName] || ''
    if (!password) {
      console.log('SESSION_VALIDATE=SKIP_NO_PASSWORD')
      console.log(
        'HINT: defina env ' +
          envName +
          ' e rode --validate-session (senha nao sera impressa)',
      )
      process.exit(0)
    }
    const userClient = createClient(url, anon, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: sign, error: signErr } = await userClient.auth.signInWithPassword({
      email: TARGET_EMAIL,
      password,
    })
    // clear password from memory best-effort
    if (signErr || !sign?.session) {
      console.error('AUTH=FAIL')
      console.error('auth_error_kind=' + (signErr?.message || 'no_session').slice(0, 80))
      process.exit(1)
    }
    console.log('AUTH=PASS')
    const token = sign.session.access_token
    const authed = createClient(url, anon, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    })

    // packages main vs iso via direct table (RLS)
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

    console.log('rls_packages_main=' + (pkgsMain.count ?? 'null') + (pkgsMain.error ? ' ERR' : ''))
    console.log('rls_packages_iso=' + (pkgsIso.count ?? 'null') + (pkgsIso.error ? ' ERR' : ''))
    console.log('rls_customer_main=' + (custMain.count ?? 'null') + (custMain.error ? ' ERR' : ''))
    console.log('rls_customer_iso=' + (custIso.count ?? 'null') + (custIso.error ? ' ERR' : ''))
    console.log('rls_quote_main=' + (quoteMain.count ?? 'null') + (quoteMain.error ? ' ERR' : ''))

    const isoVisible =
      (pkgsIso.count ?? 0) > 0 || (custIso.count ?? 0) > 0
    const mainVisible =
      (pkgsMain.count ?? 0) > 0 ||
      (custMain.count ?? 0) > 0 ||
      (quoteMain.count ?? 0) > 0

    // If RLS blocks everything including main, policies may not use membership yet
    console.log('TENANT_PRINCIPAL_DATA=' + (mainVisible ? 'PASS' : 'FAIL_OR_RLS_STRICT'))
    console.log('EMPRESA_ISOLAMENTO_VISIVEL=' + (isoVisible ? 'SIM' : 'NAO'))
    console.log(
      'RLS_MULTIEMPRESA=' +
        (!isoVisible && mainVisible
          ? 'PASS'
          : !isoVisible && !mainVisible
            ? 'NÃO TESTÁVEL (RLS bloqueia tudo / policies membership ausentes)'
            : 'FAIL'),
    )

    await userClient.auth.signOut()
  }
}

main().catch((e) => {
  console.error('FAILED:', e.message || e)
  process.exit(1)
})
