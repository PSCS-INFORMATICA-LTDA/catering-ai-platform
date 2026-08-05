/**
 * Teste — checklist operacional da Ordem de Serviço (create/complete/reopen/skip)
 *
 * Espelha (sem HTTP, via service role — mesmo padrão de outros scripts/dev)
 * as regras de `app/api/orders/[id]/checklist/route.ts`:
 *   - POST: cria item (categoria cai para 'preparacao' se desconhecida)
 *   - PATCH: status done → completed_by/completed_at preenchidos
 *            status pending/skipped → completed_by/completed_at limpos
 *
 * Cria sua própria cotação/versão/OS de teste (idempotente, ids fixos
 * `TEST-DEV-*`), não depende de outros scripts terem rodado antes.
 *
 * Pré-requisito: `npm run seed:dev:functional` (fixture customerMain/eventMain/companyMain).
 *
 * Uso:
 *   node scripts/dev/test-order-checklist.mjs
 *
 * Project Ref obrigatório: yasprgtlqclwsjcshtls
 * PROD proibido: eapwtirhevxrqinytans
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..', '..')
const FIXTURE_PATH = join(__dirname, 'fixtures', 'catering-functional-validation-v1.json')
const DEV_REF = 'yasprgtlqclwsjcshtls'
const PROD_REF = 'eapwtirhevxrqinytans'

const CHECKLIST_TEST_QUOTE_ID = 'f2200000-0000-4000-8000-000000000009'
const CHECKLIST_TEST_QUOTE_NUMBER = 'TEST-DEV-QUOTE-CHECKLIST-001'
const CHECKLIST_TEST_OS_NUMBER = 'TEST-DEV-OS-CHECKLIST-001'

const CHECKLIST_CATEGORIES = [
  'comercial', 'preparacao', 'equipe', 'equipamentos', 'alimentos',
  'logistica_evento', 'montagem', 'execucao', 'desmontagem', 'pos_evento',
]

function loadEnv() {
  const env = readFileSync(join(ROOT, '.env.local'), 'utf8')
  const get = (k) => {
    const m = env.match(new RegExp(`^${k}=(.*)$`, 'm'))
    return m ? m[1].trim() : ''
  }
  return { url: get('NEXT_PUBLIC_SUPABASE_URL'), service: get('SUPABASE_SERVICE_ROLE_KEY') }
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

function fail(msg) {
  console.log(`ORDER CHECKLIST: FAIL — ${msg}`)
  process.exit(1)
}

/** Espelho de app/api/orders/[id]/checklist/route.ts (resolução de categoria) */
function resolveCategory(input) {
  return CHECKLIST_CATEGORIES.includes(input) ? input : 'preparacao'
}

async function main() {
  const fx = JSON.parse(readFileSync(FIXTURE_PATH, 'utf8'))
  const { url, service } = loadEnv()
  if (!url || !service) fail('.env.local incompleto')
  const ref = assertDev(url)
  console.log('=== TEST ORDER CHECKLIST ===')
  console.log(`project_ref=${ref}`)
  console.log('AMBIENTE: CATERING DEV — CORRETO\n')

  console.log('--- 1) Unit: resolução de categoria ---')
  if (resolveCategory('equipe') !== 'equipe') fail('categoria válida deveria ser mantida')
  if (resolveCategory('categoria-invalida') !== 'preparacao') fail("categoria inválida deveria cair para 'preparacao'")
  if (resolveCategory(undefined) !== 'preparacao') fail("categoria ausente deveria cair para 'preparacao'")
  console.log(`  OK resolução de categoria (${CHECKLIST_CATEGORIES.length} categorias válidas conhecidas)`)

  console.log('\n--- 2) Integração: setup cotação + versão + OS de teste ---')
  const client = createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const companyId = fx.ids.companyMain
  const customerId = fx.ids.customerMain
  const eventId = fx.ids.eventMain
  const packageId = fx.ids.pkgEssential

  const { data: company } = await client.from('companies').select('id').eq('id', companyId).maybeSingle()
  if (!company) fail('companyMain ausente — rode `npm run seed:dev:functional` primeiro')
  const { data: event } = await client
    .from('events')
    .select('id, event_date, start_time, end_time')
    .eq('id', eventId)
    .maybeSingle()
  if (!event) fail('eventMain ausente — rode `npm run seed:dev:functional` primeiro')

  // Reset determinístico
  const { data: existingOs } = await client
    .from('service_orders')
    .select('id')
    .eq('company_id', companyId)
    .eq('service_order_number', CHECKLIST_TEST_OS_NUMBER)
    .maybeSingle()
  if (existingOs) {
    await client.from('service_order_checklist_items').delete().eq('service_order_id', existingOs.id)
    await client.from('service_orders').delete().eq('id', existingOs.id)
  }
  await client.from('quote_versions').delete().eq('quote_id', CHECKLIST_TEST_QUOTE_ID)

  const { error: quoteError } = await client.from('quotes').upsert(
    {
      id: CHECKLIST_TEST_QUOTE_ID,
      company_id: companyId,
      customer_id: customerId,
      event_id: eventId,
      package_id: packageId,
      quote_number: CHECKLIST_TEST_QUOTE_NUMBER,
      language: 'pt',
      quote_status: 'accepted',
      active: true,
      quote_total: 100,
      proposal_response: 'accepted',
    },
    { onConflict: 'id' },
  )
  if (quoteError) fail(`upsert cotação de teste: ${quoteError.message}`)

  const { data: version, error: versionError } = await client
    .from('quote_versions')
    .insert({
      company_id: companyId,
      quote_id: CHECKLIST_TEST_QUOTE_ID,
      version_number: 1,
      language: 'pt',
      currency_code: 'USD',
      quote_total: 100,
      commercial_snapshot: { schema_version: 1, quote_total: 100 },
      schema_version: 1,
      is_current: true,
      accepted_at: new Date().toISOString(),
    })
    .select('*')
    .single()
  if (versionError) fail(`insert quote_versions: ${versionError.message}`)

  const { data: os, error: osError } = await client
    .from('service_orders')
    .insert({
      company_id: companyId,
      service_order_number: CHECKLIST_TEST_OS_NUMBER,
      quote_id: CHECKLIST_TEST_QUOTE_ID,
      quote_version_id: version.id,
      event_id: eventId,
      customer_id: customerId,
      status: 'planned',
      event_date: event.event_date,
      start_time: event.start_time,
      end_time: event.end_time,
      service_order_total: 100,
      commercial_snapshot: { schema_version: 1, quote_total: 100 },
    })
    .select('*')
    .single()
  if (osError) fail(`insert service_orders: ${osError.message}`)
  console.log(`  OK service_orders id=${os.id} number=${os.service_order_number}`)

  console.log('\n--- 3) POST — criar item de checklist (categoria válida) ---')
  const { data: item1, error: item1Error } = await client
    .from('service_order_checklist_items')
    .insert({
      company_id: companyId,
      service_order_id: os.id,
      title: 'TEST-DEV Confirmar contagem de convidados',
      category: resolveCategory('comercial'),
      is_required: true,
      display_order: 0,
    })
    .select('*')
    .single()
  if (item1Error) fail(`insert checklist item 1: ${item1Error.message}`)
  if (item1.status !== 'pending') fail(`status inicial esperado 'pending', obtido '${item1.status}'`)
  if (item1.category !== 'comercial') fail(`categoria esperada 'comercial', obtido '${item1.category}'`)
  console.log(`  OK item id=${item1.id} status=${item1.status} category=${item1.category}`)

  console.log('\n--- 4) POST — criar item com categoria desconhecida (cai para preparacao) ---')
  const { data: item2, error: item2Error } = await client
    .from('service_order_checklist_items')
    .insert({
      company_id: companyId,
      service_order_id: os.id,
      title: 'TEST-DEV Item categoria desconhecida',
      category: resolveCategory('nao-existe'),
      is_required: false,
      display_order: 1,
    })
    .select('*')
    .single()
  if (item2Error) fail(`insert checklist item 2: ${item2Error.message}`)
  if (item2.category !== 'preparacao') fail(`categoria desconhecida deveria cair para 'preparacao', obtido '${item2.category}'`)
  console.log(`  OK item id=${item2.id} category=${item2.category} (fallback aplicado)`)

  console.log('\n--- 5) PATCH — concluir item (status=done) ---')
  const { data: item1Done, error: doneError } = await client
    .from('service_order_checklist_items')
    .update({
      status: 'done',
      completed_by: null,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', item1.id)
    .eq('service_order_id', os.id)
    .select('*')
    .single()
  if (doneError) fail(`concluir item: ${doneError.message}`)
  if (item1Done.status !== 'done') fail("status esperado 'done'")
  if (!item1Done.completed_at) fail('completed_at deveria estar preenchido ao concluir')
  console.log(`  OK item id=${item1Done.id} status=${item1Done.status} completed_at=${item1Done.completed_at}`)

  console.log('\n--- 6) PATCH — reabrir item (status=pending, limpa completed_*) ---')
  const { data: item1Reopened, error: reopenError } = await client
    .from('service_order_checklist_items')
    .update({
      status: 'pending',
      completed_by: null,
      completed_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', item1.id)
    .eq('service_order_id', os.id)
    .select('*')
    .single()
  if (reopenError) fail(`reabrir item: ${reopenError.message}`)
  if (item1Reopened.status !== 'pending') fail("status esperado 'pending' após reabertura")
  if (item1Reopened.completed_at !== null) fail('completed_at deveria ser limpo ao reabrir')
  console.log(`  OK item id=${item1Reopened.id} status=${item1Reopened.status} completed_at=${item1Reopened.completed_at}`)

  console.log('\n--- 7) PATCH — marcar item como skipped ---')
  const { data: item2Skipped, error: skipError } = await client
    .from('service_order_checklist_items')
    .update({ status: 'skipped', completed_by: null, completed_at: null, updated_at: new Date().toISOString() })
    .eq('id', item2.id)
    .eq('service_order_id', os.id)
    .select('*')
    .single()
  if (skipError) fail(`marcar item como skipped: ${skipError.message}`)
  if (item2Skipped.status !== 'skipped') fail("status esperado 'skipped'")
  console.log(`  OK item id=${item2Skipped.id} status=${item2Skipped.status}`)

  console.log('\n--- 8) GET — lista ordenada por display_order ---')
  {
    const { data: list, error } = await client
      .from('service_order_checklist_items')
      .select('id, title, display_order')
      .eq('service_order_id', os.id)
      .order('display_order', { ascending: true })
    if (error) fail(`listar checklist: ${error.message}`)
    if ((list ?? []).length !== 2) fail(`esperado 2 itens de checklist, encontrado ${(list ?? []).length}`)
    if (list[0].id !== item1.id || list[1].id !== item2.id) fail('ordem de display_order incorreta')
    console.log(`  OK ${list.length} itens listados na ordem correta`)
  }

  console.log('\nORDER CHECKLIST: PASS')
  process.exit(0)
}

main().catch((err) => {
  console.error('ERRO INESPERADO:', err instanceof Error ? err.message : err)
  process.exit(2)
})
