/**
 * Teste — máquina de status da Ordem de Serviço (unit) + transições reais
 * no fluxo completo `planned -> ... -> completed`, com histórico e limpeza.
 *
 * Espelha (sem import TS) Lib/orders/statusMachine.ts.
 *
 * Cria sua própria cotação/versão/OS de teste (idempotente, ids fixos
 * `TEST-DEV-*`), não depende de outros scripts terem rodado antes.
 *
 * Pré-requisito: `npm run seed:dev:functional` (fixture customerMain/eventMain/companyMain).
 *
 * Uso:
 *   node scripts/dev/test-order-status-transitions.mjs
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

const STATUS_TEST_QUOTE_ID = 'f2200000-0000-4000-8000-000000000005'
const STATUS_TEST_QUOTE_NUMBER = 'TEST-DEV-QUOTE-STATUS-001'
const STATUS_TEST_OS_NUMBER = 'TEST-DEV-OS-STATUS-001'

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
  console.log(`ORDER STATUS TRANSITIONS: FAIL — ${msg}`)
  process.exit(1)
}

function roundMoney(n) {
  return Math.round(Number(n) * 100) / 100
}

/** Espelho de Lib/orders/statusMachine.ts */
const SERVICE_ORDER_STATUSES = [
  'planned', 'confirmed', 'preparing', 'team_assigned',
  'ready', 'in_progress', 'completed', 'cancelled',
]
const FORWARD_FLOW = ['planned', 'confirmed', 'preparing', 'team_assigned', 'ready', 'in_progress', 'completed']
const TERMINAL_STATUSES = ['completed', 'cancelled']
const ALLOWED_TRANSITIONS = {
  planned: ['confirmed', 'cancelled'],
  confirmed: ['preparing', 'team_assigned', 'cancelled'],
  preparing: ['team_assigned', 'ready', 'cancelled'],
  team_assigned: ['ready', 'preparing', 'cancelled'],
  ready: ['in_progress', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
}
function isKnownStatus(v) {
  return Boolean(v) && SERVICE_ORDER_STATUSES.includes(v)
}
function isValidServiceOrderTransition(from, to) {
  if (!isKnownStatus(from) || !isKnownStatus(to)) return false
  if (from === to) return true
  return ALLOWED_TRANSITIONS[from].includes(to)
}
function isServiceOrderTerminal(status) {
  return isKnownStatus(status) && TERMINAL_STATUSES.includes(status)
}
function nextServiceOrderStatuses(status) {
  if (!isKnownStatus(status)) return []
  return ALLOWED_TRANSITIONS[status]
}
function serviceOrderStatusRequiresReason(status) {
  return status === 'cancelled'
}
function serviceOrderStatusOrder(status) {
  if (!isKnownStatus(status)) return -1
  return FORWARD_FLOW.indexOf(status)
}

async function main() {
  const fx = JSON.parse(readFileSync(FIXTURE_PATH, 'utf8'))
  const { url, service } = loadEnv()
  if (!url || !service) fail('.env.local incompleto')
  const ref = assertDev(url)
  console.log('=== TEST ORDER STATUS TRANSITIONS ===')
  console.log(`project_ref=${ref}`)
  console.log('AMBIENTE: CATERING DEV — CORRETO\n')

  console.log('--- 1) Unit: transições permitidas (forward flow) ---')
  for (let i = 0; i < FORWARD_FLOW.length - 1; i += 1) {
    const from = FORWARD_FLOW[i]
    const to = FORWARD_FLOW[i + 1]
    if (!isValidServiceOrderTransition(from, to)) fail(`transição forward esperada válida: ${from} -> ${to}`)
  }
  console.log(`  OK forward flow completo (${FORWARD_FLOW.join(' -> ')})`)

  console.log('\n--- 2) Unit: cancelamento permitido a partir de qualquer não-terminal ---')
  for (const status of SERVICE_ORDER_STATUSES) {
    if (isServiceOrderTerminal(status)) continue
    if (!isValidServiceOrderTransition(status, 'cancelled')) fail(`cancelamento deveria ser permitido a partir de ${status}`)
  }
  console.log('  OK cancelamento permitido a partir de todo estado não-terminal')

  console.log('\n--- 3) Unit: transições bloqueadas ---')
  const invalidCases = [
    ['planned', 'ready'],
    ['planned', 'completed'],
    ['completed', 'planned'],
    ['completed', 'cancelled'],
    ['cancelled', 'planned'],
    ['ready', 'planned'],
  ]
  for (const [from, to] of invalidCases) {
    if (isValidServiceOrderTransition(from, to)) fail(`transição esperada inválida foi aceita: ${from} -> ${to}`)
  }
  console.log(`  OK ${invalidCases.length} transições inválidas bloqueadas`)

  console.log('\n--- 4) Unit: estados terminais / motivo obrigatório / ordem ---')
  if (!isServiceOrderTerminal('completed')) fail("'completed' deveria ser terminal")
  if (!isServiceOrderTerminal('cancelled')) fail("'cancelled' deveria ser terminal")
  if (isServiceOrderTerminal('planned')) fail("'planned' não deveria ser terminal")
  if (!serviceOrderStatusRequiresReason('cancelled')) fail("'cancelled' deveria exigir motivo")
  if (serviceOrderStatusRequiresReason('planned')) fail("'planned' não deveria exigir motivo")
  if (nextServiceOrderStatuses('completed').length !== 0) fail("'completed' não deveria ter próximos status")
  if (serviceOrderStatusOrder('planned') !== 0) fail('ordem de planned deveria ser 0')
  if (serviceOrderStatusOrder('completed') !== 6) fail('ordem de completed deveria ser 6')
  if (serviceOrderStatusOrder('cancelled') !== -1) fail('ordem de cancelled deveria ser -1 (fora do forward flow)')
  console.log('  OK terminal/motivo/ordem consistentes com a spec')

  console.log('\n--- 5) Integração: setup cotação + versão + OS de teste ---')
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

  const c = fx.quoteCalc
  const billable = c.adults + c.children4To12 * 0.5
  const packageTotal = roundMoney(c.packagePricePerPerson * billable)
  const quoteTotal = packageTotal

  // Reset determinístico
  await client.from('service_order_status_history').delete().eq('service_order_id', STATUS_TEST_QUOTE_ID)
  const { data: existingOs } = await client
    .from('service_orders')
    .select('id')
    .eq('company_id', companyId)
    .eq('service_order_number', STATUS_TEST_OS_NUMBER)
    .maybeSingle()
  if (existingOs) {
    await client.from('service_order_status_history').delete().eq('service_order_id', existingOs.id)
    await client.from('service_orders').delete().eq('id', existingOs.id)
  }
  await client.from('quote_versions').delete().eq('quote_id', STATUS_TEST_QUOTE_ID)

  const { error: quoteError } = await client.from('quotes').upsert(
    {
      id: STATUS_TEST_QUOTE_ID,
      company_id: companyId,
      customer_id: customerId,
      event_id: eventId,
      package_id: packageId,
      quote_number: STATUS_TEST_QUOTE_NUMBER,
      language: 'pt',
      quote_status: 'accepted',
      active: true,
      adult_count: c.adults,
      billable_guest_count: billable,
      package_price_per_person: c.packagePricePerPerson,
      package_total: packageTotal,
      quote_total: quoteTotal,
      currency_code: 'USD',
      proposal_response: 'accepted',
      proposal_accepted_at: new Date().toISOString(),
    },
    { onConflict: 'id' },
  )
  if (quoteError) fail(`upsert cotação de teste: ${quoteError.message}`)

  const { data: version, error: versionError } = await client
    .from('quote_versions')
    .insert({
      company_id: companyId,
      quote_id: STATUS_TEST_QUOTE_ID,
      version_number: 1,
      language: 'pt',
      currency_code: 'USD',
      package_total: packageTotal,
      quote_total: quoteTotal,
      commercial_snapshot: { schema_version: 1, quote_total: quoteTotal },
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
      service_order_number: STATUS_TEST_OS_NUMBER,
      quote_id: STATUS_TEST_QUOTE_ID,
      quote_version_id: version.id,
      event_id: eventId,
      customer_id: customerId,
      status: 'planned',
      event_date: event.event_date,
      start_time: event.start_time,
      end_time: event.end_time,
      package_total: packageTotal,
      service_order_total: quoteTotal,
      commercial_snapshot: { schema_version: 1, quote_total: quoteTotal },
    })
    .select('*')
    .single()
  if (osError) fail(`insert service_orders: ${osError.message}`)
  console.log(`  OK service_orders id=${os.id} number=${os.service_order_number} status=${os.status}`)

  console.log('\n--- 6) Percorre o fluxo completo planned -> completed, gravando histórico ---')
  const path = ['confirmed', 'team_assigned', 'ready', 'in_progress', 'completed']
  let current = os.status
  for (const next of path) {
    if (!isValidServiceOrderTransition(current, next)) {
      fail(`transição planejada inválida no teste: ${current} -> ${next}`)
    }
    const { error: updError } = await client
      .from('service_orders')
      .update({ status: next, updated_at: new Date().toISOString() })
      .eq('id', os.id)
    if (updError) fail(`atualizar status para ${next}: ${updError.message}`)
    const { error: histError } = await client.from('service_order_status_history').insert({
      company_id: companyId,
      service_order_id: os.id,
      from_status: current,
      to_status: next,
      reason: null,
      changed_by: null,
    })
    if (histError) fail(`gravar status_history ${current}->${next}: ${histError.message}`)
    console.log(`  OK ${current} -> ${next}`)
    current = next
  }

  {
    const { data: osAfter, error } = await client
      .from('service_orders')
      .select('status')
      .eq('id', os.id)
      .single()
    if (error) fail(`reler OS: ${error.message}`)
    if (osAfter.status !== 'completed') fail(`status final esperado 'completed', obtido '${osAfter.status}'`)
    console.log(`  OK status final = ${osAfter.status}`)
  }

  console.log('\n--- 7) Histórico gravado corresponde ao caminho percorrido ---')
  {
    const { data: history, error } = await client
      .from('service_order_status_history')
      .select('from_status, to_status, created_at')
      .eq('service_order_id', os.id)
      .order('created_at', { ascending: true })
    if (error) fail(`consultar status_history: ${error.message}`)
    if ((history ?? []).length !== path.length) {
      fail(`esperado ${path.length} entradas de histórico, encontrado ${(history ?? []).length}`)
    }
    console.log(`  OK ${history.length} entradas de histórico registradas`)
  }

  console.log('\n--- 8) Cancelamento a partir de estado terminal deve ser bloqueado (unit) ---')
  if (isValidServiceOrderTransition('completed', 'cancelled')) {
    fail("cancelamento a partir de 'completed' deveria ser inválido")
  }
  console.log("  OK cancelamento bloqueado a partir de 'completed'")

  console.log('\nORDER STATUS TRANSITIONS: PASS')
  process.exit(0)
}

main().catch((err) => {
  console.error('ERRO INESPERADO:', err instanceof Error ? err.message : err)
  process.exit(2)
})
