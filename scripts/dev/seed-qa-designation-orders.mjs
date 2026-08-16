/**
 * Seed DEV — 4 OS visíveis para teste de designação/confirmação.
 * Números fáceis de buscar: SO-QA-DESIG-01 … 04
 *
 * Uso: node scripts/dev/seed-qa-designation-orders.mjs --apply
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const apply = process.argv.includes('--apply')
const DEV = 'yasprgtlqclwsjcshtls'
const COMPANY = '65fd576f-8d97-49ba-bf38-61bc1e94e94a'
const CUSTOMER = 'f2000000-0000-4000-8000-000000000001'
const PKG = 'c2000000-0000-4000-8000-000000000001'
const CAIO = 'a1000000-0000-4000-8000-000000000003'
const FILIPE = 'a1000000-0000-4000-8000-000000000002'
const DATE = '2027-12-05'

const cases = [
  {
    key: 'D01',
    os: 'SO-QA-DESIG-01',
    quote: 'Q-QA-DESIG-01',
    code: 'EVT-QA-DESIG-01',
    label: 'Designação OK — Equipe Caio 10:00–14:00',
    teamId: CAIO,
    start: '10:00:00',
    end: '14:00:00',
    schedule: true,
    ids: {
      os: 'f2400000-0000-4000-8000-000000000081',
      quote: 'f2200000-0000-4000-8000-000000000081',
      ver: 'f2300000-0000-4000-8000-000000000081',
      event: 'f2100000-0000-4000-8000-000000000081',
      agenda: 'f2500000-0000-4000-8000-000000000081',
    },
  },
  {
    key: 'D02',
    os: 'SO-QA-DESIG-02',
    quote: 'Q-QA-DESIG-02',
    code: 'EVT-QA-DESIG-02',
    label: 'Designação OK — Equipe Caio 16:00–20:00 (após janela)',
    teamId: CAIO,
    start: '16:00:00',
    end: '20:00:00',
    schedule: true,
    ids: {
      os: 'f2400000-0000-4000-8000-000000000082',
      quote: 'f2200000-0000-4000-8000-000000000082',
      ver: 'f2300000-0000-4000-8000-000000000082',
      event: 'f2100000-0000-4000-8000-000000000082',
      agenda: 'f2500000-0000-4000-8000-000000000082',
    },
  },
  {
    key: 'D03',
    os: 'SO-QA-DESIG-03',
    quote: 'Q-QA-DESIG-03',
    code: 'EVT-QA-DESIG-03',
    label: 'Bloqueio janela — 15:00–19:00 (OS sem agenda)',
    teamId: CAIO,
    start: '15:00:00',
    end: '19:00:00',
    schedule: false,
    ids: {
      os: 'f2400000-0000-4000-8000-000000000083',
      quote: 'f2200000-0000-4000-8000-000000000083',
      ver: 'f2300000-0000-4000-8000-000000000083',
      event: 'f2100000-0000-4000-8000-000000000083',
      agenda: 'f2500000-0000-4000-8000-000000000083',
    },
  },
  {
    key: 'D04',
    os: 'SO-QA-DESIG-04',
    quote: 'Q-QA-DESIG-04',
    code: 'EVT-QA-DESIG-04',
    label: 'Conflito pessoa — Equipe Filipe 15:00–19:00 (OS sem agenda)',
    teamId: FILIPE,
    start: '15:00:00',
    end: '19:00:00',
    schedule: false,
    ids: {
      os: 'f2400000-0000-4000-8000-000000000084',
      quote: 'f2200000-0000-4000-8000-000000000084',
      ver: 'f2300000-0000-4000-8000-000000000084',
      event: 'f2100000-0000-4000-8000-000000000084',
      agenda: 'f2500000-0000-4000-8000-000000000084',
    },
  },
]

function loadEnv() {
  const env = readFileSync(join(ROOT, '.env.local'), 'utf8')
  const get = (k) => {
    const m = env.match(new RegExp(`^${k}=(.*)$`, 'm'))
    return m ? m[1].trim().replace(/^["']|["']$/g, '') : ''
  }
  return { url: get('NEXT_PUBLIC_SUPABASE_URL'), key: get('SUPABASE_SERVICE_ROLE_KEY') }
}

const { url, key } = loadEnv()
if (!url?.includes(DEV)) {
  console.error('Abort: só DEV')
  process.exit(2)
}

console.log('=== SEED QA DESIGNATION ORDERS ===')
console.log(`mode=${apply ? 'apply' : 'dry-run'}`)
for (const c of cases) console.log(`  ${c.os} — ${c.label}`)

if (!apply) {
  console.log('Dry-run OK. Use --apply')
  process.exit(0)
}

const sb = createClient(url, key, { auth: { persistSession: false } })
const BASE = 'https://catering-ai-agenda-dev.vercel.app'

for (const c of cases) {
  await sb
    .from('agenda_event_member_confirmations')
    .delete()
    .eq('agenda_event_id', c.ids.agenda)
  await sb.from('agenda_events').delete().eq('id', c.ids.agenda)
  await sb.from('agenda_events').delete().eq('code', c.code)
  await sb
    .from('quotes')
    .update({ accepted_version_id: null, converted_service_order_id: null })
    .eq('id', c.ids.quote)
  await sb.from('service_orders').delete().eq('id', c.ids.os)
  await sb.from('service_orders').delete().eq('service_order_number', c.os)
  await sb.from('quote_versions').delete().eq('id', c.ids.ver)
  await sb.from('quotes').delete().eq('id', c.ids.quote)
  await sb.from('events').delete().eq('id', c.ids.event)

  const { error: evErr } = await sb.from('events').upsert(
    {
      id: c.ids.event,
      company_id: COMPANY,
      customer_id: CUSTOMER,
      event_name: c.label,
      event_date: DATE,
      start_time: c.start,
      end_time: c.end,
      address_line: `QA DESIG ${c.key}`,
      city: 'Orlando',
      state: 'FL',
      postal_code: '32801',
      country: 'US',
      adults_count: 40,
      children_count: 0,
      billable_guests: 40,
      total_guests: 40,
      active: true,
      notes: c.os,
    },
    { onConflict: 'id' },
  )
  if (evErr) throw new Error(`events ${c.key}: ${evErr.message}`)

  const snap = { schema_version: 1, quote_total: 100, qa: c.key }

  const { error: qErr } = await sb.from('quotes').upsert(
    {
      id: c.ids.quote,
      company_id: COMPANY,
      customer_id: CUSTOMER,
      event_id: c.ids.event,
      package_id: PKG,
      quote_number: c.quote,
      language: 'pt',
      quote_status: 'accepted',
      proposal_response: 'accepted',
      source: 'seed-qa-designation-orders',
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
      designated_team_id: c.teamId,
    },
    { onConflict: 'id' },
  )
  if (qErr) throw new Error(`quotes ${c.key}: ${qErr.message}`)

  const { error: vErr } = await sb.from('quote_versions').insert({
    id: c.ids.ver,
    company_id: COMPANY,
    quote_id: c.ids.quote,
    version_number: 1,
    language: 'pt',
    currency_code: 'USD',
    quote_total: 100,
    commercial_snapshot: snap,
    schema_version: 1,
    is_current: true,
    accepted_at: new Date().toISOString(),
  })
  if (vErr) throw new Error(`versions ${c.key}: ${vErr.message}`)

  await sb
    .from('quotes')
    .update({ accepted_version_id: c.ids.ver })
    .eq('id', c.ids.quote)

  const { error: osErr } = await sb.from('service_orders').insert({
    id: c.ids.os,
    company_id: COMPANY,
    service_order_number: c.os,
    quote_id: c.ids.quote,
    quote_version_id: c.ids.ver,
    event_id: c.ids.event,
    customer_id: CUSTOMER,
    status: 'planned',
    event_date: DATE,
    start_time: c.start,
    end_time: c.end,
    address_line: `QA DESIG ${c.key}`,
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
    commercial_snapshot: snap,
    notes: c.label,
  })
  if (osErr) throw new Error(`OS ${c.key}: ${osErr.message}`)

  await sb
    .from('quotes')
    .update({
      converted_service_order_id: c.ids.os,
      designated_team_id: c.teamId,
    })
    .eq('id', c.ids.quote)

  if (c.schedule) {
    const { error: aErr } = await sb.from('agenda_events').insert({
      id: c.ids.agenda,
      company_id: COMPANY,
      team_id: c.teamId,
      code: c.code,
      title: c.label,
      client_name: c.os,
      event_date: DATE,
      start_time: c.start,
      end_time: c.end,
      status: 'scheduled',
      quote_id: c.ids.quote,
      service_order_id: c.ids.os,
      notes: c.os,
    })
    if (aErr) throw new Error(`agenda ${c.key}: ${aErr.message}`)
  }

  console.log(`OK ${c.os} → ${BASE}/orders/${c.ids.os}`)
}

console.log('')
console.log('Buscar em /orders:  DESIG   ou   SO-QA')
console.log('SEED QA DESIGNATION ORDERS: PASS')
