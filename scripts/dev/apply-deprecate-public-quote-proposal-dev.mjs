/**
 * Probe-first helper for 20260914183400_deprecate_get_public_quote_proposal.
 * Catering DEV only (yasprgtlqclwsjcshtls). Never apply to PROD.
 * Does not DROP the function. Does not rewrite the function body.
 * Does not edit schema_migrations.
 *
 *   node scripts/dev/apply-deprecate-public-quote-proposal-dev.mjs
 */
import { execSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { assertDevUrl, DEV_REF, loadDevEnv, PROD_REF } from './loadDevEnv.mjs'
import { classifyProposalRpcCall } from './publicProposalRpcHardening.mjs'

const API_BASE = 'https://api.supabase.com'
const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const MIGRATION = '20260914183400_deprecate_get_public_quote_proposal.sql'
const sqlPath = join(root, 'supabase', 'migrations', MIGRATION)
const DUMMY_TOKEN = 'qa-rpc-hardening-probe-token-32chars-min'

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
  const candidates = [
    process.env.SUPABASE_ACCESS_TOKEN,
    process.env.SUPABASE_PERSONAL_ACCESS_TOKEN,
    parseEnvFile(join(root, '.env.local')).get('SUPABASE_ACCESS_TOKEN'),
    parseEnvFile(join(root, '.env.local')).get('SUPABASE_PERSONAL_ACCESS_TOKEN'),
  ]
  return candidates.find((value) => Boolean(value && value.length > 8)) || ''
}

function refuseIfProd(value) {
  if (String(value || '').includes(PROD_REF)) {
    throw new Error('Refused: Catering PROD')
  }
}

function assertSafeSql(sql) {
  if (/drop\s+function/i.test(sql)) {
    throw new Error('Refused: this helper must not DROP the function')
  }
  if (/create\s+or\s+replace\s+function/i.test(sql)) {
    throw new Error('Refused: this helper must not rewrite the function body')
  }
  if (/get_public_supplier_garnish|get_public_team_assignment|get_public_team_member_confirmation|get_public_material_dispatch|respond_to_quote_proposal/i.test(sql)) {
    throw new Error('Refused: this helper must not touch unrelated public-token RPCs')
  }
}

async function management(token, path, init = {}) {
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
    'User-Agent': 'catering-commercial-review-dev/1.0',
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
      body = { parse_error: true, body_length: text.length, preview: text.slice(0, 240) }
    }
  }
  return { status: response.status, body, text }
}

async function callRpc(url, key) {
  const db = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data, error } = await db.rpc('get_public_quote_proposal', {
    p_token: DUMMY_TOKEN,
  })
  return classifyProposalRpcCall(data, error)
}

async function probeRoles(env) {
  const anon = await callRpc(env.url, env.anon)
  const service = await callRpc(env.url, env.service)
  let authenticated = { executable: null, kind: 'login_skipped' }
  const email = process.env.CATERING_DEV_LOGIN_EMAIL
  const password = process.env.CATERING_DEV_LOGIN_PASSWORD
  if (email && password) {
    const auth = createClient(env.url, env.anon, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const signed = await auth.auth.signInWithPassword({ email, password })
    if (signed.error || !signed.data.session) {
      authenticated = {
        executable: null,
        kind: 'login_failed',
        code: signed.error?.code || null,
      }
    } else {
      const { data, error } = await auth.rpc('get_public_quote_proposal', {
        p_token: DUMMY_TOKEN,
      })
      authenticated = classifyProposalRpcCall(data, error)
    }
  }
  return { anon, authenticated, service_role: service }
}

function allRevoked(probe) {
  return (
    probe.anon.executable === false &&
    probe.authenticated.executable === false &&
    probe.service_role.executable === false
  )
}

async function applyViaManagement(token, sql) {
  const project = await management(token, `/v1/projects/${DEV_REF}`)
  if (project.status !== 200 || !project.body || typeof project.body !== 'object') {
    return { ok: false, method: 'management_project', status: project.status }
  }
  const id = String(project.body.id ?? '')
  refuseIfProd(id)
  if (id !== DEV_REF) {
    throw new Error(`Refused: expected ${DEV_REF}, got ${id}`)
  }
  const apply = await management(token, `/v1/projects/${DEV_REF}/database/query`, {
    method: 'POST',
    body: JSON.stringify({ query: sql }),
  })
  return {
    ok: apply.status === 200 || apply.status === 201,
    method: 'management_query',
    status: apply.status,
    preview: JSON.stringify(apply.body).slice(0, 240),
  }
}

function applyViaCli() {
  const linked = existsSync(join(root, 'supabase/.temp/project-ref'))
    ? readFileSync(join(root, 'supabase/.temp/project-ref'), 'utf8').trim()
    : ''
  refuseIfProd(linked)
  const token = accessToken()
  const dbUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL || ''
  refuseIfProd(dbUrl)
  if (dbUrl && /eapwtirhevxrqinytans/.test(dbUrl)) {
    throw new Error('Refused: Catering PROD db url')
  }
  if (!linked && token) {
    execSync(`npx supabase link --project-ref ${DEV_REF}`, {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, SUPABASE_ACCESS_TOKEN: token },
    })
  }
  const confirm = existsSync(join(root, 'supabase/.temp/project-ref'))
    ? readFileSync(join(root, 'supabase/.temp/project-ref'), 'utf8').trim()
    : ''
  if (confirm && confirm !== DEV_REF) {
    throw new Error(`Refused: linked ref ${confirm}`)
  }
  const args = dbUrl
    ? `npx supabase db query --file "${sqlPath}" --db-url "${dbUrl}"`
    : `npx supabase db query --file "${sqlPath}" --linked`
  try {
    const output = execSync(args, {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: token ? { ...process.env, SUPABASE_ACCESS_TOKEN: token } : process.env,
    })
    return { ok: true, method: dbUrl ? 'cli_db_query_url' : 'cli_db_query', preview: output.slice(0, 240) }
  } catch (error) {
    return {
      ok: false,
      method: dbUrl ? 'cli_db_query_url' : 'cli_db_query',
      preview: String(error.stderr || error.stdout || error.message || error).slice(0, 400),
    }
  }
}

async function main() {
  if (!existsSync(sqlPath)) throw new Error(`migration file missing: ${MIGRATION}`)
  const env = loadDevEnv(root)
  assertDevUrl(env.url)
  refuseIfProd(env.url)
  const sql = readFileSync(sqlPath, 'utf8')
  assertSafeSql(sql)

  const before = await probeRoles(env)
  if (allRevoked(before)) {
    console.log(
      JSON.stringify(
        {
          target_project_ref: DEV_REF,
          prod_untouched: true,
          migration: MIGRATION,
          applied: false,
          already_revoked: true,
          proof: before,
        },
        null,
        2,
      ),
    )
    return
  }

  const attempts = []
  const token = accessToken()
  if (token) {
    attempts.push(await applyViaManagement(token, sql))
  } else {
    attempts.push({
      ok: false,
      method: 'management_query',
      preview: 'missing_supabase_access_token',
    })
  }
  if (!attempts.at(-1)?.ok) {
    attempts.push(applyViaCli())
  }

  const applied = attempts.find((row) => row.ok) || null
  const after = await probeRoles(env)
  const ok = allRevoked(after)
  const report = {
    target_project_ref: DEV_REF,
    prod_untouched: true,
    migration: MIGRATION,
    applied: Boolean(applied),
    already_revoked: false,
    attempts,
    before,
    proof: after,
    blocked: ok
      ? null
      : applied
        ? 'revoke_did_not_remove_execute'
        : 'cannot_revoke_rpc_without_management_token',
  }
  console.log(JSON.stringify(report, null, 2))
  if (!ok) process.exitCode = 1
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
