/**
 * Issue #52 — lineage + composite integrity read-only DEV audit.
 */
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { assertDevUrl, loadDevEnv, DEV_REF } from './loadDevEnv.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const env = loadDevEnv(root)
assertDevUrl(env.url)
const SENTINEL = '00000000-0000-4000-8000-000000000000'
const CDL = '65fd576f-8d97-49ba-bf38-61bc1e94e94a'
const ISO = 'a1111111-1111-4111-8111-111111111111'

const admin = createClient(env.url, env.service, {
  auth: { persistSession: false, autoRefreshToken: false },
})

async function all(table, columns, extra = (q) => q) {
  let q = admin.from(table).select(columns)
  q = extra(q)
  const { data, error } = await q
  if (error) return { error: error.message, data: [] }
  return { error: null, data: data ?? [] }
}

function mismatches(child, parentKey, childCompany = 'company_id') {
  return child.filter((row) => {
    const parent = row[parentKey]
    if (!parent) return false
    const parentCompany = Array.isArray(parent) ? parent[0]?.company_id : parent.company_id
    return parentCompany && parentCompany !== row[childCompany]
  }).length
}

async function main() {
  const serviceOrders = await all(
    'service_orders',
    'id, company_id, service_order_number, quote_id, created_at, status',
  )
  const quotes = await all('quotes', 'id, company_id, quote_number, created_at, status')
  const invoices = await all('invoices', 'id, company_id, invoice_number, quote_id, created_at')
  const companies = await all(
    'companies',
    'id, company_name, company_code, slug, city, state, timezone, currency_code, default_language, logo_url, phone, website, primary_color',
  )
  const publicSettings = await all('company_public_quote_settings')
  const commercial = await all('commercial_rules', 'id, company_id, rule_key, active')
  const staff = await all('staff_rules', 'id, company_id, rule_key, active')
  const paymentRules = await all('payment_rules', 'id, company_id, rule_key, active')
  const providers = await all(
    'company_payment_providers',
    'id, company_id, provider, enabled, mode',
  )
  const branches = await all('branches', 'id, company_id, name, code, city, state')
  const quoteVersions = await all('quote_versions', 'id, company_id, quote_id, quotes(id, company_id)')
  const quoteAdd = await all(
    'quote_additional_items',
    'id, company_id, quote_id, quotes(id, company_id)',
  )
  const quoteSel = await all(
    'quote_package_selections',
    'id, company_id, quote_id, quotes(id, company_id)',
  )
  const payments = await all(
    'invoice_payments',
    'id, company_id, invoice_id, invoices(id, company_id)',
  )
  const refunds = await all(
    'invoice_refunds',
    'id, company_id, invoice_id, invoices(id, company_id)',
  )
  const soItems = await all(
    'service_order_items',
    'id, company_id, service_order_id, service_orders(id, company_id)',
  )
  const brasinha = await all(
    'brasinha_messages',
    'id, company_id, conversation_id, brasinha_conversations(id, company_id)',
  )
  const agenda = await all(
    'agenda_events',
    'id, company_id, event_id, events(id, company_id)',
  )
  const closeoutLines = await all(
    'event_financial_closeout_lines',
    'id, company_id, closeout_id, event_financial_closeouts(id, company_id)',
  )
  const media = await all('media_assets', 'id, company_id, entity_type, entity_key')
  const isoCounts = {}
  for (const table of [
    'customers',
    'packages',
    'catalog_items',
    'quotes',
    'invoices',
    'invoice_payments',
    'service_orders',
    'events',
    'agenda_events',
    'media_assets',
    'coupons',
    'brasinha_conversations',
    'company_payment_providers',
  ]) {
    const { count, error } = await admin
      .from(table)
      .select('*', { count: 'exact', head: true })
      .eq('company_id', ISO)
    isoCounts[table] = error ? error.message : count
  }

  const soNumbers = serviceOrders.data.map((r) => r.service_order_number).sort()
  const report = {
    project_ref: DEV_REF,
    companies: companies.data,
    branches: branches.data,
    public_quote_settings: publicSettings.data.map((row) => ({
      company_id: row.company_id,
      enabled: row.enabled,
      allowed_languages: row.allowed_languages,
      support_phone: row.support_phone,
      has_landing_copy: Boolean(row.landing_copy && Object.keys(row.landing_copy).length),
      landing_copy_keys: row.landing_copy ? Object.keys(row.landing_copy) : [],
    })),
    commercial_rule_keys: commercial.data.map((r) => `${r.company_id}:${r.rule_key}`),
    staff_rule_keys: staff.data.map((r) => `${r.company_id}:${r.rule_key}`),
    payment_rule_keys: paymentRules.data.map((r) => `${r.company_id}:${r.rule_key}`),
    payment_providers: providers.data,
    service_orders: serviceOrders.data,
    service_order_numbers: soNumbers,
    quotes: quotes.data.map((r) => ({
      id: r.id,
      company_id: r.company_id,
      quote_number: r.quote_number,
      created_at: r.created_at,
    })),
    invoices: invoices.data.map((r) => ({
      id: r.id,
      company_id: r.company_id,
      invoice_number: r.invoice_number,
      quote_id: r.quote_id,
    })),
    sentinel_so_consumed_in_table: serviceOrders.data.filter((r) =>
      /^SO-2026-0000(0[1-9]|1[0-3])$/.test(r.service_order_number || ''),
    ),
    cdl_so_sequence_overlap_risk: serviceOrders.data.some((r) =>
      (r.service_order_number || '').startsWith('SO-2026-'),
    ),
    composite_mismatches: {
      quote_versions: mismatches(quoteVersions.data, 'quotes'),
      quote_additional_items: mismatches(quoteAdd.data, 'quotes'),
      quote_package_selections: mismatches(quoteSel.data, 'quotes'),
      invoice_payments: mismatches(payments.data, 'invoices'),
      invoice_refunds: mismatches(refunds.data, 'invoices'),
      service_order_items: mismatches(soItems.data, 'service_orders'),
      brasinha_messages: mismatches(brasinha.data, 'brasinha_conversations'),
      agenda_events: mismatches(agenda.data, 'events'),
      event_financial_closeout_lines: mismatches(closeoutLines.data, 'event_financial_closeouts'),
      errors: {
        quote_versions: quoteVersions.error,
        quote_additional_items: quoteAdd.error,
        quote_package_selections: quoteSel.error,
        invoice_payments: payments.error,
        invoice_refunds: refunds.error,
        service_order_items: soItems.error,
        brasinha_messages: brasinha.error,
        agenda_events: agenda.error,
        closeout_lines: closeoutLines.error,
      },
    },
    isolation_counts: isoCounts,
    media_by_company: media.data.reduce((acc, row) => {
      acc[row.company_id] = (acc[row.company_id] || 0) + 1
      return acc
    }, {}),
    sentinel_in_runtime_tables: {
      quotes: quotes.data.filter((r) => r.company_id === SENTINEL).length,
      service_orders: serviceOrders.data.filter((r) => r.company_id === SENTINEL).length,
      invoices: invoices.data.filter((r) => r.company_id === SENTINEL).length,
    },
  }

  const path = join(root, 'docs/qa/multicompany-lineage-before.json')
  writeFileSync(path, JSON.stringify(report, null, 2))
  console.log(
    JSON.stringify(
      {
        so_count: serviceOrders.data.length,
        so_numbers: soNumbers,
        mismatches: report.composite_mismatches,
        isolation_counts: isoCounts,
        companies: companies.data.map((c) => ({
          id: c.id,
          name: c.company_name,
          city: c.city,
          state: c.state,
          code: c.company_code,
        })),
        path,
      },
      null,
      2,
    ),
  )
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
