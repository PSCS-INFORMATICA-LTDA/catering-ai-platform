/**
 * Sync .env.local from Vercel Development pull (.env.vercel.development).
 * Does not print secret values.
 *
 * Usage:
 *   npx vercel env pull .env.vercel.development --environment=development --project catering-ai-platform --scope pscs-informatica-ltda-s-projects --yes
 *   node scripts/sync-local-env-from-dev.mjs
 */
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const sourcePath = join(root, '.env.vercel.development')
const targetPath = join(root, '.env.local')

const DEV_REF = 'yasprgtlqclwsjcshtls'
const PROD_REF = 'eapwtirhevxrqinytans'

const KEYS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
]

function parseEnv(content) {
  const map = new Map()
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    map.set(trimmed.slice(0, eq), trimmed.slice(eq + 1))
  }
  return map
}

function detectRef(url) {
  if (!url) return 'UNKNOWN'
  if (url.includes(DEV_REF)) return 'DEV'
  if (url.includes(PROD_REF)) return 'PROD'
  return 'UNKNOWN'
}

if (!existsSync(sourcePath)) {
  console.error(
    'Missing .env.vercel.development. Pull Development env from Vercel first.',
  )
  process.exit(1)
}

const source = parseEnv(readFileSync(sourcePath, 'utf8'))
const url = source.get('NEXT_PUBLIC_SUPABASE_URL') ?? ''
const env = detectRef(url)

if (env === 'PROD') {
  console.error('Refusing to sync: source URL points to PROD.')
  process.exit(1)
}

if (env !== 'DEV') {
  console.error('Refusing to sync: could not confirm DEV project ref.')
  process.exit(1)
}

const lines = [
  '# Catering AI Platform — LOCAL DEV (default)',
  `# Supabase project ref: ${DEV_REF}`,
  '# Do not place PROD credentials in this file.',
  '',
]

for (const key of KEYS) {
  const value = source.get(key)
  if (value) lines.push(`${key}=${value}`)
}

lines.push('NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=')
lines.push('')

writeFileSync(targetPath, lines.join('\n'), 'utf8')
console.log('Synced .env.local from Vercel Development (DEV confirmed).')
