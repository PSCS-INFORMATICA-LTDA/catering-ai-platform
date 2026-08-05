/**
 * Teste — máquina de status de cotação (unit) + criação/aceite de
 * `quote_versions` (integração, idempotente) contra fixtures DEV.
 *
 * Espelha (sem import TS):
 *   - Lib/quotes/statusMachine.ts (normalizeQuoteStatus, isValidQuoteTransition,
 *     isQuoteAccepted, isQuoteConverted, canConvertQuote)
 *   - Lib/quotes/versions.ts (createQuoteVersion / ensureAcceptedQuoteVersion)
 *
 * Pré-requisito: `npm run seed:dev:functional` (fixture customerMain/eventMain/companyMain).
 *
 * Uso:
 *   node scripts/dev/test-quote-versions-status.mjs
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

const VERSIONS_TEST_QUOTE_ID = 'f2200000-0000-4000-8000-000000000003'
const VERSIONS_TEST_QUOTE_NUMBER = 'TEST-DEV-QUOTE-VERSIONS-001'

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
  console.log(`QUOTE VERSIONS/STATUS: FAIL — ${msg}`)
  process.exit(1)
}

function roundMoney(n) {
  return Math.round(Number(n) * 100) / 100
}

/** Espelho de Lib/quotes/statusMachine.ts */
const LEGACY_ALIASES = { approved: 'accepted', canceled: 'cancelled' }
const CANONICAL_STATUSES = [
  'draft',
  'ready_for_review',
  'sent',
  'viewed',
  'accepted',
  'converted',
  'rejected',
  'expired',
  'cancelled',
  'archived',
]
const ALLOWED_TRANSITIONS = {
  draft: ['ready_for_review', 'sent', 'cancelled', 'archived'],
  ready_for_review: ['sent', 'draft', 'cancelled', 'archived'],
  sent: ['viewed', 'accepted', 'rejected', 'expired', 'cancelled'],
  viewed: ['accepted', 'rejected', 'expired', 'cancelled'],
  accepted: ['converted', 'cancelled'],
  converted: ['archived'],
  rejected: ['sent', 'archived'],
  expired: ['sent', 'archived'],
  cancelled: ['archived'],
  archived: [],
}
function normalizeQuoteStatus(status) {
  const raw = (status ?? '').trim().toLowerCase()
  if (!raw) return 'draft'
  if (LEGACY_ALIASES[raw]) return LEGACY_ALIASES[raw]
  if (CANONICAL_STATUSES.includes(raw)) return raw
  return 'draft'
}
function isValidQuoteTransition(from, to) {
  const f = normalizeQuoteStatus(from)
  const t = normalizeQuoteStatus(to)
  if (f === t) return true
  return ALLOWED_TRANSITIONS[f]?.includes(t) ?? false
}
function isQuoteAccepted(input) {
  if (input.proposal_response === 'accepted') return true
  return normalizeQuoteStatus(input.quote_status) === 'accepted'
}
function isQuoteConverted(input) {
  if (input.converted_service_order_id) return true
  return normalizeQuoteStatus(input.quote_status) === 'converted'
}
function canConvertQuote(input) {
  if (input.active === false) return { ok: false, reason: 'Cotação inativa.' }
  if (isQuoteConverted(input)) {
    return { ok: false, reason: 'Cotação já convertida em Ordem de Serviço.' }
  }
  if (!isQuoteAccepted(input)) {
    return {
      ok: false,
      reason:
        'A cotação precisa estar aceita pelo cliente antes de converter em Ordem de Serviço.',
    }
  }
  return { ok: true, reason: null }
}

function assertEqual(label, actual, expected) {
  if (actual !== expected) fail(`${label}: esperado ${JSON.stringify(expected)}, obtido ${JSON.stringify(actual)}`)
  console.log(`  OK ${label} = ${JSON.stringify(actual)}`)
}

async function main() {
  const fx = JSON.parse(readFileSync(FIXTURE_PATH, 'utf8'))
  const { url, service } = loadEnv()
  if (!url || !service) fail('.env.local incompleto')
  const ref = assertDev(url)
  console.log('=== TEST QUOTE VERSIONS / STATUS MACHINE ===')
  console.log(`project_ref=${ref}`)
  console.log('AMBIENTE: CATERING DEV — CORRETO\n')

  console.log('--- 1) Unit: normalizeQuoteStatus / aliases legados ---')
  assertEqual("normalizeQuoteStatus('approved')", normalizeQuoteStatus('approved'), 'accepted')
  assertEqual("normalizeQuoteStatus('canceled')", normalizeQuoteStatus('canceled'), 'cancelled')
  assertEqual("normalizeQuoteStatus(null)", normalizeQuoteStatus(null), 'draft')
  assertEqual("normalizeQuoteStatus('lixo')", normalizeQuoteStatus('lixo'), 'draft')
  assertEqual("normalizeQuoteStatus('ACCEPTED')", normalizeQuoteStatus('ACCEPTED'), 'accepted')

  console.log('\n--- 2) Unit: isValidQuoteTransition (permitidas) ---')
  const validCases = [
    ['draft', 'sent'],
    ['sent', 'viewed'],
    ['sent', 'accepted'],
    ['viewed', 'accepted'],
    ['accepted', 'converted'],
    ['rejected', 'sent'],
    ['draft', 'draft'],
  ]
  for (const [from, to] of validCases) {
    if (!isValidQuoteTransition(from, to)) fail(`transição esperada válida: ${from} -> ${to}`)
  }
  console.log(`  OK ${validCases.length} transições válidas confirmadas`)

  console.log('\n--- 3) Unit: isValidQuoteTransition (bloqueadas) ---')
  const invalidCases = [
    ['converted', 'draft'],
    ['archived', 'sent'],
    ['draft', 'converted'],
    ['cancelled', 'sent'],
  ]
  for (const [from, to] of invalidCases) {
    if (isValidQuoteTransition(from, to)) fail(`transição esperada inválida foi aceita: ${from} -> ${to}`)
  }
  console.log(`  OK ${invalidCases.length} transições inválidas bloqueadas`)

  console.log('\n--- 4) Unit: canConvertQuote (regras de conversão) ---')
  {
    const r1 = canConvertQuote({ active: false, quote_status: 'accepted' })
    if (r1.ok) fail('cotação inativa não deveria permitir conversão')
    const r2 = canConvertQuote({ active: true, quote_status: 'converted', converted_service_order_id: 'x' })
    if (r2.ok) fail('cotação já convertida não deveria permitir nova conversão')
    const r3 = canConvertQuote({ active: true, quote_status: 'draft', proposal_response: 'pending' })
    if (r3.ok) fail('cotação não aceita não deveria permitir conversão')
    const r4 = canConvertQuote({ active: true, quote_status: 'accepted', proposal_response: 'accepted' })
    if (!r4.ok) fail('cotação aceita e ativa deveria permitir conversão')
    console.log('  OK canConvertQuote cobre os 4 cenários (inativa/convertida/não-aceita/ok)')
  }

  console.log('\n--- 5) Integração: setup cotação de teste (draft) ---')
  const client = createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const companyId = fx.ids.companyMain
  const customerId = fx.ids.customerMain
  const eventId = fx.ids.eventMain
  const packageId = fx.ids.pkgEssential

  const { data: company } = await client.from('companies').select('id').eq('id', companyId).maybeSingle()
  if (!company) fail('companyMain ausente — rode `npm run seed:dev:functional` primeiro')

  const totals = (() => {
    const c = fx.quoteCalc
    const adults = Math.max(0, Number(c.adults || 0))
    const c412 = Math.max(0, Number(c.children4To12 || 0))
    const billable = adults + c412 * 0.5
    const physical = adults + Number(c.childrenUnder3 || 0) + c412
    const packageTotal = roundMoney(c.packagePricePerPerson * billable)
    let additionalTotal = 0
    for (const line of c.additionals || []) {
      additionalTotal += line.perPerson
        ? roundMoney(line.unitPrice * billable)
        : roundMoney(line.unitPrice * line.quantity)
    }
    additionalTotal = roundMoney(additionalTotal)
    const mileageFee = roundMoney(Math.max(0, c.mileageDistance - c.mileageFreeLimit) * c.mileageRate)
    const quoteTotal = roundMoney(packageTotal + additionalTotal + mileageFee)
    const reservationAmount = roundMoney((quoteTotal * c.reservationPercentage) / 100)
    return {
      billable,
      physical,
      packageTotal,
      additionalTotal,
      mileageFee,
      quoteTotal,
      reservationAmount,
      balanceDue: roundMoney(quoteTotal - reservationAmount),
    }
  })()

  const quoteRow = {
    id: VERSIONS_TEST_QUOTE_ID,
    company_id: companyId,
    customer_id: customerId,
    event_id: eventId,
    package_id: packageId,
    quote_number: VERSIONS_TEST_QUOTE_NUMBER,
    language: 'pt',
    quote_status: 'draft',
    active: true,
    physical_guest_count: totals.physical,
    billable_guest_count: totals.billable,
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
    console.log(`  OK quotes id=${VERSIONS_TEST_QUOTE_ID} quote_total=${totals.quoteTotal}`)
  }

  // Reset determinístico entre execuções.
  await client.from('quote_versions').delete().eq('quote_id', VERSIONS_TEST_QUOTE_ID)
  await client
    .from('quotes')
    .update({ accepted_version_id: null, quote_status: 'draft', proposal_response: 'pending', proposal_accepted_at: null })
    .eq('id', VERSIONS_TEST_QUOTE_ID)

  async function currentVersionNumber() {
    const { data } = await client
      .from('quote_versions')
      .select('version_number')
      .eq('quote_id', VERSIONS_TEST_QUOTE_ID)
      .order('version_number', { ascending: false })
      .limit(1)
      .maybeSingle()
    return data?.version_number ?? 0
  }

  function buildSnapshot() {
    return {
      schema_version: 1,
      quote_number: VERSIONS_TEST_QUOTE_NUMBER,
      language: 'pt',
      currency_code: 'USD',
      package: { id: packageId, price_per_person: fx.quoteCalc.packagePricePerPerson, total: totals.packageTotal },
      guest_counts: {
        adult_count: fx.quoteCalc.adults,
        children_under_3_count: fx.quoteCalc.childrenUnder3,
        children_4_to_12_count: fx.quoteCalc.children4To12,
        physical_guest_count: totals.physical,
        billable_guest_count: totals.billable,
      },
      additional_total: totals.additionalTotal,
      mileage: {
        distance: fx.quoteCalc.mileageDistance,
        free_limit: fx.quoteCalc.mileageFreeLimit,
        rate: fx.quoteCalc.mileageRate,
        fee: totals.mileageFee,
      },
      discount_amount: 0,
      reservation: { percentage: fx.quoteCalc.reservationPercentage, amount: totals.reservationAmount },
      balance_due: totals.balanceDue,
      quote_total: totals.quoteTotal,
    }
  }

  /** Espelho de Lib/quotes/versions.ts createQuoteVersion() */
  async function createQuoteVersion({ markAccepted }) {
    const nextVersionNumber = (await currentVersionNumber()) + 1
    const { error: clearError } = await client
      .from('quote_versions')
      .update({ is_current: false })
      .eq('quote_id', VERSIONS_TEST_QUOTE_ID)
      .eq('is_current', true)
    if (clearError) fail(`clear is_current: ${clearError.message}`)

    const acceptedAt = markAccepted ? new Date().toISOString() : null
    const { data, error } = await client
      .from('quote_versions')
      .insert({
        company_id: companyId,
        quote_id: VERSIONS_TEST_QUOTE_ID,
        version_number: nextVersionNumber,
        language: 'pt',
        currency_code: 'USD',
        package_total: totals.packageTotal,
        additional_total: totals.additionalTotal,
        mileage_fee: totals.mileageFee,
        discount_amount: 0,
        reservation_amount: totals.reservationAmount,
        balance_due: totals.balanceDue,
        quote_total: totals.quoteTotal,
        commercial_snapshot: buildSnapshot(),
        schema_version: 1,
        is_current: true,
        accepted_at: acceptedAt,
        created_by: null,
      })
      .select('*')
      .single()
    if (error) fail(`insert quote_versions: ${error.message}`)

    if (markAccepted) {
      const { error: updError } = await client
        .from('quotes')
        .update({ accepted_version_id: data.id })
        .eq('id', VERSIONS_TEST_QUOTE_ID)
      if (updError) fail(`vincular accepted_version_id: ${updError.message}`)
    }
    return data
  }

  console.log('\n--- 6) createQuoteVersion() — versão 1 (rascunho, não aceita) ---')
  const v1 = await createQuoteVersion({ markAccepted: false })
  assertEqual('v1.version_number', v1.version_number, 1)
  assertEqual('v1.is_current', v1.is_current, true)
  assertEqual('v1.accepted_at', v1.accepted_at, null)
  assertEqual('v1.quote_total', Number(v1.quote_total), totals.quoteTotal)

  console.log('\n--- 7) createQuoteVersion({ markAccepted: true }) — versão 2 (aceita) ---')
  const v2 = await createQuoteVersion({ markAccepted: true })
  assertEqual('v2.version_number', v2.version_number, 2)
  assertEqual('v2.is_current', v2.is_current, true)
  if (!v2.accepted_at) fail('v2.accepted_at deveria estar preenchido')
  console.log(`  OK v2.accepted_at=${v2.accepted_at}`)

  {
    const { data: v1After } = await client
      .from('quote_versions')
      .select('is_current')
      .eq('id', v1.id)
      .single()
    assertEqual('v1.is_current após criar v2', v1After.is_current, false)
  }
  {
    const { data: quoteAfter } = await client
      .from('quotes')
      .select('accepted_version_id')
      .eq('id', VERSIONS_TEST_QUOTE_ID)
      .single()
    assertEqual('quotes.accepted_version_id', quoteAfter.accepted_version_id, v2.id)
  }

  console.log('\n--- 8) ensureAcceptedQuoteVersion() — idempotência (não deve criar v3) ---')
  {
    const { data: quoteRowNow } = await client
      .from('quotes')
      .select('accepted_version_id')
      .eq('id', VERSIONS_TEST_QUOTE_ID)
      .single()
    let ensured
    if (quoteRowNow.accepted_version_id) {
      const { data: existing } = await client
        .from('quote_versions')
        .select('*')
        .eq('id', quoteRowNow.accepted_version_id)
        .maybeSingle()
      ensured = existing
    }
    if (!ensured) fail('ensureAcceptedQuoteVersion deveria reaproveitar a versão já aceita (v2)')
    assertEqual('ensureAcceptedQuoteVersion() retorna v2.id', ensured.id, v2.id)

    const { count } = await client
      .from('quote_versions')
      .select('id', { head: true, count: 'exact' })
      .eq('quote_id', VERSIONS_TEST_QUOTE_ID)
    assertEqual('total de quote_versions após idempotência', count, 2)
  }

  console.log('\nQUOTE VERSIONS/STATUS: PASS')
  process.exit(0)
}

main().catch((err) => {
  console.error('ERRO INESPERADO:', err instanceof Error ? err.message : err)
  process.exit(2)
})
