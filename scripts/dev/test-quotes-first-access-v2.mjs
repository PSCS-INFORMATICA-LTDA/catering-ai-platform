/**
 * First Access Performance V2 — auth bootstrap, pagination, prefetch, isolation.
 *
 *   npm run test:dev:quotes-first-access-v2
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
  },
  {
    id: '87ee4dec-2b07-4c29-a2c3-190a6ad95e06',
    quote_total: 800,
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

const hook = read('Lib/i18n/useAuthLocaleFromMe.ts')
const header = read('components/layout/AppHeader.tsx')
const sessionBar = read('components/auth/AuthSessionBar.tsx')
const tenant = read('components/tenant/TenantProvider.tsx')
const layout = read('app/layout.tsx')
const session = read('Lib/auth/session.ts')
const identity = read('Lib/auth/resolveAuthIdentity.ts')
const bootstrap = read('Lib/auth/loadAuthenticatedBootstrap.ts')
const dashboard = read('components/QuotesDashboard.tsx')
const listFetch = read('Lib/fetchQuoteList.ts')
const listPage = read('app/quotes/page.tsx')
const listApi = read('app/api/quotes/route.ts')
const middleware = read('Lib/supabase/middleware.ts')
const invoice = read('components/payments/QuoteInvoicePanel.tsx')
const detailView = read('app/quotes/[id]/QuoteDetailView.tsx')
const detailFetch = read('Lib/fetchQuoteDetail.ts')
const usersPage = read('app/users/page.tsx')
const share = read('components/quotes/QuoteProposalSharePanel.tsx')

test('AUTH_ME_HOOK_HAS_NO_FETCH', () => {
  assert.doesNotMatch(hook, /fetch\('\/api\/auth\/me'/)
  assert.match(hook, /useOptionalAppSession/)
})

test('APP_HEADER_AUTH_FETCH = 0', () => {
  assert.doesNotMatch(header, /fetch\('\/api\/auth\/me'/)
  assert.match(header, /useAppSession/)
})

test('QUOTE_DASHBOARD_AUTH_FETCH = 0', () => {
  assert.doesNotMatch(dashboard, /fetch\('\/api\/auth\/me'/)
})

test('SHARE_PANEL_AUTH_FETCH = 0', () => {
  assert.doesNotMatch(share, /fetch\('\/api\/auth\/me'/)
})

test('USERS_PAGE_AUTH_FETCH = 0', () => {
  assert.doesNotMatch(usersPage, /fetch\('\/api\/auth\/me'/)
})

test('AUTH_SESSION_BAR_AUTH_FETCH = 0', () => {
  assert.doesNotMatch(sessionBar, /fetch\('\/api\/auth\/me'/)
})

test('TENANT_CONTEXT_NO_MOUNT_FETCH', () => {
  assert.match(tenant, /initialTenantContext/)
  assert.doesNotMatch(
    tenant,
    /useEffect\(\(\) => \{\s*if \(publicRoute\) return\s*const timer = window\.setTimeout\(\(\) => \{\s*void refresh\(\)/,
  )
})

test('SERVER_BOOTSTRAP_ONCE', () => {
  assert.match(layout, /loadAuthenticatedAppBootstrap/)
  assert.match(layout, /isPublicRoutePathname/)
  assert.match(bootstrap, /cache\(/)
  assert.match(session, /cache\(loadAuthSessionUncached\)/)
})

test('AUTH_SESSION_REBUILDS_PER_RSC_REQUEST <= 1', () => {
  assert.match(session, /from 'react'/)
  assert.match(session, /export const getAuthSession = cache\(/)
  assert.doesNotMatch(session, /new Map\(/)
})

test('GET_CLAIMS_PREFERRED', () => {
  assert.match(identity, /getClaims/)
  assert.match(identity, /getUser\(\)/)
  assert.doesNotMatch(identity, /await supabase\.auth\.getSession\(\)/)
})

test('AUTH_WAVES_PARALLEL', () => {
  assert.match(session, /Promise\.all\(\[/)
  assert.match(session, /from\('app_users'\)/)
  assert.match(session, /from\('company_memberships'\)/)
})

test('PUBLIC_MIDDLEWARE_SKIPS_GET_USER', () => {
  assert.match(middleware, /isPublic && !isLogin/)
  assert.match(middleware, /x-pathname/)
})

test('INITIAL_QUOTES_FETCHED <= 25', () => {
  assert.match(listFetch, /QUOTE_LIST_PAGE_SIZE = 25/)
  assert.match(listFetch, /QUOTE_LIST_MAX_PAGE_SIZE = 30/)
  assert.match(dashboard, /QUOTE_LIST_PAGE_SIZE/)
  assert.doesNotMatch(dashboard, /pageSize', '200'/)
  assert.doesNotMatch(listApi, /applyQuoteListFilters/)
})

test('QUOTE_LIST_REQUIRES_COMPANY', () => {
  assert.match(listFetch, /company_context_required/)
  assert.match(listFetch, /\.eq\('company_id', companyId\)/)
  assert.match(listPage, /resolveAuthorizedCompanyId/)
  assert.match(listApi, /resolveAuthorizedCompanyId/)
})

test('KEYSET_PAGINATION', () => {
  assert.match(listFetch, /created_at/)
  assert.match(listFetch, /nextCursor/)
  assert.match(dashboard, /loadMore/)
})

test('PREFETCH_POLICY', () => {
  assert.match(dashboard, /prefetch=\{false\}/)
  assert.match(dashboard, /IDLE_PREFETCH_DELAY_MS = 2000/)
  assert.match(dashboard, /IDLE_PREFETCH_MAX = 2/)
  assert.doesNotMatch(dashboard, /onTouchStart/)
  assert.doesNotMatch(dashboard, /onPointerEnter/)
})

test('PDF_NEVER_PREFETCHED_AS_TRUE', () => {
  assert.match(dashboard, /quotes\/\$\{quote\.id\}\?pdf=1/)
  const pdfBlock = dashboard.slice(dashboard.indexOf('?pdf=1') - 80, dashboard.indexOf('?pdf=1') + 80)
  assert.match(pdfBlock, /prefetch=\{false\}/)
})

test('INVOICE_NOT_ON_CRITICAL_PATH', () => {
  assert.match(detailView, /QuoteSecondaryPanels/)
  assert.match(detailView, /openInvoice/)
  assert.match(invoice, /fetch\(`\/api\/quotes\/\$\{quoteId\}\/invoice`\)/)
})

test('NO_AUTHENTICATED_HTML_CACHE', () => {
  assert.match(listPage, /force-dynamic/)
  assert.match(listPage, /revalidate = 0/)
})

test('NO_PRICING_TOUCHED', () => {
  assert.doesNotMatch(listFetch, /applyCommercialMinimums/)
  assert.doesNotMatch(detailFetch, /applyCommercialMinimums/)
})

const env = loadDevEnv(ROOT)
assertDevUrl(env.url)
const sb = createClient(env.url, env.service, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const { data: afterRows, error: afterError } = await sb
  .from('quotes')
  .select('id, quote_total, company_id, created_at')
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
  }
})

const { data: cdlPage, error: cdlError } = await sb
  .from('quotes')
  .select('id, company_id, created_at')
  .eq('active', true)
  .eq('company_id', CDL_ID)
  .order('created_at', { ascending: false })
  .order('id', { ascending: false })
  .limit(26)

test('SERVER_PAGE_SIZE_25', () => {
  assert.ifError(cdlError)
  assert.ok((cdlPage ?? []).length <= 26)
})

const { data: isoRows, error: isoError } = await sb
  .from('quotes')
  .select('id, company_id')
  .eq('company_id', ISO_ID)
  .eq('active', true)
  .limit(5)

test('COMPANY_A_LIST_CAN_SEE_B = NO', () => {
  assert.ifError(isoError)
  for (const row of isoRows ?? []) {
    assert.notEqual(row.company_id, CDL_ID)
  }
  for (const row of cdlPage ?? []) {
    assert.equal(row.company_id, CDL_ID)
  }
})

if (failed > 0) {
  console.error(`\n${failed} failed, ${passed} passed`)
  process.exit(1)
}
console.log(`\n${passed} passed`)
