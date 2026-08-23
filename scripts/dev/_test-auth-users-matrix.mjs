/**
 * Matriz básica de autenticação (DEV).
 * Requer usuário philippe.dev + senha temp gitignored.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'

const DEV = 'yasprgtlqclwsjcshtls'
const EMAIL = 'philippe.dev@pscsinformatica.com.br'
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

let failed = 0
function check(name, ok) {
  console.log(`${ok ? 'PASS' : 'FAIL'} | ${name}`)
  if (!ok) failed += 1
}

const bad = await client.auth.signInWithPassword({
  email: EMAIL,
  password: 'definitely-wrong-password-xxx',
})
check('login inválido negado', !!bad.error)

const good = await client.auth.signInWithPassword({ email: EMAIL, password })
password = ''
check('login válido', !good.error && !!good.data.session)

if (good.data.session) {
  const { data: mem } = await client
    .from('company_memberships')
    .select('id, role, status, active')
    .eq('user_id', good.data.user.id)
  check('membership visível autenticado', (mem?.length ?? 0) >= 1)

  await client.auth.signOut()
  check('logout', true)
}

console.log(failed === 0 ? 'AUTH USERS MATRIX: PASS' : 'AUTH USERS MATRIX: FAIL')
process.exit(failed === 0 ? 0 : 1)
