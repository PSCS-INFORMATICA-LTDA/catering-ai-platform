/**
 * Base de teste — pedido de guarnição ao fornecedor (WhatsApp / OS)
 *
 * Cria:
 *   - 2 fornecedores (customers.is_supplier)
 *   - 2 OSs: pacote COM guarnição (BBQPRI+) e SEM + sides como adicional
 *   - Cotação aceita + quote_version + agenda_event (Equipe Caio)
 *
 * Uso:
 *   node scripts/dev/seed-supplier-garnish-order.mjs
 *   node scripts/dev/seed-supplier-garnish-order.mjs --apply
 *   node scripts/dev/seed-supplier-garnish-order.mjs --verify
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
const FIXTURE = JSON.parse(
  readFileSync(join(__dirname, 'fixtures/supplier-garnish-order-v1.json'), 'utf8'),
)
const DEV_REF = 'yasprgtlqclwsjcshtls'
const PROD_REF = 'eapwtirhevxrqinytans'

const RULES = {
  minOrderWeekday: 800,
  minOrderWeekend: 1000,
  minOrderDecJan: 900,
  holidaySurchargePercent: 100,
  holidayMinOrder: 2000,
}

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

async function resolvePackages(client, companyId) {
  const { data: packages, error } = await client
    .from('packages')
    .select('id, package_key, label_pt, price_per_person, active')
    .eq('company_id', companyId)
    .eq('active', true)
  if (error) throw new Error(`packages: ${error.message}`)

  const byKey = new Map(
    (packages ?? []).map((p) => [
      String(p.package_key ?? '').trim().toUpperCase(),
      p,
    ]),
  )
  const withG =
    byKey.get('BBQPRI+') ||
    (packages ?? []).find((p) =>
      String(p.package_key ?? '').trim().endsWith('+'),
    )
  const withoutG =
    byKey.get('BBQPRI') ||
    (packages ?? []).find(
      (p) => !String(p.package_key ?? '').trim().endsWith('+'),
    )
  if (!withG || !withoutG) {
    throw new Error(
      'Pacotes BBQPRI / BBQPRI+ ausentes. Rode sync:dev:packages no DEV.',
    )
  }
  return { withG, withoutG }
}

async function resolveSideItems(client, companyId) {
  const { data, error } = await client
    .from('catalog_items')
    .select('id, item_key, label_pt, item_type, price, sale_price, active')
    .eq('company_id', companyId)
    .eq('active', true)
    .eq('item_type', 'SIDE')
    .limit(20)
  if (error) throw new Error(`catalog_items SIDE: ${error.message}`)
  return (data ?? []).map((s) => ({
    ...s,
    unit_price: Number(s.sale_price ?? s.price ?? 0),
  }))
}

async function ensureTeam(client, companyId, teamId, teamName, dry) {
  const { data: existing } = await client
    .from('operational_teams')
    .select('id, name')
    .eq('id', teamId)
    .maybeSingle()
  if (existing) return existing

  const { data: byName } = await client
    .from('operational_teams')
    .select('id, name')
    .eq('company_id', companyId)
    .ilike('name', '%Caio%')
    .limit(1)
    .maybeSingle()
  if (byName) return byName

  if (dry) {
    console.log(`  PLAN team ${teamName} (${teamId})`)
    return { id: teamId, name: teamName }
  }

  const { data, error } = await client
    .from('operational_teams')
    .upsert(
      {
        id: teamId,
        company_id: companyId,
        name: teamName,
        color: '#16a34a',
        notes: 'Líder: Caio | fixture supplier-garnish-order-v1',
        active: true,
      },
      { onConflict: 'id' },
    )
    .select('id, name')
    .maybeSingle()
  if (error) throw new Error(`operational_teams: ${error.message}`)
  return data
}

async function upsertSupplier(client, companyId, s, dry) {
  const row = {
    id: s.id,
    company_id: companyId,
    ab_name: s.ab_name,
    full_name: s.full_name,
    phone: s.phone,
    email: s.email,
    city: s.city,
    state: s.state,
    country: 'US',
    preferred_language: 'pt',
    is_customer: false,
    is_supplier: true,
    is_team: false,
    address_book_role: 'supplier',
    active: true,
    notes: 'fixture supplier-garnish-order-v1',
  }
  if (dry) {
    console.log(`  PLAN supplier ${s.ab_name} ${s.phone}`)
    return
  }
  const { error } = await client.from('customers').upsert(row, { onConflict: 'id' })
  if (error) throw new Error(`customers supplier ${s.id}: ${error.message}`)
  console.log(`  OK supplier ${s.ab_name}`)
}

function buildCommercial(c, pkg, sideItems) {
  const ppp = Number(pkg.price_per_person ?? 0)
  const packageTotal = roundMoney(c.adults * ppp)
  const additionalItems = []
  let additionalTotal = 0

  if (!c.wantPackageWithGarnish && sideItems.length) {
    const take = Math.max(1, Number(c.additionalSideCount ?? 2))
    for (const side of sideItems.slice(0, take)) {
      const unit = Number(side.unit_price ?? 0)
      if (unit <= 0) continue
      const qty = unit <= 25 ? c.adults : 1
      const lineTotal = roundMoney(unit * qty)
      additionalTotal = roundMoney(additionalTotal + lineTotal)
      additionalItems.push({
        additional_item_id: side.id,
        quantity: qty,
        unit_price: unit,
        total_price: lineTotal,
        label_pt: side.label_pt,
        item_key: side.item_key,
      })
    }
  }

  const base = roundMoney(packageTotal + additionalTotal)
  const commercial = applyCommercialMinimums(base, c.eventDate, RULES)
  const reservationAmount = roundMoney((commercial.quoteTotal * 30) / 100)
  const balanceDue = roundMoney(commercial.quoteTotal - reservationAmount)

  return {
    packageTotal,
    additionalTotal,
    additionalItems,
    reservationAmount,
    balanceDue,
    ...commercial,
  }
}

async function applyCase(client, companyId, team, c, pkg, dry) {
  const snapshot = {
    schema_version: 1,
    currency_code: 'USD',
    package: {
      id: pkg.id,
      key: pkg.package_key,
      label: pkg.label_pt,
      total: c.packageTotal,
    },
    guest_counts: {
      adult_count: c.adults,
      physical_guest_count: c.adults,
      billable_guest_count: c.adults,
    },
    additional_items: c.additionalItems.map((a) => ({
      additional_item_id: a.additional_item_id,
      quantity: a.quantity,
      unit_price: a.unit_price,
      total_price: a.total_price,
    })),
    additional_total: c.additionalTotal,
    quote_total: c.quoteTotal,
    event: {
      event_date: c.eventDate,
      start_time: c.startTime,
      end_time: c.endTime,
      address_line: `TESTE DEV — ${c.label}`,
      city: 'Orlando',
      state: 'FL',
      postal_code: '32801',
    },
  }

  if (dry) {
    console.log(
      `  PLAN ${c.serviceOrderNumber} pkg=${pkg.package_key} total=${money(c.quoteTotal)} sides=${c.additionalItems.length}`,
    )
    return
  }

  // Cliente do evento (não é fornecedor)
  const { error: custErr } = await client.from('customers').upsert(
    {
      id: c.customerId,
      company_id: companyId,
      ab_name: `TEST DEV — Cliente ${c.key}`,
      full_name: `Cliente OS Guarnição ${c.key}`,
      phone: '+14075551999',
      email: `${c.key}@example.com`,
      city: 'Orlando',
      state: 'FL',
      country: 'US',
      is_customer: true,
      is_supplier: false,
      is_team: false,
      active: true,
      notes: 'fixture supplier-garnish-order-v1',
    },
    { onConflict: 'id' },
  )
  if (custErr) throw new Error(`customer ${c.key}: ${custErr.message}`)

  const { error: evErr } = await client.from('events').upsert(
    {
      id: c.eventId,
      company_id: companyId,
      customer_id: c.customerId,
      event_name: `TEST SUP-GAR — ${c.label}`,
      event_date: c.eventDate,
      start_time: c.startTime,
      end_time: c.endTime,
      address_line: `TESTE DEV — ${c.label}`,
      city: 'Orlando',
      state: 'FL',
      postal_code: '32801',
      country: 'US',
      adults_count: c.adults,
      children_count: 0,
      billable_guests: c.adults,
      total_guests: c.adults,
      active: true,
      notes: `fixture supplier-garnish-order-v1 key=${c.key}`,
    },
    { onConflict: 'id' },
  )
  if (evErr) throw new Error(`events ${c.key}: ${evErr.message}`)

  // Quebra FKs circulares antes de recriar versão/OS
  await client
    .from('quotes')
    .update({ accepted_version_id: null, converted_service_order_id: null })
    .eq('id', c.quoteId)
  await client.from('agenda_events').delete().eq('id', c.agendaEventId)
  await client.from('service_order_items').delete().eq('service_order_id', c.serviceOrderId)
  await client.from('service_orders').delete().eq('id', c.serviceOrderId)
  await client.from('quote_versions').delete().eq('id', c.quoteVersionId)

  const { error: qErr } = await client.from('quotes').upsert(
    {
      id: c.quoteId,
      company_id: companyId,
      customer_id: c.customerId,
      event_id: c.eventId,
      package_id: pkg.id,
      quote_number: c.quoteNumber,
      language: 'pt',
      quote_status: 'accepted',
      proposal_response: 'accepted',
      source: 'supplier-garnish-order-v1',
      active: true,
      adult_count: c.adults,
      children_under_3_count: 0,
      children_4_to_12_count: 0,
      physical_guest_count: c.adults,
      billable_guest_count: c.adults,
      package_price_per_person: Number(pkg.price_per_person ?? 0),
      package_total: c.packageTotal,
      additional_total: c.additionalTotal,
      grill_rental_total: 0,
      discount_amount: 0,
      mileage_fee: 0,
      reservation_percentage: 30,
      reservation_amount: c.reservationAmount,
      balance_due: c.balanceDue,
      quote_total: c.quoteTotal,
      minimum_order_amount: c.minimumOrderAmount,
      minimum_order_applied: c.minimumOrderApplied,
      holiday_surcharge_amount: c.holidaySurchargeAmount,
      reservation_confirmed_at: new Date().toISOString(),
      currency_code: 'USD',
      converted_service_order_id: null,
      accepted_version_id: null,
    },
    { onConflict: 'id' },
  )
  if (qErr) throw new Error(`quotes ${c.key}: ${qErr.message}`)

  const { error: verErr } = await client.from('quote_versions').insert({
    id: c.quoteVersionId,
    company_id: companyId,
    quote_id: c.quoteId,
    version_number: 1,
    language: 'pt',
    currency_code: 'USD',
    quote_total: c.quoteTotal,
    commercial_snapshot: snapshot,
    schema_version: 1,
    is_current: true,
    accepted_at: new Date().toISOString(),
  })
  if (verErr) throw new Error(`quote_versions ${c.key}: ${verErr.message}`)

  const { error: verLinkErr } = await client
    .from('quotes')
    .update({ accepted_version_id: c.quoteVersionId })
    .eq('id', c.quoteId)
  if (verLinkErr) {
    throw new Error(`quotes.accepted_version_id ${c.key}: ${verLinkErr.message}`)
  }

  const { error: osErr } = await client.from('service_orders').insert({
    id: c.serviceOrderId,
    company_id: companyId,
    service_order_number: c.serviceOrderNumber,
    quote_id: c.quoteId,
    quote_version_id: c.quoteVersionId,
    event_id: c.eventId,
    customer_id: c.customerId,
    status: 'planned',
    event_date: c.eventDate,
    start_time: c.startTime,
    end_time: c.endTime,
    address_line: `TESTE DEV — ${c.label}`,
    city: 'Orlando',
    state: 'FL',
    postal_code: '32801',
    physical_guest_count: c.adults,
    billable_guest_count: c.adults,
    currency_code: 'USD',
    package_total: c.packageTotal,
    additional_total: c.additionalTotal,
    mileage_fee: 0,
    discount_amount: 0,
    reservation_amount: c.reservationAmount,
    balance_due: c.balanceDue,
    service_order_total: c.quoteTotal,
    commercial_snapshot: snapshot,
    notes: `fixture supplier-garnish-order-v1 key=${c.key}`,
  })
  if (osErr) throw new Error(`service_orders ${c.key}: ${osErr.message}`)

  const { error: osLinkErr } = await client
    .from('quotes')
    .update({ converted_service_order_id: c.serviceOrderId })
    .eq('id', c.quoteId)
  if (osLinkErr) {
    throw new Error(`quotes.converted_service_order_id ${c.key}: ${osLinkErr.message}`)
  }

  const itemRows = [
    {
      company_id: companyId,
      service_order_id: c.serviceOrderId,
      item_type: 'package',
      item_key: pkg.id,
      label_pt: pkg.label_pt || 'Pacote',
      total_price: c.packageTotal,
      display_order: 0,
    },
    ...c.additionalItems.map((a, index) => ({
      company_id: companyId,
      service_order_id: c.serviceOrderId,
      item_type: 'additional',
      item_key: a.additional_item_id,
      label_pt: a.label_pt || 'Adicional',
      quantity: a.quantity,
      unit_price: a.unit_price,
      total_price: a.total_price,
      display_order: index + 1,
    })),
  ]
  const { error: itemsErr } = await client
    .from('service_order_items')
    .insert(itemRows)
  if (itemsErr) throw new Error(`service_order_items ${c.key}: ${itemsErr.message}`)

  // Espelha adicionais na cotação (mensagem financeira / WhatsApp cliente)
  await client.from('quote_additional_items').delete().eq('quote_id', c.quoteId)
  if (c.additionalItems.length > 0) {
    const quoteAddRows = c.additionalItems.map((a) => ({
      quote_id: c.quoteId,
      company_id: companyId,
      additional_item_id: a.additional_item_id,
      quantity: a.quantity,
      unit_price: a.unit_price,
      total_price: a.total_price,
      selected: true,
    }))
    let { error: qaErr } = await client
      .from('quote_additional_items')
      .insert(quoteAddRows)
    if (qaErr) {
      const slim = quoteAddRows.map(
        ({ company_id: _cid, selected: _sel, ...rest }) => rest,
      )
      ;({ error: qaErr } = await client
        .from('quote_additional_items')
        .insert(slim))
    }
    if (qaErr) {
      throw new Error(`quote_additional_items ${c.key}: ${qaErr.message}`)
    }
  }

  const { error: agErr } = await client.from('agenda_events').upsert(
    {
      id: c.agendaEventId,
      company_id: companyId,
      team_id: team.id,
      code: `EVT-SUP-${c.key.toUpperCase().replace(/[^A-Z0-9]+/g, '-').slice(0, 24)}`,
      title: `TEST SUP-GAR — ${c.label}`,
      client_name: `Cliente OS Guarnição ${c.key}`,
      event_date: c.eventDate,
      start_time: c.startTime,
      end_time: c.endTime,
      status: 'scheduled',
      quote_id: c.quoteId,
      service_order_id: c.serviceOrderId,
      notes: 'fixture supplier-garnish-order-v1',
    },
    { onConflict: 'id' },
  )
  if (agErr) throw new Error(`agenda_events ${c.key}: ${agErr.message}`)

  console.log(
    `  OK ${c.serviceOrderNumber} → /orders/${c.serviceOrderId} pkg=${pkg.package_key} total=${money(c.quoteTotal)}`,
  )
}

async function verify(client, companyId, rows) {
  console.log('\n=== VERIFY ===\n')
  let fail = 0

  for (const s of FIXTURE.suppliers) {
    const { data } = await client
      .from('customers')
      .select('id, is_supplier, phone, active')
      .eq('id', s.id)
      .maybeSingle()
    const ok = data?.is_supplier && data?.active && data?.phone
    console.log(
      ok
        ? `PASS  supplier ${s.ab_name}`
        : `FAIL  supplier ${s.ab_name}`,
    )
    if (!ok) fail += 1
  }

  for (const r of rows) {
    const { data: os } = await client
      .from('service_orders')
      .select('id, service_order_number, commercial_snapshot, billable_guest_count')
      .eq('id', r.serviceOrderId)
      .maybeSingle()
    const { data: agenda } = await client
      .from('agenda_events')
      .select('id, team_id, service_order_id')
      .eq('id', r.agendaEventId)
      .maybeSingle()
    const pkgId = os?.commercial_snapshot?.package?.id
    const ok =
      os &&
      os.service_order_number === r.serviceOrderNumber &&
      pkgId &&
      agenda?.team_id &&
      agenda?.service_order_id === r.serviceOrderId
    console.log(
      ok
        ? `PASS  ${r.serviceOrderNumber} pkgId=${pkgId} team=${agenda.team_id}`
        : `FAIL  ${r.serviceOrderNumber}`,
    )
    if (!ok) fail += 1
  }

  const { count } = await client
    .from('customers')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .eq('is_supplier', true)
    .eq('active', true)
  console.log(`\nFornecedores ativos na empresa: ${count ?? 0}`)
  return fail
}

async function main() {
  console.log(`fixture=${FIXTURE.fixture}`)
  console.log(`mode=${mode}`)

  const { url, service } = loadEnv()
  assertDev(url)
  const client = createClient(url, service)
  const companyId = FIXTURE.companyId

  const dry = mode === 'dry-run'
  const { withG, withoutG } = await resolvePackages(client, companyId)
  const sides = await resolveSideItems(client, companyId)
  const team = await ensureTeam(
    client,
    companyId,
    FIXTURE.teamId,
    FIXTURE.teamName,
    dry || mode === 'verify',
  )

  console.log(
    `packages: with=${withG.package_key} · without=${withoutG.package_key}`,
  )
  console.log(`side items: ${sides.length} · team=${team.name} (${team.id})`)

  if (mode === 'dry-run') {
    console.log('\n=== DRY-RUN ===\n')
  } else if (mode === 'apply') {
    console.log('\n=== APPLY — gravando no DEV ===\n')
  }

  console.log('Fornecedores:')
  for (const s of FIXTURE.suppliers) {
    await upsertSupplier(client, companyId, s, dry || mode === 'verify')
  }

  const rows = []
  for (const c of FIXTURE.cases) {
    const pkg = c.wantPackageWithGarnish ? withG : withoutG
    const built = buildCommercial(c, pkg, sides)
    const row = { ...c, ...built, packageKey: pkg.package_key, packageId: pkg.id }
    rows.push(row)
    if (mode !== 'verify') {
      await applyCase(client, companyId, team, row, pkg, dry)
    }
  }

  if (mode === 'verify' || mode === 'apply') {
    const fail = await verify(client, companyId, rows)
    mkdirSync(REPORT_DIR, { recursive: true })
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    const outPath = join(REPORT_DIR, `supplier-garnish-${stamp}.json`)
    writeFileSync(
      outPath,
      JSON.stringify(
        {
          fixture: FIXTURE.fixture,
          mode,
          generatedAt: new Date().toISOString(),
          suppliers: FIXTURE.suppliers.map((s) => ({
            id: s.id,
            name: s.ab_name,
            phone: s.phone,
          })),
          orders: rows.map((r) => ({
            key: r.key,
            serviceOrderNumber: r.serviceOrderNumber,
            serviceOrderId: r.serviceOrderId,
            quoteNumber: r.quoteNumber,
            packageKey: r.packageKey,
            quoteTotal: r.quoteTotal,
            path: `/orders/${r.serviceOrderId}`,
          })),
        },
        null,
        2,
      ),
    )
    console.log(`\nRelatório: ${outPath}`)
    if (fail > 0) process.exit(1)
  }

  if (mode === 'dry-run') {
    console.log('\nUse --apply para gravar. Validação UI:')
    for (const r of rows) {
      console.log(`  - ${r.serviceOrderNumber}: /orders/${r.serviceOrderId}`)
    }
    console.log('  - Fornecedores: Clientes → filtro Fornecedor')
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
