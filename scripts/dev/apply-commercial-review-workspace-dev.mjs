/**
 * Probe-first helper for commercial-review-workspace-v1 on Catering DEV only.
 * Git filename matches DEV history: 20260914111651_commercial_review_workspace_v1.
 * Do not reapply SQL when the columns already exist. Never apply to PROD.
 * See docs/qa/commercial-review-migration-reconciliation.md
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { assertDevUrl, DEV_REF, loadDevEnv, PROD_REF } from './loadDevEnv.mjs'

const API_BASE = 'https://api.supabase.com'
const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const sqlPath = join(
  root,
  'supabase',
  'migrations',
  '20260914111651_commercial_review_workspace_v1.sql',
)

function parseEnvFile(path) {
  const map = new Map()
  if (!existsSync(path)) return map
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    map.set(trimmed.slice(0, eq).trim(), value)
  }
  return map
}

function accessToken() {
  return (
    process.env.SUPABASE_ACCESS_TOKEN ||
    process.env.SUPABASE_PERSONAL_ACCESS_TOKEN ||
    parseEnvFile(join(root, '.env.local')).get('SUPABASE_ACCESS_TOKEN') ||
    parseEnvFile(join(root, '.env.local')).get('SUPABASE_PERSONAL_ACCESS_TOKEN') ||
    ''
  )
}

async function columnsExist(url, service) {
  const db = createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const wanted = [
    'internal_notes',
    'proposal_shared_version_id',
    'proposal_shared_by',
  ]
  const present = []
  const missing = []
  for (const column of wanted) {
    const { error } = await db.from('quotes').select(column).limit(1)
    if (!error) present.push(column)
    else missing.push(column)
  }
  if (missing.length === 0) return { ok: true, via: 'select', present, missing }
  return {
    ok: false,
    via: 'missing',
    present,
    missing,
    text: missing.join(','),
  }
}

async function main() {
  const env = loadDevEnv(root)
  assertDevUrl(env.url)
  if (String(env.url).includes(PROD_REF)) throw new Error('Refused: Catering PROD')
  const already = await columnsExist(env.url, env.service)
  if (already.ok) {
    console.log(
      JSON.stringify({
        target_project_ref: DEV_REF,
        applied: false,
        already_present: true,
        present: already.present,
        prod_untouched: true,
      }),
    )
    return
  }
  const token = accessToken()
  if (!token) {
    console.log(
      JSON.stringify({
        target_project_ref: DEV_REF,
        applied: false,
        already_present: false,
        present: already.present,
        missing: already.missing,
        blocked: 'missing_supabase_access_token',
        prod_untouched: true,
      }),
    )
    process.exitCode = 0
    return
  }
  const sql = readFileSync(sqlPath, 'utf8')
  const response = await fetch(`${API_BASE}/v1/projects/${DEV_REF}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  })
  const text = await response.text()
  const after = await columnsExist(env.url, env.service)
  console.log(
    JSON.stringify({
      target_project_ref: DEV_REF,
      applied: after.ok,
      status: response.status,
      preview: text.slice(0, 200),
      prod_untouched: true,
    }),
  )
  if (!after.ok) process.exitCode = 1
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
