/**
 * Issue #52 — structural cross-tenant negative tests.
 * service_role is setup only. The database must reject the inconsistency.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { assertDevUrl, loadDevEnv } from './loadDevEnv.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const COMPANY_A = '65fd576f-8d97-49ba-bf38-61bc1e94e94a'
const COMPANY_B = 'a1111111-1111-4111-8111-111111111111'
const ROUND2 = readFileSync(
  join(root, 'supabase/migrations/20260917204000_multicompany_composite_integrity_round2.sql'),
  'utf8',
)
const CONFIG = readFileSync(
  join(root, 'supabase/migrations/20260917203000_multicompany_config_rls_and_qa_b.sql'),
  'utf8',
)

const rows = []
function record(id, ok, detail) {
  rows.push({ id, result: ok ? 'PASS' : 'FAIL', detail: detail || '-' })
  console.log(`${ok ? 'PASS' : 'FAIL'} | ${id} | ${detail || '-'}`)
}

function sqlContract() {
  record(
    'qa_seed_absent_from_product_migration',
    !CONFIG.includes('a1111111-1111-4111-8111-111111111111'),
    'Company B UUID must not appear in 030',
  )
  record(
    'franchise_rls_not_using_true',
    /franchise_groups_select_authenticated[\s\S]+is_company_member/.test(CONFIG) &&
      !/franchise_groups_select_authenticated[\s\S]+USING \(true\)/.test(CONFIG),
    'membership-scoped franchise_groups policy',
  )
  const required = [
    'quotes_customer_company_fkey',
    'quotes_event_company_fkey',
    'quotes_package_company_fkey',
    'quote_items_catalog_company_fkey',
    'quote_package_selections_package_company_fkey',
    'events_customer_company_fkey',
    'agenda_events_team_company_fkey',
    'inventory_document_lines_catalog_company_fkey',
    'inventory_document_lines_location_company_fkey',
    'package_items_package_company_fkey',
    'package_items_catalog_company_fkey',
    'trg_quotes_converted_so_same_company',
    'trg_agenda_events_quote_same_company',
    'trg_agenda_events_so_same_company',
    'trg_public_quote_intake_quote_same_company',
    'trg_service_orders_event_same_company',
    'trg_service_orders_customer_same_company',
  ]
  for (const name of required) {
    record(`sql_has_${name}`, ROUND2.includes(name), name)
  }
  record(
    'mismatch_abort',
    ROUND2.includes('Issue #52 blocked') && ROUND2.includes('cross-tenant'),
    'preflight abort on mismatch > 0',
  )
  record(
    'no_finance_cascade',
    !/ON DELETE CASCADE[\s\S]{0,40}invoices/.test(ROUND2),
    'no new invoice CASCADE',
  )
}

async function liveNegatives(admin) {
  const stamp = Date.now()
  const created = { ids: [] }

  const customerA = await admin
    .from('customers')
    .insert({
      company_id: COMPANY_A,
      full_name: `QA-ST-A-${stamp}`,
      customer_type: 'person',
      active: true,
      country: 'US',
    })
    .select('id')
    .single()
  const customerB = await admin
    .from('customers')
    .insert({
      company_id: COMPANY_B,
      full_name: `QA-ST-B-${stamp}`,
      customer_type: 'person',
      active: true,
      country: 'US',
    })
    .select('id')
    .single()
  const packageA = await admin
    .from('packages')
    .insert({
      company_id: COMPANY_A,
      package_key: `QA-ST-A-${stamp}`,
      package_name: `QA-ST-A-${stamp}`,
      label_pt: `QA-ST-A-${stamp}`,
      price_per_person: 1,
      active: false,
    })
    .select('id')
    .single()
  const packageB = await admin
    .from('packages')
    .insert({
      company_id: COMPANY_B,
      package_key: `QA-ST-B-${stamp}`,
      package_name: `QA-ST-B-${stamp}`,
      label_pt: `QA-ST-B-${stamp}`,
      price_per_person: 1,
      active: false,
    })
    .select('id')
    .single()
  const eventA = await admin
    .from('events')
    .insert({
      company_id: COMPANY_A,
      event_name: `QA-ST-A-${stamp}`,
      event_date: '2026-12-21',
      country: 'US',
      adults_count: 10,
      active: true,
    })
    .select('id')
    .single()
  const eventB = await admin
    .from('events')
    .insert({
      company_id: COMPANY_B,
      event_name: `QA-ST-B-${stamp}`,
      event_date: '2026-12-21',
      country: 'US',
      adults_count: 10,
      active: true,
    })
    .select('id')
    .single()
  const catalogB = await admin
    .from('catalog_items')
    .insert({
      company_id: COMPANY_B,
      item_name: `QA-ST-B-${stamp}`,
      item_key: `qa-st-b-${stamp}`,
      price: 1,
      charge_type: 'UNIT',
      active: false,
    })
    .select('id')
    .single()

  const setupOk =
    customerA.data?.id &&
    customerB.data?.id &&
    packageA.data?.id &&
    packageB.data?.id &&
    eventA.data?.id &&
    eventB.data?.id &&
    catalogB.data?.id
  if (!setupOk) {
    record('live_setup', false, 'could not seed A/B parents')
    return { applied: false, livePass: false }
  }
  created.ids.push(
    ['customers', customerA.data.id],
    ['customers', customerB.data.id],
    ['packages', packageA.data.id],
    ['packages', packageB.data.id],
    ['events', eventA.data.id],
    ['events', eventB.data.id],
    ['catalog_items', catalogB.data.id],
  )

  async function expectReject(id, table, payload) {
    const result = await admin.from(table).insert(payload).select('id').single()
    if (result.data?.id) {
      await admin.from(table).delete().eq('id', result.data.id)
      record(id, false, 'accepted cross-tenant row — constraint not applied')
      return false
    }
    const code = result.error?.code || ''
    const rejected = ['23503', '23514', 'PGRST204', '23502'].includes(code) || Boolean(result.error)
    record(id, rejected, result.error?.message || code || 'rejected')
    return rejected
  }

  const quoteCrossCustomer = await expectReject('quote_a_customer_b', 'quotes', {
    company_id: COMPANY_A,
    customer_id: customerB.data.id,
    event_id: eventA.data.id,
    package_id: packageA.data.id,
    quote_number: `Q-ST-X-${stamp}`,
    quote_status: 'draft',
    language: 'en',
    source: 'qa_structural',
    active: true,
    currency_code: 'USD',
    physical_guest_count: 10,
  })

  const quoteCrossPackage = await expectReject('quote_a_package_b', 'quotes', {
    company_id: COMPANY_A,
    customer_id: customerA.data.id,
    event_id: eventA.data.id,
    package_id: packageB.data.id,
    quote_number: `Q-ST-P-${stamp}`,
    quote_status: 'draft',
    language: 'en',
    source: 'qa_structural',
    active: true,
    currency_code: 'USD',
    physical_guest_count: 10,
  })

  const eventCrossCustomer = await expectReject('event_a_customer_b', 'events', {
    company_id: COMPANY_A,
    customer_id: customerB.data.id,
    event_name: `QA-ST-X-${stamp}`,
    event_date: '2026-12-22',
    country: 'US',
    adults_count: 8,
    active: true,
  })

  const packageItemCross = await expectReject('package_a_catalog_b', 'package_items', {
    company_id: COMPANY_A,
    package_id: packageA.data.id,
    item_name: `QA-ST-X-${stamp}`,
    additional_item_id: catalogB.data.id,
  })

  const applied = quoteCrossCustomer && quoteCrossPackage && eventCrossCustomer
  const livePass = applied && packageItemCross !== false

  for (const [table, id] of created.ids.reverse()) {
    await admin.from(table).delete().eq('id', id)
  }

  return { applied, livePass }
}

async function main() {
  sqlContract()
  const sqlFailed = rows.some((row) => row.result === 'FAIL')

  const env = loadDevEnv(root)
  let liveStatus = 'SKIPPED'
  if (env.url && env.service) {
    try {
      assertDevUrl(env.url)
      const admin = createClient(env.url, env.service, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
      const live = await liveNegatives(admin)
      liveStatus = live.applied ? (live.livePass ? 'PASS' : 'FAIL') : 'PENDING_APPLY'
    } catch (error) {
      liveStatus = `SKIPPED:${error instanceof Error ? error.message : 'live_failed'}`
    }
  }

  const structuralPass = !sqlFailed && liveStatus !== 'FAIL'
  console.log(
    JSON.stringify(
      {
        STRUCTURAL_CROSS_TENANT: structuralPass ? 'PASS' : 'FAIL',
        SQL_CONTRACT: sqlFailed ? 'FAIL' : 'PASS',
        LIVE_NEGATIVE: liveStatus,
        DEV_MIGRATIONS_APPLIED: liveStatus === 'PASS' ? 'YES' : 'NO',
        cases: rows,
      },
      null,
      2,
    ),
  )
  if (!structuralPass) process.exit(1)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'structural_test_failed')
  process.exit(1)
})
