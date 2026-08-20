/**
 * Base de teste — guarnição no pacote vs como adicional (share WhatsApp/SMS/e-mail)
 *
 * Uso:
 *   node scripts/dev/seed-garnish-share-quotes.mjs
 *   node scripts/dev/seed-garnish-share-quotes.mjs --apply
 *   node scripts/dev/seed-garnish-share-quotes.mjs --verify
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

const SHARED = {
  companyId: '65fd576f-8d97-49ba-bf38-61bc1e94e94a',
  customerId: 'f2000000-0000-4000-8000-000000000001',
  adults: 30,
  eventDate: '2026-10-07', // Wednesday
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
    key: 'with-garnish',
    quoteNumber: 'TEST-DEV-QUOTE-GAR-WITH',
    eventId: 'e6100000-0000-4000-8000-000000000001',
    quoteId: 'e6200000-0000-4000-8000-000000000001',
    label: 'Pacote COM guarnições (bloqueia adicional guarnição)',
    wantPackageWithGarnish: true,
    addGarnishAsAdditional: false,
  },
  {
    key: 'without-garnish',
    quoteNumber: 'TEST-DEV-QUOTE-GAR-WITHOUT',
    eventId: 'e6100000-0000-4000-8000-000000000002',
    quoteId: 'e6200000-0000-4000-8000-000000000002',
    label: 'Pacote SEM guarnições + guarnição como adicional',
    wantPackageWithGarnish: false,
    addGarnishAsAdditional: true,
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
}

function roundMoney(n) {
  return Math.round(Number(n) * 100) / 100
}

function money(n) {
  return `$${Number(n).toFixed(2)}`
}

async function resolveCatalog(client) {
  const { data: packages, error: pkgErr } = await client
    .from('packages')
    .select('id, package_key, label_pt, price_per_person, active')
    .eq('company_id', SHARED.companyId)
    .eq('active', true)
  if (pkgErr) throw new Error(`packages: ${pkgErr.message}`)

  const ranked = (packages ?? [])
    .slice()
    .sort((a, b) => Number(b.price_per_person ?? 0) - Number(a.price_per_person ?? 0))

  // Preferir pacotes CDL reais (foto/descrição): Prime → Choice → Select → Tradicional.
  const PREFERRED_WITH = ['BBQPRI+', 'BBQCHO+', 'BBQSEL+', 'BBQTRAD+']
  const PREFERRED_WITHOUT = ['BBQPRI', 'BBQCHO', 'BBQSEL', 'BBQTRAD']
  const byKey = new Map(
    ranked.map((p) => [String(p.package_key ?? '').trim().toUpperCase(), p]),
  )
  const withG =
    PREFERRED_WITH.map((k) => byKey.get(k)).find(
      (p) => p && Number(p.price_per_person ?? 0) > 0,
    ) ||
    ranked.find(
      (p) =>
        String(p.package_key ?? '').trim().endsWith('+') &&
        Number(p.price_per_person ?? 0) > 0,
    ) ||
    ranked.find((p) => String(p.package_key ?? '').trim().endsWith('+'))
  const withoutG =
    PREFERRED_WITHOUT.map((k) => byKey.get(k)).find(
      (p) => p && Number(p.price_per_person ?? 0) > 0,
    ) ||
    ranked.find(
      (p) =>
        !String(p.package_key ?? '').trim().endsWith('+') &&
        Number(p.price_per_person ?? 0) > 0,
    ) ||
    ranked.find((p) => !String(p.package_key ?? '').trim().endsWith('+'))
  if (!withG || !withoutG) {
    throw new Error(
      'Não encontrei pacotes CDL reais com/sem guarnição (BBQPRI / BBQPRI+…). Rode sync de packages no DEV.',
    )
  }

  async function loadSides(select) {
    return client
      .from('catalog_items')
      .select(select)
      .eq('company_id', SHARED.companyId)
      .eq('active', true)
      .eq('item_type', 'SIDE')
      .limit(20)
  }

  let { data: sides, error: sideErr } = await loadSides(
    'id, item_key, label_pt, price, sale_price, item_type, can_be_additional, active',
  )
  if (sideErr) {
    ;({ data: sides, error: sideErr } = await loadSides(
      'id, item_key, label_pt, price, item_type, active',
    ))
  }
  if (sideErr) throw new Error(`catalog_items: ${sideErr.message}`)

  const normalized = (sides ?? []).map((s) => ({
    ...s,
    unit_price: Number(s.sale_price ?? s.price ?? 0),
  }))
  const usable = normalized.filter(
    (s) => s.can_be_additional !== false && Number(s.unit_price ?? 0) > 0,
  )
  return { withG, withoutG, sides: usable.length ? usable : normalized }
}

function buildRow(c, pkg, sideItems) {
  const ppp = Number(pkg.price_per_person ?? 0)
  const packageTotal = roundMoney(SHARED.adults * ppp)
  const garnishLines = []
  let additionalTotal = 0
  if (c.addGarnishAsAdditional && sideItems.length) {
    // 2 guarnições à la carte (qty 30 pessoas se preço unitário for típico; usa qty=1 se unitário alto)
    const pick = sideItems.slice(0, 2)
    for (const side of pick) {
      const unit = Number(side.unit_price ?? 0)
      const perPersonLike = unit > 0 && unit <= 25
      const qty = perPersonLike ? SHARED.adults : 1
      const lineTotal = roundMoney(unit * qty)
      additionalTotal = roundMoney(additionalTotal + lineTotal)
      garnishLines.push({
        itemId: side.id,
        code: side.item_key,
        label: side.label_pt || side.item_key,
        quantity: qty,
        unitPrice: unit,
        lineTotal,
      })
    }
  }

  const base = roundMoney(packageTotal + additionalTotal)
  const commercial = applyCommercialMinimums(base, SHARED.eventDate, RULES)
  const reservationAmount = roundMoney(
    (commercial.quoteTotal * SHARED.reservationPercentage) / 100,
  )
  const balanceDue = roundMoney(commercial.quoteTotal - reservationAmount)

  return {
    ...c,
    packageId: pkg.id,
    packageKey: pkg.package_key,
    packageLabel: pkg.label_pt,
    packagePricePerPerson: ppp,
    packageTotal,
    additionalTotal,
    garnishLines,
    ...commercial,
    reservationAmount,
    balanceDue,
  }
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
      `  PLAN quote ${row.quote_number} pkg=${row.package_id} add=${row.additional_total} total=${row.quote_total}`,
    )
    return
  }
  const { error } = await client.from('quotes').upsert(row, { onConflict: 'id' })
  if (error) throw new Error(`quotes ${row.quote_number}: ${error.message}`)
  console.log(
    `  OK quote ${row.quote_number} add=${row.additional_total} total=${row.quote_total}`,
  )
}

async function syncAdditionals(client, quoteId, companyId, lines, dry) {
  if (dry) {
    for (const line of lines) {
      console.log(`  PLAN additional ${line.code} qty=${line.quantity} $${line.lineTotal}`)
    }
    return
  }
  await client.from('quote_additional_items').delete().eq('quote_id', quoteId)
  for (const line of lines) {
    const attempts = [
      {
        quote_id: quoteId,
        company_id: companyId,
        additional_item_id: line.itemId,
        quantity: line.quantity,
        unit_price: line.unitPrice,
        total_price: line.lineTotal,
        selected: true,
      },
      {
        quote_id: quoteId,
        company_id: companyId,
        additional_item_id: line.itemId,
        quantity: line.quantity,
        unit_price: line.unitPrice,
        total_price: line.lineTotal,
      },
    ]
    let ok = false
    let last = null
    for (const payload of attempts) {
      const { error } = await client.from('quote_additional_items').insert(payload)
      if (!error) {
        ok = true
        break
      }
      last = error.message
    }
    if (!ok) throw new Error(`quote_additional_items ${line.code}: ${last}`)
    console.log(`  OK additional ${line.code} = ${money(line.lineTotal)}`)
  }
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
        event_name: `TEST GAR — ${r.label}`,
        event_date: SHARED.eventDate,
        start_time: SHARED.startTime,
        end_time: SHARED.endTime,
        address_line: `TESTE DEV — ${r.label}`,
        city: SHARED.city,
        state: SHARED.state,
        postal_code: SHARED.postalCode,
        country: SHARED.country,
        adults_count: SHARED.adults,
        children_count: 0,
        billable_guests: SHARED.adults,
        total_guests: SHARED.adults,
        active: true,
        notes: `fixture garnish-share key=${r.key} pkg=${r.packageKey}`,
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
        package_id: r.packageId,
        quote_number: r.quoteNumber,
        language: 'pt',
        quote_status: 'draft',
        source: 'garnish-share-quotes-v1',
        active: true,
        adult_count: SHARED.adults,
        children_under_3_count: 0,
        children_4_to_12_count: 0,
        physical_guest_count: SHARED.adults,
        billable_guest_count: SHARED.adults,
        package_price_per_person: r.packagePricePerPerson,
        package_total: r.packageTotal,
        additional_total: r.additionalTotal,
        grill_rental_total: 0,
        discount_amount: 0,
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

    await syncAdditionals(
      client,
      r.quoteId,
      SHARED.companyId,
      r.garnishLines,
      dry,
    )
  }
}

async function verify(client, rows) {
  console.log('\n=== VERIFY ===\n')
  let fail = 0
  for (const r of rows) {
    const { data: quote } = await client
      .from('quotes')
      .select('quote_number, package_id, additional_total, quote_total')
      .eq('id', r.quoteId)
      .maybeSingle()
    const { count } = await client
      .from('quote_additional_items')
      .select('id', { count: 'exact', head: true })
      .eq('quote_id', r.quoteId)
    const addCount = count ?? 0
    const expectAdd = r.garnishLines.length
    const ok =
      quote &&
      Number(quote.additional_total) === r.additionalTotal &&
      Number(quote.quote_total) === r.quoteTotal &&
      addCount === expectAdd
    if (!ok) {
      fail += 1
      console.log(
        `FAIL  ${r.quoteNumber} addTotal=${quote?.additional_total} lines=${addCount} expectedLines=${expectAdd}`,
      )
    } else {
      console.log(
        `PASS  ${r.quoteNumber} pkg=${r.packageKey} add=${money(r.additionalTotal)} lines=${addCount} total=${money(r.quoteTotal)}`,
      )
    }
  }
  return fail
}

async function main() {
  console.log('fixture=garnish-share-quotes-v1')
  console.log(`mode=${mode}`)

  if (mode === 'dry-run') {
    console.log('\nDry-run precisa do DEV para resolver pacotes/itens. Use --apply.\n')
    for (const c of CASES) {
      console.log(`- ${c.quoteNumber}: ${c.label}`)
    }
    return
  }

  const { url, service } = loadEnv()
  assertDev(url)
  const client = createClient(url, service)
  const { withG, withoutG, sides } = await resolveCatalog(client)
  console.log(
    `packages: with=${withG.package_key} (${money(withG.price_per_person)}/pp) · without=${withoutG.package_key} (${money(withoutG.price_per_person)}/pp)`,
  )
  console.log(`side items disponíveis: ${sides.length}`)

  const rows = CASES.map((c) =>
    buildRow(c, c.wantPackageWithGarnish ? withG : withoutG, sides),
  )
  for (const r of rows) {
    console.log(
      `${r.quoteNumber}: ${r.packageKey} pkg=${money(r.packageTotal)} add=${money(r.additionalTotal)} total=${money(r.quoteTotal)}`,
    )
    for (const g of r.garnishLines) {
      console.log(`   + ${g.label} × ${g.quantity} = ${money(g.lineTotal)}`)
    }
  }

  if (mode === 'verify') {
    process.exit((await verify(client, rows)) === 0 ? 0 : 1)
  }

  await apply(client, rows, false)
  const fail = await verify(client, rows)
  mkdirSync(REPORT_DIR, { recursive: true })
  const out = join(
    REPORT_DIR,
    `garnish-share-${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
  )
  writeFileSync(out, JSON.stringify({ rows, fail }, null, 2))
  console.log(`\nRelatório: ${out}`)
  process.exit(fail === 0 ? 0 : 1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
