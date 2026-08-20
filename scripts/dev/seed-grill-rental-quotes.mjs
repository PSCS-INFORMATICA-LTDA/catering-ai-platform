/**
 * Base de teste — aluguel de churrasqueira ($100) + desconto (verde no resumo)
 *
 * Uso:
 *   node scripts/dev/seed-grill-rental-quotes.mjs
 *   node scripts/dev/seed-grill-rental-quotes.mjs --apply
 *   node scripts/dev/seed-grill-rental-quotes.mjs --verify
 *
 * Project Ref: yasprgtlqclwsjcshtls (DEV). PROD bloqueado.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { applyCommercialMinimums } from './lib/us-holidays.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..', '..')
const REPORT_DIR = join(__dirname, 'reports')
const DEV_REF = 'yasprgtlqclwsjcshtls'
const PROD_REF = 'eapwtirhevxrqinytans'

const GRILL_FEE = 100
const SHARED = {
  companyId: '65fd576f-8d97-49ba-bf38-61bc1e94e94a',
  customerId: 'f2000000-0000-4000-8000-000000000001',
  packageId: 'c2000000-0000-4000-8000-000000000001',
  adults: 30,
  packagePricePerPerson: 45,
  eventDate: '2026-09-23', // Wednesday
  startTime: '12:00',
  endTime: '16:00',
  city: 'Orlando',
  state: 'FL',
  postalCode: '32801',
  country: 'US',
  reservationPercentage: 30,
}

const RULES = {
  minOrderWeekday: 800,
  minOrderWeekend: 1000,
  minOrderDecJan: 900,
  holidaySurchargePercent: 100,
  holidayMinOrder: 2000,
}

const CASES = [
  {
    key: 'grill-1-discount',
    quoteNumber: 'TEST-DEV-QUOTE-GRILL-DISC',
    eventId: 'e5100000-0000-4000-8000-000000000001',
    quoteId: 'e5200000-0000-4000-8000-000000000001',
    label: 'Aluguel 1× churrasqueira + desconto $50 (verde)',
    grillQty: 1,
    discountAmount: 50,
    addressLine: 'TESTE DEV — Cliente sem churrasqueira (aluguel 1×)',
  },
  {
    key: 'grill-2',
    quoteNumber: 'TEST-DEV-QUOTE-GRILL-2X',
    eventId: 'e5100000-0000-4000-8000-000000000002',
    quoteId: 'e5200000-0000-4000-8000-000000000002',
    label: 'Aluguel 2× churrasqueiras ($200)',
    grillQty: 2,
    discountAmount: 0,
    addressLine: 'TESTE DEV — Aluguel 2× churrasqueiras',
  },
]

const args = process.argv.slice(2)
const mode = args.includes('--apply')
  ? 'apply'
  : args.includes('--verify')
    ? 'verify'
    : 'dry-run'

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
    console.error(`BLOQUEADO — Project Ref inesperado: ${ref}`)
    process.exit(2)
  }
  return ref
}

function roundMoney(n) {
  return Math.round(Number(n) * 100) / 100
}

function calcCase(c) {
  const packageTotal = roundMoney(SHARED.adults * SHARED.packagePricePerPerson)
  const grillRentalTotal = roundMoney(c.grillQty * GRILL_FEE)
  const discountAmount = roundMoney(c.discountAmount)
  const baseBeforeDiscount = roundMoney(packageTotal + grillRentalTotal)
  const commercial = applyCommercialMinimums(
    baseBeforeDiscount,
    SHARED.eventDate,
    RULES,
  )
  // Desconto após regras comerciais (demo visual + total líquido).
  const quoteTotal = roundMoney(
    Math.max(0, commercial.quoteTotal - discountAmount),
  )
  const reservationAmount = roundMoney(
    (quoteTotal * SHARED.reservationPercentage) / 100,
  )
  const balanceDue = roundMoney(quoteTotal - reservationAmount)
  return {
    ...c,
    packageTotal,
    grillRentalTotal,
    discountAmount,
    baseBeforeDiscount,
    ...commercial,
    quoteTotal,
    reservationAmount,
    balanceDue,
  }
}

function money(n) {
  return `$${Number(n).toFixed(2)}`
}

async function upsertEvent(client, row, dry) {
  if (dry) {
    console.log(`  PLAN event ${row.id}`)
    return
  }
  let { error } = await client.from('events').upsert(row, { onConflict: 'id' })
  if (error) {
    const { company_id: _c, customer_id: _u, ...rest } = row
    ;({ error } = await client.from('events').upsert(rest, { onConflict: 'id' }))
  }
  if (error) throw new Error(`events ${row.id}: ${error.message}`)
  console.log(`  OK event ${row.event_name}`)
}

async function upsertQuote(client, row, dry) {
  if (dry) {
    console.log(
      `  PLAN quote ${row.quote_number} grill=${row.grill_rental_total} disc=${row.discount_amount} total=${row.quote_total}`,
    )
    return
  }
  const { error } = await client.from('quotes').upsert(row, { onConflict: 'id' })
  if (error) throw new Error(`quotes ${row.quote_number}: ${error.message}`)
  console.log(
    `  OK quote ${row.quote_number} grill=${row.grill_rental_total} disc=${row.discount_amount} total=${row.quote_total}`,
  )
}

async function apply(client, rows, dry) {
  console.log(
    dry
      ? '\n=== DRY-RUN — planejando upserts ===\n'
      : '\n=== APPLY — gravando no DEV ===\n',
  )

  for (const r of rows) {
    await upsertEvent(
      client,
      {
        id: r.eventId,
        company_id: SHARED.companyId,
        customer_id: SHARED.customerId,
        event_name: `TEST GRILL — ${r.label}`,
        event_date: SHARED.eventDate,
        start_time: SHARED.startTime,
        end_time: SHARED.endTime,
        address_line: r.addressLine,
        city: SHARED.city,
        state: SHARED.state,
        postal_code: SHARED.postalCode,
        country: SHARED.country,
        adults_count: SHARED.adults,
        children_count: 0,
        billable_guests: SHARED.adults,
        total_guests: SHARED.adults,
        has_grill: false,
        grill_rental_required: true,
        grill_rental_qty: r.grillQty,
        active: true,
        notes: `fixture grill-rental key=${r.key}`,
      },
      dry,
    )

    await upsertQuote(
      client,
      {
        id: r.quoteId,
        company_id: SHARED.companyId,
        customer_id: SHARED.customerId,
        event_id: r.eventId,
        package_id: SHARED.packageId,
        quote_number: r.quoteNumber,
        language: 'pt',
        quote_status: 'draft',
        source: 'grill-rental-quotes-v1',
        active: true,
        adult_count: SHARED.adults,
        children_under_3_count: 0,
        children_4_to_12_count: 0,
        physical_guest_count: SHARED.adults,
        billable_guest_count: SHARED.adults,
        package_price_per_person: SHARED.packagePricePerPerson,
        package_total: r.packageTotal,
        additional_total: 0,
        grill_rental_required: true,
        grill_rental_qty: r.grillQty,
        grill_rental_total: r.grillRentalTotal,
        discount_amount: r.discountAmount,
        mileage_fee: 0,
        mileage_distance: 0,
        mileage_free_limit: 20,
        mileage_rate: 2,
        reservation_percentage: SHARED.reservationPercentage,
        reservation_amount: r.reservationAmount,
        balance_due: r.balanceDue,
        quote_total: r.quoteTotal,
        minimum_order_amount: r.minimumOrderAmount,
        minimum_order_applied: r.minimumOrderApplied,
        holiday_surcharge_amount: r.holidaySurchargeAmount,
        currency_code: 'USD',
      },
      dry,
    )
  }
}

async function verify(client, rows) {
  console.log('\n=== VERIFY — DB vs esperado ===\n')
  let fail = 0
  for (const r of rows) {
    const { data: quote } = await client
      .from('quotes')
      .select(
        'quote_number, grill_rental_total, grill_rental_qty, discount_amount, quote_total',
      )
      .eq('id', r.quoteId)
      .maybeSingle()
    if (!quote) {
      fail += 1
      console.log(`FAIL  ${r.quoteNumber} — missing`)
      continue
    }
    const ok =
      Number(quote.grill_rental_total) === r.grillRentalTotal &&
      Number(quote.discount_amount ?? 0) === r.discountAmount &&
      Number(quote.quote_total) === r.quoteTotal
    if (!ok) {
      fail += 1
      console.log(
        `FAIL  ${r.quoteNumber} grill=${quote.grill_rental_total} disc=${quote.discount_amount} total=${quote.quote_total}`,
      )
    } else {
      console.log(
        `PASS  ${r.quoteNumber} grill=${money(r.grillRentalTotal)} disc=${money(r.discountAmount)} total=${money(r.quoteTotal)}`,
      )
    }
  }
  mkdirSync(REPORT_DIR, { recursive: true })
  const out = join(
    REPORT_DIR,
    `grill-rental-${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
  )
  writeFileSync(out, JSON.stringify({ mode, fail, rows }, null, 2))
  console.log(`\nRelatório: ${out}`)
  return fail
}

async function main() {
  const rows = CASES.map(calcCase)
  console.log('fixture=grill-rental-quotes-v1')
  console.log(`mode=${mode}`)
  console.log(`Regra: aluguel $${GRILL_FEE}/churrasqueira quando cliente não tem`)
  console.log('')
  for (const r of rows) {
    console.log(
      `${r.quoteNumber}: pacote ${money(r.packageTotal)} + grill ${money(r.grillRentalTotal)} − desc ${money(r.discountAmount)} = ${money(r.quoteTotal)}`,
    )
  }

  if (mode === 'dry-run') {
    await apply(null, rows, true)
    return
  }

  const { url, service } = loadEnv()
  assertDev(url)
  const client = createClient(url, service)

  if (mode === 'verify') {
    process.exit((await verify(client, rows)) === 0 ? 0 : 1)
  }

  await apply(client, rows, false)
  process.exit((await verify(client, rows)) === 0 ? 0 : 1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
