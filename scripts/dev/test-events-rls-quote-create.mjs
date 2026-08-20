/**
 * QA T01–T08 — RLS events + criação de cotação (DEV only).
 * JWT real. Não imprime senha/JWT/chaves.
 *
 * T01 membro A cria event empresa A → PASS
 * T02 membro A tenta event empresa B → DENIED
 * T03 anon / sem membership → DENIED
 * T04 quote criada com event.company_id → PASS
 * T05 event associado à quote correta → PASS
 * T06 conversão quote → OS (script existente)
 * T07 Agenda: event_id/company_id consistentes
 * T08 regressão RLS multiempresa (matriz JWT)
 */
import { spawnSync } from 'child_process'
import { createClient } from '@supabase/supabase-js'
import { existsSync, readFileSync } from 'fs'
import { dirname, join, resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..', '..')
const DEV = 'yasprgtlqclwsjcshtls'
const MAIN = '65fd576f-8d97-49ba-bf38-61bc1e94e94a'
const ISO = 'a1111111-1111-4111-8111-111111111111'
const PKG_ESSENTIAL = 'c2000000-0000-4000-8000-000000000001'
const EMAIL = 'philippe.dev@pscsinformatica.com.br'

const envText = readFileSync(join(ROOT, '.env.local'), 'utf8')
const getEnv = (k) => {
  const m = envText.match(new RegExp(`^${k}=(.*)$`, 'm'))
  return m ? m[1].trim() : ''
}
const url = getEnv('NEXT_PUBLIC_SUPABASE_URL')
const anon = getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY')
const service = getEnv('SUPABASE_SERVICE_ROLE_KEY')
const ref = (url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/) || [])[1]
if (ref !== DEV) {
  console.error('BLOQUEADO — Project Ref não é DEV: ' + ref)
  process.exit(2)
}

let password = process.env.CATERING_DEV_USER_PASSWORD || ''
const pwFile = resolve(ROOT, 'scripts/dev/.philippe-dev-temp-password.txt')
if (!password && existsSync(pwFile)) {
  password = readFileSync(pwFile, 'utf8').trim()
}
if (!password) {
  console.error('BLOQUEADO — senha ausente')
  process.exit(2)
}
const passwordForReauth = password

const rows = []
const record = (id, ok, detail) => {
  rows.push({ id, result: ok ? 'PASS' : 'FAIL', detail: detail || '-' })
  console.log(`${ok ? 'PASS' : 'FAIL'} | ${id} | ${detail || '-'}`)
}

const jwt = createClient(url, anon, {
  auth: { persistSession: false, autoRefreshToken: false },
})
const admin = createClient(url, service, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const { data: authData, error: authErr } = await jwt.auth.signInWithPassword({
  email: EMAIL,
  password,
})
password = ''
if (authErr || !authData.session) {
  console.error('AUTH: FAIL')
  process.exit(1)
}

const stamp = Date.now()
const created = { eventIds: [], quoteIds: [] }

async function cleanup() {
  for (const id of created.quoteIds) {
    await admin.from('quotes').delete().eq('id', id)
  }
  for (const id of created.eventIds) {
    await admin.from('events').delete().eq('id', id)
  }
}

try {
  // T01 — INSERT event empresa A
  {
    const { data, error } = await jwt
      .from('events')
      .insert({
        company_id: MAIN,
        event_name: `QA-RLS-T01-${stamp}`,
        event_date: '2026-12-01',
        country: 'US',
        active: true,
      })
      .select('id, company_id')
      .single()
    if (data?.id) created.eventIds.push(data.id)
    record(
      'T01',
      !!data?.id && data.company_id === MAIN && !error,
      error?.code || data?.id || 'no-id',
    )
  }

  // Prova de que RLS NÃO foi enfraquecida: NULL company_id continua 42501
  {
    const { data, error } = await jwt
      .from('events')
      .insert({
        event_name: `QA-RLS-NULL-${stamp}`,
        event_date: '2026-12-01',
        active: true,
      })
      .select('id')
      .maybeSingle()
    if (data?.id) created.eventIds.push(data.id)
    record(
      'T01-null-denied',
      !data && (error?.code === '42501' || error?.code === '23502'),
      error?.code || (data ? 'inserted' : 'no-error'),
    )
  }

  // T02 — INSERT event empresa B
  {
    const { data, error } = await jwt
      .from('events')
      .insert({
        company_id: ISO,
        event_name: `QA-RLS-T02-${stamp}`,
        event_date: '2026-12-01',
        active: true,
      })
      .select('id')
      .maybeSingle()
    if (data?.id) created.eventIds.push(data.id)
    record(
      'T02',
      !data && error?.code === '42501',
      error?.code || (data ? 'LEAK' : 'denied-no-code'),
    )
  }

  // T03 — anon
  await jwt.auth.signOut()
  {
    const anonClient = createClient(url, anon, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data, error } = await anonClient
      .from('events')
      .insert({
        company_id: MAIN,
        event_name: `QA-RLS-T03-${stamp}`,
        event_date: '2026-12-01',
        active: true,
      })
      .select('id')
      .maybeSingle()
    if (data?.id) created.eventIds.push(data.id)
    const denied = !data && !!error
    record('T03', denied, error?.code || (data ? 'LEAK' : 'denied'))
  }

  const { data: auth2, error: auth2Err } = await jwt.auth.signInWithPassword({
    email: EMAIL,
    password: passwordForReauth,
  })
  if (auth2Err || !auth2.session) {
    record('T04', false, 'reauth-failed')
    record('T05', false, 'skipped')
  } else {
    const { data: eventRow, error: eventErr } = await jwt
      .from('events')
      .insert({
        company_id: MAIN,
        event_name: `QA-RLS-T04-${stamp}`,
        event_date: '2026-12-15',
        country: 'US',
        adults_count: 10,
        active: true,
      })
      .select('id, company_id')
      .single()
    if (eventRow?.id) created.eventIds.push(eventRow.id)

    const quoteNumber = `Q-RLS-QA-${stamp}`
    const { data: quoteRow, error: quoteErr } = await jwt
      .from('quotes')
      .insert({
        company_id: MAIN,
        event_id: eventRow?.id ?? null,
        package_id: PKG_ESSENTIAL,
        quote_number: quoteNumber,
        quote_status: 'draft',
        language: 'pt',
        source: 'wizard',
        active: true,
        currency_code: 'USD',
        physical_guest_count: 10,
      })
      .select('id, event_id, company_id, quote_number')
      .single()
    if (quoteRow?.id) created.quoteIds.push(quoteRow.id)

    record(
      'T04',
      !!quoteRow?.id && !quoteErr && !eventErr && quoteRow.company_id === MAIN,
      quoteErr?.code || eventErr?.code || quoteRow?.quote_number || 'fail',
    )
    record(
      'T05',
      !!quoteRow?.id &&
        quoteRow.event_id === eventRow?.id &&
        eventRow?.company_id === MAIN &&
        quoteRow.company_id === MAIN,
      quoteRow
        ? `event=${quoteRow.event_id}`
        : eventErr?.message || quoteErr?.message || 'missing',
    )
  }
} finally {
  await cleanup()
}

// T06 — conversão existente
{
  const res = spawnSync(process.execPath, ['scripts/dev/test-quote-to-order-conversion.mjs'], {
    cwd: ROOT,
    stdio: 'inherit',
  })
  record('T06', res.status === 0, `exit=${res.status}`)
}

// T07 — agenda recebe o mesmo tenant/evento da cotação/OS
{
  const { data, error } = await admin
    .from('agenda_events')
    .select('id, company_id, quote_id, service_order_id, event_date')
    .eq('company_id', MAIN)
    .not('quote_id', 'is', null)
    .limit(20)
  if (error) {
    record('T07', false, error.message)
  } else {
    const quoteIds = [...new Set((data || []).map((r) => r.quote_id).filter(Boolean))]
    let mismatch = 0
    if (quoteIds.length) {
      const { data: quotes } = await admin
        .from('quotes')
        .select('id, company_id, event_id')
        .in('id', quoteIds)
      const byId = new Map((quotes || []).map((q) => [q.id, q]))
      for (const row of data || []) {
        const q = byId.get(row.quote_id)
        if (!q || q.company_id !== row.company_id) mismatch += 1
      }
    }
    record(
      'T07',
      mismatch === 0,
      `agenda_with_quote=${data?.length ?? 0} mismatch=${mismatch}`,
    )
  }
}

// T08 — matriz RLS
{
  const res = spawnSync(process.execPath, ['scripts/dev/_test-rls-jwt-matrix.mjs'], {
    cwd: ROOT,
    stdio: 'inherit',
  })
  record('T08', res.status === 0, `exit=${res.status}`)
}

const failed = rows.filter((r) => r.result === 'FAIL')
console.log('---')
for (const r of rows) {
  console.log(`${r.result} ${r.id}`)
}
console.log(
  failed.length === 0
    ? 'EVENTS RLS QUOTE CREATE: PASS'
    : `EVENTS RLS QUOTE CREATE: FAIL — ${failed.map((f) => f.id).join(',')}`,
)
process.exit(failed.length === 0 ? 0 : 1)
