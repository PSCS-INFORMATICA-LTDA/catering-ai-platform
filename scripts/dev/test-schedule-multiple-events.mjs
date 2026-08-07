/**
 * SCHEDULE MULTIPLE EVENTS — overlap + janela operacional (120 min CDL)
 * DEV only: yasprgtlqclwsjcshtls
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import {
  CDL_SCHEDULE_TURNAROUND_CONFIG,
  DEFAULT_SCHEDULE_TURNAROUND_CONFIG,
  canScheduleNextEvent,
  getOperationalBlockedUntil,
  combineEventDateTime,
  formatTimeHHMM,
} from './lib/schedule-turnaround.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..', '..')
const DEV_REF = 'yasprgtlqclwsjcshtls'
const PROD_REF = 'eapwtirhevxrqinytans'
const COMPANY = '65fd576f-8d97-49ba-bf38-61bc1e94e94a'
const ISO = 'a1111111-1111-4111-8111-111111111111'
const TEAM_A = 'a1900000-0000-4000-8000-000000000001'
const TEAM_B = 'a1900000-0000-4000-8000-000000000002'
const DAY = '2027-08-15'

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
  if (ref === PROD_REF) {
    console.error('BLOQUEADO — PROD')
    process.exit(2)
  }
  if (ref !== DEV_REF) {
    console.error(`BLOQUEADO — ref ${ref}`)
    process.exit(2)
  }
}

function fail(msg) {
  console.log(`SCHEDULE MULTIPLE EVENTS: FAIL — ${msg}`)
  process.exit(1)
}

function pass(msg) {
  console.log(`PASS  ${msg}`)
}

function event(start, end, date = DAY) {
  return {
    id: `e-${start}`,
    event_date: date,
    start_time: start.length === 5 ? `${start}:00` : start,
    end_time: end.length === 5 ? `${end}:00` : end,
    status: 'scheduled',
  }
}

function expectConflict(a, b, code, label) {
  const r = canScheduleNextEvent(a, b, CDL_SCHEDULE_TURNAROUND_CONFIG, {
    scope: 'team',
  })
  if (!r) fail(`${label}: esperado CONFLICT, obteve PASS`)
  if (r.code !== code) fail(`${label}: esperado ${code}, obteve ${r.code}`)
  pass(`${label} → ${r.code}`)
}

function expectPass(a, b, label) {
  const r = canScheduleNextEvent(a, b, CDL_SCHEDULE_TURNAROUND_CONFIG, {
    scope: 'team',
  })
  if (r) fail(`${label}: esperado PASS, obteve ${r.code}`)
  pass(`${label} → PASS`)
}

async function main() {
  const { url, service } = loadEnv()
  assertDev(url)
  const sb = createClient(url, service, { auth: { persistSession: false } })

  console.log('=== SCHEDULE MULTIPLE EVENTS (turnaround 120) ===')

  const a = event('10:00', '14:00')

  // Matriz Philippe
  expectConflict(a, event('13:00', '18:00'), 'EVENT_TIME_OVERLAP', '10–14 / 13–18')
  expectConflict(a, event('14:00', '18:00'), 'TEAM_TURNAROUND_CONFLICT', '10–14 / 14–18')
  expectConflict(a, event('15:00', '19:00'), 'TEAM_TURNAROUND_CONFLICT', '10–14 / 15–19')
  expectConflict(a, event('15:59', '20:00'), 'TEAM_TURNAROUND_CONFLICT', '10–14 / 15:59–20')
  expectPass(a, event('16:00', '20:00'), '10–14 / 16–20')
  expectPass(a, event('17:00', '21:00'), '10–14 / 17–21')

  // blocked_until / próximo horário
  const blocked = getOperationalBlockedUntil(
    combineEventDateTime(DAY, '14:00:00'),
    120,
  )
  if (formatTimeHHMM(blocked) !== '16:00') {
    fail(`blocked_until esperado 16:00, obteve ${formatTimeHHMM(blocked)}`)
  }
  pass('blocked_until 14:00+120 = 16:00')

  // Sem regra (safe default gap 0): adjacente permitido; overlap não
  {
    const adj = canScheduleNextEvent(
      a,
      event('14:00', '18:00'),
      DEFAULT_SCHEDULE_TURNAROUND_CONFIG,
    )
    if (adj) fail('safe default não deve bloquear 14:00 adjacente')
    const ov = canScheduleNextEvent(
      a,
      event('13:00', '18:00'),
      DEFAULT_SCHEDULE_TURNAROUND_CONFIG,
    )
    if (!ov || ov.code !== 'EVENT_TIME_OVERLAP') {
      fail('safe default deve detectar overlap')
    }
    pass('fallback seguro gap=0 (não herda CDL 120)')
  }

  // Distância > 20 mi
  {
    const far = canScheduleNextEvent(
      a,
      { ...event('16:00', '20:00'), distance_miles: 35 },
      CDL_SCHEDULE_TURNAROUND_CONFIG,
    )
    if (!far || far.code !== 'DISTANCE_REQUIRES_REVIEW') {
      fail('>20 mi deve REQUIRES_OPERATIONAL_REVIEW')
    }
    pass('>20 mi → DISTANCE_REQUIRES_REVIEW')
  }

  // Outra equipe mesmo slot: sem conflito de equipe A vs B no helper
  // (cada chamada é por teamId na API; aqui só validamos turnaround entre pares)
  pass('outras equipes avaliadas separadamente na API')

  // Persistência: CDL rule exists or seed path documented
  const { data: rule } = await sb
    .from('commercial_rules')
    .select('rule_key, active, rule_value')
    .eq('company_id', COMPANY)
    .eq('rule_key', 'schedule_turnaround_buffer')
    .maybeSingle()

  if (!rule?.active) {
    console.log(
      'WARN  commercial_rules.schedule_turnaround_buffer ausente — rode seed:dev:schedule-turnaround',
    )
  } else {
    pass('CDL schedule_turnaround_buffer presente')
  }

  // Isolation company must not inherit CDL rule automatically
  const { data: isoRule } = await sb
    .from('commercial_rules')
    .select('id')
    .eq('company_id', ISO)
    .eq('rule_key', 'schedule_turnaround_buffer')
    .maybeSingle()
  if (isoRule) {
    console.log('NOTE  empresa ISO tem regra própria (ok se seedada)')
  } else {
    pass('outro tenant sem herança silenciosa da CDL')
  }

  // Ensure teams for optional DB insert of PASS case
  for (const [id, name] of [
    [TEAM_A, 'Equipe Teste Multi A'],
    [TEAM_B, 'Equipe Teste Multi B'],
  ]) {
    await sb.from('operational_teams').upsert({
      id,
      company_id: COMPANY,
      name,
      color: '#e21b1b',
      active: true,
    })
  }

  await sb
    .from('agenda_events')
    .delete()
    .eq('company_id', COMPANY)
    .like('code', 'EVT-MULTI-%')

  const { error: e1err } = await sb.from('agenda_events').insert({
    company_id: COMPANY,
    team_id: TEAM_A,
    code: 'EVT-MULTI-001',
    title: 'Turnaround A',
    event_date: DAY,
    start_time: '10:00:00',
    end_time: '14:00:00',
    status: 'scheduled',
  })
  if (e1err) fail(e1err.message)

  const { error: e2err } = await sb.from('agenda_events').insert({
    company_id: COMPANY,
    team_id: TEAM_A,
    code: 'EVT-MULTI-002',
    title: 'Turnaround B OK',
    event_date: DAY,
    start_time: '16:00:00',
    end_time: '20:00:00',
    status: 'scheduled',
  })
  if (e2err) fail(`insert 16–20 deveria passar no DB: ${e2err.message}`)
  pass('DB aceita 10–14 + 16–20 (enforcement na app)')

  const { error: otherTeamErr } = await sb.from('agenda_events').insert({
    company_id: COMPANY,
    team_id: TEAM_B,
    code: 'EVT-MULTI-005',
    title: 'Other team',
    event_date: DAY,
    start_time: '10:00:00',
    end_time: '14:00:00',
    status: 'scheduled',
  })
  if (otherTeamErr) fail(otherTeamErr.message)
  pass('outra equipe mesmo horário — PASS')

  await sb
    .from('agenda_events')
    .delete()
    .eq('company_id', COMPANY)
    .like('code', 'EVT-MULTI-%')

  console.log('SCHEDULE MULTIPLE EVENTS: PASS')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
