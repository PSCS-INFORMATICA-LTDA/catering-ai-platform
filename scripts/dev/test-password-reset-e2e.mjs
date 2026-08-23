/**
 * Reset de senha E2E (DEV) — sem imprimir tokens/senhas.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, unlinkSync, writeFileSync } from 'fs'
import { resolve } from 'path'

const DEV = 'yasprgtlqclwsjcshtls'
const EMAIL = 'qa.auth.reset@example.test'
const MAIN = '65fd576f-8d97-49ba-bf38-61bc1e94e94a'
const TMP = resolve('scripts/dev/.tmp-reset-fixture-meta.json')

const envText = readFileSync('.env.local', 'utf8')
const get = (k) => ((envText.match(new RegExp(`^${k}=(.*)$`, 'm')) || [])[1] || '').trim()
const url = get('NEXT_PUBLIC_SUPABASE_URL')
const anon = get('NEXT_PUBLIC_SUPABASE_ANON_KEY')
const service = get('SUPABASE_SERVICE_ROLE_KEY')
const ref = (url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/) || [])[1]
if (ref !== DEV) {
  console.log('PASSWORD RESET E2E: FAIL — ref inválido')
  process.exit(1)
}

function fail(msg) {
  console.log('PASSWORD RESET E2E: FAIL — ' + msg)
  process.exit(1)
}

const admin = createClient(url, service, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const originalPw = `QaResetOrig-${Math.random().toString(36).slice(2, 10)}-A1!`
const newPw = `QaResetNew-${Math.random().toString(36).slice(2, 10)}-B2!`

const list = await admin.auth.admin.listUsers({ page: 1, perPage: 200 })
let user = (list.data?.users || []).find(
  (u) => (u.email || '').toLowerCase() === EMAIL,
)
if (!user) {
  const created = await admin.auth.admin.createUser({
    email: EMAIL,
    password: originalPw,
    email_confirm: true,
    user_metadata: { qa_fixture: true, full_name: 'QA Reset' },
  })
  if (created.error) fail('create fixture')
  user = created.data.user
} else {
  const upd = await admin.auth.admin.updateUserById(user.id, {
    password: originalPw,
    email_confirm: true,
  })
  if (upd.error) fail('reset fixture password')
}

await admin.from('app_users').upsert(
  {
    auth_user_id: user.id,
    email: EMAIL,
    full_name: 'QA Reset',
    display_name: 'QA Reset',
    preferred_language: 'pt',
    is_pscs_master: false,
    active: true,
  },
  { onConflict: 'auth_user_id' },
)

const { data: mem } = await admin
  .from('company_memberships')
  .select('id')
  .eq('company_id', MAIN)
  .eq('user_id', user.id)
  .maybeSingle()
if (!mem) {
  await admin.from('company_memberships').insert({
    company_id: MAIN,
    user_id: user.id,
    role: 'viewer',
    status: 'active',
    active: true,
  })
}

writeFileSync(TMP, JSON.stringify({ email: EMAIL, updatedAt: new Date().toISOString() }))

// Public forgot (neutral) — ignore rate limit as soft
const publicClient = createClient(url, anon, {
  auth: { persistSession: false, autoRefreshToken: false },
})
await publicClient.auth.resetPasswordForEmail(EMAIL, {
  redirectTo: 'http://localhost:3000/auth/callback?next=/auth/reset-password',
})

// Admin-controlled recovery link (server-side only)
const link = await admin.auth.admin.generateLink({
  type: 'recovery',
  email: EMAIL,
})
if (link.error || !link.data?.properties?.hashed_token) {
  fail('generate recovery link')
}
const tokenHash = link.data.properties.hashed_token
// never log tokenHash / action_link

const recoveryClient = createClient(url, anon, {
  auth: { persistSession: false, autoRefreshToken: false },
})
const verified = await recoveryClient.auth.verifyOtp({
  type: 'recovery',
  token_hash: tokenHash,
})
if (verified.error || !verified.data.session) fail('verify recovery otp')

// weak password
const weak = await recoveryClient.auth.updateUser({ password: '123' })
if (!weak.error) fail('weak password deveria falhar')

const strong = await recoveryClient.auth.updateUser({ password: newPw })
if (strong.error) fail('update password válida')

await recoveryClient.auth.signOut()

const oldLogin = await publicClient.auth.signInWithPassword({
  email: EMAIL,
  password: originalPw,
})
if (!oldLogin.error) fail('senha antiga ainda autentica')

const newLogin = await publicClient.auth.signInWithPassword({
  email: EMAIL,
  password: newPw,
})
if (newLogin.error || !newLogin.data.session) fail('nova senha não autentica')
await publicClient.auth.signOut()

// restore controlled password for fixture reuse
await admin.auth.admin.updateUserById(user.id, { password: originalPw })

try {
  unlinkSync(TMP)
} catch {
  /* ignore */
}

console.log('PASSWORD RESET E2E: PASS')
process.exit(0)
