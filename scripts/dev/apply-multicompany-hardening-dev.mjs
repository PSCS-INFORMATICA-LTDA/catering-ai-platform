/**
 * Apply Issue #52 migrations on Catering DEV only.
 * Never apply to PROD. No-ops when SUPABASE_ACCESS_TOKEN is missing.
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { assertDevUrl, DEV_REF, loadDevEnv, PROD_REF } from './loadDevEnv.mjs'

const API_BASE = 'https://api.supabase.com'
const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const FILES = [
  'supabase/migrations/20260917201000_multicompany_tenant_fks.sql',
  'supabase/migrations/20260917202000_multicompany_composite_integrity.sql',
  'supabase/migrations/20260917203000_multicompany_config_rls_and_qa_b.sql',
]

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

async function api(token, path, init = {}) {
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
    'User-Agent': 'pscs-catering-multicompany-agent/1.0',
    ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    ...init.headers,
  }
  const response = await fetch(`${API_BASE}${path}`, { ...init, headers })
  const text = await response.text()
  let body = null
  if (text) {
    try {
      body = JSON.parse(text)
    } catch {
      body = { parse_error: true, body_length: text.length }
    }
  }
  return { status: response.status, body }
}

async function main() {
  const env = loadDevEnv(root)
  assertDevUrl(env.url)
  const token = accessToken()
  if (!token) {
    console.log(
      JSON.stringify(
        {
          project_ref: DEV_REF,
          applied: false,
          reason: 'SUPABASE_ACCESS_TOKEN missing',
          prod_touched: false,
        },
        null,
        2,
      ),
    )
    return
  }

  const project = await api(token, `/v1/projects/${DEV_REF}`)
  if (project.status !== 200) {
    throw new Error(`project_lookup_${project.status}`)
  }
  if (String(project.body?.id ?? '') === PROD_REF) {
    throw new Error('Refused: Catering PROD')
  }

  for (const rel of FILES) {
    const sql = readFileSync(join(root, rel), 'utf8')
    const apply = await api(token, `/v1/projects/${DEV_REF}/database/query`, {
      method: 'POST',
      body: JSON.stringify({ query: sql }),
    })
    if (apply.status !== 200 && apply.status !== 201) {
      throw new Error(`${rel} apply failed HTTP ${apply.status}`)
    }
    console.log(`applied ${rel}`)
  }

  if (env.service) {
    const db = createClient(env.url, env.service, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data } = await db
      .from('document_sequences')
      .select('company_id, document_type, active, current_number')
      .eq('company_id', '00000000-0000-4000-8000-000000000000')
    console.log(JSON.stringify({ sentinel_after: data, prod_touched: false }, null, 2))
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'apply_failed')
  process.exit(1)
})
