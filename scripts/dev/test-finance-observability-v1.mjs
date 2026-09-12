/**
 * Finance Observability V1 — source, RBAC, secret-leak and i18n gates.
 *
 *   npm run test:dev:finance-observability-v1
 */
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildTranslationRegistry, inspectTranslationRegistry } from '../../Lib/i18n/registry.ts'
import { tFinanceObservability, listFinanceObservabilityI18nEntries } from '../../Lib/i18n/financeObservability.ts'
import { getChromeNavLabel } from '../../Lib/i18n/chrome.ts'
import { CATERING_NAV } from '../../components/layout/navConfig.ts'

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
const financeLibFiles = [
  'Lib/payments/fetchFinanceDashboard.ts',
  'Lib/payments/fetchInvoiceObservability.ts',
  'Lib/payments/fetchPaypalControl.ts',
  'Lib/payments/sanitizeFinanceObservability.ts',
  'Lib/payments/financeObservabilityAuth.ts',
].map((rel) => join(ROOT, rel))
const uiFiles = [
  'components/payments/InvoicesDashboard.tsx',
  'components/payments/InvoiceObservabilityPanels.tsx',
  'components/payments/PaypalControlCenter.tsx',
].map((rel) => join(ROOT, rel))

test('APIs exist and are authenticated + company-scoped', () => {
  assert.ok(financeApiFiles.length >= 7, `expected finance APIs, got ${financeApiFiles.length}`)
  for (const file of financeApiFiles) {
    const src = readFileSync(file, 'utf8')
    assert.match(src, /requireInvoiceControlApi|requirePaypalControlApi/, file)
    assert.match(src, /authorizedFinanceCompanyId|resolveAuthorizedCompanyId/, file)
    assert.doesNotMatch(src, /createBrowserClient|supabase\.from\(.*\)\.select\(\)/)
  }
})

test('tenant isolation uses session company_id, never browser-supplied as source of truth', () => {
  const auth = read('Lib/payments/financeObservabilityAuth.ts')
  assert.match(auth, /resolveAuthorizedCompanyId/)
  assert.match(auth, /rejectSpoofedCompanyId/)
  for (const file of financeLibFiles.filter((item) => item.includes('fetch'))) {
    const src = readFileSync(file, 'utf8')
    assert.match(src, /\.eq\('company_id', /, file)
  }
})

test('RBAC requires finance.invoices.view for PayPal control', () => {
  const auth = read('Lib/payments/financeObservabilityAuth.ts')
  const page = read('app/payments/paypal-control/page.tsx')
  const sidebar = read('components/layout/CateringSidebar.tsx')
  assert.match(auth, /finance\.invoices\.view/)
  assert.match(page, /canViewFinanceObservability/)
  assert.match(sidebar, /requiredPermission|requiredAnyPermission/)
})

test('token_hash and secrets never selected or rendered', () => {
  const bundle = [
    ...financeApiFiles,
    ...financeLibFiles,
    ...uiFiles,
    join(ROOT, 'Lib/payments/fetchInvoiceBackoffice.ts'),
  ]
    .map((file) => readFileSync(file, 'utf8'))
    .join('\n')
  assert.doesNotMatch(bundle, /select\([^\)]*token_hash/)
  assert.doesNotMatch(read('components/payments/InvoiceObservabilityPanels.tsx'), /token_hash/)
  assert.doesNotMatch(read('components/payments/PaypalControlCenter.tsx'), /token_hash/)
  assert.match(read('Lib/payments/sanitizeFinanceObservability.ts'), /sanitizePaymentMetadataForBackoffice/)
  assert.match(read('Lib/payments/sanitizeFinanceObservability.ts'), /sanitizePaypalProviderForObservability/)
})

test('PayPal control fail-closes outside sandbox and never shows client secret', () => {
  const overview = read('Lib/payments/fetchPaypalControl.ts')
  const ui = read('components/payments/PaypalControlCenter.tsx')
  assert.match(overview, /failClosed/)
  assert.match(overview, /hasCompanyPaypalSecret/)
  assert.doesNotMatch(overview, /loadCompanyPaypalSecret\(/)
  assert.doesNotMatch(ui, /clientSecret|client_secret|webhook_route_key/)
  assert.match(ui, /paypalSandboxBadge/)
})

test('V1 money-movement actions are not added to control UIs', () => {
  const invoiceUi = read('components/payments/InvoicesDashboard.tsx')
  const paypalUi = read('components/payments/PaypalControlCenter.tsx')
  for (const src of [invoiceUi, paypalUi]) {
    assert.doesNotMatch(src, /Retry Webhook|Retry Outbox|Force Paid/)
    assert.doesNotMatch(src, /onClick=\{[^}]*capture/i)
    assert.doesNotMatch(src, /execute-paypal/)
  }
})

test('invoice lineage and payment tables are reused, not duplicated', () => {
  const observability = read('Lib/payments/fetchInvoiceObservability.ts')
  assert.match(observability, /fetchInvoiceBackofficeDetail/)
  assert.match(observability, /computeFinancialCheck/)
  assert.match(observability, /event_financial_closeouts/)
  assert.doesNotMatch(observability, /reconcile_invoice_ledger/)
})

test('nav includes PayPal Control and Invoice Control with chrome labels', () => {
  const finance = CATERING_NAV.find((group) => group.id === 'financial')
  assert.ok(finance?.children.some((child) => child.href === '/invoices'))
  assert.ok(finance?.children.some((child) => child.href === '/payments/paypal-control'))
  assert.ok(getChromeNavLabel('pt', '/payments/paypal-control', ''))
  assert.ok(getChromeNavLabel('en', '/payments/paypal-control', ''))
  assert.ok(getChromeNavLabel('es', '/payments/paypal-control', ''))
})

test('PT/EN/ES registry contains financeObservability with no missing locales', () => {
  const entries = listFinanceObservabilityI18nEntries()
  assert.ok(entries.length > 40, `expected many keys, got ${entries.length}`)
  for (const locale of ['pt', 'en', 'es']) {
    assert.ok(tFinanceObservability(locale, 'invoiceControlTitle'))
    assert.ok(tFinanceObservability(locale, 'paypalSandboxBadge'))
    assert.ok(tFinanceObservability(locale, 'financialCheckAttention'))
  }
  const inspect = inspectTranslationRegistry(buildTranslationRegistry())
  assert.equal(inspect.missingPt.length, 0, inspect.missingPt.slice(0, 8).join(','))
  assert.equal(inspect.missingEn.length, 0, inspect.missingEn.slice(0, 8).join(','))
  assert.equal(inspect.missingEs.length, 0, inspect.missingEs.slice(0, 8).join(','))
})

test('new routes are mobile-first and paginated', () => {
  const dashboard = read('components/payments/InvoicesDashboard.tsx')
  const paypal = read('components/payments/PaypalControlCenter.tsx')
  assert.match(dashboard, /pageSize/)
  assert.match(dashboard, /xl:hidden/)
  assert.match(paypal, /xl:hidden/)
  assert.match(read('Lib/payments/financeObservabilityTypes.ts'), /25, 50, 100/)
})

console.log(failed === 0 ? `FINANCE OBSERVABILITY V1: PASS (${passed})` : `FINANCE OBSERVABILITY V1: FAIL ${failed}/${passed + failed}`)
process.exit(failed === 0 ? 0 : 1)
