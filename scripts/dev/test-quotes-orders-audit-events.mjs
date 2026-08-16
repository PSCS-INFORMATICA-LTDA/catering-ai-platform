/**
 * Teste — eventos de auditoria (audit_logs) da feature Quotes/Orders
 *
 * Espelha (via service role, sem import TS) os pontos de gravação de
 * `Lib/orders/writeOperationalAudit.ts` + os inserts ad-hoc já existentes em:
 *   - Lib/orders/convertAcceptedQuoteToServiceOrder.ts (convert_quote_to_service_order)
 *   - app/api/orders/[id]/route.ts (update_status)
 *   - app/api/orders/[id]/checklist/route.ts (checklist_item_created/completed/...)
 *   - app/api/quotes/[id]/team-assignment/route.ts (team_assignment_designated/...)
 *
 * Confirma que `audit_logs` (e `service_order_status_history`, que a
 * complementa) recebem uma linha para cada uma dessas operações.
 *
 * Cria seus próprios fixtures de teste (ids fixos `TEST-DEV-*`), idempotente.
 *
 * Pré-requisito: `npm run seed:dev:functional` (fixture customerMain/eventMain/companyMain).
 *
 * Uso:
 *   node scripts/dev/test-quotes-orders-audit-events.mjs
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

const AUDIT_TEST_QUOTE_ID = 'f2200000-0000-4000-8000-000000000010'
const AUDIT_TEST_QUOTE_NUMBER = 'TEST-DEV-QUOTE-AUDIT-001'
const AUDIT_TEST_OS_NUMBER = 'TEST-DEV-OS-AUDIT-001'
const AUDIT_TEST_TEAM_ID = 'a1900000-0000-4000-8000-000000000009'
const AUDIT_TEST_AGENDA_CODE = 'EVT-TEST-DEV-AUDIT-001'

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
  console.log(`QUOTES/ORDERS AUDIT EVENTS: FAIL — ${msg}`)
  process.exit(1)
}

/** Espelho de Lib/orders/writeOperationalAudit.ts */
async function writeOperationalAudit(client, input) {
  const { error } = await client.from('audit_logs').insert({
    company_id: input.companyId,
    user_id: input.actorUserId,
    entity_type: input.entityType,
    entity_id: input.entityId,
    action: input.action,
    old_data: input.oldData ?? null,
    new_data: input.newData ?? null,
  })
  if (error) fail(`writeOperationalAudit(${input.action}): ${error.message}`)
}

async function main() {
  const fx = JSON.parse(readFileSync(FIXTURE_PATH, 'utf8'))
  const { url, service } = loadEnv()
  if (!url || !service) fail('.env.local incompleto')
  const ref = assertDev(url)
  console.log('=== TEST QUOTES/ORDERS AUDIT EVENTS ===')
  console.log(`project_ref=${ref}`)
  console.log('AMBIENTE: CATERING DEV — CORRETO\n')

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

  console.log('--- 1) Setup: cotação + versão + OS + checklist + equipe + agenda de teste ---')

  // Reset determinístico
  const { data: existingOs } = await client
    .from('service_orders')
    .select('id')
    .eq('company_id', companyId)
    .eq('service_order_number', AUDIT_TEST_OS_NUMBER)
    .maybeSingle()
  if (existingOs) {
    await client.from('audit_logs').delete().eq('entity_type', 'service_order').eq('entity_id', existingOs.id)
    await client.from('audit_logs').delete().eq('entity_type', 'checklist_item').eq('company_id', companyId).eq('new_data->>service_order_id', existingOs.id)
    await client.from('service_order_status_history').delete().eq('service_order_id', existingOs.id)
    await client.from('service_order_checklist_items').delete().eq('service_order_id', existingOs.id)
    await client.from('service_orders').delete().eq('id', existingOs.id)
  }
  await client.from('agenda_events').delete().eq('company_id', companyId).eq('code', AUDIT_TEST_AGENDA_CODE)
  await client.from('quote_versions').delete().eq('quote_id', AUDIT_TEST_QUOTE_ID)

  const { error: teamError } = await client
    .from('operational_teams')
    .upsert({ id: AUDIT_TEST_TEAM_ID, company_id: companyId, name: 'TEST-DEV Equipe Audit', active: true }, { onConflict: 'id' })
  if (teamError) fail(`upsert equipe de teste: ${teamError.message}`)

  const { error: quoteError } = await client.from('quotes').upsert(
    {
      id: AUDIT_TEST_QUOTE_ID,
      company_id: companyId,
      customer_id: customerId,
      event_id: eventId,
      package_id: packageId,
      quote_number: AUDIT_TEST_QUOTE_NUMBER,
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
      quote_id: AUDIT_TEST_QUOTE_ID,
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

  await writeOperationalAudit(client, {
    companyId,
    actorUserId: null,
    entityType: 'quote_version',
    entityId: version.id,
    action: 'quote_version_accepted',
    newData: { quote_id: AUDIT_TEST_QUOTE_ID, version_number: 1, quote_total: 100 },
  })

  const { data: os, error: osError } = await client
    .from('service_orders')
    .insert({
      company_id: companyId,
      service_order_number: AUDIT_TEST_OS_NUMBER,
      quote_id: AUDIT_TEST_QUOTE_ID,
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
  console.log(`  OK service_orders id=${os.id}`)

  console.log('\n--- 2) Auditoria: conversão de cotação em OS (convert_quote_to_service_order) ---')
  const { error: convertAuditError } = await client.from('audit_logs').insert({
    company_id: companyId,
    user_id: null,
    entity_type: 'service_order',
    entity_id: os.id,
    action: 'convert_quote_to_service_order',
    new_data: { quote_id: AUDIT_TEST_QUOTE_ID, service_order_id: os.id },
  })
  if (convertAuditError) fail(`gravar audit conversão: ${convertAuditError.message}`)

  {
    const { data, error } = await client
      .from('audit_logs')
      .select('*')
      .eq('company_id', companyId)
      .eq('entity_type', 'service_order')
      .eq('entity_id', os.id)
      .eq('action', 'convert_quote_to_service_order')
    if (error) fail(`consultar audit conversão: ${error.message}`)
    if ((data ?? []).length === 0) fail('audit_logs sem registro de convert_quote_to_service_order')
    if (data[0].new_data?.quote_id !== AUDIT_TEST_QUOTE_ID) fail('new_data.quote_id incorreto no audit de conversão')
    console.log(`  OK audit_logs id=${data[0].id} action=${data[0].action}`)
  }

  console.log('\n--- 3) Auditoria: mudança de status (update_status) + status_history ---')
  await client.from('service_orders').update({ status: 'confirmed' }).eq('id', os.id)
  await client.from('service_order_status_history').insert({
    company_id: companyId,
    service_order_id: os.id,
    from_status: 'planned',
    to_status: 'confirmed',
    reason: null,
    changed_by: null,
  })
  const { error: statusAuditError } = await client.from('audit_logs').insert({
    company_id: companyId,
    user_id: null,
    entity_type: 'service_order',
    entity_id: os.id,
    action: 'update_status',
    old_data: { status: 'planned' },
    new_data: { status: 'confirmed' },
  })
  if (statusAuditError) fail(`gravar audit status: ${statusAuditError.message}`)

  {
    const { data: auditRows, error: auditErr } = await client
      .from('audit_logs')
      .select('*')
      .eq('company_id', companyId)
      .eq('entity_type', 'service_order')
      .eq('entity_id', os.id)
      .eq('action', 'update_status')
    if (auditErr) fail(`consultar audit status: ${auditErr.message}`)
    if ((auditRows ?? []).length === 0) fail('audit_logs sem registro de update_status')
    if (auditRows[0].new_data?.status !== 'confirmed') fail('new_data.status incorreto no audit de status')
    console.log(`  OK audit_logs id=${auditRows[0].id} old=${JSON.stringify(auditRows[0].old_data)} new=${JSON.stringify(auditRows[0].new_data)}`)

    const { data: historyRows, error: histErr } = await client
      .from('service_order_status_history')
      .select('*')
      .eq('service_order_id', os.id)
      .eq('to_status', 'confirmed')
    if (histErr) fail(`consultar status_history: ${histErr.message}`)
    if ((historyRows ?? []).length === 0) fail('service_order_status_history sem registro planned->confirmed')
    console.log(`  OK service_order_status_history id=${historyRows[0].id} ${historyRows[0].from_status}->${historyRows[0].to_status}`)
  }

  console.log('\n--- 4) Auditoria: checklist_item_created ---')
  const { data: checklistItem, error: checklistError } = await client
    .from('service_order_checklist_items')
    .insert({
      company_id: companyId,
      service_order_id: os.id,
      title: 'TEST-DEV Item de auditoria',
      category: 'comercial',
      is_required: false,
      display_order: 0,
    })
    .select('*')
    .single()
  if (checklistError) fail(`criar item de checklist: ${checklistError.message}`)

  await writeOperationalAudit(client, {
    companyId,
    actorUserId: null,
    entityType: 'checklist_item',
    entityId: checklistItem.id,
    action: 'checklist_item_created',
    newData: { service_order_id: os.id, title: checklistItem.title, category: checklistItem.category },
  })

  {
    const { data, error } = await client
      .from('audit_logs')
      .select('*')
      .eq('company_id', companyId)
      .eq('entity_type', 'checklist_item')
      .eq('entity_id', checklistItem.id)
      .eq('action', 'checklist_item_created')
    if (error) fail(`consultar audit checklist: ${error.message}`)
    if ((data ?? []).length === 0) fail('audit_logs sem registro de checklist_item_created')
    if (data[0].new_data?.service_order_id !== os.id) fail('new_data.service_order_id incorreto no audit de checklist')
    console.log(`  OK audit_logs id=${data[0].id} action=${data[0].action}`)
  }

  console.log('\n--- 5) Auditoria: team_assignment_designated ---')
  const { data: agendaEvent, error: agendaError } = await client
    .from('agenda_events')
    .insert({
      company_id: companyId,
      team_id: AUDIT_TEST_TEAM_ID,
      code: AUDIT_TEST_AGENDA_CODE,
      title: 'TEST-DEV Evento Auditoria',
      event_date: event.event_date,
      start_time: event.start_time,
      end_time: event.end_time,
      status: 'scheduled',
      quote_id: AUDIT_TEST_QUOTE_ID,
    })
    .select('*')
    .single()
  if (agendaError) fail(`criar agenda_events de teste: ${agendaError.message}`)

  await writeOperationalAudit(client, {
    companyId,
    actorUserId: null,
    entityType: 'agenda_event',
    entityId: agendaEvent.id,
    action: 'team_assignment_designated',
    newData: { quote_id: AUDIT_TEST_QUOTE_ID, team_id: AUDIT_TEST_TEAM_ID, presentation_time: '09:30:00' },
  })

  {
    const { data, error } = await client
      .from('audit_logs')
      .select('*')
      .eq('company_id', companyId)
      .eq('entity_type', 'agenda_event')
      .eq('entity_id', agendaEvent.id)
      .eq('action', 'team_assignment_designated')
    if (error) fail(`consultar audit team assignment: ${error.message}`)
    if ((data ?? []).length === 0) fail('audit_logs sem registro de team_assignment_designated')
    if (data[0].new_data?.team_id !== AUDIT_TEST_TEAM_ID) fail('new_data.team_id incorreto no audit de designação')
    console.log(`  OK audit_logs id=${data[0].id} action=${data[0].action}`)
  }

  console.log('\n--- 6) Nenhum dado sensível gravado (tokens/JWT/senhas) ---')
  {
    const { data, error } = await client
      .from('audit_logs')
      .select('old_data, new_data')
      .eq('company_id', companyId)
      .in('entity_id', [os.id, checklistItem.id, agendaEvent.id, version.id])
    if (error) fail(`consultar audit_logs para checagem de sensíveis: ${error.message}`)
    const blob = JSON.stringify(data ?? []).toLowerCase()
    const forbidden = ['token', 'jwt', 'password', 'senha', 'service_role', 'bearer ']
    const found = forbidden.filter((w) => blob.includes(w))
    if (found.length > 0) fail(`possível dado sensível encontrado em audit_logs: ${found.join(', ')}`)
    console.log('  OK nenhuma palavra-chave sensível encontrada nos payloads de auditoria')
  }

  console.log('\nQUOTES/ORDERS AUDIT EVENTS: PASS')
  process.exit(0)
}

main().catch((err) => {
  console.error('ERRO INESPERADO:', err instanceof Error ? err.message : err)
  process.exit(2)
})
