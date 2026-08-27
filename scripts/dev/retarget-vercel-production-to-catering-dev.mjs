/**
 * Copy Catering DEV Supabase URL/keys from Vercel Development → Production.
 * Aborts if source is not yasprgtlqclwsjcshtls or destination is already DEV.
 * Never prints secret values.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const CATERING_DEV_REF = 'yasprgtlqclwsjcshtls'
const CATERING_PROD_REF = 'eapwtirhevxrqinytans'
const TEAM = 'team_Fvr3LpYcuZFW3PS6l0lkTtnu'
const PROJECT = 'prj_sSQ2wfVen9FeKpsEPFw7Vj8SBE9v'
const KEYS = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY']

function vercelToken() {
  const authPath = join(
    process.env.APPDATA || '',
    'xdg.data',
    'com.vercel.cli',
    'auth.json',
  )
  if (!existsSync(authPath)) throw new Error('vercel auth.json missing')
  const parsed = JSON.parse(readFileSync(authPath, 'utf8'))
  if (!parsed.token) throw new Error('vercel token missing')
  return String(parsed.token)
}

function projectRefFromUrl(url) {
  try {
    const host = new URL(url).hostname
    const match = host.match(/^([a-z0-9]+)\.supabase\.co$/i)
    return match ? match[1] : 'not_supabase_host'
  } catch {
    return 'unparseable'
  }
}

async function api(token, path, init = {}) {
  const response = await fetch(`https://api.vercel.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  })
  const body = await response.json().catch(() => ({}))
  return { status: response.status, body }
}

function targetOf(row) {
  const targets = row.target || []
  if (targets.includes('development')) return 'development'
  if (targets.includes('production')) return 'production'
  if (targets.includes('preview')) return 'preview'
  return String(targets[0] || '')
}

async function main() {
  const token = vercelToken()
  const listed = await api(token, `/v9/projects/${PROJECT}/env?teamId=${TEAM}`)
  const envs = Array.isArray(listed.body.envs) ? listed.body.envs : []

  const byKey = {}
  for (const row of envs) {
    if (!KEYS.includes(row.key)) continue
    const target = targetOf(row)
    byKey[row.key] ??= {}
    byKey[row.key][target] = row
  }

  const sourceUrlRow = byKey.NEXT_PUBLIC_SUPABASE_URL?.development
  const destUrlRow = byKey.NEXT_PUBLIC_SUPABASE_URL?.production
  if (!sourceUrlRow || !destUrlRow) {
    throw new Error('missing url env rows')
  }

  const sourceUrl = await api(
    token,
    `/v9/projects/${PROJECT}/env/${sourceUrlRow.id}?teamId=${TEAM}&decrypt=true`,
  )
  const destUrl = await api(
    token,
    `/v9/projects/${PROJECT}/env/${destUrlRow.id}?teamId=${TEAM}&decrypt=true`,
  )
  const sourceRef = projectRefFromUrl(String(sourceUrl.body.value || ''))
  const destRef = destUrl.body.value
    ? projectRefFromUrl(String(destUrl.body.value))
    : 'encrypted_or_unknown'

  if (sourceRef !== CATERING_DEV_REF) {
    throw new Error(`refused: development supabase is ${sourceRef}`)
  }
  if (destRef === CATERING_DEV_REF) {
    console.log(JSON.stringify({ ok: true, already_dev: true, dest_ref: destRef }))
    return
  }

  for (const key of KEYS) {
    const source = byKey[key]?.development
    const dest = byKey[key]?.production
    if (!source || !dest) throw new Error(`missing ${key}`)
    const decrypted = await api(
      token,
      `/v9/projects/${PROJECT}/env/${source.id}?teamId=${TEAM}&decrypt=true`,
    )
    const value = String(decrypted.body.value || '')
    if (!value) throw new Error(`empty ${key}`)
    const removed = await api(token, `/v9/projects/${PROJECT}/env/${dest.id}?teamId=${TEAM}`, {
      method: 'DELETE',
    })
    if (removed.status >= 300) throw new Error(`rm ${key} failed HTTP ${removed.status}`)
    const added = await api(token, `/v10/projects/${PROJECT}/env?teamId=${TEAM}`, {
      method: 'POST',
      body: JSON.stringify({
        key,
        value,
        type: key === 'NEXT_PUBLIC_SUPABASE_URL' ? 'plain' : 'encrypted',
        target: ['production'],
      }),
    })
    if (added.status >= 300) throw new Error(`add ${key} failed HTTP ${added.status}`)
  }

  console.log(
    JSON.stringify({
      ok: true,
      switched_production_supabase: true,
      from_ref: destRef,
      to_ref: sourceRef,
      keys: KEYS,
      secret_logged: false,
    }),
  )
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'retarget_failed')
  process.exit(1)
})
