import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { paymentHelpLabels, paymentHelpSections, paymentHelpText } from '../../Lib/payments/paymentSetupHelp.ts'
let count = 0
const check = (name, run) => { run(); count += 1; console.log(`PASS ${name}`) }
check('all requested topics exist', () => assert.deepEqual(Object.keys(paymentHelpSections), ['company','clientId','clientSecret','webhook','buyer','zelle','bank']))
for (const locale of ['pt','en','es']) {
  check(`${locale}: all labels and steps translated`, () => {
    for (const text of [...Object.values(paymentHelpLabels), ...Object.values(paymentHelpSections).flatMap(s => [s.title,...s.steps])]) {
      assert.equal(typeof text[locale], 'string'); assert.ok(text[locale].trim().length > 2)
    }
  })
}
check('locale normalization and fallback', () => {
  assert.equal(paymentHelpText('pt-BR',paymentHelpLabels.title),paymentHelpLabels.title.pt)
  assert.equal(paymentHelpText('en-US',paymentHelpLabels.title),paymentHelpLabels.title.en)
  assert.equal(paymentHelpText('ES_mx',paymentHelpLabels.title),paymentHelpLabels.title.es)
  assert.equal(paymentHelpText('fr',paymentHelpLabels.title),paymentHelpLabels.title.pt)
})
check('only HTTPS official PayPal links', () => {
  for (const section of Object.values(paymentHelpSections)) for (const href of section.links) {
    const url = new URL(href); assert.equal(url.protocol,'https:'); assert.equal(url.hostname,'developer.paypal.com'); assert.equal(url.search,'')
  }
})
check('tenant-neutral help has no company banking data or credential values', () => {
  const data = JSON.stringify(paymentHelpSections)
  assert.doesNotMatch(data, /\b\d{9,}\b|[a-f0-9]{8}-[a-f0-9]{4}-|CDL Business|Bank of America|@personal\.example\.com/i)
})
check('native disclosures never submit or contact providers', () => {
  const ui = readFileSync(new URL('../../components/settings/PaymentSetupHelp.tsx',import.meta.url),'utf8')
  assert.match(ui, /<details/); assert.match(ui, /<summary/)
  assert.doesNotMatch(ui, /fetch\(|XMLHttpRequest|localStorage|dangerouslySetInnerHTML|<form|<input/)
  assert.match(ui, /rel="noopener noreferrer"/); assert.match(ui, /referrerPolicy="no-referrer"/)
})
console.log(`${count} payment setup help checks passed; no network or payment calls.`)
