/**
 * Apply Brasinha V1C intake_draft column on Catering DEV only.
 * Never prints tokens. Aborts on Catering PROD.
 *
 *   node scripts/dev/apply-brasinha-intake-draft-migration.mjs
 */
import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { assertDevUrl, loadDevEnv } from './loadDevEnv.mjs'

const CATERING_DEV_REF = 'yasprgtlqclwsjcshtls'
const CATERING_PROD_REF = 'eapwtirhevxrqinytans'
const API_BASE = 'https://api.supabase.com'
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const SQL_PATH = join(
  ROOT,
  'supabase',
  'migrations',
  '20260904010000_brasinha_intake_draft_v1c.sql',
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

function readTokenFile(path) {
  if (!existsSync(path)) return ''
  return readFileSync(path, 'utf8').trim()
}

function requireToken() {
  const home = homedir()
  const candidates = [
    process.env.SUPABASE_ACCESS_TOKEN,
    process.env.SUPABASE_PERSONAL_ACCESS_TOKEN,
    parseEnvFile(join(ROOT, '.env.local')).get('SUPABASE_ACCESS_TOKEN'),
    parseEnvFile(join(ROOT, '.env')).get('SUPABASE_ACCESS_TOKEN'),
    readTokenFile(join(home, '.supabase', 'access-token')),
    readTokenFile(join(home, '.config', 'supabase', 'access-token')),
  ]
  const token = candidates.find((value) => Boolean(value && value.length > 8))
  if (!token) {
    throw new Error(
      'SUPABASE_ACCESS_TOKEN missing. Apply supabase/migrations/20260904010000_brasinha_intake_draft_v1c.sql in the DEV SQL editor only (yasprgtlqclwsjcshtls).',
    )
  }
  return token
}

async function api(token, path, init = {}) {
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
    'User-Agent': 'catering-brasinha-v1c/1.0',
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

async function proveColumn(env) {
  const sb = createClient(env.url, env.service, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const probe = await sb.from('brasinha_conversations').select('intake_draft').limit(1)
  return {
    intake_draft_ok: !probe.error,
    intake_draft_error: probe.error?.message ?? null,
  }
}

async function main() {
  const env = loadDevEnv(ROOT)
  const ref = assertDevUrl(env.url)
  if (ref === CATERING_PROD_REF) {
    throw new Error('Refused: Catering PROD')
  }
  if (!env.service) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY')
  }

  const already = await proveColumn(env)
  if (already.intake_draft_ok) {
    console.log(
      JSON.stringify(
        {
          target_project_ref: CATERING_DEV_REF,
          applied: false,
          already_present: true,
          prod_untouched: true,
          proof: already,
        },
        null,
        2,
      ),
    )
    return
  }

  const token = requireToken()
  const project = await api(token, `/v1/projects/${CATERING_DEV_REF}`)
  if (project.status !== 200 || !project.body || typeof project.body !== 'object') {
    throw new Error(`Project lookup failed HTTP ${project.status}`)
  }
  const id = String(project.body.id ?? '')
  if (id === CATERING_PROD_REF) {
    throw new Error('Refused: Catering PROD')
  }
  if (id !== CATERING_DEV_REF) {
    throw new Error(`Refused: expected ${CATERING_DEV_REF}, got ${id}`)
  }

  const sql = readFileSync(SQL_PATH, 'utf8')
  const apply = await api(token, `/v1/projects/${CATERING_DEV_REF}/database/query`, {
    method: 'POST',
    body: JSON.stringify({ query: sql }),
  })
  if (apply.status !== 200 && apply.status !== 201) {
    throw new Error(`SQL apply failed HTTP ${apply.status}`)
  }

  const proof = await proveColumn(env)
  if (!proof.intake_draft_ok) {
    throw new Error('intake_draft missing after apply')
  }

  console.log(
    JSON.stringify(
      {
        target_project_ref: id,
        applied: true,
        already_present: false,
        prod_untouched: true,
        proof,
      },
      null,
      2,
    ),
  )
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'apply_failed')
  process.exit(1)
})
