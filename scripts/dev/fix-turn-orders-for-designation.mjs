/**
 * Garante as 4 OS QA TURN usáveis para designação/confirmação:
 * - T01/T03: agenda com service_order_id + equipe
 * - T02/T04: OS existem (sem agenda — conflito esperado)
 * - T01: confirmações limpas para permitir "Enviar confirmações"
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const env = readFileSync(join(ROOT, '.env.local'), 'utf8')
const get = (k) => {
  const m = env.match(new RegExp(`^${k}=(.*)$`, 'm'))
  return m ? m[1].trim().replace(/^["']|["']$/g, '') : ''
}
const url = get('NEXT_PUBLIC_SUPABASE_URL')
if (!url.includes('yasprgtlqclwsjcshtls')) {
  console.error('Abort: só DEV')
  process.exit(2)
}
const sb = createClient(url, get('SUPABASE_SERVICE_ROLE_KEY'), {
  auth: { persistSession: false },
})

const CAIO = 'a1000000-0000-4000-8000-000000000003'
const FILIPE = 'a1000000-0000-4000-8000-000000000002'
const DATE = '2027-11-15'

const cases = [
  {
    key: 'T01',
    os: 'TEST-DEV-OS-TURN-T01',
    osId: 'f2400000-0000-4000-8000-000000000071',
    quoteId: 'f2200000-0000-4000-8000-000000000071',
    agendaId: 'f2500000-0000-4000-8000-000000000071',
    code: 'EVT-TURN-QA-T01',
    teamId: CAIO,
    start: '10:00:00',
    end: '14:00:00',
    schedule: true,
  },
  {
    key: 'T02',
    os: 'TEST-DEV-OS-TURN-T02',
    osId: 'f2400000-0000-4000-8000-000000000072',
    quoteId: 'f2200000-0000-4000-8000-000000000072',
    agendaId: 'f2500000-0000-4000-8000-000000000072',
    code: 'EVT-TURN-QA-T02',
    teamId: CAIO,
    start: '15:00:00',
    end: '19:00:00',
    schedule: false,
  },
  {
    key: 'T03',
    os: 'TEST-DEV-OS-TURN-T03',
    osId: 'f2400000-0000-4000-8000-000000000073',
    quoteId: 'f2200000-0000-4000-8000-000000000073',
    agendaId: 'f2500000-0000-4000-8000-000000000073',
    code: 'EVT-TURN-QA-T03',
    teamId: CAIO,
    start: '16:00:00',
    end: '20:00:00',
    schedule: true,
  },
  {
    key: 'T04',
    os: 'TEST-DEV-OS-TURN-T04',
    osId: 'f2400000-0000-4000-8000-000000000074',
    quoteId: 'f2200000-0000-4000-8000-000000000074',
    agendaId: 'f2500000-0000-4000-8000-000000000074',
    code: 'EVT-TURN-QA-T04',
    teamId: FILIPE,
    start: '15:00:00',
    end: '19:00:00',
    schedule: false,
  },
]

console.log('=== FIX TURN ORDERS FOR DESIGNATION ===')

for (const c of cases) {
  const { data: os, error: osErr } = await sb
    .from('service_orders')
    .select('id, service_order_number, quote_id, status')
    .eq('id', c.osId)
    .maybeSingle()
  if (osErr || !os) {
    console.error(`MISSING OS ${c.os} — rode npm run qa:dev:schedule-turnaround`)
    process.exit(1)
  }

  await sb
    .from('quotes')
    .update({
      designated_team_id: c.teamId,
      converted_service_order_id: c.osId,
    })
    .eq('id', c.quoteId)

  if (!c.schedule) {
    // Garante que não há agenda fantasma nos casos de conflito
    await sb
      .from('agenda_event_member_confirmations')
      .delete()
      .eq('agenda_event_id', c.agendaId)
    await sb.from('agenda_events').delete().eq('id', c.agendaId)
    await sb.from('agenda_events').delete().eq('code', c.code)
    console.log(`${c.os}: OS ok · sem agenda (conflito esperado)`)
    continue
  }

  const { data: existing } = await sb
    .from('agenda_events')
    .select('id, service_order_id, quote_id, team_id, status')
    .eq('id', c.agendaId)
    .maybeSingle()

  if (!existing) {
    const { error } = await sb.from('agenda_events').insert({
      id: c.agendaId,
      company_id: '65fd576f-8d97-49ba-bf38-61bc1e94e94a',
      team_id: c.teamId,
      code: c.code,
      title: `QA TURN ${c.key}`,
      client_name: 'TEST DEV QA Turnaround',
      event_date: DATE,
      start_time: c.start,
      end_time: c.end,
      status: 'scheduled',
      quote_id: c.quoteId,
      service_order_id: c.osId,
      notes: `linked OS ${c.os}`,
    })
    if (error) {
      console.error(`insert agenda ${c.key}: ${error.message}`)
      process.exit(1)
    }
    console.log(`${c.os}: agenda CRIADA + service_order_id`)
  } else {
    const { error } = await sb
      .from('agenda_events')
      .update({
        team_id: c.teamId,
        quote_id: c.quoteId,
        service_order_id: c.osId,
        status: 'scheduled',
        event_date: DATE,
        start_time: c.start,
        end_time: c.end,
        updated_at: new Date().toISOString(),
      })
      .eq('id', c.agendaId)
    if (error) {
      console.error(`update agenda ${c.key}: ${error.message}`)
      process.exit(1)
    }
    console.log(`${c.os}: agenda VINCULADA service_order_id=${c.osId}`)
  }

  // Limpa confirmações antigas para T01/T03 — permite teste limpo de envio
  await sb
    .from('agenda_event_member_confirmations')
    .delete()
    .eq('agenda_event_id', c.agendaId)
  console.log(`${c.os}: confirmações resetadas (pronto para Enviar WhatsApp)`)
}

// Verificação estilo API
for (const c of cases.filter((x) => x.schedule)) {
  const { data } = await sb
    .from('agenda_events')
    .select('code, team_id, service_order_id, status')
    .eq('service_order_id', c.osId)
    .maybeSingle()
  console.log(
    `LOOKUP ${c.os}:`,
    data
      ? `${data.code} team=${data.team_id} status=${data.status}`
      : 'FAIL missing',
  )
}

console.log('')
console.log('LINKS DIRETOS:')
const base =
  process.env.PREVIEW_BASE ||
  'https://catering-ai-agenda-dev.vercel.app'
for (const c of cases) {
  console.log(`  ${c.os} → ${base}/orders/${c.osId}`)
}
console.log('FIX TURN ORDERS: PASS')
