/**
 * Reaffirm catering-ai-agenda-dev.vercel.app on the current Production deployment
 * after smoke that the deployment JS bundle targets Catering DEV supabase.
 * Does not print secrets.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const TEAM = 'team_Fvr3LpYcuZFW3PS6l0lkTtnu'
const PROJECT = 'prj_sSQ2wfVen9FeKpsEPFw7Vj8SBE9v'
const ALIAS = 'catering-ai-agenda-dev.vercel.app'
const DEV_REF = 'yasprgtlqclwsjcshtls'
const PROD_REF = 'eapwtirhevxrqinytans'

function vercelToken() {
  const authPath = join(process.env.APPDATA || '', 'xdg.data', 'com.vercel.cli', 'auth.json')
  if (!existsSync(authPath)) throw new Error('vercel auth.json missing')
  const parsed = JSON.parse(readFileSync(authPath, 'utf8'))
  if (!parsed.token) throw new Error('vercel token missing')
  return String(parsed.token)
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

async function main() {
  const token = vercelToken()
  const listed = await api(
    token,
    `/v6/deployments?projectId=${PROJECT}&teamId=${TEAM}&limit=20`,
  )
  if (listed.status >= 300) {
    throw new Error(`deployments list failed: ${listed.status}`)
  }
  const deployments = listed.body.deployments || []
  const production =
    deployments.find((row) => row.target === 'production' && row.readyState === 'READY') ||
    deployments.find((row) => row.target === 'production') ||
    deployments.find((row) => row.readyState === 'READY')
  if (!production?.uid) {
    throw new Error(`no production deployment found (http ${listed.status}, n=${deployments.length})`)
  }

  const inspect = await api(token, `/v13/deployments/${production.uid}?teamId=${TEAM}`)
  const meta = inspect.body.meta || {}
  const gitSha = meta.githubCommitSha || inspect.body.source?.sha || 'unknown'
  const urlHost = String(inspect.body.url || production.url || '')

  const html = await fetch(`https://${urlHost.replace(/^https?:\/\//, '')}`).then((r) => r.text())
  const scripts = [...html.matchAll(/\/_next\/static\/chunks\/[^"]+\.js/g)].map((m) => m[0])
  let bundle = ''
  for (const path of scripts.slice(0, 12)) {
    const js = await fetch(`https://${urlHost.replace(/^https?:\/\//, '')}${path}`).then((r) => r.text())
    bundle += js
    if (js.includes(DEV_REF) || js.includes(PROD_REF)) break
  }
  if (bundle.includes(PROD_REF)) {
    throw new Error(`refused: production deployment still embeds Catering PROD ${PROD_REF}`)
  }
  if (!bundle.includes(DEV_REF)) {
    throw new Error(`refused: production deployment JS does not embed Catering DEV ${DEV_REF}`)
  }

  const assigned = await api(token, `/v2/deployments/${production.uid}/aliases?teamId=${TEAM}`, {
    method: 'POST',
    body: JSON.stringify({ alias: ALIAS }),
  })
  if (assigned.status >= 300) {
    throw new Error(`alias assign failed: ${assigned.status}`)
  }

  const aliasInfo = await api(token, `/v4/aliases/${ALIAS}?teamId=${TEAM}`)
  const aliasDeployment = aliasInfo.body.deploymentId || aliasInfo.body.deployment?.id
  console.log(
    JSON.stringify({
      ok: true,
      alias: ALIAS,
      deployment: production.uid,
      git_sha: gitSha,
      supabase_ref: DEV_REF,
      alias_deployment_matches: aliasDeployment === production.uid || !aliasDeployment,
    }),
  )
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'pin alias failed')
  process.exit(1)
})
