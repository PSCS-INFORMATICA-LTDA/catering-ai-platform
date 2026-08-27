/**
 * Guard the canonical DEV/HML public quote.
 * Checks HTTP status on catering-ai-agenda-dev.vercel.app and, when
 * VERCEL_TOKEN is set, that the alias is a Git preview of the DEV branch
 * (not a CLI --prod deployment without SHA).
 *
 * Run: node scripts/dev/verify-dev-public-quote.mjs
 */
const CANONICAL = 'https://catering-ai-agenda-dev.vercel.app'
// Overridable like bind-canonical-dev-alias-to-head.mjs, so the check follows
// whichever DEV branch currently owns the canonical alias.
const DEV_GIT_BRANCH =
  process.env.CANONICAL_ALIAS_BRANCH || 'feat/public-self-service-quote-dev'
const PROJECT_ID = 'prj_sSQ2wfVen9FeKpsEPFw7Vj8SBE9v'
const TEAM_ID = 'team_Fvr3LpYcuZFW3PS6l0lkTtnu'
const HOST = 'catering-ai-agenda-dev.vercel.app'

async function head(path) {
  const response = await fetch(`${CANONICAL}${path}`, { method: 'GET', redirect: 'manual' })
  return {
    path,
    status: response.status,
    location: response.headers.get('location'),
  }
}

function fail(message) {
  console.error(`FAIL  ${message}`)
  process.exit(1)
}

const quotePt = await head('/quote/cdl/pt')
const quoteEn = await head('/quote/cdl/en')
const quoteEs = await head('/quote/cdl/es')
const quotes = await head('/quotes')

console.log(JSON.stringify({ quotePt, quoteEn, quoteEs, quotes }, null, 2))

for (const row of [quotePt, quoteEn, quoteEs]) {
  if (row.status !== 200) {
    fail(`${row.path} expected 200, got ${row.status} location=${row.location || ''}`)
  }
  if (row.location && row.location.includes('/login')) {
    fail(`${row.path} redirected to login`)
  }
}

if (quotes.status !== 307 && quotes.status !== 308) {
  fail(`/quotes expected 307/308 login redirect, got ${quotes.status}`)
}
if (!quotes.location || !quotes.location.includes('/login')) {
  fail(`/quotes must redirect to /login, got ${quotes.location}`)
}

const token = process.env.VERCEL_TOKEN
if (!token) {
  console.log('WARN  VERCEL_TOKEN missing; skipped SHA/alias check')
  console.log('PASS  canonical public quote HTTP checks')
  process.exit(0)
}

async function api(path) {
  const response = await fetch(`https://api.vercel.com${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const data = await response.json()
  if (!response.ok) {
    throw new Error(`${path} -> ${response.status} ${JSON.stringify(data).slice(0, 300)}`)
  }
  return data
}

const alias = await api(`/v2/aliases/${HOST}?teamId=${TEAM_ID}`)
const deploymentId = alias.deploymentId
if (!deploymentId) fail('canonical alias has no deploymentId')
const deployment = await api(`/v13/deployments/${deploymentId}?teamId=${TEAM_ID}`)
const meta = deployment.meta || {}
const sha = meta.githubCommitSha || ''
const ref = meta.githubCommitRef || ''
const target = deployment.target || null
const source = deployment.source || ''

console.log(
  JSON.stringify(
    {
      deploymentId,
      readyState: deployment.readyState,
      target,
      source,
      sha,
      ref,
    },
    null,
    2,
  ),
)

if (target === 'production' || source === 'cli' || !sha) {
  fail(
    `canonical domain is on a CLI/production deployment (${deploymentId}) instead of Git ${DEV_GIT_BRANCH}`,
  )
}
if (ref !== DEV_GIT_BRANCH) {
  fail(`canonical git ref is ${ref || '(empty)'}, expected ${DEV_GIT_BRANCH}`)
}

const project = await api(`/v9/projects/${PROJECT_ID}?teamId=${TEAM_ID}`)
if (project.autoAssignCustomDomains !== false) {
  fail('autoAssignCustomDomains must stay false so --prod cannot steal DEV')
}

const domainsPayload = await api(`/v9/projects/${PROJECT_ID}/domains?teamId=${TEAM_ID}`)
const domainList = Array.isArray(domainsPayload?.domains)
  ? domainsPayload.domains
  : Array.isArray(domainsPayload)
    ? domainsPayload
    : []
const canonicalDomain = domainList.find((row) => row.name === HOST)
if (!canonicalDomain || canonicalDomain.gitBranch !== DEV_GIT_BRANCH) {
  fail(
    `canonical domain gitBranch must stay ${DEV_GIT_BRANCH}, got ${canonicalDomain?.gitBranch || '(missing)'}`,
  )
}

console.log('PASS  canonical public quote HTTP + Git SHA alias checks')
