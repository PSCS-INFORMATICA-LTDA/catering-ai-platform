/**
 * Teste — conversão de cotação aceita em Ordem de Serviço (idempotente)
 *
 * Espelha (sem import TS) a lógica de:
 *   - Lib/quotes/versions.ts (ensureAcceptedQuoteVersion)
 *   - Lib/orders/convertAcceptedQuoteToServiceOrder.ts
 *
 * Pré-requisito: `npm run seed:dev:functional` (fixture customerMain/eventMain/companyMain).
 *
 * Uso:
 *   node scripts/dev/test-quote-to-order-conversion.mjs
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

const CONVERT_TEST_QUOTE_ID = 'f2200000-0000-4000-8000-000000000002'
const CONVERT_TEST_QUOTE_NUMBER = 'TEST-DEV-QUOTE-OS-001'

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
  console.log(`TEST QUOTE->ORDER CONVERSION: FAIL — ${msg}`)
  process.exit(1)
}

function roundMoney(n) {
  return Math.round(Number(n) * 100) / 100
}

/** Espelho de Lib/calculateQuoteTotals.ts (mesmos inputs do fixture v1). */
function calculateQuoteTotals(input) {
  const adults = Math.max(0, Number(input.adults || 0))
  const c3 = Math.max(0, Number(input.childrenUnder3 || 0))
  const c412 = Math.max(0, Number(input.children4To12 || 0))
  const billable = adults + c412 * 0.5
  const physical = adults + c3 + c412
  const packageTotal = roundMoney(input.packagePricePerPerson * billable)
  let additionalTotal = 0
  for (const line of input.additionals || []) {
    const qty = Math.max(0, Number(line.quantity || 0))
    const price = Math.max(0, Number(line.unitPrice || 0))
    if (qty <= 0) continue
    additionalTotal += line.perPerson ? roundMoney(price * billable) : roundMoney(price * qty)
  }
  additionalTotal = roundMoney(additionalTotal)
  const free = Number(input.mileageFreeLimit ?? 20)
  const rate = Number(input.mileageRate ?? 2)
  const dist = Number(input.mileageDistance ?? 0)
  const mileageFee = roundMoney(Math.max(0, dist - free) * rate)
  const quoteSubtotal = roundMoney(packageTotal + additionalTotal + mileageFee)
  const pct = Number(input.reservationPercentage ?? 30)
  const reservationAmount = roundMoney((quoteSubtotal * pct) / 100)
  const balanceDue = roundMoney(quoteSubtotal - reservationAmount)
  return {
    billableGuestCount: billable,
    physicalGuestCount: physical,
    packageTotal,
    additionalTotal,
    mileageFee,
    quoteSubtotal,
    reservationAmount,
    balanceDue,
    quoteTotal: quoteSubtotal,
  }
}

async function main() {
  const fx = JSON.parse(readFileSync(FIXTURE_PATH, 'utf8'))
  const { url, service } = loadEnv()
  if (!url || !service) fail('.env.local incompleto')
  const ref = assertDev(url)
  console.log('=== TEST QUOTE -> ORDER CONVERSION ===')
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
  const { data: customer } = await client.from('customers').select('id').eq('id', customerId).maybeSingle()
  if (!customer) fail('customerMain ausente — rode `npm run seed:dev:functional` primeiro')
  const { data: event } = await client
    .from('events')
    .select('id, event_date, start_time, end_time, venue_name, address_line, city, state, postal_code')
    .eq('id', eventId)
    .maybeSingle()
  if (!event) fail('eventMain ausente — rode `npm run seed:dev:functional` primeiro')

  const totals = calculateQuoteTotals({ ...fx.quoteCalc, additionals: fx.quoteCalc.additionals })
  console.log(`CALCULO ESPERADO (calculateQuoteTotals espelhado): total=${totals.quoteTotal}`)
  if (totals.quoteTotal !== 2830) {
    fail(`fórmula divergiu do fixture — total calculado ${totals.quoteTotal}, esperado 2830`)
  }

  console.log('\n--- 1) upsert cotação de teste (draft) ---')
  const quoteRow = {
    id: CONVERT_TEST_QUOTE_ID,
    company_id: companyId,
    customer_id: customerId,
    event_id: eventId,
    package_id: packageId,
    quote_number: CONVERT_TEST_QUOTE_NUMBER,
    language: 'pt',
    quote_status: 'draft',
    active: true,
    physical_guest_count: totals.physicalGuestCount,
    billable_guest_count: totals.billableGuestCount,
    adult_count: fx.quoteCalc.adults,
    package_price_per_person: fx.quoteCalc.packagePricePerPerson,
    package_total: totals.packageTotal,
    additional_total: totals.additionalTotal,
    mileage_distance: fx.quoteCalc.mileageDistance,
    mileage_free_limit: fx.quoteCalc.mileageFreeLimit,
    mileage_rate: fx.quoteCalc.mileageRate,
    mileage_fee: totals.mileageFee,
    reservation_percentage: fx.quoteCalc.reservationPercentage,
    reservation_amount: totals.reservationAmount,
    balance_due: totals.balanceDue,
    quote_total: totals.quoteTotal,
    currency_code: 'USD',
    proposal_response: 'pending',
    proposal_accepted_at: null,
    accepted_version_id: null,
    converted_service_order_id: null,
  }
  {
    const { error } = await client.from('quotes').upsert(quoteRow, { onConflict: 'id' })
    if (error) fail(`upsert cotação de teste: ${error.message}`)
    console.log(`  OK quotes id=${CONVERT_TEST_QUOTE_ID}`)
  }

  // Reset determinístico entre execuções: remove OS/versões de tentativas anteriores.
  await client.from('service_orders').delete().eq('quote_id', CONVERT_TEST_QUOTE_ID)
  await client.from('quote_versions').delete().eq('quote_id', CONVERT_TEST_QUOTE_ID)
  await client
    .from('quotes')
    .update({ accepted_version_id: null, converted_service_order_id: null, quote_status: 'draft' })
    .eq('id', CONVERT_TEST_QUOTE_ID)

  console.log('\n--- 2) simula aceite do cliente ---')
  const acceptedAt = new Date().toISOString()
  {
    const { error } = await client
      .from('quotes')
      .update({ proposal_response: 'accepted', proposal_accepted_at: acceptedAt })
      .eq('id', CONVERT_TEST_QUOTE_ID)
    if (error) fail(`marcar aceite: ${error.message}`)
    console.log('  OK proposal_response=accepted')
  }

  console.log('\n--- 3) ensureAcceptedQuoteVersion (espelhado) ---')
  const additionalItemRows = (fx.quoteCalc.additionals || []).map((line) => ({
    additional_item_id: null,
    code: line.code,
    quantity: line.quantity,
    unit_price: line.unitPrice,
    total_price: line.perPerson
      ? roundMoney(line.unitPrice * totals.billableGuestCount)
      : roundMoney(line.unitPrice * line.quantity),
    selected: true,
  }))
  const snapshot = {
    schema_version: 1,
    quote_number: CONVERT_TEST_QUOTE_NUMBER,
    language: 'pt',
    currency_code: 'USD',
    package: { id: packageId, price_per_person: fx.quoteCalc.packagePricePerPerson, total: totals.packageTotal },
    guest_counts: {
      adult_count: fx.quoteCalc.adults,
      children_under_3_count: fx.quoteCalc.childrenUnder3,
      children_4_to_12_count: fx.quoteCalc.children4To12,
      physical_guest_count: totals.physicalGuestCount,
      billable_guest_count: totals.billableGuestCount,
    },
    additional_items: additionalItemRows,
    additional_total: totals.additionalTotal,
    mileage: {
      base_location: null,
      distance: fx.quoteCalc.mileageDistance,
      free_limit: fx.quoteCalc.mileageFreeLimit,
      rate: fx.quoteCalc.mileageRate,
      fee: totals.mileageFee,
    },
    discount_amount: 0,
    reservation: { percentage: fx.quoteCalc.reservationPercentage, amount: totals.reservationAmount },
    balance_due: totals.balanceDue,
    quote_total: totals.quoteTotal,
    event: {
      event_date: event.event_date,
      start_time: event.start_time,
      end_time: event.end_time,
      venue_name: event.venue_name,
      address_line: event.address_line,
      city: event.city,
      state: event.state,
      postal_code: event.postal_code,
    },
  }

  let versionId
  {
    const { data, error } = await client
      .from('quote_versions')
      .insert({
        company_id: companyId,
        quote_id: CONVERT_TEST_QUOTE_ID,
        version_number: 1,
        language: 'pt',
        currency_code: 'USD',
        package_total: totals.packageTotal,
        additional_total: totals.additionalTotal,
        mileage_fee: totals.mileageFee,
        discount_amount: 0,
        reservation_amount: totals.reservationAmount,
        balance_due: totals.balanceDue,
        quote_total: totals.quoteTotal,
        commercial_snapshot: snapshot,
        schema_version: 1,
        is_current: true,
        accepted_at: acceptedAt,
        created_by: null,
      })
      .select('*')
      .single()
    if (error) fail(`criar quote_versions: ${error.message}`)
    versionId = data.id
    console.log(`  OK quote_versions id=${versionId} version_number=1 quote_total=${data.quote_total}`)

    const { error: updError } = await client
      .from('quotes')
      .update({ accepted_version_id: versionId })
      .eq('id', CONVERT_TEST_QUOTE_ID)
    if (updError) fail(`vincular accepted_version_id: ${updError.message}`)
  }

  console.log('\n--- 4) convertAcceptedQuoteToServiceOrder (espelhado) — 1ª chamada ---')
  async function convertOnce() {
    const { data: existing } = await client
      .from('service_orders')
      .select('*')
      .eq('company_id', companyId)
      .eq('quote_version_id', versionId)
      .maybeSingle()
    if (existing) return { data: existing, alreadyExisted: true }

    const { data: numberData, error: numberError } = await client.rpc('get_next_document_number', {
      p_company_id: companyId,
      p_document_type: 'service_order',
    })
    if (numberError || !numberData) {
      fail(`get_next_document_number(service_order): ${numberError?.message ?? 'vazio'}`)
    }

    const insertPayload = {
      company_id: companyId,
      service_order_number: numberData,
      quote_id: CONVERT_TEST_QUOTE_ID,
      quote_version_id: versionId,
      event_id: eventId,
      customer_id: customerId,
      status: 'planned',
      event_date: snapshot.event.event_date,
      start_time: snapshot.event.start_time,
      end_time: snapshot.event.end_time,
      venue_name: snapshot.event.venue_name,
      address_line: snapshot.event.address_line,
      city: snapshot.event.city,
      state: snapshot.event.state,
      postal_code: snapshot.event.postal_code,
      physical_guest_count: snapshot.guest_counts.physical_guest_count,
      billable_guest_count: snapshot.guest_counts.billable_guest_count,
      currency_code: snapshot.currency_code,
      package_total: totals.packageTotal,
      additional_total: totals.additionalTotal,
      mileage_fee: totals.mileageFee,
      discount_amount: 0,
      reservation_amount: totals.reservationAmount,
      balance_due: totals.balanceDue,
      service_order_total: totals.quoteTotal,
      commercial_snapshot: snapshot,
      created_by: null,
    }

    const { data: created, error: insertError } = await client
      .from('service_orders')
      .insert(insertPayload)
      .select('*')
      .single()
    if (insertError) fail(`insert service_orders: ${insertError.message}`)

    await client.from('service_order_status_history').insert({
      company_id: companyId,
      service_order_id: created.id,
      from_status: null,
      to_status: 'planned',
      reason: 'Conversão de cotação aceita em Ordem de Serviço (teste automatizado).',
      changed_by: null,
    })

    await client
      .from('quotes')
      .update({ converted_service_order_id: created.id, quote_status: 'converted' })
      .eq('id', CONVERT_TEST_QUOTE_ID)

    return { data: created, alreadyExisted: false }
  }

  const first = await convertOnce()
  console.log(
    `  OK service_orders id=${first.data.id} number=${first.data.service_order_number} total=${first.data.service_order_total} already_existed=${first.alreadyExisted}`,
  )
  if (first.alreadyExisted) fail('1ª conversão deveria criar uma nova OS, mas encontrou uma existente')
  if (Number(first.data.service_order_total) !== 2830) {
    fail(`service_order_total divergente: ${first.data.service_order_total} (esperado 2830)`)
  }

  console.log('\n--- 5) 2ª chamada (idempotência) ---')
  const second = await convertOnce()
  console.log(`  OK already_existed=${second.alreadyExisted} id=${second.data.id}`)
  if (!second.alreadyExisted) fail('2ª conversão deveria reaproveitar a OS existente (idempotência)')
  if (second.data.id !== first.data.id) fail('2ª conversão retornou uma OS diferente da 1ª')

  console.log('\n--- 6) verifica unicidade (company_id, quote_version_id) ---')
  {
    const { count, error } = await client
      .from('service_orders')
      .select('id', { head: true, count: 'exact' })
      .eq('company_id', companyId)
      .eq('quote_version_id', versionId)
    if (error) fail(`contagem service_orders: ${error.message}`)
    if (count !== 1) fail(`esperado exatamente 1 OS para a versão aceita, encontrado ${count}`)
    console.log(`  OK count=${count}`)
  }

  console.log('\n--- 7) verifica quotes.converted_service_order_id ---')
  {
    const { data, error } = await client
      .from('quotes')
      .select('converted_service_order_id, quote_status')
      .eq('id', CONVERT_TEST_QUOTE_ID)
      .single()
    if (error) fail(`reler cotação: ${error.message}`)
    if (data.converted_service_order_id !== first.data.id) fail('quotes.converted_service_order_id não foi vinculado')
    if (data.quote_status !== 'converted') fail(`quote_status esperado 'converted', encontrado '${data.quote_status}'`)
    console.log(`  OK converted_service_order_id=${data.converted_service_order_id} quote_status=${data.quote_status}`)
  }

  console.log('\nTEST QUOTE->ORDER CONVERSION: PASS')
  process.exit(0)
}

main().catch((err) => {
  console.error('ERRO INESPERADO:', err instanceof Error ? err.message : err)
  process.exit(2)
})
