/**
 * Apply pscs_one_user_id on Catering DEV only.
 * Never prints tokens. Aborts on Catering PROD.
 *
 *   node scripts/dev/apply-pscs-one-user-id-dev.mjs
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const CATERING_DEV_REF = 'yasprgtlqclwsjcshtls'
const CATERING_PROD_REF = 'eapwtirhevxrqinytans'
const API_BASE = 'https://api.supabase.com'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const sqlPath = join(root, 'supabase', 'migrations', '20260820090000_pscs_one_user_id.sql')

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

function requireToken() {
  const candidates = [
    process.env.SUPABASE_ACCESS_TOKEN,
    parseEnvFile(join(root, '.env.local')).get('SUPABASE_ACCESS_TOKEN'),
    parseEnvFile(join('D:', 'PSCS', 'PSCS ONE', '.env.local')).get('SUPABASE_ACCESS_TOKEN'),
    parseEnvFile(join('D:', 'PSCS', 'catering-ai-platform', '.env.local')).get(
      'SUPABASE_ACCESS_TOKEN',
    ),
  ]
  const token = candidates.find((value) => Boolean(value && value.length > 8))
  if (!token) {
    throw new Error('SUPABASE_ACCESS_TOKEN missing. Do not use supabase login.')
  }
  return token
}

async function api(token, path, init = {}) {
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
    'User-Agent': 'pscs-catering-sso-agent/1.0',
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
  const token = requireToken()
  const { status, body } = await api(token, `/v1/projects/${CATERING_DEV_REF}`)
  if (status !== 200 || !body || typeof body !== 'object') {
    throw new Error(`Project lookup failed HTTP ${status}`)
  }
  const id = String(body.id ?? '')
  const name = String(body.name ?? '')
  if (id === CATERING_PROD_REF) {
    throw new Error('Refused: Catering PROD')
  }
  if (id !== CATERING_DEV_REF) {
    throw new Error(`Refused: expected ${CATERING_DEV_REF}, got ${id}`)
  }

  const sql = readFileSync(sqlPath, 'utf8')
  const apply = await api(token, `/v1/projects/${CATERING_DEV_REF}/database/query`, {
    method: 'POST',
    body: JSON.stringify({ query: sql }),
  })
  if (apply.status !== 200 && apply.status !== 201) {
    throw new Error(`SQL apply failed HTTP ${apply.status}`)
  }

  const proofSql = `
select
  '${CATERING_DEV_REF}' as target_project_ref,
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'app_users'
      and column_name = 'pscs_one_user_id'
  ) as pscs_one_user_id_ok;
`
  const proof = await api(token, `/v1/projects/${CATERING_DEV_REF}/database/query`, {
    method: 'POST',
    body: JSON.stringify({ query: proofSql }),
  })
  if (proof.status !== 200 && proof.status !== 201) {
    throw new Error(`Proof query failed HTTP ${proof.status}`)
  }

  console.log(
    JSON.stringify(
      {
        target_project_ref: id,
        project_name: name,
        prod_untouched: true,
        proof: proof.body,
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
