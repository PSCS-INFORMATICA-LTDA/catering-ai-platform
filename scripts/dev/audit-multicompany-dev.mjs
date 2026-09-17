/**
 * Issue #52 — read-only DEV schema/data audit.
 * Never prints secrets. Aborts on PROD. Does not mutate data.
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { assertDevUrl, loadDevEnv, DEV_REF } from './loadDevEnv.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const env = loadDevEnv(root)
assertDevUrl(env.url)
if (!env.service) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY')
  process.exit(2)
}

const SENTINEL = '00000000-0000-4000-8000-000000000000'
const CDL = '65fd576f-8d97-49ba-bf38-61bc1e94e94a'
const ISO = 'a1111111-1111-4111-8111-111111111111'

const admin = createClient(env.url, env.service, {
  auth: { persistSession: false, autoRefreshToken: false },
})

function classifyTable(name, columns) {
  const hasCompany = columns.includes('company_id')
  const global = new Set([
    'languages',
    'permissions',
    'role_permissions',
    'franchise_groups',
    'inventory_movement_types',
  ])
  const platform = new Set([
    'app_users',
    'users',
    'support_access_sessions',
    'admin_audit_events',
    'audit_logs',
  ])
  if (name === 'companies') return 'tenant_root'
  if (global.has(name)) return 'global_reference'
  if (platform.has(name)) return 'platform'
  if (hasCompany) return 'tenant'
  return 'needs_analysis'
}

async function fetchOpenApi() {
  const res = await fetch(`${env.url}/rest/v1/`, {
    headers: {
      apikey: env.service,
      Authorization: `Bearer ${env.service}`,
      Accept: 'application/openapi+json',
    },
  })
  if (!res.ok) {
    throw new Error(`openapi_http_${res.status}`)
  }
  return res.json()
}

async function selectAll(table, columns = '*', extra = (q) => q) {
  let q = admin.from(table).select(columns)
  q = extra(q)
  const { data, error } = await q
  return { data: data ?? [], error: error ? { code: error.code, message: error.message } : null }
}

async function countEq(table, column, value) {
  const { count, error } = await admin
    .from(table)
    .select('id', { count: 'exact', head: true })
    .eq(column, value)
  return { count: count ?? 0, error: error ? error.message : null }
}

async function countIs(table, column, value) {
  const { count, error } = await admin
    .from(table)
    .select('*', { count: 'exact', head: true })
    .is(column, value)
  return { count: count ?? 0, error: error ? error.message : null }
}

async function countAll(table) {
  const { count, error } = await admin.from(table).select('*', { count: 'exact', head: true })
  return { count: count ?? 0, error: error ? error.message : null }
}

function tableNamesFromOpenApi(spec) {
  const names = new Set()
  const paths = spec.paths || {}
  for (const path of Object.keys(paths)) {
    if (!path.startsWith('/')) continue
    const name = path.slice(1).split('/')[0]
    if (name && !name.includes('{')) names.add(name)
  }
  return [...names].sort()
}

function columnsFromOpenApi(spec, table) {
  const schema =
    spec.definitions?.[table] ||
    spec.components?.schemas?.[table] ||
    spec.definitions?.[`${table}`]
  const props = schema?.properties || {}
  return Object.keys(props).sort()
}

function requiredFromOpenApi(spec, table) {
  const schema = spec.definitions?.[table] || spec.components?.schemas?.[table]
  return schema?.required || []
}

function fkHintsFromOpenApi(spec, table) {
  const schema = spec.definitions?.[table] || spec.components?.schemas?.[table] || {}
  const props = schema.properties || {}
  const hints = []
  for (const [col, def] of Object.entries(props)) {
    const desc = String(def.description || '')
    if (desc.includes('fk') || desc.includes('Foreign') || desc.includes('references')) {
      hints.push({ column: col, description: desc })
    }
    if (def.format === 'uuid' && col.endsWith('_id')) {
      hints.push({ column: col, format: 'uuid' })
    }
  }
  return hints
}

async function main() {
  const spec = await fetchOpenApi()
  const tables = tableNamesFromOpenApi(spec)
  const matrix = []

  const companies = await selectAll('companies', 'id, company_name, legal_name, created_at')
  const appUsers = await selectAll(
    'app_users',
    'id, email, role_key, company_id, is_pscs_master, active, auth_user_id, pscs_one_user_id',
  )
  const memberships = await selectAll(
    'company_memberships',
    'id, company_id, user_id, role, active, status, branch_id',
  )
  const sequences = await selectAll('document_sequences')
  const movementTypes = await selectAll('inventory_movement_types')
  const usersTable = await selectAll('users', 'id, email, company_id, role, active')

  const companyIds = new Set((companies.data || []).map((c) => c.id))

  for (const table of tables) {
    const columns = columnsFromOpenApi(spec, table)
    const required = requiredFromOpenApi(spec, table)
    const hasCompany = columns.includes('company_id')
    const companyNullable = hasCompany ? !required.includes('company_id') : null
    let rowCount = null
    let nullCompany = null
    let orphanCount = null
    let sentinelCount = null
    let error = null

    if (columns.length) {
      const all = await countAll(table)
      rowCount = all.count
      error = all.error
      if (hasCompany) {
        const n = await countIs(table, 'company_id', null)
        nullCompany = n.error ? n.error : n.count
        const s = await countEq(table, 'company_id', SENTINEL)
        sentinelCount = s.error ? s.error : s.count
        if (rowCount > 0 && rowCount <= 20000) {
          const { data, error: e2 } = await admin.from(table).select('company_id')
          if (!e2 && Array.isArray(data)) {
            orphanCount = data.filter(
              (row) =>
                row.company_id &&
                row.company_id !== SENTINEL &&
                !companyIds.has(row.company_id),
            ).length
          } else if (e2) {
            orphanCount = `err:${e2.message}`
          }
        }
      }
    }

    matrix.push({
      table_name: table,
      classification: classifyTable(table, columns),
      company_id_present: hasCompany,
      company_id_nullable_openapi: companyNullable,
      columns,
      row_count: rowCount,
      company_id_null_count: nullCompany,
      orphan_count: orphanCount,
      sentinel_count: sentinelCount,
      error,
    })
  }

  const rpcs = Object.keys(spec.paths || {})
    .filter((p) => p.startsWith('/rpc/'))
    .map((p) => p.slice(5))
    .sort()

  const report = {
    generated_at: new Date().toISOString(),
    project_ref: DEV_REF,
    prod_touched: false,
    companies: companies.data,
    companies_error: companies.error,
    app_users: {
      total: appUsers.data.length,
      error: appUsers.error,
      rows: appUsers.data.map((u) => ({
        id: u.id,
        email: u.is_pscs_master ? 'pscs-master@redacted.test' : u.email,
        role_key: u.role_key,
        company_id: u.company_id,
        is_pscs_master: u.is_pscs_master,
        active: u.active,
        has_auth_user_id: Boolean(u.auth_user_id),
        has_pscs_one_user_id: Boolean(u.pscs_one_user_id),
      })),
      company_id_null: appUsers.data.filter((u) => !u.company_id).length,
      pscs_master: appUsers.data.filter((u) => u.is_pscs_master).length,
      role_user_and_null_company: appUsers.data.filter(
        (u) => !u.company_id && u.role_key === 'user',
      ).length,
    },
    users_table: {
      total: usersTable.data.length,
      error: usersTable.error,
      rows: usersTable.data,
    },
    memberships: {
      total: memberships.data.length,
      error: memberships.error,
      by_company: memberships.data.reduce((acc, m) => {
        acc[m.company_id] = (acc[m.company_id] || 0) + 1
        return acc
      }, {}),
      rows: memberships.data,
    },
    document_sequences: {
      error: sequences.error,
      rows: sequences.data,
      sentinel_rows: sequences.data.filter((r) => r.company_id === SENTINEL),
      cdl_rows: sequences.data.filter((r) => r.company_id === CDL),
    },
    inventory_movement_types: {
      error: movementTypes.error,
      rows: movementTypes.data,
      null_company: movementTypes.data.filter((r) => !r.company_id).length,
    },
    isolation_company_present: companyIds.has(ISO),
    cdl_present: companyIds.has(CDL),
    sentinel_company_present: companyIds.has(SENTINEL),
    rpc_names: rpcs,
    table_count: tables.length,
    matrix,
  }

  const outDir = join(root, 'docs/qa')
  mkdirSync(outDir, { recursive: true })
  const jsonPath = join(outDir, 'multicompany-audit-before.json')
  writeFileSync(jsonPath, JSON.stringify(report, null, 2))
  console.log(
    JSON.stringify(
      {
        project_ref: DEV_REF,
        table_count: tables.length,
        company_count: companies.data.length,
        app_users: report.app_users.total,
        app_users_null_company: report.app_users.company_id_null,
        sequences: sequences.data.length,
        sentinel_sequences: report.document_sequences.sentinel_rows.length,
        movement_types: movementTypes.data.length,
        isolation_company_present: report.isolation_company_present,
        jsonPath,
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
