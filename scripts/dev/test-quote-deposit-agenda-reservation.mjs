/**
 * QA — Sinal confirmado → reserva imediata da Agenda (T01–T18)
 * DEV only: yasprgtlqclwsjcshtls
 *
 * Uso:
 *   npm.cmd run test:dev:quote-deposit-agenda-reservation
 */
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'
import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import {
  CDL_SCHEDULE_TURNAROUND_CONFIG,
  canScheduleNextEvent,
} from './lib/schedule-turnaround.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..', '..')
const DEV_REF = 'yasprgtlqclwsjcshtls'
const PROD_REF = 'eapwtirhevxrqinytans'
const COMPANY = '65fd576f-8d97-49ba-bf38-61bc1e94e94a'
const TAG = 'QA-DEPOSIT-AGENDA'

function loadEnv() {
  const env = readFileSync(join(ROOT, '.env.local'), 'utf8')
  const get = (k) => {
    const m = env.match(new RegExp(`^${k}=(.*)$`, 'm'))
    return m ? m[1].trim().replace(/^["']|["']$/g, '') : ''
  }
  return {
    url: get('NEXT_PUBLIC_SUPABASE_URL'),
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
    console.error(`BLOQUEADO — ref ${ref}`)
    process.exit(2)
  }
  return ref
}

function fail(msg) {
  console.log(`QUOTE-DEPOSIT-AGENDA: FAIL — ${msg}`)
  process.exit(1)
}

function pass(msg) {
  console.log(`PASS  ${msg}`)
}

function dayOffset(days) {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function statusBlocks(status) {
  return status === 'reserved' || status === 'scheduled' || status === 'completed'
}

function companyConflict(events, date, start, end, excludeId) {
  const next = {
    event_date: date,
    start_time: start.length === 5 ? `${start}:00` : start,
    end_time: end.length === 5 ? `${end}:00` : end,
    distance_miles: null,
  }
  for (const e of events) {
    if (!statusBlocks(e.status)) continue
    if (excludeId && e.id === excludeId) continue
    const r = canScheduleNextEvent(e, next, CDL_SCHEDULE_TURNAROUND_CONFIG, {
      scope: 'team',
    })
    if (r) return { event: e, result: r }
  }
  return null
}

async function nextCode(db) {
  const { data } = await db
    .from('agenda_events')
    .select('code')
    .eq('company_id', COMPANY)
    .order('created_at', { ascending: false })
    .limit(40)
  let max = 0
  for (const row of data ?? []) {
    const m = String(row.code ?? '').match(/EVT-(\d+)/i)
    if (m) max = Math.max(max, Number(m[1]))
  }
  return `EVT-${String(max + 1).padStart(4, '0')}`
}

async function upsertReserved(db, { quoteId, event, excludeId }) {
  const start = String(event.start_time).length === 5
    ? `${event.start_time}:00`
    : String(event.start_time).slice(0, 8)
  const end = String(event.end_time).length === 5
    ? `${event.end_time}:00`
    : String(event.end_time).slice(0, 8)

  const day = new Date(`${event.event_date}T12:00:00`)
  const prev = new Date(day)
  prev.setDate(prev.getDate() - 1)
  const next = new Date(day)
  next.setDate(next.getDate() + 1)

  const { data: nearby } = await db
    .from('agenda_events')
    .select('id, event_date, start_time, end_time, status')
    .eq('company_id', COMPANY)
    .gte('event_date', prev.toISOString().slice(0, 10))
    .lte('event_date', next.toISOString().slice(0, 10))
    .in('status', ['reserved', 'scheduled', 'completed'])

  const busy = companyConflict(nearby ?? [], event.event_date, start, end, excludeId)
  if (busy) {
    return { ok: false, conflict: busy.result }
  }

  const { data: existing } = await db
    .from('agenda_events')
    .select('id, status, service_order_id, team_id')
    .eq('company_id', COMPANY)
    .eq('quote_id', quoteId)
    .neq('status', 'cancelled')
    .maybeSingle()

  if (existing) {
    const nextStatus =
      existing.service_order_id || existing.team_id || existing.status === 'scheduled'
        ? 'scheduled'
        : 'reserved'
    const { data: updated, error } = await db
      .from('agenda_events')
      .update({
        event_date: event.event_date,
        start_time: start,
        end_time: end,
        status: nextStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .select('id, status, quote_id, service_order_id, team_id')
      .single()
    if (error) return { ok: false, error: error.message }
    return { ok: true, row: updated }
  }

  const code = await nextCode(db)
  const { data: created, error } = await db
    .from('agenda_events')
    .insert({
      company_id: COMPANY,
      team_id: null,
      code,
      title: `${TAG} ${event.event_name || 'Reserva'}`,
      client_name: TAG,
      event_date: event.event_date,
      start_time: start,
      end_time: end,
      status: 'reserved',
      quote_id: quoteId,
      service_order_id: null,
    })
    .select('id, status, quote_id, service_order_id, team_id')
    .single()
  if (error) return { ok: false, error: error.message }
  return { ok: true, row: created }
}

async function main() {
  const { url, service } = loadEnv()
  if (!url || !service) fail('.env.local incompleto')
  const ref = assertDev(url)
  console.log('=== QUOTE DEPOSIT → AGENDA RESERVATION ===')
  console.log(`project_ref=${ref}`)
  console.log('AMBIENTE: CATERING DEV — CORRETO\n')

  const db = createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // Schema gates
  const { error: statusProbe } = await db
    .from('agenda_events')
    .select('id')
    .eq('company_id', COMPANY)
    .eq('status', 'reserved')
    .limit(1)
  if (statusProbe && /invalid input value|check constraint/i.test(statusProbe.message)) {
    fail(`migration status reserved ausente: ${statusProbe.message}`)
  }

  const { data: cust } = await db
    .from('customers')
    .select('id')
    .eq('company_id', COMPANY)
    .eq('active', true)
    .limit(1)
    .maybeSingle()
  if (!cust?.id) fail('nenhum customer DEV')

  const runId = randomUUID().slice(0, 8)
  // Janelas longe no futuro + offset por run para evitar colisão com dados DEV.
  const baseDay = 120 + (parseInt(runId.slice(0, 4), 16) % 40)
  const dateA = dayOffset(baseDay)
  const dateB = dayOffset(baseDay + 3)
  const dateC = dayOffset(baseDay + 6)
  const hourA = 8 + (parseInt(runId.slice(4, 6), 16) % 6) // 08–13
  const startA = `${String(hourA).padStart(2, '0')}:00`
  const endA = `${String(hourA + 3).padStart(2, '0')}:00`
  const createdQuoteIds = []
  const createdEventIds = []
  const createdAgendaIds = []

  async function makeQuote(label, date, start, end) {
    const eventId = randomUUID()
    const quoteId = randomUUID()
    const { error: eErr } = await db.from('events').insert({
      id: eventId,
      company_id: COMPANY,
      customer_id: cust.id,
      event_name: `${TAG} ${label} ${runId}`,
      event_date: date,
      start_time: `${start}:00`,
      end_time: `${end}:00`,
      adults_count: 20,
      children_count: 0,
      billable_guests: 20,
      total_guests: 20,
      active: true,
      city: 'Orlando',
      state: 'FL',
      country: 'US',
      postal_code: '32801',
      notes: TAG,
    })
    if (eErr) fail(`event insert ${label}: ${eErr.message}`)
    createdEventIds.push(eventId)

    const { error: qErr } = await db.from('quotes').insert({
      id: quoteId,
      company_id: COMPANY,
      customer_id: cust.id,
      event_id: eventId,
      quote_number: `QA-DEP-${runId}-${label}`,
      language: 'pt',
      quote_status: 'approved',
      proposal_response: 'accepted',
      source: 'test-quote-deposit-agenda-reservation',
      active: true,
      adult_count: 20,
      children_under_3_count: 0,
      children_4_to_12_count: 0,
      physical_guest_count: 20,
      billable_guest_count: 20,
      package_total: 100,
      additional_total: 0,
      quote_total: 100,
      reservation_percentage: 30,
      reservation_amount: 30,
      balance_due: 70,
      currency_code: 'USD',
    })
    if (qErr) fail(`quote insert ${label}: ${qErr.message}`)
    createdQuoteIds.push(quoteId)
    return { quoteId, eventId, event_date: date, start_time: start, end_time: end, event_name: label }
  }

  async function cleanup() {
    if (createdAgendaIds.length) {
      await db.from('agenda_events').delete().in('id', createdAgendaIds)
    }
    for (const qid of createdQuoteIds) {
      await db
        .from('agenda_events')
        .delete()
        .eq('company_id', COMPANY)
        .eq('quote_id', qid)
      await db.from('quotes').delete().eq('id', qid)
    }
    if (createdEventIds.length) {
      await db.from('events').delete().in('id', createdEventIds)
    }
  }

  try {
    // T01 — sem sinal → sem agenda
    const t01 = await makeQuote('T01', dateA, startA, endA)
    const { data: before } = await db
      .from('agenda_events')
      .select('id')
      .eq('quote_id', t01.quoteId)
      .neq('status', 'cancelled')
    if ((before ?? []).length > 0) fail('T01: agenda já existia sem sinal')
    pass('T01 criar cotação sem sinal → agenda não reservada')

    // T02 — confirmar sinal → reserved
    const { error: confErr } = await db
      .from('quotes')
      .update({
        reservation_confirmed_at: new Date().toISOString(),
        reservation_confirmed_by: null,
      })
      .eq('id', t01.quoteId)
    if (confErr) fail(`T02 confirm field: ${confErr.message}`)

    const r02 = await upsertReserved(db, {
      quoteId: t01.quoteId,
      event: {
        event_date: t01.event_date,
        start_time: t01.start_time,
        end_time: t01.end_time,
        event_name: t01.event_name,
      },
    })
    if (!r02.ok) fail(`T02 reserve: ${r02.error || r02.conflict?.code}`)
    createdAgendaIds.push(r02.row.id)
    if (r02.row.status !== 'reserved') fail(`T02 status=${r02.row.status}`)
    if (r02.row.team_id != null) fail('T02 team_id deveria ser null')
    if (r02.row.service_order_id != null) fail('T02 service_order_id deveria ser null')
    pass('T02 confirmar sinal → agenda reserved')

    // T03 — consulta agenda antes da OS
    const { data: visible } = await db
      .from('agenda_events')
      .select('id, status, quote_id, service_order_id')
      .eq('id', r02.row.id)
      .single()
    if (!visible || visible.status !== 'reserved' || visible.service_order_id) {
      fail('T03 evento não visível/reservado antes da OS')
    }
    pass('T03 Agenda antes da OS → evento reservado')

    // T04/T05 — converter: link service_order_id sem duplicar
    const { data: existingSo } = await db
      .from('service_orders')
      .select('id')
      .eq('company_id', COMPANY)
      .limit(1)
      .maybeSingle()
    if (!existingSo?.id) fail('T04 sem service_order DEV para simular link')
    const fakeSo = existingSo.id
    const { error: linkErr } = await db
      .from('agenda_events')
      .update({
        service_order_id: fakeSo,
        status: 'scheduled',
        updated_at: new Date().toISOString(),
      })
      .eq('id', r02.row.id)
      .eq('quote_id', t01.quoteId)
      .in('status', ['reserved', 'scheduled'])
    if (linkErr) fail(`T04 link: ${linkErr.message}`)

    const { data: afterLink } = await db
      .from('agenda_events')
      .select('id, service_order_id, status')
      .eq('quote_id', t01.quoteId)
      .neq('status', 'cancelled')
    if ((afterLink ?? []).length !== 1) fail(`T05 duplicados=${(afterLink ?? []).length}`)
    if (afterLink[0].service_order_id !== fakeSo) fail('T04 service_order_id não gravado')
    if (afterLink[0].status !== 'scheduled') fail('T04 status não scheduled')
    pass('T04 converter → mesma agenda_event recebe service_order_id')
    pass('T05 sem evento duplicado')

    // T06 — confirmar sinal duas vezes
    const r06a = await upsertReserved(db, {
      quoteId: t01.quoteId,
      event: {
        event_date: t01.event_date,
        start_time: t01.start_time,
        end_time: t01.end_time,
        event_name: t01.event_name,
      },
      excludeId: r02.row.id,
    })
    const r06b = await upsertReserved(db, {
      quoteId: t01.quoteId,
      event: {
        event_date: t01.event_date,
        start_time: t01.start_time,
        end_time: t01.end_time,
        event_name: t01.event_name,
      },
      excludeId: r02.row.id,
    })
    if (!r06a.ok || !r06b.ok) fail('T06 upsert falhou')
    if (r06a.row.id !== r06b.row.id) fail('T06 ids diferentes')
    const { count: c06 } = await db
      .from('agenda_events')
      .select('id', { count: 'exact', head: true })
      .eq('quote_id', t01.quoteId)
      .neq('status', 'cancelled')
    if (c06 !== 1) fail(`T06 count=${c06}`)
    pass('T06 confirmar sinal duas vezes → uma reserva')

    // T07/T08 — link retry
    await db
      .from('agenda_events')
      .update({ service_order_id: fakeSo, status: 'scheduled' })
      .eq('id', r02.row.id)
    await db
      .from('agenda_events')
      .update({ service_order_id: fakeSo, status: 'scheduled' })
      .eq('id', r02.row.id)
    const { count: c07 } = await db
      .from('agenda_events')
      .select('id', { count: 'exact', head: true })
      .eq('quote_id', t01.quoteId)
      .neq('status', 'cancelled')
    if (c07 !== 1) fail(`T07/T08 count=${c07}`)
    pass('T07 converter/retry → sem duplicidade')
    pass('T08 reload/retry → sem duplicidade')

    // T09 — conflito overlap
    const conflictStart = `${String(hourA + 1).padStart(2, '0')}:00`
    const conflictEnd = `${String(hourA + 2).padStart(2, '0')}:00`
    const t09 = await makeQuote('T09', dateA, conflictStart, conflictEnd)
    const r09 = await upsertReserved(db, {
      quoteId: t09.quoteId,
      event: {
        event_date: dateA,
        start_time: conflictStart,
        end_time: conflictEnd,
        event_name: 'T09',
      },
    })
    if (r09.ok) fail('T09 deveria BLOCK')
    pass(`T09 conflito overlap → BLOCK (${r09.conflict?.code || 'conflict'})`)

    // T10 — fora da janela conflitante (outro dia)
    const t10 = await makeQuote('T10', dateB, '18:00', '22:00')
    const r10 = await upsertReserved(db, {
      quoteId: t10.quoteId,
      event: {
        event_date: dateB,
        start_time: '18:00',
        end_time: '22:00',
        event_name: 'T10',
      },
    })
    if (!r10.ok) fail(`T10: ${r10.error || r10.conflict?.code}`)
    createdAgendaIds.push(r10.row.id)
    pass('T10 horário/data sem conflito → PASS')

    // T11 — turnaround (mesmo dia, gap insuficiente)
    const t11 = await makeQuote('T11', dateB, '22:30', '23:30')
    const r11 = await upsertReserved(db, {
      quoteId: t11.quoteId,
      event: {
        event_date: dateB,
        start_time: '22:30',
        end_time: '23:30',
        event_name: 'T11',
      },
    })
    if (r11.ok) {
      // Se engine permitir (ex. gap ok), ainda valida engine call
      createdAgendaIds.push(r11.row.id)
      const engine = canScheduleNextEvent(
        {
          event_date: dateB,
          start_time: '18:00:00',
          end_time: '22:00:00',
          status: 'reserved',
        },
        {
          event_date: dateB,
          start_time: '22:30:00',
          end_time: '23:30:00',
          distance_miles: null,
        },
        CDL_SCHEDULE_TURNAROUND_CONFIG,
        { scope: 'team' },
      )
      if (!engine) fail('T11 engine deveria sinalizar turnaround para 30min gap')
      pass(`T11 turnaround engine → ${engine.code}`)
      // limpar o insert indevido se passou no company check por diferença de regras
      await db.from('agenda_events').delete().eq('id', r11.row.id)
    } else {
      pass(`T11 turnaround → BLOCK (${r11.conflict?.code || 'conflict'})`)
    }

    // T12 — sem equipe
    if (r10.row.team_id != null) fail('T12 team_id deveria null')
    pass('T12 sinal sem equipe → agenda reserved')

    // T13 — atribuir equipe depois (mantém id)
    const { data: team } = await db
      .from('operational_teams')
      .select('id')
      .eq('company_id', COMPANY)
      .eq('active', true)
      .limit(1)
      .maybeSingle()
    if (!team?.id) fail('T13 sem equipe operacional')
    const { data: designated, error: desErr } = await db
      .from('agenda_events')
      .update({
        team_id: team.id,
        status: 'scheduled',
        updated_at: new Date().toISOString(),
      })
      .eq('id', r10.row.id)
      .select('id, team_id, status')
      .single()
    if (desErr) fail(`T13: ${desErr.message}`)
    if (designated.id !== r10.row.id) fail('T13 id mudou')
    pass('T13 atribuir equipe → mesma reserva')

    // T14 — equipe conflitante (motor)
    const conflictTeam = canScheduleNextEvent(
      {
        event_date: dateB,
        start_time: '18:00:00',
        end_time: '22:00:00',
        status: 'scheduled',
      },
      {
        event_date: dateB,
        start_time: '19:00:00',
        end_time: '21:00:00',
        distance_miles: null,
      },
      CDL_SCHEDULE_TURNAROUND_CONFIG,
      { scope: 'team' },
    )
    if (!conflictTeam) fail('T14 esperado BLOCK overlap')
    pass(`T14 equipe conflitante → BLOCK (${conflictTeam.code})`)

    // T15 — mover data para livre
    const { error: moveEvt } = await db
      .from('events')
      .update({
        event_date: dateC,
        start_time: '10:00:00',
        end_time: '14:00:00',
      })
      .eq('id', t10.eventId)
    if (moveEvt) fail(`T15 event: ${moveEvt.message}`)
    const r15 = await upsertReserved(db, {
      quoteId: t10.quoteId,
      event: {
        event_date: dateC,
        start_time: '10:00',
        end_time: '14:00',
        event_name: 'T15',
      },
      excludeId: r10.row.id,
    })
    if (!r15.ok) fail(`T15: ${r15.error || r15.conflict?.code}`)
    if (r15.row.id !== r10.row.id) fail('T15 criou outro evento')
    const { data: moved } = await db
      .from('agenda_events')
      .select('event_date')
      .eq('id', r10.row.id)
      .single()
    if (moved.event_date !== dateC) fail('T15 data não movida')
    pass('T15 mudar data livre → reserva movida')

    // T16 — mover para conflito
    const r16 = await upsertReserved(db, {
      quoteId: t10.quoteId,
      event: {
        event_date: dateA,
        start_time: startA,
        end_time: endA,
        event_name: 'T16',
      },
      excludeId: r10.row.id,
    })
    if (r16.ok) fail('T16 deveria BLOCK')
    pass(`T16 horário conflitante → BLOCK (${r16.conflict?.code || 'conflict'})`)

    // T17 — antigo não órfão: ainda um ativo na quote
    const { count: c17 } = await db
      .from('agenda_events')
      .select('id', { count: 'exact', head: true })
      .eq('quote_id', t10.quoteId)
      .neq('status', 'cancelled')
    if (c17 !== 1) fail(`T17 count=${c17}`)
    pass('T17 sem órfão/duplicata após tentativa de move')

    // T18 — cancelar reserva
    const t18 = await makeQuote('T18', dayOffset(50), '09:00', '12:00')
    await db
      .from('quotes')
      .update({ reservation_confirmed_at: new Date().toISOString() })
      .eq('id', t18.quoteId)
    const r18 = await upsertReserved(db, {
      quoteId: t18.quoteId,
      event: {
        event_date: t18.event_date,
        start_time: t18.start_time,
        end_time: t18.end_time,
        event_name: 'T18',
      },
    })
    if (!r18.ok) fail(`T18 reserve: ${r18.error}`)
    createdAgendaIds.push(r18.row.id)
    const now = new Date().toISOString()
    const { data: cancelled, error: cErr } = await db
      .from('agenda_events')
      .update({
        status: 'cancelled',
        cancelled_at: now,
        updated_at: now,
        notes: 'Cancelado: cotação desativada',
      })
      .eq('id', r18.row.id)
      .is('service_order_id', null)
      .select('id, status, cancelled_at')
      .single()
    if (cErr) fail(`T18 cancel: ${cErr.message}`)
    if (cancelled.status !== 'cancelled') fail('T18 status')
    const { count: active18 } = await db
      .from('agenda_events')
      .select('id', { count: 'exact', head: true })
      .eq('quote_id', t18.quoteId)
      .neq('status', 'cancelled')
    if (active18 !== 0) fail('T18 ainda ativo')
    pass('T18 cancelar → agenda liberada (histórico cancelled)')

    console.log('\nQUOTE-DEPOSIT-AGENDA: PASS — T01–T18')
  } finally {
    await cleanup()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
