/**
 * Prévia das mensagens WhatsApp/SMS/e-mail das cotações de teste DEV.
 *
 * Uso:
 *   node --experimental-strip-types scripts/dev/preview-share-messages.mjs
 *   npm run preview:dev:share-messages
 *
 * Project Ref: yasprgtlqclwsjcshtls (DEV). PROD bloqueado.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath, pathToFileURL } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..', '..')
const REPORT_DIR = join(__dirname, 'reports')
const DEV_REF = 'yasprgtlqclwsjcshtls'
const PROD_REF = 'eapwtirhevxrqinytans'

/** Cotações de teste para validar o espelho do resumo no share. */
const TEST_QUOTES = [
  {
    quoteNumber: 'TEST-DEV-QUOTE-HOL-DEC24-MID',
    focus: 'Feriado 24/dez — acréscimo 100%',
  },
  {
    quoteNumber: 'TEST-DEV-QUOTE-HOL-JUL4-MID',
    focus: 'Feriado 4/jul — acréscimo 100%',
  },
  {
    quoteNumber: 'TEST-DEV-QUOTE-HOL-CTRL-WD',
    focus: 'Controle dia útil (mínimo)',
  },
  {
    quoteNumber: 'TEST-DEV-QUOTE-MI-TAMPA-84',
    focus: 'Milhagem Tampa 84 mi',
  },
  {
    quoteNumber: 'TEST-DEV-QUOTE-MI-KISS-35',
    focus: 'Milhagem Kissimmee 35 mi',
  },
  {
    quoteNumber: 'TEST-DEV-QUOTE-MI-CTRL-20',
    focus: 'Milhagem controle (cortesia)',
  },
  {
    quoteNumber: 'TEST-DEV-QUOTE-GRILL-DISC',
    focus: 'Churrasqueira 1× + desconto $50',
  },
  {
    quoteNumber: 'TEST-DEV-QUOTE-GRILL-2X',
    focus: 'Churrasqueira 2×',
  },
  {
    quoteNumber: 'TEST-DEV-QUOTE-GAR-WITH',
    focus: 'Pacote COM guarnições (regra: não vira adicional)',
  },
  {
    quoteNumber: 'TEST-DEV-QUOTE-GAR-WITHOUT',
    focus: 'Pacote SEM guarnições + guarnição como adicional',
  },
]

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

async function loadBuilder() {
  const modUrl = pathToFileURL(
    join(ROOT, 'Lib', 'whatsappMessageTemplates.ts'),
  ).href
  return import(modUrl)
}

function chargedMiles(distance, free) {
  return Math.max(0, Number(distance ?? 0) - Number(free ?? 20))
}

const SIDES_PRICE_PER_PERSON = 13
const SIDES_ITEMS_PT = [
  'Arroz branco',
  'Feijão preto',
  'Vinagrete',
  'Farofa',
  'Maionese',
]

function isGarnishCatalogItem(item) {
  if (!item) return false
  const type = String(item.item_type ?? '').toUpperCase()
  const cat = String(item.category ?? item.item_group ?? '').toLowerCase()
  const name = String(item.label_pt ?? item.item_key ?? '').toLowerCase()
  return (
    type === 'SIDE' ||
    cat.includes('guarni') ||
    cat.includes('side') ||
    name.includes('arroz') ||
    name.includes('feijão') ||
    name.includes('feijao') ||
    name.includes('vinagrete') ||
    name.includes('farofa') ||
    name.includes('mandioca')
  )
}

async function main() {
  const { url, service } = loadEnv()
  assertDev(url)
  const { buildClientQuoteWhatsAppText } = await loadBuilder()
  const client = createClient(url, service)

  const numbers = TEST_QUOTES.map((q) => q.quoteNumber)
  const { data: quotes, error } = await client
    .from('quotes')
    .select(
      'id, quote_number, package_id, package_total, additional_total, mileage_fee, mileage_distance, mileage_free_limit, grill_rental_total, grill_rental_qty, discount_amount, holiday_surcharge_amount, minimum_order_amount, minimum_order_applied, quote_total, reservation_amount, currency_code, language, adult_count, children_under_3_count, children_4_to_12_count, event_id',
    )
    .in('quote_number', numbers)

  if (error) throw new Error(error.message)

  const byNumber = new Map((quotes ?? []).map((q) => [q.quote_number, q]))
  const quoteIds = (quotes ?? []).map((q) => q.id)
  const packageIds = [
    ...new Set((quotes ?? []).map((q) => q.package_id).filter(Boolean)),
  ]
  const { data: packages } = packageIds.length
    ? await client
        .from('packages')
        .select('id, package_key, label_pt, description_pt, price_per_person')
        .in('id', packageIds)
    : { data: [] }
  const packageById = new Map((packages ?? []).map((p) => [p.id, p]))
  const eventIds = [...new Set((quotes ?? []).map((q) => q.event_id).filter(Boolean))]
  const { data: events } = eventIds.length
    ? await client
        .from('events')
        .select('id, event_date, address_line, city, state, start_time, end_time')
        .in('id', eventIds)
    : { data: [] }
  const eventById = new Map((events ?? []).map((e) => [e.id, e]))

  const { data: additionals } = quoteIds.length
    ? await client
        .from('quote_additional_items')
        .select('quote_id, additional_item_id, total_price, quantity')
        .in('quote_id', quoteIds)
    : { data: [] }
  const catalogIds = [
    ...new Set(
      (additionals ?? [])
        .map((row) => row.additional_item_id)
        .filter(Boolean),
    ),
  ]
  let catalogById = new Map()
  if (catalogIds.length) {
    const { data: catalogRows, error: catalogErr } = await client
      .from('catalog_items')
      .select('id, item_key, label_pt, item_type')
      .in('id', catalogIds)
    if (!catalogErr && catalogRows?.length) {
      catalogById = new Map(catalogRows.map((row) => [row.id, row]))
    }
  }
  const additionalsByQuote = new Map()
  for (const row of additionals ?? []) {
    const list = additionalsByQuote.get(row.quote_id) ?? []
    list.push(row)
    additionalsByQuote.set(row.quote_id, list)
  }

  const previews = []
  console.log('\n=== PRÉVIA MENSAGENS SHARE (WhatsApp = SMS = e-mail) ===\n')

  for (const item of TEST_QUOTES) {
    const q = byNumber.get(item.quoteNumber)
    console.log('─'.repeat(72))
    console.log(`${item.quoteNumber}`)
    console.log(`Foco: ${item.focus}`)
    if (!q) {
      console.log('STATUS: NÃO ENCONTRADA NO DEV\n')
      previews.push({ ...item, status: 'MISSING', message: null })
      continue
    }
    const ev = eventById.get(q.event_id) ?? {}
    const free = Number(q.mileage_free_limit ?? 20)
    const dist = Number(q.mileage_distance ?? 0)
    const charged = chargedMiles(dist, free)
    const grill = Number(q.grill_rental_total ?? 0)
    const holiday = Number(q.holiday_surcharge_amount ?? 0)
    const storedPackageTotal = Number(q.package_total ?? 0)
    const mileageFee = Number(q.mileage_fee ?? 0)
    const discount = Number(q.discount_amount ?? 0)
    const adults = Number(q.adult_count ?? 0)
    const pkg = packageById.get(q.package_id) ?? {}
    const packageKey = String(pkg.package_key ?? '')
    const packageHasGarnish = packageKey.endsWith('+')
    const garnishIncludedTotal = packageHasGarnish
      ? Math.round(adults * SIDES_PRICE_PER_PERSON * 100) / 100
      : 0
    const packageTotal =
      packageHasGarnish && garnishIncludedTotal > 0
        ? Math.round((storedPackageTotal - garnishIncludedTotal) * 100) / 100
        : storedPackageTotal
    const addRows = additionalsByQuote.get(q.id) ?? []
    const additionalLines = addRows
      .filter((row) => Number(row.total_price ?? 0) > 0)
      .map((row) => {
        const catalog = catalogById.get(row.additional_item_id)
        return {
          label: catalog?.label_pt || catalog?.item_key || 'Adicional',
          amount: Number(row.total_price ?? 0),
          isGarnish: isGarnishCatalogItem(catalog),
        }
      })
    const base =
      storedPackageTotal +
      Number(q.additional_total ?? 0) +
      mileageFee +
      grill
    let minAdj = 0
    if (q.minimum_order_applied) {
      minAdj = Math.max(
        0,
        Number(q.quote_total ?? 0) + discount - base - holiday,
      )
    }

    const message = buildClientQuoteWhatsAppText({
      quoteNumber: q.quote_number,
      customerName: 'Cliente Teste',
      eventDate: ev.event_date ?? null,
      startTime: ev.start_time ?? null,
      endTime: ev.end_time ?? null,
      packageLabel: pkg.label_pt || 'Essential',
      quoteTotal: q.quote_total,
      reservationAmount: q.reservation_amount,
      currencyCode: q.currency_code ?? 'USD',
      proposalUrl: `https://preview.local/proposta/TEST-${q.quote_number}`,
      companyName: 'BBQ At Home',
      adultCount: q.adult_count,
      childrenUnder3Count: q.children_under_3_count,
      children4To12Count: q.children_4_to_12_count,
      addressLine: ev.address_line ?? null,
      city: ev.city ?? null,
      state: ev.state ?? null,
      language: q.language ?? 'pt',
      packageTotal,
      packageUnitPrice: Number(pkg.price_per_person ?? 0) || null,
      packageHasGarnish,
      garnishIncludedTotal,
      garnishDescription: packageHasGarnish
        ? SIDES_ITEMS_PT.join(', ')
        : 'Não inclusas',
      packageItemsDescription: (() => {
        const desc = String(pkg.description_pt ?? '')
        const match = desc.match(
          /Itens do pacote:\s*([\s\S]*?)(?:\n\s*Guarnições:|$)/i,
        )
        return match?.[1]?.trim() || null
      })(),
      additionalTotal: q.additional_total,
      additionalLines,
      mileageFee,
      chargedMiles: charged,
      mileageFreeLimit: free,
      grillRentalTotal: grill,
      grillRentalQty: q.grill_rental_qty,
      discountAmount: discount,
      holidaySurchargeAmount: holiday,
      minimumOrderAdjustment: minAdj,
      minimumOrderAmount: q.minimum_order_amount,
      commercialReason:
        holiday > 0
          ? 'cdl_holiday'
          : q.minimum_order_applied
            ? 'weekday'
            : 'none',
    })

    console.log(`ID: ${q.id}`)
    console.log('MENSAGEM:\n')
    console.log(message)
    console.log('')
    previews.push({
      ...item,
      status: 'OK',
      quoteId: q.id,
      quoteTotal: Number(q.quote_total),
      message,
    })
  }

  mkdirSync(REPORT_DIR, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const outPath = join(REPORT_DIR, `share-message-previews-${stamp}.json`)
  writeFileSync(outPath, JSON.stringify({ generatedAt: new Date().toISOString(), previews }, null, 2))
  console.log('─'.repeat(72))
  console.log(`Relatório JSON: ${outPath}`)
  console.log(
    `OK: ${previews.filter((p) => p.status === 'OK').length} · Missing: ${previews.filter((p) => p.status === 'MISSING').length}`,
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
