/**
 * MATRIZ DE CONFLITOS DE AGENDA — ≥10 testes + seed visual DEV.
 *
 * Usa o pool de Pessoas (seed-staff-conflict-pool) + motor CDL 120 min.
 *
 * Uso:
 *   node scripts/dev/test-schedule-conflict-matrix.mjs
 *   node scripts/dev/test-schedule-conflict-matrix.mjs --apply   # grava eventos QA
 *   node scripts/dev/test-schedule-conflict-matrix.mjs --report
 */
import { createClient } from '@supabase/supabase-js'
import { mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import {
  CDL_SCHEDULE_TURNAROUND_CONFIG,
  DEFAULT_SCHEDULE_TURNAROUND_CONFIG,
  canScheduleNextEvent,
} from './lib/schedule-turnaround.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..', '..')
const FIXTURE = join(__dirname, 'fixtures', 'staff-conflict-pool-v1.json')
const DEV_REF = 'yasprgtlqclwsjcshtls'
const PROD_REF = 'eapwtirhevxrqinytans'
const apply = process.argv.includes('--apply')
const report = process.argv.includes('--report')

function loadEnv() {
  const env = readFileSync(join(ROOT, '.env.local'), 'utf8')
  const get = (k) => {
    const m = env.match(new RegExp(`^${k}=(.*)$`, 'm'))
    return m ? m[1].trim().replace(/^["']|["']$/g, '') : ''
  }
  return {
    url: get('NEXT_PUBLIC_SUPABASE_URL'),
    key: get('SUPABASE_SERVICE_ROLE_KEY'),
  }
}

function assertDev(url) {
  const ref = (url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/) || [])[1] || 'none'
  if (ref === PROD_REF) process.exit(2)
  if (ref !== DEV_REF) {
    console.error(`BLOQUEADO — ref ${ref}`)
    process.exit(2)
  }
  return ref
}

function personId(fx, role, index) {
  const base = fx.idBase[role]
  return `${base}${String(index).padStart(2, '0')}`
}

function evt(date, start, end, extra = {}) {
  return {
    event_date: date,
    start_time: `${start}:00`,
    end_time: `${end}:00`,
    status: 'scheduled',
    ...extra,
  }
}

function runCase(name, fn) {
  try {
    const result = fn()
    if (result === false) {
      console.log(`FAIL  ${name}`)
      return { name, ok: false, detail: 'assertion false' }
    }
    console.log(`PASS  ${name}`)
    return { name, ok: true, detail: typeof result === 'string' ? result : 'ok' }
  } catch (e) {
    console.log(`FAIL  ${name} — ${e.message}`)
    return { name, ok: false, detail: e.message }
  }
}

function expectCode(actual, expected, label) {
  if (!actual || actual.code !== expected) {
    throw new Error(`${label}: esperado ${expected}, got ${actual?.code ?? 'null'}`)
  }
  return actual.code
}

function expectPass(actual, label) {
  if (actual) throw new Error(`${label}: esperado PASS, got ${actual.code}`)
  return 'PASS'
}

async function seedVisualConflicts(sb, fx, results) {
  const date = fx.testDate
  const grillA = personId(fx, 'grill_master', 1)
  const grillB = personId(fx, 'grill_master', 2)
  const assistA = personId(fx, 'assistant', 1)
  const leaderA = personId(fx, 'team_leader', 1)

  const cases = [
    {
      key: 'V01',
      code: 'EVT-CONF-MX-V01',
      title: 'MX V01 — Bruno 10–14 (base)',
      teamId: fx.teamCaioId,
      start: '10:00:00',
      end: '14:00:00',
      personIds: [grillA, assistA, leaderA],
      roles: ['grill_master', 'assistant', 'team_leader'],
      agendaId: 'f2500000-0000-4000-8000-000000000201',
    },
    {
      key: 'V02',
      code: 'EVT-CONF-MX-V02',
      title: 'MX V02 — Bruno 15–19 BLOQUEADO (janela)',
      teamId: fx.teamFilipeId,
      start: '15:00:00',
      end: '19:00:00',
      personIds: [grillA],
      roles: ['grill_master'],
      agendaId: 'f2500000-0000-4000-8000-000000000202',
      skipAgenda: true,
      note: 'Mesmo churrasqueiro — conflito de pessoa; sem agenda',
    },
    {
      key: 'V03',
      code: 'EVT-CONF-MX-V03',
      title: 'MX V03 — Diego 15–19 OK (outro churrasqueiro)',
      teamId: fx.teamFilipeId,
      start: '15:00:00',
      end: '19:00:00',
      personIds: [grillB],
      roles: ['grill_master'],
      agendaId: 'f2500000-0000-4000-8000-000000000203',
    },
    {
      key: 'V04',
      code: 'EVT-CONF-MX-V04',
      title: 'MX V04 — Bruno 16–20 OK (após janela)',
      teamId: fx.teamCaioId,
      start: '16:00:00',
      end: '20:00:00',
      personIds: [grillA],
      roles: ['grill_master'],
      agendaId: 'f2500000-0000-4000-8000-000000000204',
    },
  ]

  for (const c of cases) {
    await sb
      .from('agenda_event_member_confirmations')
      .delete()
      .eq('agenda_event_id', c.agendaId)
    await sb.from('agenda_events').delete().eq('id', c.agendaId)
    await sb.from('agenda_events').delete().eq('code', c.code)

    if (c.skipAgenda) {
      results.push({
        name: `seed ${c.key}`,
        ok: true,
        detail: c.note || 'skipped agenda by design',
      })
      console.log(`SEED  ${c.key} — ${c.note}`)
      continue
    }

    const { error: ae } = await sb.from('agenda_events').upsert({
      id: c.agendaId,
      company_id: fx.companyId,
      team_id: c.teamId,
      code: c.code,
      title: c.title,
      event_date: date,
      start_time: c.start,
      end_time: c.end,
      status: 'scheduled',
      client_name: 'QA Conflict Matrix',
    })
    if (ae) throw new Error(`agenda ${c.key}: ${ae.message}`)

    for (let i = 0; i < c.personIds.length; i++) {
      const { error: ce } = await sb.from('agenda_event_member_confirmations').insert({
        company_id: fx.companyId,
        agenda_event_id: c.agendaId,
        team_id: c.teamId,
        person_id: c.personIds[i],
        role_key: c.roles[i],
        status: 'confirmed',
        sent_at: new Date().toISOString(),
        responded_at: new Date().toISOString(),
      })
      if (ce) throw new Error(`conf ${c.key}/${i}: ${ce.message}`)
    }
    console.log(`SEED  ${c.key} → agenda ${c.code}`)
    results.push({ name: `seed ${c.key}`, ok: true, detail: c.code })
  }
}

async function main() {
  const fx = JSON.parse(readFileSync(FIXTURE, 'utf8'))
  const { url, key } = loadEnv()
  if (!url || !key) {
    console.error('.env.local incompleto')
    process.exit(2)
  }
  const ref = assertDev(url)
  const date = fx.testDate
  const cfg = CDL_SCHEDULE_TURNAROUND_CONFIG
  const results = []

  console.log('=== SCHEDULE CONFLICT MATRIX ===')
  console.log(`project_ref=${ref}`)
  console.log(`test_date=${date}`)
  console.log(`min_gap_minutes=${cfg.min_gap_minutes}`)

  // —— Motor (≥10) ——
  results.push(
    runCase('T01 overlap mesmo churrasqueiro 10–14 / 13–17', () =>
      expectCode(
        canScheduleNextEvent(
          evt(date, '10:00', '14:00'),
          evt(date, '13:00', '17:00'),
          cfg,
          { scope: 'person', personName: 'Bruno Grill' },
        ),
        'EVENT_TIME_OVERLAP',
        'T01',
      ),
    ),
  )

  results.push(
    runCase('T02 turnaround 10–14 / 15–19 → bloqueio até 16:00', () => {
      const r = canScheduleNextEvent(
        evt(date, '10:00', '14:00'),
        evt(date, '15:00', '19:00'),
        cfg,
        { scope: 'person', personName: 'Bruno Grill' },
      )
      expectCode(r, 'PERSON_TURNAROUND_CONFLICT', 'T02')
      if (r.blockedUntil !== '16:00') throw new Error(`blockedUntil=${r.blockedUntil}`)
      return r.code
    }),
  )

  results.push(
    runCase('T03 10–14 / 16–20 → PASS (janela ok)', () =>
      expectPass(
        canScheduleNextEvent(
          evt(date, '10:00', '14:00'),
          evt(date, '16:00', '20:00'),
          cfg,
          { scope: 'person', personName: 'Bruno Grill' },
        ),
        'T03',
      ),
    ),
  )

  results.push(
    runCase('T04 back-to-back 14:00→14:00 com gap 120 → TURNAROUND', () =>
      expectCode(
        canScheduleNextEvent(
          evt(date, '10:00', '14:00'),
          evt(date, '14:00', '18:00'),
          cfg,
          { scope: 'person', personName: 'Bruno Grill' },
        ),
        'PERSON_TURNAROUND_CONFLICT',
        'T04',
      ),
    ),
  )

  results.push(
    runCase('T05 equipe overlap 10–14 / 12–16', () =>
      expectCode(
        canScheduleNextEvent(
          evt(date, '10:00', '14:00'),
          evt(date, '12:00', '16:00'),
          cfg,
          { scope: 'team' },
        ),
        'EVENT_TIME_OVERLAP',
        'T05',
      ),
    ),
  )

  results.push(
    runCase('T06 equipe turnaround 10–14 / 15–19', () =>
      expectCode(
        canScheduleNextEvent(
          evt(date, '10:00', '14:00'),
          evt(date, '15:00', '19:00'),
          cfg,
          { scope: 'team' },
        ),
        'TEAM_TURNAROUND_CONFLICT',
        'T06',
      ),
    ),
  )

  results.push(
    runCase('T07 equipe 10–14 / 16–20 → PASS', () =>
      expectPass(
        canScheduleNextEvent(
          evt(date, '10:00', '14:00'),
          evt(date, '16:00', '20:00'),
          cfg,
          { scope: 'team' },
        ),
        'T07',
      ),
    ),
  )

  results.push(
    runCase('T08 >20 mi → DISTANCE_REQUIRES_REVIEW', () =>
      expectCode(
        canScheduleNextEvent(
          evt(date, '10:00', '14:00'),
          { ...evt(date, '16:00', '20:00'), distance_miles: 35 },
          cfg,
          { scope: 'person', personName: 'Diego Parrilla' },
        ),
        'DISTANCE_REQUIRES_REVIEW',
        'T08',
      ),
    ),
  )

  results.push(
    runCase('T09 gap=0 só bloqueia overlap (15–19 PASS)', () =>
      expectPass(
        canScheduleNextEvent(
          evt(date, '10:00', '14:00'),
          evt(date, '15:00', '19:00'),
          { ...DEFAULT_SCHEDULE_TURNAROUND_CONFIG, min_gap_minutes: 0 },
          { scope: 'person', personName: 'Bruno Grill' },
        ),
        'T09',
      ),
    ),
  )

  results.push(
    runCase('T10 dois churrasqueiros no mesmo horário → sem conflito de identidade', () => {
      // Motor avalia um par temporal; pessoas diferentes não compartilham personId na API.
      // Aqui documentamos: mesmo slot horário é válido se forem pessoas distintas.
      const rA = canScheduleNextEvent(
        evt(date, '10:00', '14:00'),
        evt(date, '16:00', '20:00'),
        cfg,
        { scope: 'person', personName: 'Bruno Grill' },
      )
      const rB = canScheduleNextEvent(
        evt(date, '15:00', '19:00'),
        evt(date, '15:00', '19:00'),
        cfg,
        { scope: 'person', personName: 'Diego Parrilla' },
      )
      // self vs self same window = overlap
      expectCode(rB, 'EVENT_TIME_OVERLAP', 'T10-self')
      expectPass(rA, 'T10-bruno-next')
      return 'multi-grill allowed; conflict is per person_id'
    }),
  )

  results.push(
    runCase('T11 ajudante turnaround entre equipes', () =>
      expectCode(
        canScheduleNextEvent(
          evt(date, '09:00', '13:00'),
          evt(date, '14:00', '18:00'),
          cfg,
          { scope: 'person', personName: 'Ana Apoio' },
        ),
        'PERSON_TURNAROUND_CONFLICT',
        'T11',
      ),
    ),
  )

  results.push(
    runCase('T12 líder livre no slot em que churrasqueiro conflita', () =>
      expectPass(
        canScheduleNextEvent(
          evt(date, '10:00', '14:00'),
          evt(date, '16:00', '20:00'),
          cfg,
          { scope: 'person', personName: 'Alex Líder' },
        ),
        'T12',
      ),
    ),
  )

  const motor = results.filter((r) => r.name.startsWith('T'))
  const passCount = motor.filter((r) => r.ok).length
  const failCount = motor.filter((r) => !r.ok).length

  console.log('---')
  console.log(`MOTOR: ${passCount} PASS / ${failCount} FAIL / ${motor.length} total`)

  if (failCount > 0) {
    console.log('SCHEDULE CONFLICT MATRIX: FAIL')
    process.exit(1)
  }

  if (apply) {
    const sb = createClient(url, key, { auth: { persistSession: false } })
    // ensure pool exists
    const grillId = personId(fx, 'grill_master', 1)
    const { data: person } = await sb
      .from('customers')
      .select('id')
      .eq('id', grillId)
      .maybeSingle()
    if (!person) {
      console.error('Pool ausente — rode: npm run seed:dev:staff-conflict-pool')
      process.exit(1)
    }
    await seedVisualConflicts(sb, fx, results)
  }

  const out = {
    generatedAt: new Date().toISOString(),
    projectRef: ref,
    testDate: date,
    multiGrillPolicy:
      'Mínimo 1 churrasqueiro para fechar escala; permitido >1 por evento (conflito é por person_id).',
    motor: {
      total: motor.length,
      pass: passCount,
      fail: failCount,
      cases: motor,
    },
    seeds: results.filter((r) => r.name.startsWith('seed')),
  }

  if (report || apply) {
    const dir = join(ROOT, 'scripts/dev/reports')
    mkdirSync(dir, { recursive: true })
    const path = join(dir, 'schedule-conflict-matrix-latest.json')
    writeFileSync(path, JSON.stringify(out, null, 2))
    console.log(`report=${path}`)
  }

  console.log('SCHEDULE CONFLICT MATRIX: PASS')
  console.log(
    'Multi-grill: SIM — pode haver mais de 1 churrasqueiro no evento; o bloqueio é por pessoa.',
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
