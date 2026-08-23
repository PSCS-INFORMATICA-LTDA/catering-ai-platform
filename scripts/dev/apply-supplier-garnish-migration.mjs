/**
 * Aplica migration supplier garnish no DEV via SQL REST (service role).
 * Fallback: tenta rpc exec_sql se existir; senão instrui uso do SQL Editor.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const sqlPath = resolve(
  ROOT,
  'supabase/migrations/20260806200000_supplier_garnish_confirmation.sql',
)

const env = Object.fromEntries(
  readFileSync(resolve(ROOT, '.env.local'), 'utf8')
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, '')]
    }),
)

const url = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL
const service = env.SUPABASE_SERVICE_ROLE_KEY
if (!url?.includes('yasprgtlqclwsjcshtls')) {
  console.error('NOT DEV — abort', url)
  process.exit(1)
}

const sql = readFileSync(sqlPath, 'utf8')
const client = createClient(url, service, {
  auth: { persistSession: false, autoRefreshToken: false },
})

// 1) Teste se colunas já existem
{
  const { error } = await client
    .from('service_orders')
    .select('supplier_garnish_token')
    .limit(1)
  if (!error) {
    console.log('OK columns already present')
  } else {
    console.log('columns missing:', error.message)
  }
}

// 2) Tenta funções auxiliares comuns
const attempts = [
  { name: 'exec_sql', args: { query: sql } },
  { name: 'exec_sql', args: { sql } },
  { name: 'execute_sql', args: { query: sql } },
]

let applied = false
for (const attempt of attempts) {
  const { error } = await client.rpc(attempt.name, attempt.args)
  if (!error) {
    console.log(`Applied via rpc ${attempt.name}`)
    applied = true
    break
  }
  if (!/could not find|function|schema cache/i.test(error.message)) {
    console.log(`rpc ${attempt.name}:`, error.message)
  }
}

if (!applied) {
  // 3) Management API com access token se existir
  const access =
    env.SUPABASE_ACCESS_TOKEN ||
    env.SUPABASE_PERSONAL_ACCESS_TOKEN ||
    process.env.SUPABASE_ACCESS_TOKEN
  if (access) {
    const ref = 'yasprgtlqclwsjcshtls'
    const res = await fetch(
      `https://api.supabase.com/v1/projects/${ref}/database/query`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${access}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: sql }),
      },
    )
    const text = await res.text()
    if (res.ok) {
      console.log('Applied via Management API')
      applied = true
    } else {
      console.log('Management API failed:', res.status, text.slice(0, 300))
    }
  } else {
    console.log('No SUPABASE_ACCESS_TOKEN — cannot auto-apply DDL')
  }
}

// 4) Verify
const { error: verifyErr } = await client
  .from('service_orders')
  .select(
    'id, supplier_garnish_token, supplier_garnish_response, supplier_garnish_sent_at',
  )
  .limit(1)

if (verifyErr) {
  console.error('VERIFY FAIL:', verifyErr.message)
  console.error(
    '\nAplique manualmente no SQL Editor DEV:\n',
    sqlPath,
  )
  process.exit(1)
}

console.log('VERIFY OK — supplier_garnish_* columns readable')

// Atualiza telefone do fornecedor B para teste Philippe
const { data: phoneRow, error: phoneErr } = await client
  .from('customers')
  .update({ phone: '+5511983481803' })
  .eq('id', 'f3000000-0000-4000-8000-000000000002')
  .select('id, ab_name, phone')
  .maybeSingle()

if (phoneErr) {
  console.log('phone update:', phoneErr.message)
} else {
  console.log('phone OK', phoneRow)
}
