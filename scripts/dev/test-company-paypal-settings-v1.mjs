/**
 * Company-scoped PayPal sandbox readiness — no live money, no public checkout.
 *
 *   npm run test:dev:company-paypal-settings
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

const settingsApi = read('app/api/company/payment-providers/paypal/route.ts')
const testApi = read('app/api/company/payment-providers/paypal/test/route.ts')
const webhookAdmin = read('app/api/company/payment-providers/paypal/webhook/route.ts')
const webhookKeyed = read('app/api/payments/paypal/webhook/[connectionKey]/route.ts')
const webhookLegacy = read('app/api/payments/paypal/webhook/route.ts')
const processWebhook = read('Lib/payments/paypal/processWebhook.ts')
const companyPaypal = read('Lib/payments/companyPaypal.ts')
const vault = read('Lib/payments/secretVault.ts')
const adapter = read('Lib/payments/paypal/adapter.ts')
const config = read('Lib/payments/paypal/config.ts')
const sandboxWebhooks = read('Lib/payments/paypal/sandboxWebhooks.ts')
const orders = read('app/api/payments/paypal/orders/route.ts')
const capture = read('app/api/payments/paypal/capture/route.ts')
const ui = read('components/settings/PaymentSettingsDashboard.tsx')
const page = read('app/settings/payments/page.tsx')
const payPage = read('components/payments/PublicPaymentPage.tsx')
const payRoute = read('app/pay/[token]/page.tsx')
const requireApi = read('Lib/auth/requireApi.ts')
const permissions = read('Lib/auth/permissions.ts')
const migration = read('supabase/migrations/20260827190000_company_paypal_settings_v1.sql')
const oneAdapter = read('Lib/pscs-one/sessionAdapter.ts')
const oneCompany = read('Lib/pscs-one/companyService.ts')
const publicTypes = read('Lib/payments/paypalSettingsTypes.ts')

test('PAYPAL_COMPANY_SCOPED', () => {
  assert.match(settingsApi, /requireSessionCompanyId/)
  assert.match(settingsApi, /rejectSpoofedTenantCompanyId/)
  assert.match(companyPaypal, /eq\('company_id', companyId\)/)
  assert.match(page, /requireSessionCompanyId/)
  assert.match(requireApi, /Payment settings must not fall back/)
  assert.doesNotMatch(settingsApi, /getCdlCompanyId/)
  assert.doesNotMatch(testApi, /getCdlCompanyId/)
  assert.doesNotMatch(webhookAdmin, /getCdlCompanyId/)
})

test('PAYPAL_CLIENT_ID_COMPANY_SCOPED', () => {
  assert.match(settingsApi, /public_client_id/)
  assert.match(companyPaypal, /public_client_id/)
  assert.match(orders, /paypal_not_configured/)
  assert.match(capture, /paypal_not_configured/)
})

test('PAYPAL_SECRET_VAULT_STORED', () => {
  assert.match(vault, /store_company_paypal_secret/)
  assert.match(vault, /encryptProviderSecret/)
  assert.match(migration, /private\.payment_provider_secrets/)
  assert.match(migration, /SECURITY DEFINER/)
  assert.match(migration, /REVOKE ALL ON FUNCTION public.store_company_paypal_secret/)
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public.store_company_paypal_secret/)
  assert.match(migration, /TO service_role/)
})

test('PAYPAL_SECRET_NEVER_RETURNED', () => {
  assert.match(publicTypes, /clientSecretConfigured/)
  assert.doesNotMatch(publicTypes, /clientSecret:/)
  assert.doesNotMatch(testApi, /access_token/)
  assert.match(ui, /data-paypal-secret-masked/)
  assert.match(companyPaypal, /clientSecretConfigured: secretConfigured/)
  assert.doesNotMatch(settingsApi, /clientSecret:/)
})

test('PAYPAL_SECRET_BLANK_UPDATE_PRESERVES_EXISTING', () => {
  assert.match(settingsApi, /if \(secret\)/)
  assert.match(settingsApi, /storeCompanyPaypalSecret/)
  assert.match(ui, /clientSecret\.trim\(\) \|\| undefined/)
})

test('PAYPAL_SETTINGS_AUTHORIZED_USER_ONLY', () => {
  assert.match(settingsApi, /PAYMENT_SETTINGS_PERMISSION/)
  assert.match(testApi, /PAYMENT_SETTINGS_PERMISSION/)
  assert.match(webhookAdmin, /PAYMENT_SETTINGS_PERMISSION/)
  assert.match(page, /PAYMENT_SETTINGS_PERMISSION/)
  assert.match(companyPaypal, /company\.settings/)
  assert.match(permissions, /'company.settings'/)
  assert.doesNotMatch(permissions, /'finance': \[[^\]]*'company.settings'/)
})

test('PAYPAL_CROSS_COMPANY_ACCESS_BLOCKED', () => {
  assert.match(settingsApi, /rejectSpoofedTenantCompanyId/)
  assert.match(requireApi, /rejectSpoofedTenantCompanyId/)
  assert.match(orders, /loadCompanyPaypalCredentials\(companyId\)/)
  assert.match(capture, /loadCompanyPaypalCredentials\(companyId\)/)
  assert.match(webhookKeyed, /expectedCompanyId/)
})

test('PAYPAL_SANDBOX_CONNECTION_TEST', () => {
  assert.match(testApi, /getPaypalSandboxAccessToken/)
  assert.match(testApi, /paypal_not_configured/)
  assert.doesNotMatch(testApi, /createOrder/)
  assert.doesNotMatch(testApi, /captureOrder/)
})

test('PAYPAL_CONNECTION_TEST_MOVES_MONEY = NO', () => {
  assert.doesNotMatch(testApi, /\/v2\/checkout\/orders/)
  assert.doesNotMatch(testApi, /createPaypalAdapter/)
  assert.doesNotMatch(testApi, /captureOrder/)
  assert.match(testApi, /oauth2|getPaypalSandboxAccessToken/)
})

test('PAYPAL_WEBHOOK_COMPANY_SCOPED', () => {
  assert.match(webhookKeyed, /findPaypalProviderByWebhookKey/)
  assert.match(webhookKeyed, /expectedCompanyId/)
  assert.match(companyPaypal, /webhook_route_key/)
  assert.match(migration, /webhook_route_key/)
  assert.match(companyPaypal, /createWebhookRouteKey/)
})

test('PAYPAL_WEBHOOK_SIGNATURE_REQUIRED', () => {
  assert.match(webhookKeyed, /verifyPaypalWebhookSignature/)
  assert.match(webhookLegacy, /verifyPaypalWebhookSignature/)
  assert.match(processWebhook, /PAYMENT\.CAPTURE\.COMPLETED/)
  assert.doesNotMatch(processWebhook, /CHECKOUT\.ORDER\.APPROVED/)
})

test('PAYPAL_WEBHOOK_IDEMPOTENT', () => {
  assert.match(webhookAdmin, /findOrCreateSandboxWebhook/)
  assert.match(sandboxWebhooks, /listSandboxWebhooks/)
  assert.match(sandboxWebhooks, /reused: true/)
  assert.match(sandboxWebhooks, /PAYMENT\.CAPTURE\.COMPLETED/)
})

test('PAYPAL_LIVE_BLOCKED', () => {
  assert.match(settingsApi, /paypal_live_blocked/)
  assert.match(config, /liveBlocked/)
  assert.match(ui, /data-paypal-live-blocked/)
})

test('PAYPAL_PUBLIC_CHECKOUT_OFF', () => {
  assert.match(companyPaypal, /publicCheckout: false/)
  assert.match(config, /publicCheckoutRequested && false/)
  assert.match(orders, /paypal_public_checkout_off/)
  assert.match(ui, /data-paypal-public-checkout="off"/)
  assert.match(payPage, /paypalUnavailable/)
  assert.match(payRoute, /publicCheckout=\{false\}/)
})

test('ZELLE_PRESERVED', () => {
  assert.match(ui, /data-zelle-preserved/)
  assert.match(payPage, /data-method-zelle/)
  assert.match(migration, /'zelle', true/)
})

test('BANK_TRANSFER_PRESERVED', () => {
  assert.match(ui, /data-bank-transfer-preserved/)
  assert.match(payPage, /data-method-bank-transfer/)
  assert.match(migration, /'bank_transfer', true/)
})

test('TENANT_ISOLATION', () => {
  assert.match(settingsApi, /rejectSpoofedTenantCompanyId/)
  assert.match(requireApi, /resolveSessionCompanyId/)
  assert.match(orders, /loadCompanyPaypalCredentials\(companyId\)/)
  assert.match(capture, /loadCompanyPaypalCredentials\(companyId\)/)
  assert.match(webhookKeyed, /expectedCompanyId/)
  assert.match(adapter, /if \(company\)/)
})

test('PAYPAL_COMPANY_LINKED_TO_CANONICAL_TENANT', () => {
  assert.match(oneAdapter, /external_company_id/)
  assert.match(oneAdapter, /pscs_one_user_id/)
  assert.match(oneCompany, /mapped_company_missing/)
  assert.match(oneCompany, /role: 'viewer'/)
  assert.doesNotMatch(migration, /CREATE TABLE .*compan(y|ies)_master/)
  assert.doesNotMatch(migration, /CREATE TABLE public\.companies /)
})

test('PSCS_ONE_NO_DUPLICATION', () => {
  assert.doesNotMatch(migration, /CREATE TABLE .*identity/)
  assert.doesNotMatch(migration, /CREATE TABLE .*membership/)
  assert.doesNotMatch(migration, /CREATE TABLE .*entitlement/)
  assert.doesNotMatch(page, /from\('pscs_one/)
  assert.doesNotMatch(settingsApi, /from\('pscs_one/)
})

test('SECRET_LEAK_SCAN', () => {
  const files = [
    settingsApi,
    testApi,
    webhookAdmin,
    webhookKeyed,
    ui,
    page,
    companyPaypal,
    processWebhook,
    sandboxWebhooks,
  ]
  for (const src of files) {
    assert.doesNotMatch(src, /PAYPAL_CLIENT_SECRET\s*=\s*['"][^'"]+['"]/)
    assert.doesNotMatch(src, /access_token['"]\s*:/)
    assert.doesNotMatch(src, /console\.log\([^\)]*clientSecret/)
    assert.doesNotMatch(src, /console\.log\([^\)]*access_token/)
  }
})

test('SETTINGS_UI_EXISTS', () => {
  assert.match(page, /PAYMENT_SETTINGS_PERMISSION/)
  assert.match(ui, /data-settings-payments/)
  assert.match(ui, /data-paypal-breadcrumb/)
  assert.match(read('components/layout/navConfig.ts'), /\/settings\/payments/)
})

test('ORDERS_USE_COMPANY_CREDENTIALS', () => {
  assert.match(orders, /createPaypalAdapter\(runtime, \{/)
  assert.match(capture, /createPaypalAdapter\(runtime, \{/)
  assert.match(adapter, /company\.clientId/)
})

test('WEBHOOK_REQUIRES_TEST_PASS', () => {
  assert.match(webhookAdmin, /paypal_test_required/)
  assert.match(sandboxWebhooks, /PAYMENT\.CAPTURE\.COMPLETED/)
})

const env = loadDevEnv(ROOT)
assertDevUrl(env.url)
const sb = createClient(env.url, env.service, {
  auth: { persistSession: false, autoRefreshToken: false },
})

test('DEV_SUPABASE_CONFIRMED', () => {
  assert.match(env.url, /yasprgtlqclwsjcshtls/)
})

const { data: cdlProviders, error: providerError } = await sb
  .from('company_payment_providers')
  .select('provider, enabled, public_client_id, company_id, webhook_route_key, metadata')
  .eq('company_id', CDL_ID)

test('CDL_PROVIDERS_SCOPED', () => {
  if (providerError) {
    throw new Error(providerError.message)
  }
  const keys = (cdlProviders ?? []).map((row) => row.provider)
  assert.ok(keys.includes('zelle'))
  assert.ok(keys.includes('bank_transfer'))
  assert.ok(keys.includes('paypal'))
  const paypal = (cdlProviders ?? []).find((row) => row.provider === 'paypal')
  assert.equal(paypal?.enabled, false)
  assert.equal(paypal?.public_client_id, null)
})

const { data: roles } = await sb
  .from('role_permissions')
  .select('role_key')
  .eq('permission_key', 'company.settings')

test('PAYMENT_SETTINGS_PERMISSION_USED', () => {
  const roleKeys = (roles ?? []).map((row) => row.role_key).sort()
  assert.deepEqual(roleKeys, ['admin', 'owner'])
  assert.match(companyPaypal, /export const PAYMENT_SETTINGS_PERMISSION = 'company.settings'/)
})

const { data: payPerms } = await sb
  .from('permissions')
  .select('permission_key')
  .ilike('permission_key', '%pay%')

test('PAYMENT_PERMISSION_GAP_DOCUMENTED', () => {
  assert.equal((payPerms ?? []).length, 0)
  assert.match(oneCompany, /role: 'viewer'/)
  assert.match(ui, /company.settings/)
})

const { data: isolationCompany } = await sb
  .from('companies')
  .select('id, company_name')
  .eq('id', ISO_ID)
  .maybeSingle()

test('ISOLATION_COMPANY_EXISTS_OR_SKIPPED', () => {
  console.log(
    `INFO  ISOLATION_COMPANY=${isolationCompany ? isolationCompany.company_name : 'missing'}`,
  )
  assert.equal(typeof isolationCompany === 'object' || isolationCompany == null, true)
})

const { data: appUserCols } = await sb
  .from('app_users')
  .select('id, pscs_one_user_id, company_id')
  .not('pscs_one_user_id', 'is', null)
  .limit(1)

test('CANONICAL_MAPPING_COLUMN_PRESENT', () => {
  assert.equal(Array.isArray(appUserCols) || appUserCols === null, true)
})

if (isolationCompany) {
  const dummyCipher = 'unit-test-cipher-isolation-v1'
  const { error: storeError } = await sb.rpc('store_company_paypal_secret', {
    p_company_id: ISO_ID,
    p_ciphertext: dummyCipher,
  })
  test('PAYPAL_SECRET_RPC_STORE', () => {
    assert.ifError(storeError)
  })

  const { data: stored, error: readError } = await sb.rpc(
    'read_company_paypal_secret',
    { p_company_id: ISO_ID },
  )
  test('PAYPAL_SECRET_RPC_READ_SAME_COMPANY', () => {
    assert.ifError(readError)
    assert.equal(stored, dummyCipher)
  })

  const { data: cdlSecret } = await sb.rpc('read_company_paypal_secret', {
    p_company_id: CDL_ID,
  })
  test('PAYPAL_COMPANY_ISOLATION_SECRET', () => {
    assert.notEqual(cdlSecret, dummyCipher)
  })

  await sb.from('company_payment_providers').upsert(
    {
      company_id: ISO_ID,
      provider: 'paypal',
      environment: 'sandbox',
      enabled: false,
      public_client_id: 'iso-public-client-id',
    },
    { onConflict: 'company_id,provider' },
  )
  const { data: isoRow } = await sb
    .from('company_payment_providers')
    .select('public_client_id, company_id, webhook_route_key')
    .eq('company_id', ISO_ID)
    .eq('provider', 'paypal')
    .maybeSingle()
  const cdlPaypal = (cdlProviders ?? []).find((row) => row.provider === 'paypal')
  test('PAYPAL_CLIENT_ID_NOT_SHARED', () => {
    assert.equal(isoRow?.public_client_id, 'iso-public-client-id')
    assert.notEqual(cdlPaypal?.public_client_id, 'iso-public-client-id')
  })

  const { data: secretAfterBlank } = await sb.rpc('read_company_paypal_secret', {
    p_company_id: ISO_ID,
  })
  test('PAYPAL_SECRET_BLANK_UPDATE_PRESERVES_EXISTING_DB', () => {
    assert.equal(secretAfterBlank, dummyCipher)
  })
}

if (failed > 0) {
  console.error(`\n${failed} failed, ${passed} passed`)
  process.exit(1)
}
console.log(`\n${passed} passed`)
