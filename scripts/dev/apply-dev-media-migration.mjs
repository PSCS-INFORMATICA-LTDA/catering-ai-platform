#!/usr/bin/env node
/**
 * Attempts to apply the Media Manager additive migration on DEV only.
 * DDL requires SUPABASE_ACCESS_TOKEN (Management API) or SQL Editor.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const sqlPath = resolve(
  ROOT,
  'supabase/migrations/20260822140000_company_media_content_manager.sql',
)
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

const sql = readFileSync(sqlPath, 'utf8')
const client = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const { error: already } = await client.from('media_assets').select('placement').limit(1)
if (!already) {
  console.log('OK columns already present')
  process.exit(0)
}

const attempts = [
  { name: 'exec_sql', args: { query: sql } },
  { name: 'exec_sql', args: { sql } },
  { name: 'execute_sql', args: { query: sql } },
]
for (const attempt of attempts) {
  const { error } = await client.rpc(attempt.name, attempt.args)
  if (!error) {
    console.log(`Applied via rpc ${attempt.name}`)
    process.exit(0)
  }
}

const access =
  process.env.SUPABASE_ACCESS_TOKEN || process.env.SUPABASE_PERSONAL_ACCESS_TOKEN
if (access) {
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${DEV_REF}/database/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${access}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: sql }),
    },
  )
  if (res.ok) {
    console.log('Applied via Management API')
    process.exit(0)
  }
  console.log('Management API failed:', res.status, (await res.text()).slice(0, 300))
}

console.log('DDL not applied from this environment.')
console.log('Apply in Supabase SQL Editor of yasprgtlqclwsjcshtls only:')
console.log(sqlPath)
process.exit(2)
