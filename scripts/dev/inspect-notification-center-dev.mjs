/**
 * Read-only DEV inspect. Never applies SQL. Never prints secrets or phones.
 *   node scripts/dev/inspect-notification-center-dev.mjs
 */
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { assertDevUrl, DEV_REF, loadDevEnv, PROD_REF } from './loadDevEnv.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

export const PACKAGE_FILES = [
  'supabase/migrations/20260917190000_notification_center_v1.sql',
  'supabase/migrations/20260918183219_notification_center_v12_auto.sql',
  'supabase/migrations/20260918213000_notification_center_v13_lineage.sql',
]

const TABLES = [
  'notification_recipients',
  'notification_subscriptions',
  'notification_events',
  'notification_deliveries',
  'company_notification_providers',
  'company_notification_settings',
]

function sha256(rel) {
  return createHash('sha256').update(readFileSync(join(root, rel))).digest('hex')
}

function errorCode(error) {
  return error?.code || error?.details || null
}

async function probeTable(db, table, columns) {
  const query = db.from(table).select(columns).limit(1)
  const { error, data } = await query
  if (!error) {
    return {
      present: true,
      readable: true,
      row_probe: Array.isArray(data) ? data.length : 0,
    }
  }
  const text = String(error.message || '')
  const missing = /PGRST205|could not find the table|schema cache/i.test(text)
  const missingColumn = /PGRST204|column/i.test(text) && /does not exist|Could not find/i.test(text)
  return {
    present: missing ? false : !missingColumn,
    readable: false,
    missing,
    missing_column: missingColumn,
    code: errorCode(error),
    reason: text.slice(0, 180),
  }
}

async function openApiNotificationPaths(url, service) {
  try {
    const response = await fetch(`${url.replace(/\/$/, '')}/rest/v1/`, {
      headers: {
        apikey: service,
        Authorization: `Bearer ${service}`,
        Accept: 'application/openapi+json',
      },
    })
    if (!response.ok) return { ok: false, status: response.status }
    const spec = await response.json()
    const paths = Object.keys(spec.paths || {})
      .filter((path) => /notification/i.test(path))
      .sort()
    return { ok: true, notification_paths: paths }
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message.slice(0, 120) : 'openapi_failed' }
  }
}

async function tryMigrationHistory(url, service) {
  const headers = {
    apikey: service,
    Authorization: `Bearer ${service}`,
    Accept: 'application/json',
  }
  const attempts = [
    { label: 'public.schema_migrations', path: '/rest/v1/schema_migrations?select=version,name&order=version.desc&limit=40' },
    {
      label: 'supabase_migrations.schema_migrations',
      path: '/rest/v1/schema_migrations?select=version,name&order=version.desc&limit=80',
      extra: { 'Accept-Profile': 'supabase_migrations' },
    },
  ]
  const out = []
  for (const attempt of attempts) {
    try {
      const response = await fetch(`${url.replace(/\/$/, '')}${attempt.path}`, {
        headers: { ...headers, ...(attempt.extra || {}) },
      })
      const text = await response.text()
      let rows = null
      try {
        rows = JSON.parse(text)
      } catch {
        rows = null
      }
      const notificationRows = Array.isArray(rows)
        ? rows.filter((row) =>
            /notification|whatsapp|v1[23]|lineage/i.test(
              `${row?.version || ''} ${row?.name || ''} ${row?.statements || ''}`,
            ),
          )
        : []
      out.push({
        source: attempt.label,
        status: response.status,
        readable: response.ok && Array.isArray(rows),
        total: Array.isArray(rows) ? rows.length : 0,
        notification_like: notificationRows.map((row) => ({
          version: row.version || row.name || null,
        })),
      })
    } catch (error) {
      out.push({
        source: attempt.label,
        readable: false,
        reason: error instanceof Error ? error.message.slice(0, 120) : 'history_failed',
      })
    }
  }
  return out
}

export async function inspectNotificationCenterDev() {
  const env = loadDevEnv(root)
  assertDevUrl(env.url)
  if (String(env.url).includes(PROD_REF)) throw new Error('Refused: Catering PROD')

  const db = createClient(env.url, env.service, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const tables = {}
  for (const table of TABLES) {
    tables[table] = await probeTable(db, table, 'company_id')
  }
  tables.notification_event_definitions = await probeTable(db, 'notification_event_definitions', 'event_key')

  const columns = {
    consent_status: await probeTable(db, 'notification_recipients', 'consent_status'),
    queue_eligible: await probeTable(db, 'notification_deliveries', 'queue_eligible'),
    send_attempted_at: await probeTable(db, 'notification_deliveries', 'send_attempted_at'),
    next_attempt_at: await probeTable(db, 'notification_deliveries', 'next_attempt_at'),
    auto_dispatch_from: await probeTable(db, 'company_notification_settings', 'auto_dispatch_from'),
  }

  const permissions = await db
    .from('permissions')
    .select('permission_key, active')
    .like('permission_key', 'notification%')
  const financeView = await db
    .from('permissions')
    .select('permission_key, active')
    .eq('permission_key', 'finance.invoices.view')
    .maybeSingle()

  let eventKeys = null
  if (tables.notification_event_definitions?.present && tables.notification_event_definitions?.readable) {
    const defs = await db
      .from('notification_event_definitions')
      .select('event_key, v1_enabled')
      .in('event_key', [
        'quote.created',
        'quote.accepted',
        'payment.deposit_received',
        'payment.full_received',
      ])
    eventKeys = defs.error ? { error: defs.error.message.slice(0, 160) } : defs.data
  }

  const companies = await db.from('companies').select('id').limit(20)
  const companyCount = Array.isArray(companies.data) ? companies.data.length : null

  const v1Present = Boolean(tables.notification_events?.present && !tables.notification_events?.missing)
  const v12Present = Boolean(
    v1Present &&
      columns.consent_status?.present &&
      !columns.consent_status?.missing &&
      !columns.consent_status?.missing_column &&
      tables.company_notification_settings?.present &&
      !tables.company_notification_settings?.missing,
  )
  const v13Present = Boolean(
    v12Present &&
      columns.queue_eligible?.present &&
      !columns.queue_eligible?.missing &&
      !columns.queue_eligible?.missing_column &&
      columns.send_attempted_at?.present &&
      !columns.send_attempted_at?.missing_column,
  )

  const pending = []
  if (!v1Present) pending.push('20260917190000_notification_center_v1.sql')
  if (!v12Present) pending.push('20260918183219_notification_center_v12_auto.sql')
  if (!v13Present) pending.push('20260918213000_notification_center_v13_lineage.sql')

  return {
    inspected_at: new Date().toISOString(),
    target_project_ref: DEV_REF,
    url_ref: new URL(env.url).hostname.split('.')[0],
    apply: false,
    prod_untouched: true,
    official_dev_alias_rebound: false,
    package_checksums: Object.fromEntries(
      PACKAGE_FILES.map((file) => [file, { sha256: sha256(file), bytes: readFileSync(join(root, file)).length }]),
    ),
    tables,
    columns,
    permissions: {
      notification: permissions.error
        ? { error: permissions.error.message.slice(0, 160) }
        : (permissions.data || []).map((row) => row.permission_key),
      finance_invoices_view: Boolean(financeView.data?.permission_key),
    },
    event_keys: eventKeys,
    companies_visible: companyCount,
    migration_history: await tryMigrationHistory(env.url, env.service),
    openapi: await openApiNotificationPaths(env.url, env.service),
    inferred_package: {
      v1: v1Present ? 'PRESENT' : 'ABSENT',
      v12: v12Present ? 'PRESENT' : v1Present ? 'ABSENT_OR_PARTIAL' : 'ABSENT',
      v13: v13Present ? 'PRESENT' : v12Present ? 'ABSENT_OR_PARTIAL' : 'ABSENT',
      pending_files: pending,
      status: pending.length === 0 ? 'APLICADO' : v1Present || v12Present ? 'PARCIAL' : 'PENDENTE',
    },
    management_token_present: Boolean(
      process.env.SUPABASE_ACCESS_TOKEN || process.env.SUPABASE_PERSONAL_ACCESS_TOKEN,
    ),
    whatsapp_env_present: {
      app_secret: Boolean(process.env.WHATSAPP_APP_SECRET),
      access_token: Boolean(process.env.WHATSAPP_ACCESS_TOKEN || process.env.META_WHATSAPP_ACCESS_TOKEN),
      phone_number_id: Boolean(process.env.WHATSAPP_PHONE_NUMBER_ID || process.env.META_WHATSAPP_PHONE_NUMBER_ID),
      verify_token: Boolean(process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN),
      worker_secret: Boolean(process.env.NOTIFICATION_WORKER_SECRET || process.env.CRON_SECRET),
      shared_sender_allowlist: Boolean(process.env.WHATSAPP_SHARED_SENDER_COMPANY_IDS),
    },
  }
}

if (process.argv[1] && process.argv[1].endsWith('inspect-notification-center-dev.mjs')) {
  inspectNotificationCenterDev()
    .then((report) => {
      console.log(JSON.stringify(report, null, 2))
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error)
      process.exit(1)
    })
}
