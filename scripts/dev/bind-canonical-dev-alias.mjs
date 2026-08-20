/**
 * Bind the canonical DEV/HML domain to the latest Git preview of the
 * functional DEV branch. Never targets Production. Never touches cateringai.app.
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

assertSafeHost(CANONICAL_DEV_HOST)

const project = await api(
  'PATCH',
  `/v9/projects/${PROJECT_ID}?teamId=${TEAM_ID}`,
  { autoAssignCustomDomains: false },
)
console.log(`autoAssignCustomDomains=${project.autoAssignCustomDomains}`)

const domain = await api(
  'PATCH',
  `/v9/projects/${PROJECT_ID}/domains/${CANONICAL_DEV_HOST}?teamId=${TEAM_ID}`,
  { gitBranch: DEV_GIT_BRANCH },
)
console.log(`domain ${domain.name} gitBranch=${domain.gitBranch}`)

const listing = await api(
  'GET',
  `/v6/deployments?projectId=${PROJECT_ID}&teamId=${TEAM_ID}&limit=20`,
)
const match = (listing.deployments || []).find((deployment) => {
  const meta = deployment.meta || {}
  return (
    deployment.state === 'READY' &&
    deployment.target !== 'production' &&
    meta.githubCommitRef === DEV_GIT_BRANCH
  )
})
if (!match?.uid) {
  throw new Error(`No READY Git preview found for ${DEV_GIT_BRANCH}`)
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
