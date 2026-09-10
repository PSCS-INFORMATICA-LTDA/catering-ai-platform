/**
 * Apply Brasinha conversation persistence on Catering DEV only.
 * Never prints tokens. Aborts on Catering PROD.
 *
 *   node scripts/dev/apply-brasinha-persistence-migration.mjs
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
  '20260903030000_brasinha_conversations_v1a.sql',
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
      'SUPABASE_ACCESS_TOKEN missing. Apply supabase/migrations/20260903030000_brasinha_conversations_v1a.sql in the DEV SQL editor only (yasprgtlqclwsjcshtls).',
    )
  }
  return token
}

async function api(token, path, init = {}) {
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
    'User-Agent': 'catering-brasinha-v1a/1.0',
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

async function proveTables(env) {
  const sb = createClient(env.url, env.service, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const conversations = await sb
    .from('brasinha_conversations')
    .select('id')
    .limit(1)
  const messages = await sb.from('brasinha_messages').select('id').limit(1)
  return {
    conversations_ok: !conversations.error,
    messages_ok: !messages.error,
    conversations_error: conversations.error?.message ?? null,
    messages_error: messages.error?.message ?? null,
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

  const already = await proveTables(env)
  if (already.conversations_ok && already.messages_ok) {
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

  const proof = await proveTables(env)
  if (!proof.conversations_ok || !proof.messages_ok) {
    throw new Error('Tables missing after apply')
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
