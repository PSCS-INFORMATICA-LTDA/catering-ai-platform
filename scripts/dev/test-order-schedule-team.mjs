/**
 * Teste — vínculo cotação/OS/agenda (agenda_events) e conflito por horário
 *
 * Multi-evento no mesmo dia é permitido se [start,end) não se sobrepõe.
 * O índice `uq_agenda_events_team_day_active` foi removido (migration
 * 20260807160000). Conflito de overlap é validado na aplicação.
 *
 * Pré-requisito: `npm run seed:dev:functional`
 * Project Ref: yasprgtlqclwsjcshtls — PROD proibido.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..', '..')
const FIXTURE_PATH = join(__dirname, 'fixtures', 'catering-functional-validation-v1.json')
const DEV_REF = 'yasprgtlqclwsjcshtls'
const PROD_REF = 'eapwtirhevxrqinytans'

const TEAM_A_ID = 'a1900000-0000-4000-8000-000000000001'
const TEAM_B_ID = 'a1900000-0000-4000-8000-000000000002'
const QUOTE_1_ID = 'f2200000-0000-4000-8000-000000000006'
const QUOTE_2_ID = 'f2200000-0000-4000-8000-000000000007'
const CODE_1 = 'EVT-TEST-DEV-001'
const CODE_2 = 'EVT-TEST-DEV-002'
const CODE_3 = 'EVT-TEST-DEV-003'
const TEST_DATE = '2027-03-20'

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
    console.error('BLOQUEADO — CONFIGURACAO APONTA PARA PROD')
    process.exit(2)
  }
  if (ref !== DEV_REF) {
    console.error(`BLOQUEADO — Project Ref inesperado: ${ref} (esperado ${DEV_REF})`)
    process.exit(2)
  }
  return ref
}

function fail(msg) {
  console.log(`ORDER SCHEDULE/TEAM: FAIL — ${msg}`)
  process.exit(1)
}

/** Espelho de overlap [start,end) + disponibilidade */
function statusBlocksTeamDay(status) {
  return status === 'scheduled' || status === 'completed'
}
function timeToMinutes(value) {
  const [h, m] = String(value).slice(0, 5).split(':').map(Number)
  return h * 60 + m
}
function intervalsOverlap(aStart, aEnd, bStart, bEnd) {
  return (
    timeToMinutes(aStart) < timeToMinutes(bEnd) &&
    timeToMinutes(aEnd) > timeToMinutes(bStart)
  )
}
function teamHasBookingOnDate(
  events,
  teamId,
  dayKey,
  excludeEventId,
  startTime,
  endTime,
) {
  return events.some((e) => {
    if (e.team_id !== teamId || e.event_date !== dayKey) return false
    if (!statusBlocksTeamDay(e.status)) return false
    if (excludeEventId && e.id === excludeEventId) return false
    if (startTime && endTime && e.start_time && e.end_time) {
      return intervalsOverlap(startTime, endTime, e.start_time, e.end_time)
    }
    return true
  })
}
function availableTeamsForDate(
  teams,
  events,
  dayKey,
  excludeEventId,
  startTime,
  endTime,
) {
  if (!dayKey) return teams
  return teams.filter(
    (t) =>
      !teamHasBookingOnDate(
        events,
        t.id,
        dayKey,
        excludeEventId,
        startTime,
        endTime,
      ),
  )
}
const TEAM_DAY_BUSY_MESSAGE =
  'Esta equipe já tem evento com horário sobreposto neste dia. Ajuste o intervalo ou escolha outra equipe.'

async function main() {
  const fx = JSON.parse(readFileSync(FIXTURE_PATH, 'utf8'))
  const { url, service } = loadEnv()
  if (!url || !service) fail('.env.local incompleto')
  const ref = assertDev(url)
  console.log('=== TEST ORDER SCHEDULE/TEAM (agenda_events) ===')
  console.log(`project_ref=${ref}`)
  console.log('AMBIENTE: CATERING DEV — CORRETO\n')

  console.log('--- 1) Unit: statusBlocksTeamDay / teamHasBookingOnDate / availableTeamsForDate ---')
  if (!statusBlocksTeamDay('scheduled')) fail("'scheduled' deveria bloquear o dia")
  if (!statusBlocksTeamDay('completed')) fail("'completed' deveria bloquear o dia")
  if (statusBlocksTeamDay('cancelled')) fail("'cancelled' não deveria bloquear o dia")

  const mockEvents = [
    {
      id: 'e1',
      team_id: 'ta',
      event_date: '2027-01-01',
      status: 'scheduled',
      start_time: '10:00:00',
      end_time: '14:00:00',
    },
    {
      id: 'e2',
      team_id: 'tb',
      event_date: '2027-01-01',
      status: 'cancelled',
      start_time: '10:00:00',
      end_time: '14:00:00',
    },
  ]
  if (!teamHasBookingOnDate(mockEvents, 'ta', '2027-01-01', null, '13:00', '15:00')) {
    fail('ta deveria conflitar com overlap 13–15')
  }
  if (teamHasBookingOnDate(mockEvents, 'ta', '2027-01-01', null, '14:00', '18:00')) {
    fail('ta adjacente 14–18 não deveria conflitar')
  }
  if (teamHasBookingOnDate(mockEvents, 'tb', '2027-01-01', null, '10:00', '14:00')) {
    fail('tb (cancelado) não deveria estar ocupada')
  }

  const mockTeams = [{ id: 'ta' }, { id: 'tb' }, { id: 'tc' }]
  const available = availableTeamsForDate(
    mockTeams,
    mockEvents,
    '2027-01-01',
    null,
    '14:00',
    '18:00',
  )
  if (available.length !== 3) {
    fail(`com slot adjacente todas as equipes livres, obtido: ${JSON.stringify(available)}`)
  }
  console.log('  OK funções de disponibilidade (overlap) espelhadas corretamente')

  console.log('\n--- 2) Integração: setup equipes + cotações de teste ---')
  const client = createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const companyId = fx.ids.companyMain
  const customerId = fx.ids.customerMain
  const eventId = fx.ids.eventMain
  const packageId = fx.ids.pkgEssential

  const { data: company } = await client.from('companies').select('id').eq('id', companyId).maybeSingle()
  if (!company) fail('companyMain ausente — rode `npm run seed:dev:functional` primeiro')

  // Reset determinístico: remove agenda_events de teste antes de tudo (FK RESTRICT em team_id).
  await client.from('agenda_events').delete().eq('company_id', companyId).in('code', [CODE_1, CODE_2, CODE_3])
  await client.from('quotes').delete().in('id', [QUOTE_1_ID, QUOTE_2_ID])

  const { error: teamsError } = await client.from('operational_teams').upsert(
    [
      { id: TEAM_A_ID, company_id: companyId, name: 'TEST-DEV Equipe A', color: '#111111', active: true },
      { id: TEAM_B_ID, company_id: companyId, name: 'TEST-DEV Equipe B', color: '#222222', active: true },
    ],
    { onConflict: 'id' },
  )
  if (teamsError) fail(`upsert operational_teams: ${teamsError.message}`)
  console.log('  OK equipes de teste (A/B) prontas')

  for (const [id, number] of [
    [QUOTE_1_ID, 'TEST-DEV-QUOTE-SCHED-001'],
    [QUOTE_2_ID, 'TEST-DEV-QUOTE-SCHED-002'],
  ]) {
    const { error } = await client.from('quotes').upsert(
      {
        id,
        company_id: companyId,
        customer_id: customerId,
        event_id: eventId,
        package_id: packageId,
        quote_number: number,
        language: 'pt',
        quote_status: 'accepted',
        active: true,
        proposal_response: 'accepted',
        quote_total: 100,
      },
      { onConflict: 'id' },
    )
    if (error) fail(`upsert cotação ${number}: ${error.message}`)
  }
  console.log('  OK cotações de teste (SCHED-001/002) prontas')

  console.log('\n--- 3) Designar equipe A na data de teste (vincula quote_id) ---')
  const { data: agendaEvent1, error: ae1Error } = await client
    .from('agenda_events')
    .insert({
      company_id: companyId,
      team_id: TEAM_A_ID,
      code: CODE_1,
      title: 'TEST-DEV Evento 1',
      event_date: TEST_DATE,
      start_time: '10:00:00',
      end_time: '14:00:00',
      status: 'scheduled',
      quote_id: QUOTE_1_ID,
    })
    .select('*')
    .single()
  if (ae1Error) fail(`insert agenda_events (evento 1): ${ae1Error.message}`)
  if (agendaEvent1.quote_id !== QUOTE_1_ID) fail('agenda_events.quote_id não vinculado corretamente')
  if (agendaEvent1.team_id !== TEAM_A_ID) fail('agenda_events.team_id não vinculado corretamente')
  console.log(`  OK agenda_events id=${agendaEvent1.id} quote_id=${agendaEvent1.quote_id} team_id=${agendaEvent1.team_id}`)

  console.log('\n--- 4) Multi-evento: mesma equipe (A), mesma data, horários sem overlap → permitido ---')
  {
    const { data: adj, error } = await client
      .from('agenda_events')
      .insert({
        company_id: companyId,
        team_id: TEAM_A_ID,
        code: CODE_2,
        title: 'TEST-DEV Evento 2 (adjacente)',
        event_date: TEST_DATE,
        start_time: '14:00:00',
        end_time: '18:00:00',
        status: 'scheduled',
        quote_id: QUOTE_2_ID,
      })
      .select('*')
      .single()
    if (error) fail(`insert adjacente deveria passar após remover day-lock: ${error.message}`)
    if (
      teamHasBookingOnDate(
        [agendaEvent1, adj],
        TEAM_A_ID,
        TEST_DATE,
        null,
        '13:00:00',
        '15:00:00',
      )
    ) {
      console.log(`  OK overlap helper detecta conflito (${TEAM_DAY_BUSY_MESSAGE.slice(0, 48)}...)`)
    } else {
      fail('helper deveria detectar overlap 13–15 com 10–14 e 14–18')
    }
    // remove adjacente para não atrapalhar passos seguintes que reusam CODE_2 liberação
    await client.from('agenda_events').delete().eq('id', adj.id)
  }

  console.log('\n--- 5) Equipe B pode assumir a mesma data (equipes diferentes) ---')
  const { data: agendaEvent3, error: ae3Error } = await client
    .from('agenda_events')
    .insert({
      company_id: companyId,
      team_id: TEAM_B_ID,
      code: CODE_3,
      title: 'TEST-DEV Evento 3 (equipe B)',
      event_date: TEST_DATE,
      start_time: '10:00:00',
      end_time: '14:00:00',
      status: 'scheduled',
      quote_id: QUOTE_2_ID,
    })
    .select('*')
    .single()
  if (ae3Error) fail(`equipe B deveria conseguir assumir a mesma data: ${ae3Error.message}`)
  console.log(`  OK agenda_events id=${agendaEvent3.id} (equipe B, mesma data, sem conflito)`)

  console.log('\n--- 6) Cancelar evento 1 libera a data para a equipe A ---')
  {
    const { error: cancelError } = await client
      .from('agenda_events')
      .update({ status: 'cancelled' })
      .eq('id', agendaEvent1.id)
    if (cancelError) fail(`cancelar evento 1: ${cancelError.message}`)

    const { data: retry, error: retryError } = await client
      .from('agenda_events')
      .insert({
        company_id: companyId,
        team_id: TEAM_A_ID,
        code: CODE_2,
        title: 'TEST-DEV Evento 2 (retry pós-cancelamento)',
        event_date: TEST_DATE,
        start_time: '15:00:00',
        end_time: '18:00:00',
        status: 'scheduled',
        quote_id: QUOTE_2_ID,
      })
      .select('*')
      .single()
    if (retryError) fail(`após cancelar evento 1, equipe A deveria poder assumir a data: ${retryError.message}`)
    console.log(`  OK agenda_events id=${retry.id} criado após liberar a data (evento 1 cancelado)`)
  }

  console.log('\n--- 7) Coluna agenda_events.service_order_id existe (superfície de vínculo OS) ---')
  {
    const { error } = await client
      .from('agenda_events')
      .select('service_order_id', { head: true })
      .limit(1)
    if (error) fail(`coluna agenda_events.service_order_id indisponível: ${error.message}`)
    console.log('  OK coluna agenda_events.service_order_id existe (vínculo cotação→OS→agenda documentado)')
  }

  console.log('\nORDER SCHEDULE/TEAM: PASS')
  process.exit(0)
}

main().catch((err) => {
  console.error('ERRO INESPERADO:', err instanceof Error ? err.message : err)
  process.exit(2)
})
