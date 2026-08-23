#!/usr/bin/env node
/**
 * Prove catering-ai-agenda-dev.vercel.app points at this branch HEAD.
 * Never inspects Production hosts.
 */
import { execSync } from 'node:child_process'

const CANONICAL_HOST = 'catering-ai-agenda-dev.vercel.app'
const PROJECT_ID = 'prj_sSQ2wfVen9FeKpsEPFw7Vj8SBE9v'
const TEAM_ID = 'team_Fvr3LpYcuZFW3PS6l0lkTtnu'
const EXPECTED_BRANCH = process.env.CANONICAL_ALIAS_BRANCH || 'cursor/media-save-public-reflect-f9ec'
const FORBIDDEN_HOSTS = ['cateringai.app', 'www.cateringai.app']
const token = process.env.VERCEL_TOKEN

let passed = 0
let failed = 0

function report(name, ok, detail = '') {
  if (ok) {
    passed += 1
    console.log(`PASS  ${name}${detail ? ` — ${detail}` : ''}`)
  } else {
    failed += 1
    console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

function git(command) {
  return execSync(command, { encoding: 'utf8' }).trim()
}

const head = git('git rev-parse HEAD')
const branch = git('git branch --show-current')
report('GIT branch is the save-reflect stack', branch === EXPECTED_BRANCH, branch)
report('GIT HEAD present', Boolean(head), head)

if (!token) {
  report('CANONICAL_DEV_ALIAS_MATCHES_HEAD', false, 'VERCEL_TOKEN missing')
  process.exit(1)
}

async function api(path) {
  const response = await fetch(`https://api.vercel.com${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const data = await response.json()
  if (!response.ok) {
    throw new Error(`${path} -> ${response.status}`)
  }
  return data
}

const project = await api(`/v9/projects/${PROJECT_ID}?teamId=${TEAM_ID}`)
report('VERCEL project is catering-ai-platform', project.name === 'catering-ai-platform', project.name)
report('autoAssignCustomDomains is false', project.autoAssignCustomDomains === false, String(project.autoAssignCustomDomains))

const alias = await api(`/v2/aliases/${CANONICAL_HOST}?teamId=${TEAM_ID}`)
const deployment = alias.deploymentId
  ? await api(`/v13/deployments/${alias.deploymentId}?teamId=${TEAM_ID}`)
  : null
const sha = deployment?.meta?.githubCommitSha || ''
const ref = deployment?.meta?.githubCommitRef || ''
const target = deployment?.target || null

report('alias host is DEV canonical only', alias.alias === CANONICAL_HOST)
report('refuses Production hosts', FORBIDDEN_HOSTS.every((host) => alias.alias !== host))
report('deployment is not Production target', target !== 'production', String(target))
report(
  'CANONICAL_DEV_ALIAS_MATCHES_HEAD',
  Boolean(sha) && sha === head && ref === EXPECTED_BRANCH,
  `alias=${sha || 'none'} head=${head} ref=${ref} deployment=${alias.deploymentId || 'none'}`,
)

console.log('')
console.log(`Passed: ${passed}`)
console.log(`Failed: ${failed}`)
process.exit(failed === 0 ? 0 : 1)
