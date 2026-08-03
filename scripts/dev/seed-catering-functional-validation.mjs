/**
 * Seed idempotente — base funcional Catering DEV
 *
 * Uso:
 *   node scripts/dev/seed-catering-functional-validation.mjs           # --dry-run
 *   node scripts/dev/seed-catering-functional-validation.mjs --dry-run
 *   node scripts/dev/seed-catering-functional-validation.mjs --apply
 *   node scripts/dev/seed-catering-functional-validation.mjs --verify
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
const FIXTURE_PATH = join(
  __dirname,
  'fixtures',
  'catering-functional-validation-v1.json',
)
const DEV_REF = 'yasprgtlqclwsjcshtls'
const PROD_REF = 'eapwtirhevxrqinytans'

const mode = parseMode(process.argv.slice(2))

function parseMode(args) {
  if (args.includes('--apply')) return 'apply'
  if (args.includes('--verify')) return 'verify'
  return 'dry-run'
}

function loadEnv() {
  const env = readFileSync(join(ROOT, '.env.local'), 'utf8')
  const get = (k) => {
    const m = env.match(new RegExp(`^${k}=(.*)$`, 'm'))
    return m ? m[1].trim() : ''
  }
  return {
    url: get('NEXT_PUBLIC_SUPABASE_URL'),
    anon: get('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
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
    console.error(`BLOQUEADO — Project Ref inesperado: ${ref} (esperado ${DEV_REF})`)
    process.exit(2)
  }
  return ref
}

function roundMoney(n) {
  return Math.round(Number(n) * 100) / 100
}

/** Espelho de Lib/calculateQuoteTotals.ts (sem import TS). */
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
    additionalTotal += line.perPerson
      ? roundMoney(price * billable)
      : roundMoney(price * qty)
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

function eventDatePlusDays(days) {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

async function countEq(client, table, col, val) {
  const { count, error } = await client
    .from(table)
    .select('*', { count: 'exact', head: true })
    .eq(col, val)
  if (error) return { ok: false, count: null, error: error.message }
  return { ok: true, count: count ?? 0 }
}

async function upsert(client, table, row, dry) {
  if (dry) {
    console.log(`  PLAN upsert ${table} id=${row.id}`)
    return row.id
  }
  const { error } = await client.from(table).upsert(row, { onConflict: 'id' })
  if (error) throw new Error(`${table}: ${error.message}`)
  console.log(`  OK upsert ${table} id=${row.id}`)
  return row.id
}

async function upsertPackageItem(client, row, dry) {
  if (dry) {
    console.log(`  PLAN upsert package_items key=${row.item_key}`)
    return
  }
  let { error } = await client.from('package_items').upsert(row, { onConflict: 'id' })
  if (error) {
    const { additional_item_id: _a, ...rest } = row
    ;({ error } = await client.from('package_items').upsert(rest, { onConflict: 'id' }))
  }
  if (error) throw new Error(`package_items: ${error.message}`)
  console.log(`  OK upsert package_items key=${row.item_key}`)
}

async function ensureQuoteAdditionals(client, quoteId, companyId, lines, dry) {
  for (const line of lines) {
    if (dry) {
      console.log(`  PLAN quote_additional item=${line.code} qty=${line.quantity}`)
      continue
    }
    const existing = await client
      .from('quote_additional_items')
      .select('id')
      .eq('quote_id', quoteId)
      .eq('additional_item_id', line.itemId)
      .maybeSingle()
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
      {
        quote_id: quoteId,
        additional_item_id: line.itemId,
        quantity: line.quantity,
        unit_price: line.unitPrice,
      },
    ]
    let lastErr = null
    let done = false
    for (const payload of attempts) {
      if (existing.data?.id) {
        const { error } = await client
          .from('quote_additional_items')
          .update(payload)
          .eq('id', existing.data.id)
        if (!error) {
          done = true
          break
        }
        lastErr = error.message
      } else {
        const { error } = await client.from('quote_additional_items').insert(payload)
        if (!error) {
          done = true
          break
        }
        lastErr = error.message
      }
    }
    if (!done) throw new Error(`quote_additional_items: ${lastErr}`)
    console.log(`  OK quote_additional item=${line.code}`)
  }
}

async function verify(client, fx, totals) {
  const id = fx.ids
  const checks = []
  const add = async (label, promise, min) => {
    const { count, error } = await promise
    const n = error ? -1 : count ?? 0
    const pass = !error && n >= min
    checks.push({ label, n, min, pass, error: error?.message })
    console.log(`VERIFY ${label}: ${error ? 'ERR ' + error.message : n} (min ${min}) ${pass ? 'PASS' : 'FAIL'}`)
  }

  await add(
    'company_main',
    client.from('companies').select('*', { count: 'exact', head: true }).eq('id', id.companyMain),
    1,
  )
  await add(
    'company_iso',
    client.from('companies').select('*', { count: 'exact', head: true }).eq('id', id.companyIso),
    1,
  )
  await add(
    'categories_main',
    client
      .from('package_categories')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', id.companyMain),
    4,
  )
  await add(
    'packages_main',
    client
      .from('packages')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', id.companyMain)
      .like('package_key', 'TEST-DEV-PKG-%'),
    3,
  )
  await add(
    'packages_iso',
    client
      .from('packages')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', id.companyIso),
    1,
  )
  await add(
    'catalog_additionals',
    client
      .from('catalog_items')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', id.companyMain)
      .like('item_key', 'TEST-DEV-ADD-%'),
    4,
  )
  await add(
    'customer_main',
    client.from('customers').select('*', { count: 'exact', head: true }).eq('id', id.customerMain),
    1,
  )
  await add(
    'customer_iso',
    client.from('customers').select('*', { count: 'exact', head: true }).eq('id', id.customerIso),
    1,
  )
  await add(
    'event_main',
    client.from('events').select('*', { count: 'exact', head: true }).eq('id', id.eventMain),
    1,
  )
  await add(
    'quote_main',
    client.from('quotes').select('*', { count: 'exact', head: true }).eq('id', id.quoteMain),
    1,
  )

  // dup check by package_key
  const { data: pkgs } = await client
    .from('packages')
    .select('package_key')
    .eq('company_id', id.companyMain)
    .like('package_key', 'TEST-DEV-PKG-%')
  const keys = (pkgs || []).map((p) => p.package_key)
  const dup = keys.length !== new Set(keys).size
  console.log(`VERIFY package_key_dups: ${dup ? 'FAIL' : 'PASS'}`)

  // membership pending expected when no auth users
  const { data: authData, error: authErr } = await client.auth.admin.listUsers({
    page: 1,
    perPage: 50,
  })
  const authCount = authErr ? -1 : authData?.users?.length ?? 0
  console.log(`VERIFY auth_users_page1: ${authErr ? 'ERR' : authCount}`)
  if (authCount === 0) {
    console.log('PENDENTE — selecionar usuario DEV para membership')
  } else if (authCount === 1) {
    console.log('VERIFY membership_candidate: exatamente 1 usuario Auth (ver apply)')
  } else {
    console.log('PENDENTE — selecionar usuario DEV para membership (multiplos usuarios)')
  }

  if (totals) {
    console.log('VERIFY quote_calc_expected_total=' + totals.quoteTotal)
  }

  const failed = checks.some((c) => !c.pass) || dup
  console.log(failed ? 'VERIFY_RESULT=FAIL' : 'VERIFY_RESULT=PASS')
  return !failed
}

async function main() {
  const fx = JSON.parse(readFileSync(FIXTURE_PATH, 'utf8'))
  const { url, service } = loadEnv()
  if (!url || !service) {
    console.error('BLOQUEADO — .env.local incompleto')
    process.exit(2)
  }
  const ref = assertDev(url)
  if (fx.projectRefRequired !== DEV_REF) {
    console.error('BLOQUEADO — fixture projectRefRequired invalido')
    process.exit(2)
  }

  const dry = mode === 'dry-run'
  const client = createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const id = fx.ids

  const totals = calculateQuoteTotals({
    ...fx.quoteCalc,
    additionals: fx.quoteCalc.additionals,
  })

  console.log('=== CATERING FUNCTIONAL VALIDATION SEED ===')
  console.log(`mode=${mode}`)
  console.log(`project_ref=${ref}`)
  console.log('AMBIENTE: CATERING DEV — CORRETO')
  console.log(`fixture=${fx.fixtureId}`)
  console.log(`company_main=${id.companyMain}`)
  console.log(`company_iso=${id.companyIso}`)
  console.log('currency=USD (schema/app default)')
  console.log('')
  console.log('CALCULO (Lib/calculateQuoteTotals espelhado):')
  console.log(
    `  package=${totals.packageTotal} additionals=${totals.additionalTotal} mileage=${totals.mileageFee}`,
  )
  console.log(
    `  subtotal=${totals.quoteSubtotal} reservation=${totals.reservationAmount} total=${totals.quoteTotal}`,
  )
  console.log('  rounding=Math.round(x*100)/100')
  console.log('')

  if (mode === 'verify') {
    const ok = await verify(client, fx, totals)
    process.exit(ok ? 0 : 1)
  }

  // counts before
  console.log('=== CONTAGENS ANTES ===')
  for (const [label, col, val] of [
    ['companies_main', 'id', id.companyMain],
    ['companies_iso', 'id', id.companyIso],
    ['packages_test_keys', null, null],
  ]) {
    if (label === 'packages_test_keys') {
      const { count } = await client
        .from('packages')
        .select('*', { count: 'exact', head: true })
        .like('package_key', 'TEST-DEV-%')
      console.log(`packages_test_keys=${count ?? 0}`)
    } else {
      const r = await countEq(client, label.startsWith('companies') ? 'companies' : 'packages', col, val)
      console.log(`${label}=${r.count}`)
    }
  }

  console.log('\n=== PLANO DE CARGA ===')
  console.log('tabelas: franchise_groups, companies, branches, package_categories,')
  console.log('         packages, catalog_items, package_items, customers, events, quotes,')
  console.log('         quote_additional_items')
  console.log('idempotencia: upsert por id + chaves TEST-DEV-*')
  console.log('memberships: somente se exatamente 1 auth user')
  console.log('PII PROD: nao')
  if (dry) {
    console.log('\nDRY-RUN: nenhuma escrita sera executada')
  }

  // --- apply / dry plan ---
  await upsert(
    client,
    'franchise_groups',
    {
      id: id.franchiseMain,
      name: 'CDL BBQ Network (DEV Validation)',
      slug: 'cdl-bbq-network-dev-validation',
    },
    dry,
  )

  await upsert(
    client,
    'companies',
    {
      id: id.companyMain,
      franchise_group_id: id.franchiseMain,
      company_name: fx.companyMain.company_name,
      company_code: fx.companyMain.company_code,
      trade_name: fx.companyMain.trade_name,
      slug: fx.companyMain.slug,
      currency_code: 'USD',
      default_currency: 'USD',
      default_language: 'pt',
      timezone: 'America/New_York',
      default_timezone: 'America/New_York',
      subscription_status: 'active',
      active: true,
    },
    dry,
  )

  await upsert(
    client,
    'companies',
    {
      id: id.companyIso,
      company_name: fx.companyIso.company_name,
      company_code: fx.companyIso.company_code,
      trade_name: fx.companyIso.trade_name,
      slug: fx.companyIso.slug,
      currency_code: 'USD',
      default_currency: 'USD',
      default_language: 'pt',
      timezone: 'America/New_York',
      subscription_status: 'active',
      active: true,
    },
    dry,
  )

  await upsert(
    client,
    'branches',
    {
      id: id.branchMain,
      company_id: id.companyMain,
      name: 'Orlando Main DEV Validation',
      slug: 'orlando-main-dev-validation',
      branch_code: 'ORL-DEV-VAL',
      city: 'Orlando',
      state: 'FL',
      country: 'US',
      timezone: 'America/New_York',
      active: true,
    },
    dry,
  )

  const categories = [
    { id: id.catMeats, key: 'meats', pt: 'Carnes', en: 'Meats', es: 'Carnes', order: 1 },
    {
      id: id.catSides,
      key: 'sides',
      pt: 'Acompanhamentos',
      en: 'Side Dishes',
      es: 'Acompanamientos',
      order: 2,
    },
    { id: id.catDrinks, key: 'drinks', pt: 'Bebidas', en: 'Beverages', es: 'Bebidas', order: 3 },
    {
      id: id.catServices,
      key: 'services',
      pt: 'Servicos',
      en: 'Services',
      es: 'Servicios',
      order: 4,
    },
  ]
  // labels ES sem diacriticos problematicos em alguns terminais; app usa label_es text
  for (const cat of categories) {
    await upsert(
      client,
      'package_categories',
      {
        id: cat.id,
        company_id: id.companyMain,
        category_key: cat.key,
        label_pt: cat.pt,
        label_en: cat.en,
        label_es: cat.es,
        display_order: cat.order,
        active: true,
      },
      dry,
    )
  }
  await upsert(
    client,
    'package_categories',
    {
      id: id.catIso,
      company_id: id.companyIso,
      category_key: 'iso-cat',
      label_pt: 'TESTE DEV — Categoria Isolamento',
      label_en: 'DEV TEST — Isolation Category',
      label_es: 'PRUEBA DEV — Categoria Aislamiento',
      display_order: 1,
      active: true,
    },
    dry,
  )

  const packages = [
    {
      id: id.pkgEssential,
      key: 'TEST-DEV-PKG-ESSENTIAL',
      pt: 'TESTE DEV — Churrasco Essencial',
      en: 'DEV TEST — Essential Barbecue',
      es: 'PRUEBA DEV — Barbacoa Esencial',
      price: 45,
      order: 1,
    },
    {
      id: id.pkgPremium,
      key: 'TEST-DEV-PKG-PREMIUM',
      pt: 'TESTE DEV — Churrasco Premium',
      en: 'DEV TEST — Premium Barbecue',
      es: 'PRUEBA DEV — Barbacoa Premium',
      price: 70,
      order: 2,
    },
    {
      id: id.pkgFixed,
      key: 'TEST-DEV-PKG-FIXED',
      pt: 'TESTE DEV — Evento Compacto',
      en: 'DEV TEST — Compact Event',
      es: 'PRUEBA DEV — Evento Compacto',
      // schema sem charge_type fixed no package → price_per_person ilustrativo (19 * 50 ≈ 950)
      price: 19,
      order: 3,
      note: 'Schema packages so tem price_per_person; 19*50≈950 valor alvo compacto',
    },
  ]
  for (const pkg of packages) {
    await upsert(
      client,
      'packages',
      {
        id: pkg.id,
        company_id: id.companyMain,
        package_key: pkg.key,
        package_name: pkg.pt,
        label_pt: pkg.pt,
        label_en: pkg.en,
        label_es: pkg.es,
        description_pt: pkg.note || 'Pacote ficticio DEV Validation',
        description_en: 'Fictional DEV Validation package',
        description_es: 'Paquete ficticio DEV Validation',
        price_per_person: pkg.price,
        currency_code: 'USD',
        display_order: pkg.order,
        active: true,
      },
      dry,
    )
  }
  await upsert(
    client,
    'packages',
    {
      id: id.pkgIso,
      company_id: id.companyIso,
      package_key: 'TEST-DEV-PKG-ISO',
      package_name: 'TESTE DEV — Pacote Isolamento',
      label_pt: 'TESTE DEV — Pacote Isolamento',
      label_en: 'DEV TEST — Isolation Package',
      label_es: 'PRUEBA DEV — Paquete Aislamiento',
      price_per_person: 10,
      currency_code: 'USD',
      display_order: 1,
      active: true,
    },
    dry,
  )

  const catalogCore = [
    {
      id: id.itemBeef,
      key: 'TEST-DEV-ITEM-BEEF',
      name: 'Corte bovino de teste',
      en: 'Test beef cut',
      es: 'Corte vacuno de prueba',
      cat: 'meats',
      catPt: 'Carnes',
      catEn: 'Meats',
      catEs: 'Carnes',
      price: 0,
      charge: 'PERSON',
      pkg: true,
      add: false,
      order: 1,
    },
    {
      id: id.itemChicken,
      key: 'TEST-DEV-ITEM-CHICKEN',
      name: 'Frango grelhado de teste',
      en: 'Test grilled chicken',
      es: 'Pollo a la parrilla de prueba',
      cat: 'meats',
      catPt: 'Carnes',
      catEn: 'Meats',
      catEs: 'Carnes',
      price: 0,
      charge: 'PERSON',
      pkg: true,
      add: false,
      order: 2,
    },
    {
      id: id.itemRice,
      key: 'TEST-DEV-ITEM-RICE',
      name: 'Arroz de teste',
      en: 'Test rice',
      es: 'Arroz de prueba',
      cat: 'sides',
      catPt: 'Acompanhamentos',
      catEn: 'Side Dishes',
      catEs: 'Acompanamientos',
      price: 0,
      charge: 'PERSON',
      pkg: true,
      add: false,
      order: 3,
    },
    {
      id: id.itemSalad,
      key: 'TEST-DEV-ITEM-SALAD',
      name: 'Salada de teste',
      en: 'Test salad',
      es: 'Ensalada de prueba',
      cat: 'sides',
      catPt: 'Acompanhamentos',
      catEn: 'Side Dishes',
      catEs: 'Acompanamientos',
      price: 0,
      charge: 'PERSON',
      pkg: true,
      add: false,
      order: 4,
    },
    {
      id: id.itemBread,
      key: 'TEST-DEV-ITEM-BREAD',
      name: 'Pao de alho de teste',
      en: 'Test garlic bread',
      es: 'Pan de ajo de prueba',
      cat: 'sides',
      catPt: 'Acompanhamentos',
      catEn: 'Side Dishes',
      catEs: 'Acompanamientos',
      price: 0,
      charge: 'PERSON',
      pkg: true,
      add: false,
      order: 5,
    },
    {
      id: id.itemSetup,
      key: 'TEST-DEV-ITEM-SETUP',
      name: 'Servico de montagem de teste',
      en: 'Test setup service',
      es: 'Servicio de montaje de prueba',
      cat: 'services',
      catPt: 'Servicos',
      catEn: 'Services',
      catEs: 'Servicios',
      price: 0,
      charge: 'UNIT',
      pkg: true,
      add: false,
      order: 6,
    },
  ]
  const catalogAdds = [
    {
      id: id.addDessert,
      key: 'TEST-DEV-ADD-DESSERT',
      name: 'TESTE DEV — Sobremesa por pessoa',
      en: 'DEV TEST — Dessert per person',
      es: 'PRUEBA DEV — Postre por persona',
      cat: 'sides',
      catPt: 'Acompanhamentos',
      catEn: 'Side Dishes',
      catEs: 'Acompanamientos',
      price: 6,
      charge: 'PERSON',
      pkg: false,
      add: true,
      order: 10,
    },
    {
      id: id.addTable,
      key: 'TEST-DEV-ADD-TABLE',
      name: 'TESTE DEV — Mesa adicional',
      en: 'DEV TEST — Additional table',
      es: 'PRUEBA DEV — Mesa adicional',
      cat: 'services',
      catPt: 'Servicos',
      catEn: 'Services',
      catEs: 'Servicios',
      price: 35,
      charge: 'UNIT',
      pkg: false,
      add: true,
      order: 11,
    },
    {
      id: id.addTravel,
      key: 'TEST-DEV-ADD-TRAVEL',
      name: 'TESTE DEV — Taxa de deslocamento',
      en: 'DEV TEST — Travel fee',
      es: 'PRUEBA DEV — Tarifa de desplazamiento',
      cat: 'services',
      catPt: 'Servicos',
      catEn: 'Services',
      catEs: 'Servicios',
      price: 90,
      charge: 'UNIT',
      pkg: false,
      add: true,
      order: 12,
    },
    {
      id: id.addStaff,
      key: 'TEST-DEV-ADD-STAFF',
      name: 'TESTE DEV — Profissional adicional',
      en: 'DEV TEST — Additional staff member',
      es: 'PRUEBA DEV — Profesional adicional',
      cat: 'services',
      catPt: 'Servicos',
      catEn: 'Services',
      catEs: 'Servicios',
      price: 120,
      charge: 'UNIT',
      pkg: false,
      add: true,
      order: 13,
    },
  ]

  for (const item of [...catalogCore, ...catalogAdds]) {
    await upsert(
      client,
      'catalog_items',
      {
        id: item.id,
        company_id: id.companyMain,
        item_key: item.key,
        item_name: item.name,
        label_pt: item.name,
        label_en: item.en,
        label_es: item.es,
        category_key: item.cat,
        category_pt: item.catPt,
        category_en: item.catEn,
        category_es: item.catEs,
        price: item.price,
        sale_price: item.price,
        charge_type: item.charge,
        pricing_type: item.charge === 'PERSON' ? 'PER_PERSON' : 'PER_UNIT',
        currency_code: 'USD',
        can_be_package_item: item.pkg,
        can_be_additional: item.add,
        can_be_side_item: item.cat === 'sides',
        item_type: 'PRODUCT',
        active: true,
        display_order: item.order,
        image_status: 'missing',
      },
      dry,
    )
  }
  await upsert(
    client,
    'catalog_items',
    {
      id: id.itemIso,
      company_id: id.companyIso,
      item_key: 'TEST-DEV-ITEM-ISO',
      item_name: 'TESTE DEV — Item Isolamento',
      label_pt: 'TESTE DEV — Item Isolamento',
      label_en: 'DEV TEST — Isolation Item',
      label_es: 'PRUEBA DEV — Item Aislamiento',
      category_key: 'iso-cat',
      category_pt: 'TESTE DEV — Categoria Isolamento',
      category_en: 'DEV TEST — Isolation Category',
      category_es: 'PRUEBA DEV — Categoria Aislamiento',
      price: 1,
      sale_price: 1,
      charge_type: 'UNIT',
      currency_code: 'USD',
      can_be_additional: true,
      active: true,
      display_order: 1,
      image_status: 'missing',
    },
    dry,
  )

  const pi = [
    { id: 'e2000000-0000-4000-8000-000000000001', pkg: id.pkgEssential, item: id.itemBeef, key: 'TEST-DEV-ITEM-BEEF', name: 'Corte bovino de teste', order: 1 },
    { id: 'e2000000-0000-4000-8000-000000000002', pkg: id.pkgEssential, item: id.itemChicken, key: 'TEST-DEV-ITEM-CHICKEN', name: 'Frango grelhado de teste', order: 2 },
    { id: 'e2000000-0000-4000-8000-000000000003', pkg: id.pkgEssential, item: id.itemRice, key: 'TEST-DEV-ITEM-RICE', name: 'Arroz de teste', order: 3 },
    { id: 'e2000000-0000-4000-8000-000000000004', pkg: id.pkgEssential, item: id.itemSalad, key: 'TEST-DEV-ITEM-SALAD', name: 'Salada de teste', order: 4 },
    { id: 'e2000000-0000-4000-8000-000000000005', pkg: id.pkgPremium, item: id.itemBeef, key: 'TEST-DEV-ITEM-BEEF', name: 'Corte bovino de teste', order: 1 },
    { id: 'e2000000-0000-4000-8000-000000000006', pkg: id.pkgPremium, item: id.itemBread, key: 'TEST-DEV-ITEM-BREAD', name: 'Pao de alho de teste', order: 2 },
    { id: 'e2000000-0000-4000-8000-000000000007', pkg: id.pkgPremium, item: id.itemSetup, key: 'TEST-DEV-ITEM-SETUP', name: 'Servico de montagem de teste', order: 3 },
    { id: 'e2000000-0000-4000-8000-000000000008', pkg: id.pkgFixed, item: id.itemChicken, key: 'TEST-DEV-ITEM-CHICKEN', name: 'Frango grelhado de teste', order: 1 },
    { id: 'e2000000-0000-4000-8000-000000000009', pkg: id.pkgFixed, item: id.itemRice, key: 'TEST-DEV-ITEM-RICE', name: 'Arroz de teste', order: 2 },
  ]
  for (const row of pi) {
    await upsertPackageItem(
      client,
      {
        id: row.id,
        company_id: id.companyMain,
        package_id: row.pkg,
        additional_item_id: row.item,
        item_key: row.key,
        item_name: row.name,
        label_pt: row.name,
        label_en: row.name,
        label_es: row.name,
        included: true,
        quantity: 1,
        display_order: row.order,
        active: true,
      },
      dry,
    )
  }

  await upsert(
    client,
    'customers',
    {
      id: id.customerMain,
      company_id: id.companyMain,
      ab_name: 'TESTE FUNCIONAL DEV — Cliente Ficticio',
      full_name: 'TESTE FUNCIONAL DEV — Cliente Ficticio',
      contact_name: 'TESTE FUNCIONAL DEV — Cliente Ficticio',
      phone: '+15550001001',
      phone_normalized: '15550001001',
      email: 'cliente.funcional@catering-test.invalid',
      notes: 'Registro ficticio para validacao. Nao contatar. TEST-DEV-CUSTOMER-001',
      source: 'dev_fixture_v1',
      preferred_language: 'pt',
      address_line: 'TESTE DEV — Endereco ficticio, nao utilizar para entrega',
      city: 'Orlando',
      state: 'FL',
      country: 'US',
      active: true,
    },
    dry,
  )
  await upsert(
    client,
    'customers',
    {
      id: id.customerIso,
      company_id: id.companyIso,
      ab_name: 'TESTE DEV — Cliente Isolamento',
      full_name: 'TESTE DEV — Cliente Isolamento',
      phone: '+15550001998',
      phone_normalized: '15550001998',
      email: 'cliente.isolamento@catering-test.invalid',
      notes: 'Cliente ficticio empresa isolamento',
      source: 'dev_fixture_v1',
      active: true,
    },
    dry,
  )

  const evDate = eventDatePlusDays(30)
  const eventRow = {
    id: id.eventMain,
    company_id: id.companyMain,
    customer_id: id.customerMain,
    event_name: 'TESTE FUNCIONAL DEV — Evento de Validacao',
    event_date: evDate,
    start_time: '12:00',
    end_time: '16:00',
    address_line: 'TESTE DEV — Local ficticio',
    city: 'Orlando',
    state: 'FL',
    postal_code: '32801',
    country: 'US',
    adults_count: 50,
    children_count: 0,
    billable_guests: 50,
    total_guests: 50,
    active: true,
    notes: 'TEST-DEV-EVENT-001 ficticio',
  }
  if (dry) {
    console.log(`  PLAN upsert events id=${id.eventMain} date=${evDate}`)
  } else {
    let { error } = await client.from('events').upsert(eventRow, { onConflict: 'id' })
    if (error) {
      const { company_id: _c, customer_id: _u, ...rest } = eventRow
      ;({ error } = await client.from('events').upsert(rest, { onConflict: 'id' }))
    }
    if (error) throw new Error(`events: ${error.message}`)
    console.log(`  OK upsert events id=${id.eventMain}`)
  }

  const dessertLineTotal = roundMoney(6 * totals.billableGuestCount)
  const quoteRow = {
    id: id.quoteMain,
    company_id: id.companyMain,
    customer_id: id.customerMain,
    event_id: id.eventMain,
    package_id: id.pkgEssential,
    quote_number: 'TEST-DEV-QUOTE-001',
    language: 'pt',
    quote_status: 'draft',
    source: 'dev_fixture_v1',
    active: true,
    physical_guest_count: totals.physicalGuestCount,
    billable_guest_count: totals.billableGuestCount,
    adult_count: 50,
    package_price_per_person: 45,
    package_total: totals.packageTotal,
    additional_total: totals.additionalTotal,
    mileage_fee: totals.mileageFee,
    reservation_percentage: 30,
    reservation_amount: totals.reservationAmount,
    balance_due: totals.balanceDue,
    quote_total: totals.quoteTotal,
    currency_code: 'USD',
  }
  if (dry) {
    console.log(`  PLAN upsert quotes id=${id.quoteMain} total=${totals.quoteTotal}`)
  } else {
    const attempts = [
      quoteRow,
      {
        id: id.quoteMain,
        company_id: id.companyMain,
        customer_id: id.customerMain,
        event_id: id.eventMain,
        package_id: id.pkgEssential,
        quote_number: 'TEST-DEV-QUOTE-001',
        language: 'pt',
        quote_status: 'draft',
        active: true,
        physical_guest_count: 50,
        package_price_per_person: 45,
        package_total: totals.packageTotal,
        quote_total: totals.quoteTotal,
        currency_code: 'USD',
      },
    ]
    let last = null
    let ok = false
    for (const row of attempts) {
      const { error } = await client.from('quotes').upsert(row, { onConflict: 'id' })
      if (!error) {
        ok = true
        console.log(`  OK upsert quotes cols=${Object.keys(row).length}`)
        break
      }
      last = error.message
    }
    if (!ok) throw new Error(`quotes: ${last}`)
  }

  const addLines = [
    {
      code: 'TEST-DEV-ADD-DESSERT',
      itemId: id.addDessert,
      quantity: 1,
      unitPrice: 6,
      lineTotal: dessertLineTotal,
    },
    {
      code: 'TEST-DEV-ADD-TABLE',
      itemId: id.addTable,
      quantity: 2,
      unitPrice: 35,
      lineTotal: 70,
    },
    {
      code: 'TEST-DEV-ADD-TRAVEL',
      itemId: id.addTravel,
      quantity: 1,
      unitPrice: 90,
      lineTotal: 90,
    },
    {
      code: 'TEST-DEV-ADD-STAFF',
      itemId: id.addStaff,
      quantity: 1,
      unitPrice: 120,
      lineTotal: 120,
    },
  ]
  await ensureQuoteAdditionals(client, id.quoteMain, id.companyMain, addLines, dry)

  // membership only if exactly one auth user
  if (!dry) {
    const { data: authData, error: authErr } = await client.auth.admin.listUsers({
      page: 1,
      perPage: 50,
    })
    if (authErr) {
      console.log('MEMBERSHIP: skip (auth.admin erro)')
    } else {
      const users = authData?.users || []
      if (users.length === 1) {
        const uid = users[0].id
        console.log('MEMBERSHIP: exatamente 1 auth user — associando company_main (id omitido)')
        // company_memberships: user_id -> auth.users
        const existing = await client
          .from('company_memberships')
          .select('id')
          .eq('company_id', id.companyMain)
          .eq('user_id', uid)
          .maybeSingle()
        if (!existing.data?.id) {
          const { error } = await client.from('company_memberships').insert({
            company_id: id.companyMain,
            user_id: uid,
            role: 'owner',
            active: true,
          })
          if (error) console.log('MEMBERSHIP WARN: ' + error.message)
          else console.log('MEMBERSHIP: OK')
        } else console.log('MEMBERSHIP: ja existente')
      } else if (users.length === 0) {
        console.log('PENDENTE — selecionar usuario DEV para membership')
      } else {
        console.log('PENDENTE — selecionar usuario DEV para membership (ambiguidade)')
      }
    }
  } else {
    console.log('  PLAN membership: somente se auth_users==1')
  }

  if (dry) {
    console.log('\nDRY_RUN_RESULT=OK (nenhuma escrita)')
    process.exit(0)
  }

  console.log('\n=== VERIFY POS-APPLY ===')
  const ok = await verify(client, fx, totals)
  console.log('\n=== CONTAGENS DEPOIS ===')
  for (const table of [
    'companies',
    'package_categories',
    'packages',
    'catalog_items',
    'package_items',
    'customers',
    'events',
    'quotes',
  ]) {
    const { count } = await client.from(table).select('*', { count: 'exact', head: true })
    console.log(`${table}=${count}`)
  }
  console.log('PROD_ALTERADO=NAO')
  process.exit(ok ? 0 : 1)
}

main().catch((e) => {
  console.error('SEED_FAILED:', e.message || e)
  process.exit(1)
})
