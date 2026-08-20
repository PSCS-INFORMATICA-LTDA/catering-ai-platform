/**
 * Base de teste — feriados federais EUA + datas CDL (acréscimo 100%)
 *
 * Uso:
 *   node scripts/dev/seed-commemorative-dates-quotes.mjs           # dry-run + matrix
 *   node scripts/dev/seed-commemorative-dates-quotes.mjs --matrix  # só tabela esperada
 *   node scripts/dev/seed-commemorative-dates-quotes.mjs --apply   # grava no DEV
 *   node scripts/dev/seed-commemorative-dates-quotes.mjs --verify  # compara DB vs esperado
 *   node scripts/dev/seed-commemorative-dates-quotes.mjs --report  # verify + matrix
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
  'commemorative-dates-quotes-v1.json',
)
const REPORT_DIR = join(__dirname, 'reports')
const DEV_REF = 'yasprgtlqclwsjcshtls'
const PROD_REF = 'eapwtirhevxrqinytans'

const args = process.argv.slice(2)
const mode = args.includes('--apply')
  ? 'apply'
  : args.includes('--verify')
    ? 'verify'
    : args.includes('--report')
      ? 'report'
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

function calcCase(fx, c) {
  const profile = fx.profiles[c.profile]
  const adults = profile.adults
  const ppp = profile.packagePricePerPerson
  const packageTotal = roundMoney(adults * ppp)
  const baseSubtotal = packageTotal
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
  console.log('\n=== MATRIX ESPERADA — DATAS COMEMORATIVAS ===\n')
  console.log(
    [
      'Caso'.padEnd(38),
      'Data'.padEnd(12),
      'Base'.padStart(10),
      'Surch%'.padStart(8),
      'Surch$'.padStart(10),
      'Mín'.padStart(10),
      'Adj'.padStart(10),
      'TOTAL'.padStart(10),
      'Reserva'.padStart(10),
    ].join(' '),
  )
  console.log('-'.repeat(130))
  for (const r of rows) {
    console.log(
      [
        r.label.slice(0, 38).padEnd(38),
        r.eventDate.padEnd(12),
        money(r.baseSubtotal).padStart(10),
        String(r.holidaySurchargeAmount > 0 ? 100 : 0).padStart(8),
        money(r.holidaySurchargeAmount).padStart(10),
        money(r.minimumOrderAmount).padStart(10),
        money(r.minimumOrderAdjustment).padStart(10),
        money(r.quoteTotal).padStart(10),
        money(r.reservationAmount).padStart(10),
      ].join(' '),
    )
    if (r.note) console.log(`  note: ${r.note}`)
  }
  console.log('')
}

async function upsertEvent(client, row, dry) {
  if (dry) {
    console.log(`  PLAN event ${row.id} date=${row.event_date}`)
    return
  }
  let { error } = await client.from('events').upsert(row, { onConflict: 'id' })
  if (error) {
    const { company_id: _c, customer_id: _u, ...rest } = row
    ;({ error } = await client.from('events').upsert(rest, { onConflict: 'id' }))
  }
  if (error) throw new Error(`events ${row.id}: ${error.message}`)
  console.log(`  OK event ${row.event_name} (${row.event_date})`)
}

async function upsertQuote(client, row, dry) {
  if (dry) {
    console.log(
      `  PLAN quote ${row.quote_number} total=${row.quote_total} surcharge=${row.holiday_surcharge_amount}`,
    )
    return
  }
  const attempts = [row]
  let last = null
  for (const payload of attempts) {
    const { error } = await client.from('quotes').upsert(payload, {
      onConflict: 'id',
    })
    if (!error) {
      console.log(
        `  OK quote ${row.quote_number} total=${row.quote_total} minApplied=${row.minimum_order_applied}`,
      )
      return
    }
    last = error.message
  }
  throw new Error(`quotes ${row.quote_number}: ${last}`)
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
      event_name: `TEST HOL — ${r.label}`,
      event_date: r.eventDate,
      start_time: fx.shared.startTime,
      end_time: fx.shared.endTime,
      address_line: 'TESTE DEV — Local datas comemorativas',
      city: fx.shared.city,
      state: fx.shared.state,
      postal_code: fx.shared.postalCode,
      country: fx.shared.country,
      adults_count: r.adults,
      children_count: 0,
      billable_guests: r.adults,
      total_guests: r.adults,
      active: true,
      notes: `fixture ${fx.fixtureId} key=${r.key}`,
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
      mileage_fee: 0,
      mileage_distance: 0,
      mileage_free_limit: fx.shared.mileageFreeLimit,
      mileage_rate: fx.shared.mileageRate,
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
        'id, quote_number, quote_total, reservation_amount, balance_due, minimum_order_amount, minimum_order_applied, holiday_surcharge_amount, package_total, event_id',
      )
      .eq('id', r.quoteId)
      .maybeSingle()

    const { data: event } = await client
      .from('events')
      .select('event_date')
      .eq('id', r.eventId)
      .maybeSingle()

    if (error || !quote) {
      fail += 1
      console.log(`FAIL  ${r.quoteNumber} — cotação não encontrada`)
      reportRows.push({
        ...r,
        status: 'MISSING',
        actualTotal: null,
      })
      continue
    }

    const actualDate = event?.event_date ?? null
    const checks = [
      ['event_date', actualDate, r.eventDate],
      ['quote_total', Number(quote.quote_total), r.quoteTotal],
      [
        'holiday_surcharge_amount',
        Number(quote.holiday_surcharge_amount ?? 0),
        r.holidaySurchargeAmount,
      ],
      [
        'minimum_order_amount',
        Number(quote.minimum_order_amount ?? 0),
        r.minimumOrderAmount,
      ],
      [
        'minimum_order_applied',
        Boolean(quote.minimum_order_applied),
        r.minimumOrderApplied,
      ],
      [
        'reservation_amount',
        Number(quote.reservation_amount),
        r.reservationAmount,
      ],
    ]

    const mismatches = checks.filter(([, a, e]) => a !== e)
    if (mismatches.length) {
      fail += 1
      console.log(`FAIL  ${r.quoteNumber} (${r.eventDate})`)
      for (const [field, actual, expected] of mismatches) {
        console.log(`       ${field}: actual=${actual} expected=${expected}`)
      }
      reportRows.push({
        ...r,
        status: 'FAIL',
        actualTotal: Number(quote.quote_total),
        actualSurcharge: Number(quote.holiday_surcharge_amount ?? 0),
      })
    } else {
      console.log(
        `PASS  ${r.quoteNumber} ${r.eventDate} total=${money(r.quoteTotal)} surcharge=${money(r.holidaySurchargeAmount)}`,
      )
      reportRows.push({
        ...r,
        status: 'PASS',
        actualTotal: Number(quote.quote_total),
        actualSurcharge: Number(quote.holiday_surcharge_amount ?? 0),
      })
    }
  }

  mkdirSync(REPORT_DIR, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const outPath = join(REPORT_DIR, `commemorative-dates-${stamp}.json`)
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
    'Motor: +100% em feriados federais EUA (+ observação) e extras CDL 24/31 dez',
  )

  printMatrix(rows)

  if (mode === 'matrix') {
    process.exit(0)
  }

  const { url, service } = loadEnv()
  if (!url || !service) {
    console.error('BLOQUEADO — .env.local incompleto')
    process.exit(2)
  }
  const ref = assertDev(url)
  console.log(`project_ref=${ref} AMBIENTE: CATERING DEV`)

  const client = createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  if (mode === 'dry-run') {
    await apply(client, fx, rows, true)
    console.log(
      '\nPróximo: npm run seed:dev:commemorative-dates -- --apply',
    )
    process.exit(0)
  }

  if (mode === 'apply') {
    await apply(client, fx, rows, false)
    const fail = await verify(client, rows)
    process.exit(fail === 0 ? 0 : 1)
  }

  if (mode === 'verify' || mode === 'report') {
    const fail = await verify(client, rows)
    process.exit(fail === 0 ? 0 : 1)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
