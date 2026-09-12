/**
 * Finance Control Center V2 — source, RBAC, secret-leak, i18n and mobile gates.
 *
 *   npm run test:dev:finance-control-center-v2
 */
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildTranslationRegistry, inspectTranslationRegistry } from '../../Lib/i18n/registry.ts'
import { tFinanceControl, listFinanceControlI18nEntries } from '../../Lib/i18n/financeControl.ts'
import { getChromeNavLabel } from '../../Lib/i18n/chrome.ts'
import { CATERING_NAV, isNavHrefActive } from '../../components/layout/navConfig.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8')

function walk(dir) {
  const out = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) out.push(...walk(full))
    else out.push(full)
  }
  return out
}

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

const financeApiFiles = walk(join(ROOT, 'app/api/finance')).filter((file) => file.endsWith('.ts'))
const v2Lib = [
  'Lib/payments/financeControlCenter.ts',
  'Lib/payments/fetchFinanceControlCenter.ts',
  'Lib/payments/requireFinancePage.ts',
].map((rel) => join(ROOT, rel))
const v2Ui = [
  'components/finance/FinanceControlCenter.tsx',
  'components/finance/FinanceRefundsBoard.tsx',
  'components/finance/FinanceReconciliationBoard.tsx',
  'components/finance/FinancePscsOneBoard.tsx',
  'components/finance/FinancePostEventBoard.tsx',
].map((rel) => join(ROOT, rel))

test('new finance APIs are authenticated and company-scoped', () => {
  const expected = [
    'app/api/finance/overview/route.ts',
    'app/api/finance/activity/route.ts',
    'app/api/finance/attention/route.ts',
    'app/api/finance/search/route.ts',
    'app/api/finance/refunds/route.ts',
    'app/api/finance/post-event/route.ts',
    'app/api/finance/providers/route.ts',
    'app/api/finance/pscs-one/route.ts',
    'app/api/finance/ledger-reconciliation/route.ts',
  ]
  for (const rel of expected) {
    const src = read(rel)
    assert.match(src, /requireInvoiceControlApi|requirePaypalControlApi/)
    assert.match(src, /authorizedFinanceCompanyId/)
    assert.doesNotMatch(src, /createBrowserClient/)
  }
  assert.ok(financeApiFiles.length >= 14)
})

test('fetcher queries are company-scoped and never select secrets', () => {
  const src = read('Lib/payments/fetchFinanceControlCenter.ts')
  assert.match(src, /\.eq\('company_id', /)
  assert.doesNotMatch(src, /token_hash|client_secret|webhook_route_key|account_number|routing_number/)
  assert.doesNotMatch(src, /createBrowserClient|from\('invoice_refunds'\).*metadata/)
  assert.match(src, /sanitizeOutboxPayload/)
})

test('V2 UI is read-only and has no money-movement actions', () => {
  for (const file of v2Ui) {
    const src = readFileSync(file, 'utf8')
    assert.doesNotMatch(src, /Force Paid|Retry Outbox|Retry Webhook|execute-paypal|onClick=\{[^}]*capture/i)
    assert.doesNotMatch(src, /method:\s*'POST'/)
  }
})

test('nav exposes Finance home without swallowing child routes', () => {
  const finance = CATERING_NAV.find((group) => group.id === 'financial')
  const hrefs = finance.children.map((child) => child.href)
  assert.deepEqual(
    ['/finance', '/invoices', '/payments/paypal-control', '/finance/refunds', '/finance/post-event', '/finance/reconciliation', '/finance/pscs-one'].every((href) => hrefs.includes(href)),
    true,
  )
  assert.equal(isNavHrefActive('/finance', '/finance'), true)
  assert.equal(isNavHrefActive('/finance/refunds', '/finance'), false)
  assert.equal(getChromeNavLabel('pt', '/finance', ''), 'Visão Geral')
  assert.equal(getChromeNavLabel('en', '/finance', ''), 'Overview')
  assert.equal(getChromeNavLabel('es', '/finance', ''), 'Resumen')
})

test('pages exist and enforce RBAC', () => {
  for (const rel of [
    'app/finance/page.tsx',
    'app/finance/refunds/page.tsx',
    'app/finance/reconciliation/page.tsx',
    'app/finance/pscs-one/page.tsx',
    'app/finance/post-event/page.tsx',
  ]) {
    const src = read(rel)
    assert.match(src, /requireFinancePage/)
  }
  const guard = read('Lib/payments/requireFinancePage.ts')
  assert.match(guard, /finance\.invoices\.view/)
  assert.match(guard, /redirect\('\/quotes'\)/)
})

test('PT/EN/ES financeControl registry is complete', () => {
  const entries = listFinanceControlI18nEntries()
  assert.ok(entries.length > 60)
  for (const locale of ['pt', 'en', 'es']) {
    assert.ok(tFinanceControl(locale, 'homeTitle'))
    assert.ok(tFinanceControl(locale, 'searchPlaceholder'))
    assert.ok(tFinanceControl(locale, 'paypalSandbox'))
  }
  const inspect = inspectTranslationRegistry(buildTranslationRegistry())
  assert.equal(inspect.missingPt.length, 0, inspect.missingPt.slice(0, 8).join(','))
  assert.equal(inspect.missingEn.length, 0, inspect.missingEn.slice(0, 8).join(','))
  assert.equal(inspect.missingEs.length, 0, inspect.missingEs.slice(0, 8).join(','))
})

test('mobile markup gates use cards and xl:hidden', () => {
  const home = read('components/finance/FinanceControlCenter.tsx')
  const refunds = read('components/finance/FinanceRefundsBoard.tsx')
  const paypal = read('components/payments/PaypalControlCenter.tsx')
  assert.match(home, /min-h-\[48px\]|min-h-\[52px\]|min-h-\[44px\]/)
  assert.match(refunds, /xl:hidden/)
  assert.match(paypal, /xl:hidden/)
  assert.match(home, /liquid-glass-card/)
})

test('invoices and PayPal keep existing routes and add finance breadcrumb', () => {
  assert.match(read('components/payments/InvoicesDashboard.tsx'), /FinanceBreadcrumb/)
  assert.match(read('components/payments/PaypalControlCenter.tsx'), /paypalSandboxControl/)
  assert.match(read('app/invoices/page.tsx'), /InvoicesDashboard/)
  assert.match(read('app/payments/paypal-control/page.tsx'), /PaypalControlCenter/)
})

test('secret leakage keys stay out of V2 surfaces', () => {
  const bundle = [...v2Lib, ...v2Ui, join(ROOT, 'Lib/i18n/financeControl.ts')]
    .map((file) => readFileSync(file, 'utf8'))
    .join('\n')
  assert.doesNotMatch(bundle, /client_secret|token_hash|webhook_route_key|buyer_password|service_role/)
})

console.log(failed === 0 ? `FINANCE CONTROL CENTER V2: PASS (${passed})` : `FINANCE CONTROL CENTER V2: FAIL ${failed}/${passed + failed}`)
process.exit(failed === 0 ? 0 : 1)
