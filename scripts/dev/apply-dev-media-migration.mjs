#!/usr/bin/env node
/**
 * DEV ONLY (yasprgtlqclwsjcshtls): apply 22/08 media foundation migrations
 * via the official Supabase CLI flow.
 *
 *   npx supabase migration list --linked
 *   npx supabase db push --linked
 *
 * Does not use Management API ad-hoc SQL (that skips schema_migrations).
 * Does not touch PROD (eapwtirhevxrqinytans).
 */
import { execSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'

const DEV_REF = 'yasprgtlqclwsjcshtls'
const PROD_REF = 'eapwtirhevxrqinytans'
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''

if (url.includes(PROD_REF)) {
  console.error('REFUSING: PROD supabase')
  process.exit(1)
}
if (url && !url.includes(DEV_REF)) {
  console.error('REFUSING: not DEV supabase')
  process.exit(1)
}

const linkedRef = existsSync('supabase/.temp/project-ref')
  ? readFileSync('supabase/.temp/project-ref', 'utf8').trim()
  : ''

if (linkedRef === PROD_REF) {
  console.error('REFUSING: linked project-ref is PROD')
  process.exit(1)
}

function run(command) {
  return execSync(command, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
}

if (linkedRef && linkedRef !== DEV_REF) {
  console.error(`REFUSING: linked project-ref ${linkedRef} is not DEV`)
  process.exit(1)
}

if (!linkedRef) {
  if (!process.env.SUPABASE_ACCESS_TOKEN && !process.env.SUPABASE_PERSONAL_ACCESS_TOKEN) {
    console.error('Official apply blocked: supabase/.temp/project-ref missing and no SUPABASE_ACCESS_TOKEN.')
    console.error('Link DEV only, then rerun:')
    console.error('  npx supabase login')
    console.error(`  npx supabase link --project-ref ${DEV_REF}`)
    console.error('  npx supabase migration list --linked')
    console.error('  npx supabase db push --linked --dry-run')
    console.error('  npx supabase db push --linked')
    process.exit(2)
  }
  console.log(`Linking official CLI to DEV ${DEV_REF}`)
  try {
    console.log(run(`npx supabase link --project-ref ${DEV_REF}`))
  } catch (error) {
    console.error((error.stderr || error.stdout || error.message || String(error)).toString().slice(0, 800))
    process.exit(2)
  }
}

const confirmRef = existsSync('supabase/.temp/project-ref')
  ? readFileSync('supabase/.temp/project-ref', 'utf8').trim()
  : ''
if (confirmRef !== DEV_REF) {
  console.error(`REFUSING: linked ref ${confirmRef || '(empty)'} is not ${DEV_REF}`)
  process.exit(1)
}

try {
  console.log('--- supabase migration list --linked ---')
  console.log(run('npx supabase migration list --linked'))
  console.log('--- supabase db push --linked --dry-run ---')
  console.log(run('npx supabase db push --linked --dry-run'))
  console.log('--- supabase db push --linked ---')
  console.log(run('npx supabase db push --linked'))
  console.log('--- supabase migration list --linked (after) ---')
  console.log(run('npx supabase migration list --linked'))
} catch (error) {
  console.error((error.stderr || error.stdout || error.message || String(error)).toString().slice(0, 1200))
  process.exit(1)
}

console.log('Official DEV apply finished. PROD ALTERADO: NÃO')
