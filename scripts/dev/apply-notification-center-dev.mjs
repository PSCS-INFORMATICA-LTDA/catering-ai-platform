/**
 * Probe-first apply of 20260917190000_notification_center_v1 on Catering DEV only.
 * Never apply to PROD. No-op when notification_events already exists.
 *
 *   node scripts/dev/apply-notification-center-dev.mjs
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
  '20260917190000_notification_center_v1.sql',
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

async function tableReady(url, service) {
  const db = createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { error } = await db.from('notification_events').select('id').limit(1)
  if (!error) return { ok: true, via: 'select' }
  return { ok: false, via: 'missing', text: error.message }
}

async function main() {
  const env = loadDevEnv(root)
  assertDevUrl(env.url)
  if (String(env.url).includes(PROD_REF)) throw new Error('Refused: Catering PROD')
  const already = await tableReady(env.url, env.service)
  if (already.ok) {
    console.log(
      JSON.stringify({
        target_project_ref: DEV_REF,
        applied: false,
        already_present: true,
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
  const after = await tableReady(env.url, env.service)
  console.log(
    JSON.stringify({
      target_project_ref: DEV_REF,
      applied: after.ok,
      status: response.status,
      preview: text.slice(0, 240),
      prod_untouched: true,
    }),
  )
  if (!after.ok) process.exitCode = 1
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
