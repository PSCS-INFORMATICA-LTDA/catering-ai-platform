import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildOfflineMetadata, cleanOfflineField } from '../../Lib/payments/offlinePaymentMetadata.ts'
let count = 0
const check = (name, run) => { run(); count += 1; console.log(`PASS ${name}`) }
check('new bank fields stay separate and preserve leading zero', () => {
  const result = buildOfflineMetadata({}, { routingNumber: ' 001 ', wireRoutingNumber: ' 002 ', paymentAddress: ' QA address ', checkPayableTo: ' QA payee ' }, {}, {})
  assert.equal(result.bankTransfer.routing_number, '001')
  assert.equal(result.bankTransfer.wire_routing_number, '002')
  assert.equal(result.bankTransfer.payment_address, 'QA address')
  assert.equal(result.bankTransfer.check_payable_to, 'QA payee')
})
check('older clients preserve optional fields and existing server metadata', () => {
  const before = { wire_routing_number: 'QA-WIRE', payment_address: 'QA-ADDRESS', check_payable_to: 'QA-PAYEE', server_flag: true }
  const result = buildOfflineMetadata({}, {}, { server_flag: true }, before)
  for (const [key, value] of Object.entries(before)) assert.equal(result.bankTransfer[key], value)
  assert.equal(result.zelle.server_flag, true)
  assert.deepEqual(before, { wire_routing_number: 'QA-WIRE', payment_address: 'QA-ADDRESS', check_payable_to: 'QA-PAYEE', server_flag: true })
})
check('explicitly clearing optional fields is supported', () => assert.equal(buildOfflineMetadata({}, { wireRoutingNumber: '' }, {}, { wire_routing_number: 'QA' }).bankTransfer.wire_routing_number, ''))
check('unknown request metadata is never copied', () => {
  const result = buildOfflineMetadata({ client_secret: 'DO-NOT-COPY', company_id: 'other-company' }, { metadata: { admin: true }, accountNumber: 42 }, null, null)
  assert.equal(result.zelle.client_secret, undefined)
  assert.equal(result.zelle.company_id, undefined)
  assert.equal(result.bankTransfer.metadata, undefined)
  assert.equal(result.bankTransfer.account_number, '')
})
check('field bounds and string-only normalization', () => {
  assert.equal(cleanOfflineField('x'.repeat(300)).length, 200)
  assert.equal(cleanOfflineField(false), '')
  assert.equal(buildOfflineMetadata({ instructions: 'x'.repeat(1500) }, {}, {}, {}).zelle.instructions.length, 1200)
})
check('tenant permission checks precede data access; PayPal excluded', () => {
  const route = readFileSync(new URL('../../app/api/company/payment-providers/offline/route.ts', import.meta.url), 'utf8')
  for (const guard of ['requireApiPermission(PAYMENT_SETTINGS_PERMISSION)', 'requireSessionCompanyId(auth.session)', 'rejectSpoofedTenantCompanyId(company.companyId']) {
    assert.ok(route.indexOf(guard) >= 0 && route.indexOf(guard) < route.indexOf('getSupabaseServerClient()'))
  }
  assert.match(route, /\.eq\('company_id', company\.companyId\)/)
  assert.match(route, /\.in\('provider', \['zelle', 'bank_transfer'\]\)/)
  assert.doesNotMatch(route, /provider: ['"]paypal['"]|fetch\(|capture|checkout/)
})
check('screen includes manual and contextual help without nesting help in labels', () => {
  const ui = readFileSync(new URL('../../components/settings/PaymentSettingsDashboard.tsx', import.meta.url), 'utf8')
  assert.match(ui, /<PaymentSetupHelp locale=\{locale\} \/>/)
  for (const topic of ['clientId', 'clientSecret', 'webhook', 'buyer', 'zelle', 'bank']) assert.ok(ui.includes(`topic="${topic}"`))
  const fields = [...ui.matchAll(/<BackofficeField\b[^>]*>([\s\S]*?)<\/BackofficeField>/g)]
  for (const field of fields) assert.ok(!field[1].includes('<PaymentSetupHelp'))
  assert.match(ui, /data-paypal-secret-masked type="password"/)
  assert.match(ui, /data-paypal-live-blocked="true"/)
})
console.log(`${count} offline metadata checks passed; no database or payment calls.`)
