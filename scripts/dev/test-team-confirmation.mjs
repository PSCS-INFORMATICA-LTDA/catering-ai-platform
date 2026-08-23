/**
 * TEAM CONFIRMATION — hash token + RPC público — DEV only
 */
import { createClient } from '@supabase/supabase-js'
import { createHash, randomBytes } from 'crypto'
import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..', '..')
const DEV_REF = 'yasprgtlqclwsjcshtls'
const PROD_REF = 'eapwtirhevxrqinytans'
const COMPANY = '65fd576f-8d97-49ba-bf38-61bc1e94e94a'
const TEAM = 'a1900000-0000-4000-8000-000000000001'
const PERSON = 'b2800000-0000-4000-8000-000000000091'

function loadEnv() {
  const env = readFileSync(join(ROOT, '.env.local'), 'utf8')
  const get = (k) => {
    const m = env.match(new RegExp(`^${k}=(.*)$`, 'm'))
    return m ? m[1].trim() : ''
  }
  return { url: get('NEXT_PUBLIC_SUPABASE_URL'), service: get('SUPABASE_SERVICE_ROLE_KEY') }
}

function assertDev(url) {
  const ref = (url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/) || [])[1] || 'none'
  if (ref === PROD_REF) process.exit(2)
  if (ref !== DEV_REF) process.exit(2)
}

function fail(m) {
  console.log(`TEAM CONFIRMATION: FAIL — ${m}`)
  process.exit(1)
}

async function main() {
  const { url, service } = loadEnv()
  assertDev(url)
  const sb = createClient(url, service, { auth: { persistSession: false } })

  await sb.from('operational_teams').upsert({
    id: TEAM,
    company_id: COMPANY,
    name: 'Equipe Teste Multi A',
    color: '#e21b1b',
    active: true,
  })
  await sb.from('customers').upsert({
    id: PERSON,
    company_id: COMPANY,
    full_name: 'TEST DEV — Pessoa Funções',
    ab_name: 'Pessoa Funções',
    phone: '+14075559991',
    is_team: true,
    active: true,
  })

  await sb
    .from('agenda_events')
    .delete()
    .eq('company_id', COMPANY)
    .eq('code', 'EVT-CONF-001')

  const { data: evt, error: evtErr } = await sb
    .from('agenda_events')
    .insert({
      company_id: COMPANY,
      team_id: TEAM,
      code: 'EVT-CONF-001',
      title: 'Confirmação individual test',
      event_date: '2027-09-01',
      start_time: '10:00:00',
      end_time: '14:00:00',
      status: 'scheduled',
    })
    .select('id')
    .single()
  if (evtErr) fail(evtErr.message)

  const token = randomBytes(32).toString('hex')
  const hash = createHash('sha256').update(token).digest('hex')
  const expires = new Date(Date.now() + 7 * 864e5).toISOString()

  await sb
    .from('agenda_event_member_confirmations')
    .delete()
    .eq('agenda_event_id', evt.id)

  const { data: conf, error: confErr } = await sb
    .from('agenda_event_member_confirmations')
    .insert({
      company_id: COMPANY,
      agenda_event_id: evt.id,
      team_id: TEAM,
      person_id: PERSON,
      role_key: 'grill_master',
      status: 'pending',
      token_hash: hash,
      token_expires_at: expires,
      sent_at: new Date().toISOString(),
    })
    .select('id')
    .single()
  if (confErr) fail(confErr.message)

  const { data: pub, error: pubErr } = await sb.rpc(
    'get_public_team_member_confirmation',
    { p_token: token },
  )
  if (pubErr) fail(pubErr.message)
  if (!pub?.found || !pub?.can_respond) fail('public get failed')

  const { data: resp, error: respErr } = await sb.rpc(
    'respond_to_team_member_confirmation',
    { p_token: token, p_response: 'confirmed' },
  )
  if (respErr) fail(respErr.message)
  if (!resp?.ok || resp.status !== 'confirmed') fail('confirm failed')

  const { data: idem } = await sb.rpc('respond_to_team_member_confirmation', {
    p_token: token,
    p_response: 'declined',
  })
  if (!idem?.ok || !idem?.idempotent) fail('idempotency failed')

  // cleanup
  await sb.from('agenda_event_member_confirmations').delete().eq('id', conf.id)
  await sb.from('agenda_events').delete().eq('id', evt.id)

  console.log('PASS  token hash lookup')
  console.log('PASS  confirm + idempotent')
  console.log('TEAM CONFIRMATION: PASS')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
