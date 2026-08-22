#!/usr/bin/env node
/**
 * DEV-only: report media_assets foundation + schema_migrations visibility.
 * Never targets PROD. Does not run DDL.
 */
import { createClient } from '@supabase/supabase-js'
import { execSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'

const DEV_REF = 'yasprgtlqclwsjcshtls'
const PROD_REF = 'eapwtirhevxrqinytans'
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''

if (url.includes(PROD_REF)) {
  console.error('REFUSING: PROD supabase')
  process.exit(1)
}
if (!url.includes(DEV_REF)) {
  console.error('REFUSING: not DEV supabase')
  process.exit(1)
}

const label = process.argv[2] || 'snapshot'
console.log(`=== DEV media foundation report (${label}) ===`)
console.log(`target: ${DEV_REF}`)
console.log(`PROD ALTERADO: NÃO`)

const linkedRef = existsSync('supabase/.temp/project-ref')
  ? readFileSync('supabase/.temp/project-ref', 'utf8').trim()
  : ''
console.log(`linked project-ref: ${linkedRef || '(missing — not linked)'}`)

try {
  const list = execSync('npx supabase migration list --linked', {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  console.log('--- supabase migration list --linked ---')
  console.log(list)
} catch (error) {
  const err = error
  console.log('--- supabase migration list --linked ---')
  console.log((err.stderr || err.stdout || err.message || String(err)).toString().slice(0, 800))
}

const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

for (const column of ['placement', 'editor_meta', 'title_pt', 'active', 'status', 'focal_x', 'overlay_enabled']) {
  const { error } = await admin.from('media_assets').select(column).limit(1)
  console.log(`column ${column}: ${error ? `MISSING (${error.message})` : 'present'}`)
}

const { count, error: tokenError } = await admin
  .from('media_assets')
  .select('id', { count: 'exact', head: true })
  .like('label_es', '__m1|%')
console.log(`__m1 in label_es: ${tokenError ? tokenError.message : count ?? 0}`)

const { data: perms, error: permError } = await admin
  .from('permissions')
  .select('permission_key')
  .in('permission_key', ['media.view', 'media.manage', 'media.delete'])
  .order('permission_key')
console.log(
  `permissions: ${permError ? permError.message : (perms ?? []).map((row) => row.permission_key).join(', ')}`,
)

for (const table of ['schema_migrations', 'supabase_migrations.schema_migrations']) {
  const { error } = await admin.from(table).select('*').limit(1)
  console.log(`postgrest ${table}: ${error ? error.message : 'readable'}`)
}
