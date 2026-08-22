#!/usr/bin/env node
/**
 * Bind catering-ai-agenda-dev.vercel.app to the READY Git preview of THIS HEAD.
 * Never targets Production. Never touches cateringai.app.
 *
 * Unlike bind-canonical-dev-alias.mjs this does NOT force
 * feat/public-self-service-quote-dev — it pins the alias to the current
 * stacked media branch so QA can see Media V3 + SAVE reflect + restore.
 */
import { execSync } from 'node:child_process'

const CANONICAL_DEV_HOST = 'catering-ai-agenda-dev.vercel.app'
const PROJECT_ID = 'prj_sSQ2wfVen9FeKpsEPFw7Vj8SBE9v'
const TEAM_ID = 'team_Fvr3LpYcuZFW3PS6l0lkTtnu'
const FORBIDDEN_HOSTS = new Set([
  'cateringai.app',
  'www.cateringai.app',
  'catering-ai-platform.vercel.app',
])
const token = process.env.VERCEL_TOKEN
const expectedBranch =
  process.env.CANONICAL_ALIAS_BRANCH || execSync('git branch --show-current', { encoding: 'utf8' }).trim()
const expectedSha = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim()

if (!token) {
  console.error('VERCEL_TOKEN is required.')
  process.exit(1)
}

function assertSafeHost(host) {
  if (FORBIDDEN_HOSTS.has(host) || host.endsWith('.cateringai.app')) {
    throw new Error(`Refusing to touch ${host}`)
  }
}

async function api(method, path, body) {
  const response = await fetch(`https://api.vercel.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await response.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = { raw: text.slice(0, 400) }
  }
  if (!response.ok) {
    throw new Error(`${method} ${path} -> ${response.status} ${JSON.stringify(data).slice(0, 400)}`)
  }
  return data
}

assertSafeHost(CANONICAL_DEV_HOST)

const project = await api('PATCH', `/v9/projects/${PROJECT_ID}?teamId=${TEAM_ID}`, {
  autoAssignCustomDomains: false,
})
if (project.autoAssignCustomDomains !== false) {
  throw new Error('Failed to keep autoAssignCustomDomains=false')
}
if (project.name !== 'catering-ai-platform') {
  throw new Error(`Unexpected Vercel project ${project.name}`)
}

const domain = await api(
  'PATCH',
  `/v9/projects/${PROJECT_ID}/domains/${CANONICAL_DEV_HOST}?teamId=${TEAM_ID}`,
  { gitBranch: expectedBranch },
)
console.log(`autoAssignCustomDomains=${project.autoAssignCustomDomains}`)
console.log(`domain ${domain.name} gitBranch=${domain.gitBranch}`)

const listing = await api(
  'GET',
  `/v6/deployments?projectId=${PROJECT_ID}&teamId=${TEAM_ID}&limit=60`,
)
const match = (listing.deployments || []).find((deployment) => {
  const meta = deployment.meta || {}
  return (
    deployment.state === 'READY' &&
    deployment.target !== 'production' &&
    Boolean(meta.githubCommitSha) &&
    meta.githubCommitSha === expectedSha &&
    meta.githubCommitRef === expectedBranch
  )
})
if (!match?.uid) {
  throw new Error(
    `No READY Git preview found for ${expectedBranch} @ ${expectedSha}. Deploy that SHA first.`,
  )
}
if (match.target === 'production') {
  throw new Error(`Refusing to bind Production deployment ${match.uid}`)
}

const assigned = await api('POST', `/v2/deployments/${match.uid}/aliases?teamId=${TEAM_ID}`, {
  alias: CANONICAL_DEV_HOST,
})
console.log(`bound ${CANONICAL_DEV_HOST} -> ${match.uid} sha=${expectedSha}`)
console.log(`alias uid ${assigned.uid}`)

const afterAlias = await api('GET', `/v2/aliases/${CANONICAL_DEV_HOST}?teamId=${TEAM_ID}`)
if (afterAlias.deploymentId !== match.uid) {
  throw new Error(`Alias verification failed: expected ${match.uid}, got ${afterAlias.deploymentId}`)
}
const afterDeployment = await api('GET', `/v13/deployments/${afterAlias.deploymentId}?teamId=${TEAM_ID}`)
const afterSha = afterDeployment.meta?.githubCommitSha || ''
if (afterSha !== expectedSha) {
  throw new Error(`ALIAS SHA ${afterSha} != HEAD ${expectedSha}`)
}
console.log(
  JSON.stringify(
    {
      ok: true,
      host: CANONICAL_DEV_HOST,
      deploymentId: afterAlias.deploymentId,
      sha: afterSha,
      ref: afterDeployment.meta?.githubCommitRef || '',
      target: afterDeployment.target || null,
      matchesHead: afterSha === expectedSha,
    },
    null,
    2,
  ),
)
