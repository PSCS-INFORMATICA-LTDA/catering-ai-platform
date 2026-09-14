/**
 * Prove get_public_quote_proposal is no longer executable by public API roles.
 * DEV only. Does not DROP the function. Does not rewrite it.
 *
 *   node scripts/dev/test-public-proposal-rpc-hardening.mjs
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { assertDevUrl, DEV_REF, loadDevEnv, PROD_REF } from './loadDevEnv.mjs'
import {
  classifyProposalRpcCall,
  isHardened,
} from './publicProposalRpcHardening.mjs'

const API_BASE = 'https://api.supabase.com'
const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const DUMMY_TOKEN = 'qa-rpc-hardening-probe-token-32chars-min'
const FUNCTION_NAME = 'get_public_quote_proposal'

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

const rows = []
function record(id, ok, detail) {
  rows.push({ id, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${id}  ${detail}`)
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
      body = { parse_error: true, body_length: text.length }
    }
  }
  return { status: response.status, body }
}

async function rpcAs(url, key, token = DUMMY_TOKEN) {
  const db = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data, error } = await db.rpc(FUNCTION_NAME, { p_token: token })
  return classifyProposalRpcCall(data, error)
}

async function sampleProposalToken(url, service) {
  const db = createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data, error } = await db
    .from('quotes')
    .select('proposal_token, quote_number')
    .eq('company_id', '65fd576f-8d97-49ba-bf38-61bc1e94e94a')
    .not('proposal_token', 'is', null)
    .limit(1)
    .maybeSingle()
  if (error || !data?.proposal_token) return { token: null, quoteNumber: null }
  return { token: data.proposal_token, quoteNumber: data.quote_number }
}

function mentionsFunction(value) {
  return JSON.stringify(value || {}).includes(FUNCTION_NAME)
}

async function main() {
  const env = loadDevEnv(root)
  assertDevUrl(env.url)
  if (String(env.url).includes(PROD_REF)) throw new Error('Refused: Catering PROD')

  const sample = await sampleProposalToken(env.url, env.service)
  const probeToken = sample.token || DUMMY_TOKEN
  const anon = await rpcAs(env.url, env.anon, probeToken)
  record(
    'A-anon-no-execute',
    isHardened(anon) && anon.kind !== 'executed_broken_schema',
    JSON.stringify({ ...anon, via: sample.token ? 'real_token' : 'dummy_token', quote: sample.quoteNumber }),
  )

  const email = process.env.CATERING_DEV_LOGIN_EMAIL
  const password = process.env.CATERING_DEV_LOGIN_PASSWORD
  if (!email || !password) {
    record('B-authenticated-no-execute', false, 'CATERING_DEV_LOGIN_* required')
  } else {
    const auth = createClient(env.url, env.anon, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const signed = await auth.auth.signInWithPassword({ email, password })
    if (signed.error || !signed.data.session) {
      record('B-authenticated-no-execute', false, signed.error?.message || 'login failed')
    } else {
      const { data, error } = await auth.rpc(FUNCTION_NAME, { p_token: probeToken })
      const authenticated = classifyProposalRpcCall(data, error)
      record(
        'B-authenticated-no-execute',
        isHardened(authenticated) && authenticated.kind !== 'executed_broken_schema',
        JSON.stringify(authenticated),
      )
    }
  }

  const service = await rpcAs(env.url, env.service, probeToken)
  record(
    'C-service-role-no-execute',
    isHardened(service) && service.kind !== 'executed_broken_schema',
    JSON.stringify(service),
  )

  const token = accessToken()
  let advisor = {
    ran: false,
    blocked: token ? null : 'missing_supabase_access_token',
    anon_authenticated_hits: null,
  }
  if (token) {
    const grantSql = `
      SELECT r.rolname,
             has_function_privilege(r.oid, 'public.get_public_quote_proposal(text)', 'EXECUTE') AS can_execute
      FROM pg_roles r
      WHERE r.rolname IN ('anon', 'authenticated', 'service_role')
      ORDER BY r.rolname;
    `
    const grants = await management(token, `/v1/projects/${DEV_REF}/database/query`, {
      method: 'POST',
      body: JSON.stringify({ query: grantSql }),
    })
    const grantRows = Array.isArray(grants.body) ? grants.body : []
    const grantMap = Object.fromEntries(
      grantRows.map((row) => [row.rolname, row.can_execute]),
    )
    record(
      'GRANT-anon',
      grantMap.anon === false,
      JSON.stringify({ status: grants.status, can_execute: grantMap.anon ?? null }),
    )
    record(
      'GRANT-authenticated',
      grantMap.authenticated === false,
      JSON.stringify({
        status: grants.status,
        can_execute: grantMap.authenticated ?? null,
      }),
    )
    record(
      'GRANT-service_role',
      grantMap.service_role === false,
      JSON.stringify({
        status: grants.status,
        can_execute: grantMap.service_role ?? null,
      }),
    )

    const endpoints = [
      `/v1/projects/${DEV_REF}/advisors/security`,
      `/v1/projects/${DEV_REF}/database/lint`,
    ]
    const payloads = []
    for (const path of endpoints) {
      const result = await management(token, path)
      payloads.push({ path, status: result.status, body: result.body })
    }
    const hits = payloads.flatMap((item) => {
      const list = Array.isArray(item.body)
        ? item.body
        : Array.isArray(item.body?.result)
          ? item.body.result
          : Array.isArray(item.body?.lints)
            ? item.body.lints
            : []
      return list.filter((row) => mentionsFunction(row))
    })
    const publicHits = hits.filter((row) => {
      const blob = JSON.stringify(row).toLowerCase()
      return (
        blob.includes('anon_security_definer_function_executable') ||
        blob.includes('authenticated_security_definer_function_executable') ||
        blob.includes('"anon"') ||
        blob.includes('"authenticated"')
      )
    })
    advisor = {
      ran: payloads.some((item) => item.status === 200),
      endpoints: payloads.map((item) => ({ path: item.path, status: item.status })),
      function_hits: hits.length,
      anon_authenticated_hits: publicHits.length,
    }
    record(
      'ADVISOR-rpc-not-anon-or-authenticated',
      advisor.ran && publicHits.length === 0,
      JSON.stringify(advisor),
    )
  } else {
    record(
      'ADVISOR-rpc-not-anon-or-authenticated',
      false,
      'missing_supabase_access_token',
    )
  }

  const failed = rows.filter((row) => !row.ok)
  const report = {
    target_project_ref: DEV_REF,
    prod_untouched: true,
    function: FUNCTION_NAME,
    passed: rows.filter((row) => row.ok).length,
    failed: failed.length,
    advisor,
    rows,
  }
  console.log(JSON.stringify(report, null, 2))
  if (failed.length) process.exitCode = 1
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
