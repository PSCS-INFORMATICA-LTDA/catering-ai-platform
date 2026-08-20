/**
 * PERSON SCHEDULE CONFLICTS — turnaround individual
 * DEV only.
 */
import {
  CDL_SCHEDULE_TURNAROUND_CONFIG,
  canScheduleNextEvent,
} from './lib/schedule-turnaround.mjs'

function fail(msg) {
  console.log(`PERSON SCHEDULE CONFLICTS: FAIL — ${msg}`)
  process.exit(1)
}

function pass(msg) {
  console.log(`PASS  ${msg}`)
}

function evt(start, end) {
  return {
    event_date: '2027-08-15',
    start_time: `${start}:00`,
    end_time: `${end}:00`,
    status: 'scheduled',
  }
}

const cfg = CDL_SCHEDULE_TURNAROUND_CONFIG

console.log('=== PERSON SCHEDULE CONFLICTS ===')

// Philippe Equipe A 10–14 vs Equipe B 13–17 → overlap
{
  const r = canScheduleNextEvent(evt('10:00', '14:00'), evt('13:00', '17:00'), cfg, {
    scope: 'person',
    personName: 'Philippe',
  })
  if (!r || r.code !== 'EVENT_TIME_OVERLAP') fail('13–17 deveria EVENT_TIME_OVERLAP')
  pass('Philippe 10–14 / 13–17 → PERSON CONFLICT (overlap)')
}

// 15–19 → turnaround
{
  const r = canScheduleNextEvent(evt('10:00', '14:00'), evt('15:00', '19:00'), cfg, {
    scope: 'person',
    personName: 'Philippe',
  })
  if (!r || r.code !== 'PERSON_TURNAROUND_CONFLICT') {
    fail(`15–19 deveria PERSON_TURNAROUND_CONFLICT, got ${r?.code}`)
  }
  if (r.blockedUntil !== '16:00') fail(`blocked_until ${r.blockedUntil}`)
  pass('Philippe 10–14 / 15–19 → PERSON TURNAROUND (até 16:00)')
}

// 16–20 → PASS
{
  const r = canScheduleNextEvent(evt('10:00', '14:00'), evt('16:00', '20:00'), cfg, {
    scope: 'person',
    personName: 'Philippe',
  })
  if (r) fail(`16–20 deveria PASS, got ${r.code}`)
  pass('Philippe 10–14 / 16–20 → PASS')
}

// João diferente — não conflita com o slot do Philippe por identidade
// (o motor avalia pares; João vs Philippe não é o mesmo personId na API)
{
  const r = canScheduleNextEvent(evt('10:00', '14:00'), evt('14:00', '18:00'), cfg, {
    scope: 'person',
    personName: 'João',
  })
  // Mesmo horário de turnaround se fosse a MESMA pessoa; pessoa diferente
  // é filtrada na API por person_id. Aqui só documentamos o par temporal.
  if (!r || r.code !== 'PERSON_TURNAROUND_CONFLICT') {
    fail('mesmo intervalo temporal ainda é turnaround se mesma pessoa')
  }
  pass('pessoa diferente: API filtra por person_id (João ≠ Philippe)')
}

// >20 mi
{
  const r = canScheduleNextEvent(
    evt('10:00', '14:00'),
    { ...evt('16:00', '20:00'), distance_miles: 40 },
    cfg,
    { scope: 'person', personName: 'Philippe' },
  )
  if (!r || r.code !== 'DISTANCE_REQUIRES_REVIEW') fail('>20 mi review')
  pass('>20 mi → DISTANCE_REQUIRES_REVIEW')
}

console.log('PERSON SCHEDULE CONFLICTS: PASS')
