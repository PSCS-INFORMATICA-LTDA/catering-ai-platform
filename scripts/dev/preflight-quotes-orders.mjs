/**
 * Preflight (somente leitura) — fundação Quote → Order/OS
 *
 * Verifica, sem escrever nada, se o ambiente DEV está pronto para os testes
 * de conversão de cotação em Ordem de Serviço:
 *   - .env.local aponta para o Supabase DEV (nunca PROD)
 *   - Tabelas novas existem (quote_versions, service_orders, ...)
 *   - Colunas novas existem (quotes.accepted_version_id, agenda_events.service_order_id, ...)
 *   - Permissões novas foram seedadas (quotes.convert, orders.view, orders.manage)
 *   - Cotação fixture (TEST-DEV-QUOTE-001) existe
 *
 * Uso:
 *   node scripts/dev/preflight-quotes-orders.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..', '..')
const DEV_REF = 'yasprgtlqclwsjcshtls'
const PROD_REF = 'eapwtirhevxrqinytans'
const QUOTE_MAIN = 'f2200000-0000-4000-8000-000000000001'

function loadEnv() {
  const env = readFileSync(join(ROOT, '.env.local'), 'utf8')
  const get = (k) => {
    const m = env.match(new RegExp(`^${k}=(.*)$`, 'm'))
    return m ? m[1].trim() : ''
  }
  return {
    url: get('NEXT_PUBLIC_SUPABASE_URL'),
    service: get('SUPABASE_SERVICE_ROLE_KEY'),
  }
}

function assertDev(url) {
  const ref = (url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/) || [])[1] || 'none'
  if (ref === PROD_REF) {
    console.error('BLOQUEADO — CONFIGURACAO APONTA PARA PROD')
    process.exit(2)
  }
  if (ref !== DEV_REF) {
    console.error(`BLOQUEADO — Project Ref inesperado: ${ref} (esperado ${DEV_REF})`)
    process.exit(2)
  }
  return ref
}

let failures = 0
function check(label, ok, detail) {
  console.log(`${ok ? 'OK  ' : 'FAIL'} — ${label}${detail ? ` (${detail})` : ''}`)
  if (!ok) failures += 1
}

async function tableExists(client, table) {
  const { error } = await client.from(table).select('id', { head: true, count: 'exact' }).limit(1)
  if (!error) return { ok: true }
  return { ok: false, detail: error.message }
}

async function columnExists(client, table, column) {
  const { error } = await client.from(table).select(column, { head: true }).limit(1)
  if (!error) return { ok: true }
  return { ok: false, detail: error.message }
}

async function main() {
  const { url, service } = loadEnv()
  if (!url || !service) {
    console.error('BLOQUEADO — .env.local incompleto (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)')
    process.exit(2)
  }
  const ref = assertDev(url)
  console.log('=== PREFLIGHT QUOTES -> ORDERS (somente leitura) ===')
  console.log(`project_ref=${ref}`)
  console.log('AMBIENTE: CATERING DEV — CORRETO\n')

  const client = createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  console.log('--- Tabelas novas ---')
  for (const table of [
    'quote_versions',
    'service_orders',
    'service_order_items',
    'service_order_status_history',
    'service_order_checklist_items',
  ]) {
    const r = await tableExists(client, table)
    check(`tabela ${table} existe`, r.ok, r.detail)
  }

  console.log('\n--- Colunas novas ---')
  const columnChecks = [
    ['quotes', 'accepted_version_id'],
    ['quotes', 'converted_service_order_id'],
    ['agenda_events', 'service_order_id'],
  ]
  for (const [table, column] of columnChecks) {
    const r = await columnExists(client, table, column)
    check(`coluna ${table}.${column} existe`, r.ok, r.detail)
  }

  console.log('\n--- RPC de numeração ---')
  {
    const { error } = await client.rpc('get_next_document_number', {
      p_company_id: '00000000-0000-4000-8000-000000000000',
      p_document_type: 'service_order',
    })
    // Espera erro de FK (empresa inexistente) — não erro de função ausente.
    const missingFn = error && /function .* does not exist/i.test(error.message)
    check('RPC get_next_document_number aceita document_type=service_order', !missingFn, error?.message)
  }

  console.log('\n--- Permissões seedadas ---')
  {
    const { data, error } = await client
      .from('permissions')
      .select('permission_key')
      .in('permission_key', ['quotes.convert', 'orders.view', 'orders.manage'])
    if (error) {
      check('tabela permissions consultável', false, error.message)
    } else {
      const keys = new Set((data ?? []).map((r) => r.permission_key))
      for (const key of ['quotes.convert', 'orders.view', 'orders.manage']) {
        check(`permissão ${key} seedada`, keys.has(key))
      }
    }
  }

  console.log('\n--- Fixture de validação funcional ---')
  {
    const { data, error } = await client
      .from('quotes')
      .select('id, quote_number, quote_total, active')
      .eq('id', QUOTE_MAIN)
      .maybeSingle()
    if (error) {
      check('cotação fixture TEST-DEV-QUOTE-001 consultável', false, error.message)
    } else {
      check(
        'cotação fixture TEST-DEV-QUOTE-001 existe',
        Boolean(data),
        data ? `total=${data.quote_total}` : 'rode npm run seed:dev:functional primeiro',
      )
    }
  }

  console.log(`\n=== RESULTADO: ${failures === 0 ? 'PASS' : `FAIL (${failures})`} ===`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((err) => {
  console.error('ERRO INESPERADO:', err instanceof Error ? err.message : err)
  process.exit(2)
})
