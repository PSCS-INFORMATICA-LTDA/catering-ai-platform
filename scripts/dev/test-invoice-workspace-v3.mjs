/**
 * Invoice Workspace V3 — source, RBAC, secret-leak, i18n and layout gates.
 *
 *   npm run test:dev:invoice-workspace-v3
 */
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildTranslationRegistry, inspectTranslationRegistry } from '../../Lib/i18n/registry.ts'
import { tInvoiceWorkspace, listInvoiceWorkspaceI18nEntries } from '../../Lib/i18n/invoiceWorkspace.ts'
import { getChromeNavLabel } from '../../Lib/i18n/chrome.ts'
import { tFinanceControl } from '../../Lib/i18n/financeControl.ts'
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

const fetcher = read('Lib/payments/fetchFinanceDashboard.ts')
const dashboard = read('components/payments/InvoicesDashboard.tsx')
const grid = read('components/payments/InvoiceWorkspaceGrid.tsx')
const preview = read('components/payments/InvoiceWorkspacePreview.tsx')
const exportRoute = read('app/api/finance/invoices/export/route.ts')
const listRoute = read('app/api/finance/invoices/route.ts')
const workspace = read('Lib/payments/invoiceWorkspace.ts')

test('does not keep the 800-row in-memory invoice cap', () => {
  assert.doesNotMatch(fetcher, /\.limit\(800\)/)
  assert.match(fetcher, /countInvoiceWorkspaceViews|INVOICE_WORKSPACE_WORKING_SET_CAP/)
  assert.match(fetcher, /\.range\(/)
  assert.match(fetcher, /compareInvoiceWorkspaceRows/)
  assert.match(fetcher, /snapshot->customer->>name/)
  assert.match(fetcher, /invoice_refunds/)
  assert.match(fetcher, /computeInvoiceMovementTotals/)
})

test('list and export APIs stay authenticated and company-scoped', () => {
  for (const src of [listRoute, exportRoute]) {
    assert.match(src, /requireInvoiceControlApi/)
    assert.match(src, /authorizedFinanceCompanyId/)
    assert.doesNotMatch(src, /createBrowserClient/)
  }
  assert.match(fetcher, /\.eq\('company_id', /)
  assert.match(exportRoute, /mode: 'export'/)
  assert.match(exportRoute, /buildInvoiceWorkspaceCsv/)
  assert.match(exportRoute, /invoiceWorkspaceCsvHasForbiddenContent/)
})

test('never selects or exports secrets', () => {
  const bundle = [fetcher, dashboard, grid, preview, exportRoute, listRoute].join('\n')
  assert.doesNotMatch(bundle, /select\([^\)]*token_hash/)
  assert.doesNotMatch(bundle, /client_secret|webhook_route_key|service_role|provider_payload/)
  assert.match(fetcher, /invoice_payment_links/)
  assert.match(fetcher, /purpose, expires_at, revoked_at, created_at/)
  assert.doesNotMatch(fetcher, /token_hash/)
})

test('workspace UI has no money-movement actions', () => {
  for (const src of [dashboard, grid, preview]) {
    assert.doesNotMatch(src, /Force Paid|Retry Webhook|Retry Outbox|execute-paypal/)
    assert.doesNotMatch(src, /onClick=\{[^}]*capture/i)
  }
})

test('desktop grid and mobile cards share the same invoices API', () => {
  assert.match(dashboard, /\/api\/finance\/invoices/)
  assert.match(dashboard, /xl:hidden/)
  assert.match(grid, /xl:block/)
  assert.match(grid, /cursor-col-resize/)
  assert.match(grid, /onDragStart/)
  assert.match(workspace, /invoice-workspace-v3/)
  assert.match(dashboard, /localStorage/)
  assert.match(preview, /previewOpenInvoice/)
  assert.match(grid, /\/quotes\/\$\{invoice\.quote_id\}/)
})

test('nav highlights Faturamento on the existing /invoices route', () => {
  const finance = CATERING_NAV.find((group) => group.id === 'financial')
  const invoices = finance?.children.find((child) => child.href === '/invoices')
  assert.equal(invoices?.label, 'Faturamento')
  assert.equal(getChromeNavLabel('pt', '/invoices', ''), 'Faturamento')
  assert.equal(getChromeNavLabel('en', '/invoices', ''), 'Invoices')
  assert.equal(getChromeNavLabel('es', '/invoices', ''), 'Facturación')
  assert.equal(tFinanceControl('pt', 'invoices'), 'Faturamento')
  assert.match(read('app/invoices/page.tsx'), /InvoicesDashboard/)
  assert.match(read('app/invoices/page.tsx'), /finance\.invoices\.view/)
})

test('PT/EN/ES invoice workspace registry is complete', () => {
  const entries = listInvoiceWorkspaceI18nEntries()
  assert.ok(entries.length > 40, `expected many keys, got ${entries.length}`)
  for (const locale of ['pt', 'en', 'es']) {
    assert.ok(tInvoiceWorkspace(locale, 'title'))
    assert.ok(tInvoiceWorkspace(locale, 'subtitle'))
    assert.ok(tInvoiceWorkspace(locale, 'divergence'))
    assert.ok(tInvoiceWorkspace(locale, 'exportCsv'))
  }
  assert.equal(tInvoiceWorkspace('pt', 'title'), 'Faturamento')
  assert.match(tInvoiceWorkspace('pt', 'subtitle'), /invoices, recebimentos e saldos/)
  const inspect = inspectTranslationRegistry(buildTranslationRegistry())
  assert.equal(inspect.missingPt.length, 0, inspect.missingPt.slice(0, 8).join(','))
  assert.equal(inspect.missingEn.length, 0, inspect.missingEn.slice(0, 8).join(','))
  assert.equal(inspect.missingEs.length, 0, inspect.missingEs.slice(0, 8).join(','))
})

test('finance APIs remain company-scoped after the new export route', () => {
  const files = walk(join(ROOT, 'app/api/finance')).filter((file) => file.endsWith('.ts'))
  assert.ok(files.length >= 15)
  for (const file of files) {
    const src = readFileSync(file, 'utf8')
    assert.match(src, /requireInvoiceControlApi|requirePaypalControlApi/, file)
    assert.match(src, /authorizedFinanceCompanyId|resolveAuthorizedCompanyId/, file)
  }
})

console.log(failed === 0 ? `INVOICE WORKSPACE V3: PASS (${passed})` : `INVOICE WORKSPACE V3: FAIL ${failed}/${passed + failed}`)
process.exit(failed === 0 ? 0 : 1)
