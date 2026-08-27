/**
 * Fast quote actions v1 — VER + CONVERTER performance/UX gates.
 *
 *   npm run test:dev:quote-fast-actions
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { assertDevUrl, loadDevEnv } from './loadDevEnv.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const CDL_ID = '65fd576f-8d97-49ba-bf38-61bc1e94e94a'
const ISO_ID = 'a1111111-1111-4111-8111-111111111111'
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8')

const PRICE_FREEZE = [
  {
    id: '4750023f-0947-4f1e-a446-f9675cd44907',
    quote_total: 2460,
    package_total: 1760,
    additional_total: 600,
    mileage_fee: 0,
    grill_rental_total: 100,
    reservation_amount: 738,
    balance_due: 1722,
  },
  {
    id: '87ee4dec-2b07-4c29-a2c3-190a6ad95e06',
    quote_total: 800,
    package_total: 0,
    additional_total: 400,
    mileage_fee: 98.8,
    grill_rental_total: 100,
    reservation_amount: 240,
    balance_due: 560,
  },
  {
    id: '8e9248ee-ac0d-4427-94fb-3489bcf32c13',
    quote_total: 2260,
    package_total: 1760,
    additional_total: 400,
    mileage_fee: 0,
    grill_rental_total: 100,
    reservation_amount: 678,
    balance_due: 1582,
  },
  {
    id: '91f82628-a8e0-41f1-8d7f-6b767175e707',
    quote_total: 2280.6,
    package_total: 1500,
    additional_total: 500,
    mileage_fee: 180.6,
    grill_rental_total: 100,
    reservation_amount: 684.18,
    balance_due: 1596.42,
  },
  {
    id: '42bc0160-0ad0-4cae-bdc2-4bf2a07308eb',
    quote_total: 3607,
    package_total: 3000,
    additional_total: 400,
    mileage_fee: 207,
    grill_rental_total: 0,
    reservation_amount: 1082.1,
    balance_due: 2524.9,
  },
]

let passed = 0
let failed = 0
function test(name, fn) {
  try {
    fn()
    passed += 1
    console.log(`PASS  ${name}`)
  } catch (error) {
    failed += 1
    console.error(`FAIL  ${name}`)
    console.error(`      ${error instanceof Error ? error.message : error}`)
  }
}

const dashboard = read('components/QuotesDashboard.tsx')
const convertPanel = read('components/quotes/QuoteConvertPanel.tsx')
const convertApi = read('app/api/quotes/[id]/convert/route.ts')
const convertLib = read('Lib/orders/convertAcceptedQuoteToServiceOrder.ts')
const detailFetch = read('Lib/fetchQuoteDetail.ts')
const detailPage = read('app/quotes/[id]/page.tsx')
const detailView = read('app/quotes/[id]/QuoteDetailView.tsx')
const toolbar = read('app/quotes/[id]/QuoteDetailToolbar.tsx')
const listPage = read('app/quotes/page.tsx')
const loadingDetail = read('app/quotes/[id]/loading.tsx')
const loadingList = read('app/quotes/loading.tsx')

test('VIEW_OPENS', () => {
  assert.match(dashboard, /href=\{viewHref\}/)
  assert.match(dashboard, /tQuotesOrders\(locale, 'view'\)/)
  assert.match(listPage, /QuotesDashboard/)
})

test('VIEW_NO_FULL_PAGE_RELOAD', () => {
  assert.match(dashboard, /from 'next\/link'/)
  assert.doesNotMatch(dashboard, /location\.href/)
  assert.doesNotMatch(dashboard, /location\.assign/)
  assert.doesNotMatch(dashboard, /router\.refresh/)
})

test('VIEW_AUTHORIZATION', () => {
  assert.match(detailPage, /getAuthSession/)
  assert.match(detailFetch, /company_id/)
  assert.match(listPage, /quotes\.convert/)
})

test('VIEW_TENANT_ISOLATION', () => {
  assert.match(detailFetch, /eq\('company_id', companyId\)/)
  assert.match(convertApi, /resolveAuthorizedCompanyId/)
  assert.match(convertLib, /eq\('company_id', companyId\)/)
})

test('VIEW_SKELETON', () => {
  assert.match(loadingDetail, /data-quote-detail-skeleton/)
  assert.match(loadingList, /data-quotes-list-skeleton/)
})

test('VIEW_PREFETCH_CONTROLLED', () => {
  assert.match(dashboard, /prefetch=\{false\}/)
  assert.match(dashboard, /IDLE_PREFETCH_DELAY_MS = 2000/)
  assert.match(dashboard, /IDLE_PREFETCH_MAX = 2/)
  assert.doesNotMatch(dashboard, /onTouchStart=\{/)
  assert.doesNotMatch(dashboard, /fetchQuoteDetail/)
})

test('VIEW_REDUNDANT_QUERIES_REMOVED', () => {
  assert.match(detailFetch, /QUOTE_TABLE_COLUMNS/)
  assert.match(detailFetch, /loadQuoteTableExtras/)
  assert.match(detailFetch, /from\('quote_detail_view'\)/)
  assert.doesNotMatch(detailFetch, /fetchQuoteLinkedPackageCatalog/)
})

test('CONVERT_SERVER_SIDE', () => {
  assert.match(convertApi, /requireApiPermission\('quotes\.convert'\)/)
  assert.match(convertApi, /convertAcceptedQuoteToServiceOrder/)
  assert.doesNotMatch(dashboard, /from\('service_orders'\)/)
})

test('CONVERT_IMMEDIATE_FEEDBACK', () => {
  assert.match(dashboard, /setConvertingId\(quote\.id\)/)
  assert.match(dashboard, /window\.confirm/)
  assert.match(dashboard, /'converting'/)
  assert.match(convertPanel, /if \(busy\) return/)
  assert.match(convertPanel, /setBusy\(true\)/)
})

test('DOUBLE_TAP_DUPLICATE_CONVERSION = 0', () => {
  assert.match(dashboard, /if \(convertingId\) return/)
  assert.match(dashboard, /disabled=\{Boolean\(convertingId\)\}/)
  assert.match(convertLib, /already_existed: true/)
  assert.match(convertLib, /duplicate key\|unique constraint/)
})

test('CONVERT_EXISTING_RECORD_REUSED', () => {
  assert.match(convertLib, /converted_service_order_id/)
  assert.match(convertLib, /findExistingServiceOrder/)
  assert.match(convertLib, /already_existed: true/)
})

test('CONVERT_NO_LIST_RELOAD', () => {
  assert.doesNotMatch(dashboard, /await refreshQuotes\(filters\)/)
  assert.doesNotMatch(dashboard, /router\.push\(`\/orders/)
  assert.match(dashboard, /quote_status: 'converted'/)
})

test('CONVERT_FAILURE_DOES_NOT_MARK_SUCCESS', () => {
  assert.match(dashboard, /catch \(convertError\)/)
  assert.match(dashboard, /setConvertingId\(null\)/)
  assert.match(dashboard, /setError\(/)
  const successIndex = dashboard.indexOf("quote_status: 'converted'")
  const catchIndex = dashboard.indexOf('catch (convertError)')
  assert.ok(successIndex > -1 && catchIndex > successIndex)
})

test('PDF_ON_CONVERT_CRITICAL_PATH = NO', () => {
  assert.doesNotMatch(convertApi, /pdf/i)
  assert.doesNotMatch(convertLib, /pdf/i)
  assert.doesNotMatch(convertLib, /whatsapp/i)
  assert.doesNotMatch(convertLib, /paypal/i)
})

test('FILTER_STATE_PRESERVED', () => {
  assert.match(dashboard, /cdl-quotes-filters-v1/)
  assert.match(dashboard, /sessionStorage\.setItem\(FILTERS_STORAGE_KEY/)
})

test('SCROLL_BEHAVIOR_ACCEPTABLE', () => {
  assert.match(dashboard, /cdl-quotes-scroll-v1/)
  assert.match(dashboard, /window\.scrollTo/)
})

test('LAZY_NON_CRITICAL_DETAIL', () => {
  assert.match(detailView, /next\/dynamic/)
  assert.match(toolbar, /QuotePdfDownload/)
  assert.match(toolbar, /dynamic/)
})

test('NO_PRICING_OR_PAYMENTS_TOUCHED', () => {
  assert.doesNotMatch(dashboard, /quote_total \+|deposit|mileage_rate/)
  assert.doesNotMatch(detailFetch, /applyCommercialMinimums/)
  assert.doesNotMatch(convertLib, /PAYPAL|zelle/)
})

const env = loadDevEnv(ROOT)
assertDevUrl(env.url)
const sb = createClient(env.url, env.service, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const { data: afterRows, error: afterError } = await sb
  .from('quotes')
  .select(
    'id, quote_total, package_total, additional_total, mileage_fee, grill_rental_total, reservation_amount, balance_due',
  )
  .in(
    'id',
    PRICE_FREEZE.map((row) => row.id),
  )

test('PRICE_FREEZE', () => {
  assert.ifError(afterError)
  for (const before of PRICE_FREEZE) {
    const after = (afterRows ?? []).find((row) => row.id === before.id)
    assert.ok(after, `missing ${before.id}`)
    assert.equal(Number(after.quote_total), before.quote_total)
    assert.equal(Number(after.package_total), before.package_total)
    assert.equal(Number(after.additional_total), before.additional_total)
    assert.equal(Number(after.mileage_fee), before.mileage_fee)
    assert.equal(Number(after.grill_rental_total), before.grill_rental_total)
    assert.equal(Number(after.reservation_amount), before.reservation_amount)
    assert.equal(Number(after.balance_due), before.balance_due)
  }
})

const { data: isoQuote } = await sb
  .from('quotes')
  .select('id, company_id')
  .eq('company_id', ISO_ID)
  .limit(1)
  .maybeSingle()

test('TENANT_ISOLATION_QUERY', () => {
  assert.match(detailFetch, /eq\('company_id', companyId\)/)
  assert.match(convertLib, /eq\('company_id', companyId\)/)
  if (isoQuote) {
    assert.notEqual(isoQuote.company_id, CDL_ID)
  }
})

if (failed > 0) {
  console.error(`\n${failed} failed, ${passed} passed`)
  process.exit(1)
}
console.log(`\n${passed} passed`)
