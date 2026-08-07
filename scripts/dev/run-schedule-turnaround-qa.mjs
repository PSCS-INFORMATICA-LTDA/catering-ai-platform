/**
 * QA operacional — 4 ordens DEV para validar janela entre eventos.
 *
 * Gera OS reais + agenda (quando permitido) e avalia o motor de conflito.
 *
 * Uso:
 *   node scripts/dev/run-schedule-turnaround-qa.mjs --apply
 *
 * Project Ref: yasprgtlqclwsjcshtls — PROD bloqueado.
 */
import { createClient } from '@supabase/supabase-js'
import { createHash, randomBytes } from 'crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import {
  CDL_SCHEDULE_TURNAROUND_CONFIG,
  canScheduleNextEvent,
} from './lib/schedule-turnaround.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..', '..')
const FIXTURE = join(__dirname, 'fixtures', 'schedule-turnaround-qa-v1.json')
const DEV_REF = 'yasprgtlqclwsjcshtls'
const PROD_REF = 'eapwtirhevxrqinytans'
const apply = process.argv.includes('--apply')

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
  console.error(`SCHEDULE TURNAROUND QA: FAIL — ${msg}`)
  process.exit(1)
}

function teamIdOf(fx, team) {
  if (team === 'caio') return fx.teamCaioId
  if (team === 'filipe') return fx.teamFilipeId
  fail(`team desconhecido: ${team}`)
}

function personIdOf(fx, person) {
  if (person === 'philippe') return fx.personPhilippeId
  if (person === 'joao') return fx.personJoaoId
  fail(`person desconhecida: ${person}`)
}

async function cleanupCase(sb, companyId, c) {
  await sb
    .from('agenda_event_member_confirmations')
    .delete()
    .eq('agenda_event_id', c.ids.agendaEventId)
  await sb.from('agenda_events').delete().eq('id', c.ids.agendaEventId)
  await sb.from('agenda_events').delete().eq('code', c.eventCode)
  await sb
    .from('quotes')
    .update({ accepted_version_id: null, converted_service_order_id: null })
    .eq('id', c.ids.quoteId)
  await sb.from('service_orders').delete().eq('id', c.ids.serviceOrderId)
  await sb.from('quote_versions').delete().eq('id', c.ids.quoteVersionId)
  await sb.from('quotes').delete().eq('id', c.ids.quoteId)
  await sb.from('events').delete().eq('id', c.ids.eventId)
}

async function upsertOrderBundle(sb, fx, c) {
  const teamId = teamIdOf(fx, c.team)
  const { error: evErr } = await sb.from('events').upsert(
    {
      id: c.ids.eventId,
      company_id: fx.companyId,
      customer_id: fx.customerId,
      event_name: `QA TURN — ${c.label}`,
      event_date: fx.testDate,
      start_time: c.start,
      end_time: c.end,
      address_line: `TESTE DEV QA TURN ${c.key}`,
      city: 'Orlando',
      state: 'FL',
      postal_code: '32801',
      country: 'US',
      adults_count: 40,
      children_count: 0,
      billable_guests: 40,
      total_guests: 40,
      active: true,
      notes: `schedule-turnaround-qa-v1 ${c.key}`,
    },
    { onConflict: 'id' },
  )
  if (evErr) fail(`events ${c.key}: ${evErr.message}`)

  const snapshot = {
    schema_version: 1,
    quote_total: 100,
    qa_case: c.key,
    label: c.label,
  }

  const { error: qErr } = await sb.from('quotes').upsert(
    {
      id: c.ids.quoteId,
      company_id: fx.companyId,
      customer_id: fx.customerId,
      event_id: c.ids.eventId,
      package_id: fx.packageId,
      quote_number: c.quoteNumber,
      language: 'pt',
      quote_status: 'accepted',
      proposal_response: 'accepted',
      source: 'schedule-turnaround-qa-v1',
      active: true,
      adult_count: 40,
      children_under_3_count: 0,
      children_4_to_12_count: 0,
      physical_guest_count: 40,
      billable_guest_count: 40,
      package_total: 100,
      additional_total: 0,
      quote_total: 100,
      reservation_percentage: 30,
      reservation_amount: 30,
      balance_due: 70,
      currency_code: 'USD',
      reservation_confirmed_at: new Date().toISOString(),
      converted_service_order_id: null,
      accepted_version_id: null,
    },
    { onConflict: 'id' },
  )
  if (qErr) fail(`quotes ${c.key}: ${qErr.message}`)

  const { error: verErr } = await sb.from('quote_versions').insert({
    id: c.ids.quoteVersionId,
    company_id: fx.companyId,
    quote_id: c.ids.quoteId,
    version_number: 1,
    language: 'pt',
    currency_code: 'USD',
    quote_total: 100,
    commercial_snapshot: snapshot,
    schema_version: 1,
    is_current: true,
    accepted_at: new Date().toISOString(),
  })
  if (verErr) fail(`quote_versions ${c.key}: ${verErr.message}`)

  await sb
    .from('quotes')
    .update({ accepted_version_id: c.ids.quoteVersionId })
    .eq('id', c.ids.quoteId)

  const { error: osErr } = await sb.from('service_orders').insert({
    id: c.ids.serviceOrderId,
    company_id: fx.companyId,
    service_order_number: c.serviceOrderNumber,
    quote_id: c.ids.quoteId,
    quote_version_id: c.ids.quoteVersionId,
    event_id: c.ids.eventId,
    customer_id: fx.customerId,
    status: 'planned',
    event_date: fx.testDate,
    start_time: c.start,
    end_time: c.end,
    address_line: `TESTE DEV QA TURN ${c.key}`,
    city: 'Orlando',
    state: 'FL',
    postal_code: '32801',
    physical_guest_count: 40,
    billable_guest_count: 40,
    currency_code: 'USD',
    package_total: 100,
    additional_total: 0,
    mileage_fee: 0,
    discount_amount: 0,
    reservation_amount: 30,
    balance_due: 70,
    service_order_total: 100,
    commercial_snapshot: snapshot,
    notes: `QA TURN ${c.key}: ${c.label}`,
  })
  if (osErr) fail(`service_orders ${c.key}: ${osErr.message}`)

  await sb
    .from('quotes')
    .update({
      converted_service_order_id: c.ids.serviceOrderId,
      designated_team_id: teamId,
    })
    .eq('id', c.ids.quoteId)

  let agenda = null
  if (c.scheduleAgenda) {
    const { data, error } = await sb
      .from('agenda_events')
      .insert({
        id: c.ids.agendaEventId,
        company_id: fx.companyId,
        team_id: teamId,
        code: c.eventCode,
        title: `QA TURN ${c.key}`,
        client_name: 'TEST DEV QA Turnaround',
        event_date: fx.testDate,
        start_time: c.start,
        end_time: c.end,
        status: 'scheduled',
        quote_id: c.ids.quoteId,
        // API Equipe/Escala busca por service_order_id (não só quote_id)
        service_order_id: c.ids.serviceOrderId,
        notes: `linked OS ${c.serviceOrderNumber}`,
      })
      .select('*')
      .single()
    if (error) fail(`agenda_events ${c.key}: ${error.message}`)
    agenda = data

    if (c.confirmPerson) {
      const token = randomBytes(24).toString('hex')
      const tokenHash = createHash('sha256').update(token).digest('hex')
      const { error: confErr } = await sb
        .from('agenda_event_member_confirmations')
        .insert({
          company_id: fx.companyId,
          agenda_event_id: c.ids.agendaEventId,
          team_id: teamId,
          person_id: personIdOf(fx, c.person),
          role_key: 'grill_master',
          status: 'confirmed',
          token_hash: tokenHash,
          token_expires_at: new Date(Date.now() + 7 * 864e5).toISOString(),
          sent_at: new Date().toISOString(),
          responded_at: new Date().toISOString(),
          notes: `QA TURN ${c.key}`,
        })
      if (confErr) fail(`confirmations ${c.key}: ${confErr.message}`)
    }
  }

  return { agenda }
}

async function main() {
  const fx = JSON.parse(readFileSync(FIXTURE, 'utf8'))
  const { url, key } = loadEnv()
  if (!url || !key) fail('.env.local incompleto')
  const ref = assertDev(url)
  const sb = createClient(url, key, { auth: { persistSession: false } })
  const cfg = CDL_SCHEDULE_TURNAROUND_CONFIG

  console.log('=== SCHEDULE TURNAROUND QA (4 cenários) ===')
  console.log(`mode=${apply ? 'apply' : 'dry-run'}`)
  console.log(`project_ref=${ref}`)
  console.log(`date=${fx.testDate}`)
  console.log(`gap=${cfg.min_gap_minutes}min radius=${cfg.base_radius_miles}mi`)
  console.log('')

  if (!apply) {
    for (const c of fx.cases) {
      console.log(`[${c.key}] ${c.serviceOrderNumber} — ${c.label}`)
    }
    console.log('\nDry-run OK. Use --apply para gravar no DEV.')
    process.exit(0)
  }

  // Pré-checagens
  for (const table of ['companies', 'customers', 'operational_teams']) {
    const { error } = await sb.from(table).select('id').limit(1)
    if (error) fail(`${table}: ${error.message}`)
  }
  const { data: company } = await sb
    .from('companies')
    .select('id')
    .eq('id', fx.companyId)
    .maybeSingle()
  if (!company) fail('CDL ausente — rode seed:dev:functional')

  for (const tid of [fx.teamCaioId, fx.teamFilipeId]) {
    const { data: t } = await sb
      .from('operational_teams')
      .select('id, name')
      .eq('id', tid)
      .maybeSingle()
    if (!t) fail(`equipe ${tid} ausente — rode seed:dev:agenda-teams`)
  }

  for (const pid of [fx.personPhilippeId, fx.personJoaoId]) {
    const { data: p } = await sb
      .from('customers')
      .select('id, ab_name')
      .eq('id', pid)
      .maybeSingle()
    if (!p) fail(`pessoa ${pid} ausente — rode seed:dev:team-scale`)
  }

  // Cleanup + create
  for (const c of fx.cases) await cleanupCase(sb, fx.companyId, c)

  const byKey = {}
  for (const c of fx.cases) {
    const created = await upsertOrderBundle(sb, fx, c)
    byKey[c.key] = { case: c, agenda: created.agenda }
  }

  const results = []
  for (const c of fx.cases) {
    let observed = {
      code: null,
      blockedUntil: null,
      nextAvailableStart: null,
      verdict: 'BASELINE',
      detail: 'Ordem âncora agendada',
    }

    if (c.compareAgainst) {
      const prev = byKey[c.compareAgainst].case
      const conflict = canScheduleNextEvent(
        {
          id: prev.ids.agendaEventId,
          event_date: fx.testDate,
          start_time: prev.start,
          end_time: prev.end,
          status: 'scheduled',
        },
        {
          event_date: fx.testDate,
          start_time: c.start,
          end_time: c.end,
          status: 'scheduled',
        },
        cfg,
        {
          scope: c.scope || 'team',
          personName: c.person === 'philippe' ? 'Philippe' : 'João',
        },
      )

      const expected = c.expectedCode ?? null
      const got = conflict?.code ?? null
      const ok = got === expected
      if (!ok) {
        fail(
          `${c.key}: esperado ${expected ?? 'PASS'}, obtido ${got ?? 'PASS'}`,
        )
      }
      if (c.expectedNext && conflict?.nextAvailableStart !== c.expectedNext) {
        fail(
          `${c.key}: next esperado ${c.expectedNext}, got ${conflict?.nextAvailableStart}`,
        )
      }

      observed = {
        code: got,
        blockedUntil: conflict?.blockedUntil ?? null,
        nextAvailableStart: conflict?.nextAvailableStart ?? null,
        verdict: got ? 'CONFLICT' : 'PASS',
        detail: got
          ? `Bloqueado — ${got}${
              conflict?.nextAvailableStart
                ? ` · Próximo horário disponível: ${conflict.nextAvailableStart}`
                : ''
            }`
          : 'Permitido — fora da janela operacional',
      }
    }

    results.push({
      case: c.key,
      service_order_number: c.serviceOrderNumber,
      quote_number: c.quoteNumber,
      event_code: c.eventCode,
      label: c.label,
      team: c.team,
      person: c.person,
      window: `${c.start.slice(0, 5)}–${c.end.slice(0, 5)}`,
      agenda_scheduled: Boolean(c.scheduleAgenda),
      ...observed,
    })
  }

  console.log('────────────────────────────────────────────────────────────')
  console.log('RESULTADO PARA PHILIPPE')
  console.log('────────────────────────────────────────────────────────────')
  for (const r of results) {
    console.log('')
    console.log(`#${r.case}  OS ${r.service_order_number}`)
    console.log(`     Cotação: ${r.quote_number}`)
    console.log(`     Evento:  ${r.event_code} · ${fx.testDate} · ${r.window}`)
    console.log(`     Equipe:  ${r.team} · Pessoa: ${r.person}`)
    console.log(`     Agenda:  ${r.agenda_scheduled ? 'SIM (scheduled)' : 'NÃO (bloqueada / não criada)'}`)
    console.log(`     Veredito:${r.verdict}${r.code ? ` (${r.code})` : ''}`)
    console.log(`     Detalhe: ${r.detail}`)
  }
  console.log('')
  console.log('────────────────────────────────────────────────────────────')
  console.log('Resumo rápido:')
  console.log('  T01 TEST-DEV-OS-TURN-T01 → âncora 10–14 Equipe Caio')
  console.log('  T02 TEST-DEV-OS-TURN-T02 → 15–19 BLOQUEADO (próximo 16:00)')
  console.log('  T03 TEST-DEV-OS-TURN-T03 → 16–20 PASS (agendado)')
  console.log('  T04 TEST-DEV-OS-TURN-T04 → Philippe outra equipe 15–19 BLOQUEADO')
  console.log('────────────────────────────────────────────────────────────')

  const reportDir = join(__dirname, 'reports')
  mkdirSync(reportDir, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const reportPath = join(reportDir, `schedule-turnaround-qa-${stamp}.json`)
  writeFileSync(
    reportPath,
    JSON.stringify(
      {
        fixture: fx.fixture,
        project_ref: ref,
        test_date: fx.testDate,
        config: cfg,
        results,
      },
      null,
      2,
    ),
  )
  console.log(`Relatório: ${reportPath}`)
  console.log('SCHEDULE TURNAROUND QA: PASS')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
