/**
 * Apply 20260913190825_coupon_customer_usage_lock on Catering DEV only.
 * The live DEV history already recorded this version. The script probes first
 * and must no-op when public.reserve_quote_coupon_application already exists.
 * Never prints tokens. Aborts on Catering PROD. Does not invent 20260913040124.
 *
 *   node scripts/dev/apply-coupon-customer-usage-lock-dev.mjs
 */
import { execSync } from 'node:child_process'
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
  '20260913190825_coupon_customer_usage_lock.sql',
)
const FORBIDDEN = '20260913040124_coupon_rules_v1'

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

async function management(token, path, init = {}) {
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
    'User-Agent': 'catering-coupon-center-dev/1.0',
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

async function rpcExists(url, service) {
  const db = createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { error } = await db.rpc('reserve_quote_coupon_application', {
    p_company_id: null,
    p_quote_id: null,
    p_coupon_id: null,
    p_payload: {},
  })
  const text = [error?.message, error?.details, error?.hint, error?.code]
    .filter(Boolean)
    .join(' ')
  if (/coupon_invalid_arguments/i.test(text)) return { ok: true, via: 'rpc_probe' }
  if (!error) return { ok: true, via: 'rpc_probe_empty' }
  if (/PGRST202|Could not find the function|404/i.test(text)) {
    return { ok: false, via: 'rpc_missing', text }
  }
  return { ok: /reserve_quote_coupon_application/i.test(text) === false && /usage_limit|quote_not_found|coupon_not_found/i.test(text), via: 'rpc_other', text }
}

function refuseIfProd(value) {
  if (String(value || '').includes(PROD_REF)) {
    throw new Error('Refused: Catering PROD')
  }
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

function applyViaCli(sql) {
  const linked = existsSync(join(root, 'supabase/.temp/project-ref'))
    ? readFileSync(join(root, 'supabase/.temp/project-ref'), 'utf8').trim()
    : ''
  refuseIfProd(linked)
  const token = accessToken()
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
  const tmp = join(root, 'supabase/.temp/coupon-usage-lock.apply.sql')
  if (!existsSync(join(root, 'supabase/.temp'))) {
    return { ok: false, method: 'cli', preview: 'no supabase/.temp' }
  }
  void sql
  void tmp
  try {
    const output = execSync(
      `npx supabase db execute --file "${sqlPath}" --linked`,
      {
        cwd: root,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        env: token ? { ...process.env, SUPABASE_ACCESS_TOKEN: token } : process.env,
      },
    )
    return { ok: true, method: 'cli_db_execute', preview: output.slice(0, 240) }
  } catch (error) {
    return {
      ok: false,
      method: 'cli_db_execute',
      preview: String(error.stderr || error.stdout || error.message || error).slice(0, 400),
    }
  }
}

async function main() {
  if (!existsSync(sqlPath)) throw new Error('migration file missing')
  if (existsSync(join(root, 'supabase/migrations', FORBIDDEN))) {
    throw new Error(`Refused: ${FORBIDDEN} must not be fabricated`)
  }
  const env = loadDevEnv(root)
  assertDevUrl(env.url)
  refuseIfProd(env.url)
  const sql = readFileSync(sqlPath, 'utf8')
  if (/coupon_rules/i.test(sql)) {
    throw new Error('Refused: usage-lock migration must not mention coupon_rules')
  }

  const already = await rpcExists(env.url, env.service)
  if (already.ok) {
    console.log(
      JSON.stringify(
        {
          target_project_ref: DEV_REF,
          prod_untouched: true,
          fabricated_40124: false,
          already_applied: true,
          proof: already,
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
    attempts.push({ ok: false, method: 'management_query', preview: 'no access token' })
  }
  if (!attempts.at(-1)?.ok) {
    attempts.push(applyViaCli(sql))
  }

  const applied = attempts.find((row) => row.ok)
  const proof = await rpcExists(env.url, env.service)
  if (!proof.ok) {
    throw new Error(
      `RPC still missing after apply: ${JSON.stringify({ attempts, proof })}`,
    )
  }

  console.log(
    JSON.stringify(
      {
        target_project_ref: DEV_REF,
        prod_untouched: true,
        fabricated_40124: false,
        applied: applied || attempts.at(-1),
        attempts,
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
