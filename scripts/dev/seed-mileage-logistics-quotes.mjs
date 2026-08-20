/**
 * Base de teste — milhagem / logística (cortesia 20 mi Orlando Eye)
 *
 * Uso:
 *   node scripts/dev/seed-mileage-logistics-quotes.mjs           # dry-run + matrix
 *   node scripts/dev/seed-mileage-logistics-quotes.mjs --matrix
 *   node scripts/dev/seed-mileage-logistics-quotes.mjs --apply
 *   node scripts/dev/seed-mileage-logistics-quotes.mjs --verify
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
const FIXTURE_PATH = join(
  __dirname,
  'fixtures',
  'mileage-logistics-quotes-v1.json',
)
const REPORT_DIR = join(__dirname, 'reports')
const DEV_REF = 'yasprgtlqclwsjcshtls'
const PROD_REF = 'eapwtirhevxrqinytans'

const args = process.argv.slice(2)
const mode = args.includes('--apply')
  ? 'apply'
  : args.includes('--verify')
    ? 'verify'
    : args.includes('--matrix')
      ? 'matrix'
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

function calcMileageFee(distance, freeLimit, rate) {
  const charged = Math.max(0, Number(distance) - Number(freeLimit))
  return {
    chargedMiles: charged,
    mileageFee: roundMoney(charged * Number(rate)),
  }
}

function calcCase(fx, c) {
  const profile = fx.profiles[c.profile]
  const adults = profile.adults
  const ppp = profile.packagePricePerPerson
  const packageTotal = roundMoney(adults * ppp)
  const free = fx.rules.mileageFreeLimit
  const rate = fx.rules.mileageRate
  const { chargedMiles, mileageFee } = calcMileageFee(
    c.mileageDistance,
    free,
    rate,
  )
  const baseSubtotal = roundMoney(packageTotal + mileageFee)
  const commercial = applyCommercialMinimums(
    baseSubtotal,
    c.eventDate,
    fx.rules,
  )
  const pct = fx.rules.reservationPercentage
  const reservationAmount = roundMoney((commercial.quoteTotal * pct) / 100)
  const balanceDue = roundMoney(commercial.quoteTotal - reservationAmount)
  return {
    ...c,
    profileLabel: profile.label,
    adults,
    packagePricePerPerson: ppp,
    packageTotal,
    mileageFreeLimit: free,
    mileageRate: rate,
    mileageBaseLocation: fx.rules.mileageBaseLocation,
    chargedMiles,
    mileageFee,
    baseSubtotal,
    ...commercial,
    reservationAmount,
    balanceDue,
    reservationPercentage: pct,
  }
}

function money(n) {
  return `$${Number(n).toFixed(2)}`
}

function printMatrix(rows) {
  console.log('\n=== MATRIX ESPERADA — MILHAGEM / LOGÍSTICA ===\n')
  console.log(
    [
      'Caso'.padEnd(40),
      'Dist'.padStart(6),
      'Free'.padStart(6),
      'Cob'.padStart(6),
      'Mi$'.padStart(10),
      'Pacote'.padStart(10),
      'TOTAL'.padStart(10),
      'Reserva'.padStart(10),
    ].join(' '),
  )
  console.log('-'.repeat(110))
  for (const r of rows) {
    console.log(
      [
        r.label.slice(0, 40).padEnd(40),
        String(r.mileageDistance).padStart(6),
        String(r.mileageFreeLimit).padStart(6),
        String(r.chargedMiles).padStart(6),
        money(r.mileageFee).padStart(10),
        money(r.packageTotal).padStart(10),
        money(r.quoteTotal).padStart(10),
        money(r.reservationAmount).padStart(10),
      ].join(' '),
    )
    if (r.distanceNote) console.log(`  note: ${r.distanceNote}`)
  }
  console.log('')
}

async function upsertEvent(client, row, dry) {
  if (dry) {
    console.log(`  PLAN event ${row.id} ${row.city} dist note in quote`)
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
      `  PLAN quote ${row.quote_number} dist=${row.mileage_distance} fee=${row.mileage_fee} total=${row.quote_total}`,
    )
    return
  }
  const { error } = await client.from('quotes').upsert(row, { onConflict: 'id' })
  if (error) throw new Error(`quotes ${row.quote_number}: ${error.message}`)
  console.log(
    `  OK quote ${row.quote_number} dist=${row.mileage_distance} fee=${row.mileage_fee} total=${row.quote_total}`,
  )
}

async function apply(client, fx, rows, dry) {
  console.log(
    dry
      ? '\n=== DRY-RUN — planejando upserts ===\n'
      : '\n=== APPLY — gravando no DEV ===\n',
  )

  const { data: company } = await client
    .from('companies')
    .select('id')
    .eq('id', fx.shared.companyId)
    .maybeSingle()
  if (!company && !dry) {
    throw new Error(
      'Empresa principal do fixture funcional não encontrada. Rode antes: npm run seed:dev:functional',
    )
  }

  for (const r of rows) {
    const eventRow = {
      id: r.eventId,
      company_id: fx.shared.companyId,
      customer_id: fx.shared.customerId,
      event_name: `TEST MI — ${r.label}`,
      event_date: r.eventDate,
      start_time: fx.shared.startTime,
      end_time: fx.shared.endTime,
      address_line: r.addressLine,
      city: r.city,
      state: fx.shared.state,
      postal_code: r.postalCode,
      country: fx.shared.country,
      adults_count: r.adults,
      children_count: 0,
      billable_guests: r.adults,
      total_guests: r.adults,
      active: true,
      notes: `fixture ${fx.fixtureId} key=${r.key} | ${r.distanceNote}`,
    }
    await upsertEvent(client, eventRow, dry)

    const quoteRow = {
      id: r.quoteId,
      company_id: fx.shared.companyId,
      customer_id: fx.shared.customerId,
      event_id: r.eventId,
      package_id: fx.shared.packageId,
      quote_number: r.quoteNumber,
      language: 'pt',
      quote_status: 'draft',
      source: fx.fixtureId,
      active: true,
      adult_count: r.adults,
      children_under_3_count: 0,
      children_4_to_12_count: 0,
      physical_guest_count: r.adults,
      billable_guest_count: r.adults,
      package_price_per_person: r.packagePricePerPerson,
      package_total: r.packageTotal,
      additional_total: 0,
      mileage_base_location: r.mileageBaseLocation,
      mileage_distance: r.mileageDistance,
      mileage_free_limit: r.mileageFreeLimit,
      mileage_rate: r.mileageRate,
      mileage_fee: r.mileageFee,
      reservation_percentage: r.reservationPercentage,
      reservation_amount: r.reservationAmount,
      balance_due: r.balanceDue,
      quote_total: r.quoteTotal,
      minimum_order_amount: r.minimumOrderAmount,
      minimum_order_applied: r.minimumOrderApplied,
      holiday_surcharge_amount: r.holidaySurchargeAmount,
      currency_code: 'USD',
    }
    await upsertQuote(client, quoteRow, dry)
  }
}

async function verify(client, rows) {
  console.log('\n=== VERIFY — DB vs esperado ===\n')
  let fail = 0
  const reportRows = []

  for (const r of rows) {
    const { data: quote, error } = await client
      .from('quotes')
      .select(
        'id, quote_number, quote_total, mileage_distance, mileage_free_limit, mileage_rate, mileage_fee, reservation_amount, package_total',
      )
      .eq('id', r.quoteId)
      .maybeSingle()

    if (error || !quote) {
      fail += 1
      console.log(`FAIL  ${r.quoteNumber} — cotação não encontrada`)
      reportRows.push({ ...r, status: 'MISSING' })
      continue
    }

    const checks = [
      ['mileage_distance', Number(quote.mileage_distance), r.mileageDistance],
      ['mileage_fee', Number(quote.mileage_fee), r.mileageFee],
      ['quote_total', Number(quote.quote_total), r.quoteTotal],
      [
        'reservation_amount',
        Number(quote.reservation_amount),
        r.reservationAmount,
      ],
    ]
    const mismatches = checks.filter(([, a, e]) => a !== e)
    if (mismatches.length) {
      fail += 1
      console.log(`FAIL  ${r.quoteNumber}`)
      for (const [field, actual, expected] of mismatches) {
        console.log(`       ${field}: actual=${actual} expected=${expected}`)
      }
      reportRows.push({ ...r, status: 'FAIL', actualFee: Number(quote.mileage_fee) })
    } else {
      console.log(
        `PASS  ${r.quoteNumber} dist=${r.mileageDistance} fee=${money(r.mileageFee)} total=${money(r.quoteTotal)}`,
      )
      reportRows.push({ ...r, status: 'PASS', actualFee: Number(quote.mileage_fee) })
    }
  }

  mkdirSync(REPORT_DIR, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const outPath = join(REPORT_DIR, `mileage-logistics-${stamp}.json`)
  writeFileSync(
    outPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        mode,
        fail,
        pass: reportRows.filter((x) => x.status === 'PASS').length,
        rows: reportRows,
      },
      null,
      2,
    ),
  )
  console.log(`\nRelatório JSON: ${outPath}`)
  console.log(
    fail === 0
      ? `\nVERIFY OK — ${reportRows.length} casos`
      : `\nVERIFY FAIL — ${fail}/${reportRows.length}`,
  )
  return fail
}

async function main() {
  const fx = JSON.parse(readFileSync(FIXTURE_PATH, 'utf8'))
  const rows = fx.cases.map((c) => calcCase(fx, c))

  console.log(`fixture=${fx.fixtureId}`)
  console.log(`mode=${mode}`)
  console.log(
    `Regra: base ${fx.rules.mileageBaseLocation}; ${fx.rules.mileageFreeLimit} mi cortesia; $${fx.rules.mileageRate}/mi acima`,
  )

  printMatrix(rows)

  if (mode === 'matrix') return

  const { url, service } = loadEnv()
  assertDev(url)
  const client = createClient(url, service)

  if (mode === 'verify') {
    const fail = await verify(client, rows)
    process.exit(fail === 0 ? 0 : 1)
  }

  const dry = mode !== 'apply'
  await apply(client, fx, rows, dry)
  if (!dry) {
    const fail = await verify(client, rows)
    process.exit(fail === 0 ? 0 : 1)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
