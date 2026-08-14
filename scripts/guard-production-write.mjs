/**
 * Guard for destructive local/CLI scripts targeting PROD.
 * Does not block Vercel Production runtime — only local/script usage.
 *
 * Usage:
 *   node scripts/guard-production-write.mjs
 *   ALLOW_PRODUCTION_WRITE=true node scripts/guard-production-write.mjs
 */
import { readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const PROD_REF = 'eapwtirhevxrqinytans'

function readLocalRef() {
  const path = join(root, '.env.local')
  if (!existsSync(path)) return null
  const content = readFileSync(path, 'utf8')
  const match = content.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)
  const url = match?.[1]?.trim() ?? ''
  const refMatch = url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/i)
  return refMatch?.[1] ?? null
}

const ref = readLocalRef()
const isProd = ref === PROD_REF
const allowed = process.env.ALLOW_PRODUCTION_WRITE === 'true'

if (isProd && !allowed) {
  console.error('BLOCKED: local environment targets PROD.')
  console.error('Set ALLOW_PRODUCTION_WRITE=true only with Philippe approval.')
  process.exit(1)
}

console.log(
  isProd
    ? 'Production write guard: PROD detected with explicit approval.'
    : 'Production write guard: safe (not PROD or not configured).',
)
