/**
 * DEV ONLY — cria/redefine usuário operator CDL para teste de segregação financeira.
 * Imprime e-mail + senha temporária uma vez. Arquivo gitignored.
 */
import { createClient } from '@supabase/supabase-js'
import { randomBytes } from 'crypto'
import { readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..', '..', '..')
const DEV = 'yasprgtlqclwsjcshtls'
const PROD = 'eapwtirhevxrqinytans'
const COMPANY = '65fd576f-8d97-49ba-bf38-61bc1e94e94a'
const EMAIL = 'ops.qa@cdl-dev.test'
const ROLE = 'operator'
const ORDER_ID = 'f2400000-0000-4000-8000-0000000000b1'
const PASS_FILE = join(__dirname, '..', '.ops-qa-temp-password.txt')

const env = readFileSync(join(ROOT, '.env.local'), 'utf8')
const get = (k) => ((env.match(new RegExp(`^${k}=(.*)$`, 'm')) || [])[1] || '').trim()
const url = get('NEXT_PUBLIC_SUPABASE_URL')
const anon = get('NEXT_PUBLIC_SUPABASE_ANON_KEY')
const service = get('SUPABASE_SERVICE_ROLE_KEY')
const ref = (url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/) || [])[1]

if (ref === PROD) {
  console.error('BLOQUEADO_PROD')
  process.exit(2)
}
if (ref !== DEV) {
  console.error('BLOQUEADO_REF=' + ref)
  process.exit(2)
}

const admin = createClient(url, service, {
  auth: { persistSession: false, autoRefreshToken: false },
})
// Senha fixa DEV para digitação/copy-paste no teste de Philippe (não usar em PROD).
const password =
  process.env.OPS_QA_PASSWORD?.trim() || 'OpsQaTest2026Dev!'

async function findByEmail(email) {
  for (let page = 1; page <= 30; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 50 })
    if (error) throw new Error(error.message)
    const hit = (data?.users || []).find(
      (u) => String(u.email || '').toLowerCase() === email.toLowerCase(),
    )
    if (hit) return hit
    if ((data?.users || []).length < 50) break
  }
  return null
}

let user = await findByEmail(EMAIL)
let created = false
if (!user) {
  const { data, error } = await admin.auth.admin.createUser({
    email: EMAIL,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: 'Ops QA CDL (financeiro bloqueado)',
      role_hint: ROLE,
    },
  })
  if (error) throw new Error('createUser: ' + error.message)
  user = data.user
  created = true
} else {
  const { error } = await admin.auth.admin.updateUserById(user.id, {
    password,
    email_confirm: true,
    user_metadata: {
      ...(user.user_metadata || {}),
      full_name: 'Ops QA CDL (financeiro bloqueado)',
      role_hint: ROLE,
    },
  })
  if (error) throw new Error('updateUser: ' + error.message)
}

const mem = await admin
  .from('company_memberships')
  .select('id, role, active')
  .eq('company_id', COMPANY)
  .eq('user_id', user.id)
  .maybeSingle()
if (mem.error) throw new Error(mem.error.message)

if (mem.data?.id) {
  const { error } = await admin
    .from('company_memberships')
    .update({ role: ROLE, active: true })
    .eq('id', mem.data.id)
  if (error) throw new Error('membership update: ' + error.message)
} else {
  const { error } = await admin.from('company_memberships').insert({
    company_id: COMPANY,
    user_id: user.id,
    role: ROLE,
    active: true,
  })
  if (error) throw new Error('membership insert: ' + error.message)
}

const { data: perms } = await admin
  .from('role_permissions')
  .select('permission_key')
  .eq('role_key', ROLE)
const keys = (perms || []).map((p) => p.permission_key)
const hasFin = keys.includes('orders.financial.view')
const hasOrders = keys.includes('orders.view')

const client = createClient(url, anon, {
  auth: { persistSession: false, autoRefreshToken: false },
})
const login = await client.auth.signInWithPassword({ email: EMAIL, password })
if (login.error || !login.data.session) {
  throw new Error('login failed: ' + (login.error?.message || 'no session'))
}

const { data: so } = await admin
  .from('service_orders')
  .select('id, service_order_number')
  .eq('id', ORDER_ID)
  .maybeSingle()

writeFileSync(PASS_FILE, password, 'utf8')
await client.auth.signOut()

console.log('=== CONTA OPERACIONAL DEV (CDL) ===')
console.log('ambiente=DEV yasprgtlqclwsjcshtls')
console.log('preview=https://catering-ai-agenda-dev.vercel.app')
console.log('email=' + EMAIL)
console.log('password=' + password)
console.log('role=' + ROLE)
console.log('user_id=' + user.id)
console.log('auth_action=' + (created ? 'created' : 'password_reset'))
console.log('orders.view=' + (hasOrders ? 'YES' : 'NO'))
console.log(
  'orders.financial.view=' + (hasFin ? 'YES_UNEXPECTED' : 'NO (esperado)'),
)
console.log('os_demo=' + (so?.service_order_number || ORDER_ID))
console.log(
  'os_url=https://catering-ai-agenda-dev.vercel.app/orders/' + ORDER_ID,
)
console.log('pass_file=' + PASS_FILE + ' (gitignored)')
console.log(
  'NOTE=Faça logout do PLATFORM ADMIN (ou use aba anônima) antes do teste.',
)
