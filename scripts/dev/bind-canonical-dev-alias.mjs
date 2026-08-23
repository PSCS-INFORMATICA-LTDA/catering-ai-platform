/**
 * Bind the canonical DEV/HML domain to the latest Git preview of the
 * functional DEV branch. Never targets Production. Never touches cateringai.app.
 *
 * Root cause this script permanently counters:
 * a CLI `vercel deploy --prod` creates a target=production deployment with
 * no Git SHA. If autoAssignCustomDomains is true (or gitBranch is cleared),
 * that production deployment steals catering-ai-agenda-dev.vercel.app and
 * the old app redirects /quote to /login.
 *
 * This script always:
 * 1. forces autoAssignCustomDomains=false
 * 2. forces domain.gitBranch=feat/public-self-service-quote-dev
 * 3. assigns the alias onto the latest READY Git preview of that branch
 * 4. refuses CLI / production / SHA-less deployments
 *
 * Run: node scripts/dev/bind-canonical-dev-alias.mjs
 */
const CANONICAL_DEV_HOST = 'catering-ai-agenda-dev.vercel.app'
const DEV_GIT_BRANCH = 'feat/public-self-service-quote-dev'
const PROJECT_ID = 'prj_sSQ2wfVen9FeKpsEPFw7Vj8SBE9v'
const TEAM_ID = 'team_Fvr3LpYcuZFW3PS6l0lkTtnu'
const FORBIDDEN_HOSTS = new Set([
  'cateringai.app',
  'www.cateringai.app',
  'catering-ai-platform.vercel.app',
])

const token = process.env.VERCEL_TOKEN
if (!token) {
  console.error('VERCEL_TOKEN is required.')
  process.exit(1)
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

function assertSafeHost(host) {
  if (FORBIDDEN_HOSTS.has(host) || host.endsWith('.cateringai.app')) {
    throw new Error(`Refusing to touch ${host}`)
  }
}

function isStolenDeployment(deployment) {
  const meta = deployment?.meta || {}
  return (
    deployment?.target === 'production' ||
    deployment?.source === 'cli' ||
    !meta.githubCommitSha ||
    meta.githubCommitRef !== DEV_GIT_BRANCH
  )
}

assertSafeHost(CANONICAL_DEV_HOST)

const beforeAlias = await api('GET', `/v2/aliases/${CANONICAL_DEV_HOST}?teamId=${TEAM_ID}`)
let beforeDeployment = null
if (beforeAlias.deploymentId) {
  beforeDeployment = await api(
    'GET',
    `/v13/deployments/${beforeAlias.deploymentId}?teamId=${TEAM_ID}`,
  )
  const stolen = isStolenDeployment(beforeDeployment)
  console.log(
    JSON.stringify(
      {
        phase: 'before',
        stolen,
        deploymentId: beforeAlias.deploymentId,
        target: beforeDeployment.target || null,
        source: beforeDeployment.source || '',
        sha: beforeDeployment.meta?.githubCommitSha || '',
        ref: beforeDeployment.meta?.githubCommitRef || '',
      },
      null,
      2,
    ),
  )
  if (stolen) {
    console.log(
      'ALERT canonical DEV host is on a CLI/production/non-DEV-branch deployment; rebinding to Git preview.',
    )
  }
}

const project = await api(
  'PATCH',
  `/v9/projects/${PROJECT_ID}?teamId=${TEAM_ID}`,
  { autoAssignCustomDomains: false },
)
if (project.autoAssignCustomDomains !== false) {
  throw new Error('Failed to keep autoAssignCustomDomains=false')
}
console.log(`autoAssignCustomDomains=${project.autoAssignCustomDomains}`)

const domain = await api(
  'PATCH',
  `/v9/projects/${PROJECT_ID}/domains/${CANONICAL_DEV_HOST}?teamId=${TEAM_ID}`,
  { gitBranch: DEV_GIT_BRANCH },
)
if (domain.gitBranch !== DEV_GIT_BRANCH) {
  throw new Error(`Failed to pin domain gitBranch to ${DEV_GIT_BRANCH}`)
}
console.log(`domain ${domain.name} gitBranch=${domain.gitBranch}`)

const listing = await api(
  'GET',
  `/v6/deployments?projectId=${PROJECT_ID}&teamId=${TEAM_ID}&limit=40`,
)
const match = (listing.deployments || []).find((deployment) => {
  const meta = deployment.meta || {}
  return (
    deployment.state === 'READY' &&
    deployment.target !== 'production' &&
    deployment.source !== 'cli' &&
    Boolean(meta.githubCommitSha) &&
    meta.githubCommitRef === DEV_GIT_BRANCH
  )
})
if (!match?.uid) {
  throw new Error(`No READY Git preview found for ${DEV_GIT_BRANCH}`)
}
if (isStolenDeployment(match)) {
  throw new Error(`Refusing to bind canonical DEV to ${match.uid}`)
}

const assigned = await api(
  'POST',
  `/v2/deployments/${match.uid}/aliases?teamId=${TEAM_ID}`,
  { alias: CANONICAL_DEV_HOST },
)
console.log(
  `bound ${CANONICAL_DEV_HOST} -> ${match.uid} (${match.url || ''} sha=${(match.meta?.githubCommitSha || '').slice(0, 8)})`,
)
console.log(`alias uid ${assigned.uid}`)

const afterAlias = await api('GET', `/v2/aliases/${CANONICAL_DEV_HOST}?teamId=${TEAM_ID}`)
if (afterAlias.deploymentId !== match.uid) {
  throw new Error(
    `Alias verification failed: expected ${match.uid}, got ${afterAlias.deploymentId}`,
  )
}
const afterDeployment = await api(
  'GET',
  `/v13/deployments/${afterAlias.deploymentId}?teamId=${TEAM_ID}`,
)
if (isStolenDeployment(afterDeployment)) {
  throw new Error(
    `Canonical host still points at CLI/production after bind (${afterAlias.deploymentId})`,
  )
}
console.log(
  JSON.stringify(
    {
      phase: 'after',
      stolen: false,
      deploymentId: afterAlias.deploymentId,
      target: afterDeployment.target || null,
      source: afterDeployment.source || '',
      sha: afterDeployment.meta?.githubCommitSha || '',
      ref: afterDeployment.meta?.githubCommitRef || '',
    },
    null,
    2,
  ),
)
