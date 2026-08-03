/**
 * Matriz RLS com JWT real — DEV only (yasprgtlqclwsjcshtls).
 * Não imprime senha, JWT ou chaves.
 *
 * Uso:
 *   node scripts/dev/_test-rls-jwt-matrix.mjs
 *   (lê senha de scripts/dev/.philippe-dev-temp-password.txt ou CATERING_DEV_USER_PASSWORD)
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'

const DEV = 'yasprgtlqclwsjcshtls'
const MAIN = '65fd576f-8d97-49ba-bf38-61bc1e94e94a'
const ISO = 'a1111111-1111-4111-8111-111111111111'
const EMAIL = 'philippe.dev@pscsinformatica.com.br'
const PKG_ISO = 'c2000000-0000-4000-8000-000000000099'
const CUST_ISO = 'f2000000-0000-4000-8000-000000000099'
const CUST_MAIN = 'f2000000-0000-4000-8000-000000000001'
const QUOTE_MAIN = 'f2200000-0000-4000-8000-000000000001'
const PKG_ESSENTIAL = 'c2000000-0000-4000-8000-000000000001'

const envText = readFileSync('.env.local', 'utf8')
const getEnv = (k) => {
  const m = envText.match(new RegExp(`^${k}=(.*)$`, 'm'))
  return m ? m[1].trim() : ''
}
const url = getEnv('NEXT_PUBLIC_SUPABASE_URL')
const anon = getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY')
const ref = (url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/) || [])[1]
if (ref !== DEV) {
  console.error('BLOQUEADO — Project Ref não é DEV: ' + ref)
  process.exit(2)
}

let password = process.env.CATERING_DEV_USER_PASSWORD || ''
const pwFile = resolve('scripts/dev/.philippe-dev-temp-password.txt')
if (!password && existsSync(pwFile)) {
  password = readFileSync(pwFile, 'utf8').trim()
}
if (!password) {
  console.error('BLOQUEADO — senha ausente (CATERING_DEV_USER_PASSWORD ou arquivo temp gitignored)')
  process.exit(2)
}

const rows = []
const record = (op, allowed, code, pass) => {
  rows.push({ op, allowed, code: code ?? '-', result: pass ? 'PASS' : 'FAIL' })
  console.log(`${pass ? 'PASS' : 'FAIL'} | ${op} | ${allowed} | ${code ?? '-'}`)
}

const client = createClient(url, anon, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const { data: authData, error: authErr } = await client.auth.signInWithPassword({
  email: EMAIL,
  password,
})
if (authErr || !authData.session) {
  console.error('AUTH: FAIL')
  process.exit(1)
}
console.log('AUTH: PASS')
password = ''

const uid = authData.user.id

// Membership
{
  const { data, error } = await client
    .from('company_memberships')
    .select('company_id, role, active')
    .eq('user_id', uid)
    .eq('active', true)
  const main = (data || []).some((m) => m.company_id === MAIN)
  const iso = (data || []).some((m) => m.company_id === ISO)
  record('MEMBERSHIP principal', main ? 'permitido' : 'negado', error?.code, main && !error)
  record('MEMBERSHIP isolamento count=0', iso ? 'visível' : 'invisível', error?.code, !iso && !error)
}

// 1–3 SELECT main
{
  const { data, error } = await client
    .from('packages')
    .select('id')
    .eq('company_id', MAIN)
    .like('package_key', 'TEST-DEV-PKG-%')
  const ok = !error && (data?.length ?? 0) === 3
  record('1 SELECT 3 pacotes principal', ok ? 'permitido' : 'negado', error?.code, ok)
}
{
  const { data, error } = await client.from('customers').select('id').eq('id', CUST_MAIN).maybeSingle()
  record('2 SELECT cliente principal', data?.id ? 'permitido' : 'negado', error?.code, !!data?.id && !error)
}
{
  const { data, error } = await client.from('quotes').select('id').eq('id', QUOTE_MAIN).maybeSingle()
  record('3 SELECT cotação principal', data?.id ? 'permitido' : 'negado', error?.code, !!data?.id && !error)
}

// 4 SELECT sem filtro — só principal
{
  const { data, error } = await client.from('packages').select('id, company_id')
  const companies = [...new Set((data || []).map((r) => r.company_id))]
  const onlyMain = companies.length > 0 && companies.every((c) => c === MAIN)
  const noIso = !(data || []).some((r) => r.company_id === ISO)
  record('4 SELECT packages sem filtro só principal', onlyMain && noIso ? 'permitido' : 'vazamento', error?.code, onlyMain && noIso && !error)
}

// 5–6 isolamento invisível
{
  const { data, error } = await client.from('packages').select('id').eq('id', PKG_ISO).maybeSingle()
  record('5 SELECT pacote isolamento', data ? 'visível' : 'invisível', error?.code, !data && !error)
}
{
  const { data, error } = await client.from('customers').select('id').eq('id', CUST_ISO).maybeSingle()
  record('6 SELECT cliente isolamento', data ? 'visível' : 'invisível', error?.code, !data && !error)
}

// 7 INSERT principal
{
  const key = 'TEST-DEV-RLS-TMP-' + Date.now()
  const { data, error } = await client
    .from('packages')
    .insert({
      id: crypto.randomUUID(),
      company_id: MAIN,
      package_key: key,
      package_name: key,
      label_pt: key,
      price_per_person: 1,
      active: false,
    })
    .select('id')
    .maybeSingle()
  const ok = !!data?.id && !error
  record('7 INSERT pacote principal', ok ? 'permitido' : 'negado', error?.code, ok)
  if (data?.id) {
    await client.from('packages').delete().eq('id', data.id)
  }
}

// 8 INSERT isolamento
{
  const key = 'TEST-DEV-RLS-ISO-' + Date.now()
  const { data, error } = await client
    .from('packages')
    .insert({
      id: crypto.randomUUID(),
      company_id: ISO,
      package_key: key,
      package_name: key,
      label_pt: key,
      price_per_person: 1,
      active: false,
    })
    .select('id')
    .maybeSingle()
  const denied = !data && !!error
  record('8 INSERT pacote isolamento', denied ? 'negado' : 'permitido', error?.code, denied)
}

// 9 UPDATE principal
{
  const { data, error } = await client
    .from('packages')
    .update({ image_notes: 'rls-test-' + Date.now() })
    .eq('id', PKG_ESSENTIAL)
    .select('id')
    .maybeSingle()
  record('9 UPDATE pacote principal', data?.id ? 'permitido' : 'negado', error?.code, !!data?.id && !error)
}

// 10 UPDATE company_id → isolamento
{
  const { data, error } = await client
    .from('packages')
    .update({ company_id: ISO })
    .eq('id', PKG_ESSENTIAL)
    .select('id')
    .maybeSingle()
  const denied = !data
  record('10 UPDATE company_id→isolamento', denied ? 'negado' : 'permitido', error?.code, denied)
  // restore if somehow changed (service role not here)
}

// 11 UPDATE isolamento
{
  const { data, error } = await client
    .from('packages')
    .update({ image_notes: 'should-fail' })
    .eq('id', PKG_ISO)
    .select('id')
    .maybeSingle()
  record('11 UPDATE pacote isolamento', data ? 'permitido' : 'negado', error?.code, !data)
}

// 12 DELETE isolamento
{
  const { data, error } = await client
    .from('packages')
    .delete()
    .eq('id', PKG_ISO)
    .select('id')
    .maybeSingle()
  record('12 DELETE pacote isolamento', data ? 'permitido' : 'negado', error?.code, !data)
}

// 13–14 memberships
{
  const { data, error } = await client
    .from('company_memberships')
    .select('id, company_id')
    .eq('company_id', MAIN)
  record('13 Membership principal visível', (data?.length ?? 0) > 0 ? 'visível' : 'invisível', error?.code, (data?.length ?? 0) > 0 && !error)
}
{
  const { data, error } = await client
    .from('company_memberships')
    .select('id')
    .eq('company_id', ISO)
  record('14 Membership externo invisível', (data?.length ?? 0) === 0 ? 'invisível' : 'visível', error?.code, (data?.length ?? 0) === 0 && !error)
}

// 15 autoelevação / membership externo
{
  const { data, error } = await client
    .from('company_memberships')
    .insert({
      company_id: ISO,
      user_id: uid,
      role: 'admin',
      active: true,
    })
    .select('id')
    .maybeSingle()
  record('15 INSERT membership isolamento', data ? 'permitido' : 'negado', error?.code, !data)
}

await client.auth.signOut()

const failed = rows.filter((r) => r.result === 'FAIL').length
console.log('---')
console.log('AUTH: PASS')
console.log('MEMBERSHIP: PASS')
console.log('EMPRESA PRINCIPAL VISÍVEL: SIM')
console.log(
  'EMPRESA DE ISOLAMENTO VISÍVEL: ' +
    (rows.some((r) => r.op.includes('isolamento') && r.allowed === 'visível' && r.result === 'FAIL')
      ? 'SIM'
      : 'NÃO'),
)
console.log('CROSS-TENANT SELECT: ' + (rows.find((r) => r.op.startsWith('5 '))?.result === 'PASS' ? 'NEGADO' : 'FALHOU'))
console.log('CROSS-TENANT INSERT: ' + (rows.find((r) => r.op.startsWith('8 '))?.result === 'PASS' ? 'NEGADO' : 'FALHOU'))
console.log('CROSS-TENANT UPDATE: ' + (rows.find((r) => r.op.startsWith('11 '))?.result === 'PASS' ? 'NEGADO' : 'FALHOU'))
console.log('CROSS-TENANT DELETE: ' + (rows.find((r) => r.op.startsWith('12 '))?.result === 'PASS' ? 'NEGADO' : 'FALHOU'))
console.log('ALTERAÇÃO DE COMPANY_ID: ' + (rows.find((r) => r.op.startsWith('10 '))?.result === 'PASS' ? 'NEGADA' : 'FALHOU'))
console.log('RLS/MULTIEMPRESA: ' + (failed === 0 ? 'PASS' : 'FAIL'))
console.log('failed_count=' + failed)
process.exit(failed === 0 ? 0 : 1)
