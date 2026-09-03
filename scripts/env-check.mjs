/**
 * Environment safety check — never prints secret values.
 *
 * Usage:
 *   node scripts/env-check.mjs
 *   node scripts/env-check.mjs --expected dev
 *   node scripts/env-check.mjs --expected prod
 */
import { readFileSync, existsSync } from 'fs'
import { execSync } from 'child_process'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

const DEV_REF = 'yasprgtlqclwsjcshtls'
const PROD_REF = 'eapwtirhevxrqinytans'

const expectedArg = process.argv.find((a) => a.startsWith('--expected='))
  ? process.argv.find((a) => a.startsWith('--expected=')).split('=')[1]
  : process.argv.includes('--expected')
    ? process.argv[process.argv.indexOf('--expected') + 1]
    : null

function maskRef(ref) {
  if (!ref || ref.length < 8) return 'unknown'
  return `${ref.slice(0, 4)}...${ref.slice(-4)}`
}

function extractRefFromUrl(url) {
  const match = url?.match(/https:\/\/([a-z0-9]+)\.supabase\.co/i)
  return match?.[1] ?? null
}

function classifyRef(ref) {
  if (!ref) return 'UNKNOWN'
  if (ref === DEV_REF) return 'DEV'
  if (ref === PROD_REF) return 'PROD'
  return 'UNKNOWN'
}

function readEnvFile(filename) {
  const path = join(root, filename)
  if (!existsSync(path)) return null
  const map = new Map()
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    map.set(trimmed.slice(0, eq), trimmed.slice(eq + 1))
  }
  return map
}

function gitValue(cmd) {
  try {
    return execSync(cmd, { cwd: root, encoding: 'utf8' }).trim()
  } catch {
    return 'unknown'
  }
}

function checkFile(label, filename) {
  const env = readEnvFile(filename)
  if (!env) {
    return { label, file: filename, present: false }
  }

  const url = env.get('NEXT_PUBLIC_SUPABASE_URL') ?? ''
  const ref = extractRefFromUrl(url)
  const target = classifyRef(ref)
  const anon = env.get('NEXT_PUBLIC_SUPABASE_ANON_KEY')
  const serviceInPublic = [...env.keys()].some(
    (k) => k.startsWith('NEXT_PUBLIC_') && k.includes('SERVICE_ROLE'),
  )
  const serviceServer = Boolean(env.get('SUPABASE_SERVICE_ROLE_KEY'))

  return {
    label,
    file: filename,
    present: true,
    ref: maskRef(ref),
    target,
    anonKey: anon ? 'PRESENT' : 'ABSENT',
    serviceRoleServer: serviceServer ? 'PRESENT' : 'ABSENT',
    serviceRoleInNextPublic: serviceInPublic ? 'YES (RISK)' : 'NO',
  }
}

function checkProcessEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const ref = extractRefFromUrl(url)
  const target = classifyRef(ref)
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const serviceInPublic = Object.keys(process.env).some(
    (k) => k.startsWith('NEXT_PUBLIC_') && k.includes('SERVICE_ROLE'),
  )
  const serviceServer = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)
  const googleMaps = Boolean(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY)
  return {
    label: 'process-env',
    file: 'process.env (Cloud / shell)',
    present: Boolean(url || anon || serviceServer),
    ref: maskRef(ref),
    target,
    anonKey: anon ? 'PRESENT' : 'ABSENT',
    serviceRoleServer: serviceServer ? 'PRESENT' : 'ABSENT',
    serviceRoleInNextPublic: serviceInPublic ? 'YES (RISK)' : 'NO',
    googleMaps: googleMaps ? 'PRESENT' : 'ABSENT',
  }
}

const checks = [
  checkFile('local', '.env.local'),
  checkFile('vercel-development-pull', '.env.vercel.development'),
  checkFile('vercel-preview-pull', '.env.vercel.preview'),
  checkProcessEnv(),
]

let vercelProject = 'not linked locally'
const vercelPath = join(root, '.vercel', 'project.json')
if (existsSync(vercelPath)) {
  try {
    const parsed = JSON.parse(readFileSync(vercelPath, 'utf8'))
    vercelProject = parsed.projectName ?? parsed.projectId ?? 'linked'
  } catch {
    vercelProject = 'linked (unreadable)'
  }
}

const branch = gitValue('git branch --show-current')
const remote = gitValue('git remote get-url origin')

console.log('=== Catering AI Platform — Environment Check ===')
console.log(`Branch: ${branch}`)
console.log(`Git remote: ${remote}`)
console.log(`Vercel local link: ${vercelProject}`)
console.log(`Node env: ${process.env.NODE_ENV ?? 'not set'}`)
console.log(`Expected (optional): ${expectedArg ?? 'none'}`)
console.log('')

for (const row of checks) {
  console.log(`[${row.label}] ${row.file}`)
  if (!row.present) {
    console.log('  status: MISSING')
    console.log('')
    continue
  }
  console.log(`  supabase ref: ${row.ref}`)
  console.log(`  target: ${row.target}`)
  console.log(`  anon key: ${row.anonKey}`)
  console.log(`  service role (server): ${row.serviceRoleServer}`)
  console.log(`  service role in NEXT_PUBLIC: ${row.serviceRoleInNextPublic}`)
  if (row.googleMaps) {
    console.log(`  google maps key: ${row.googleMaps}`)
  }
  console.log('')
}

const local = checks.find((c) => c.label === 'local')
const processEnv = checks.find((c) => c.label === 'process-env')
const localTarget = local?.present
  ? local.target
  : processEnv?.present
    ? processEnv.target
    : 'UNKNOWN'

if (expectedArg === 'dev' && localTarget !== 'DEV') {
  console.error('FAIL: local environment is not DEV.')
  process.exit(1)
}

if (expectedArg === 'prod' && localTarget !== 'PROD') {
  console.error('FAIL: local environment is not PROD.')
  process.exit(1)
}

if (process.env.PSCS_ONE_SSO_ENABLED === 'true') {
  const ssoTarget = processEnv?.target || localTarget
  if (ssoTarget === 'PROD') {
    console.error('FAIL: PSCS One SSO cannot run against Catering PROD.')
    process.exit(1)
  }
}

if (!expectedArg && localTarget === 'PROD') {
  console.error('WARNING: local .env.local points to PROD.')
  process.exit(1)
}

console.log('Check completed.')
