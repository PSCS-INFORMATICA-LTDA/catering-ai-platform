import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8')

test('sausage choice is the first package option by group key', () => {
  const source = read('Lib/packageQuoteDisplay.ts')
  const order = source.slice(source.indexOf('OPTION_GROUP_ORDER'), source.indexOf('export type'))
  assert.ok(order.indexOf('LINGUICA_OPTION: 0') < order.indexOf('COSTELA_OPTION'))
  assert.ok(order.indexOf('LINGUICA_OPTION: 0') < order.indexOf('SEAFOOD_OPTION'))
})

test('review consent stays locked until the summary sentinel is visible', () => {
  const source = read('components/quote-review/PublicQuoteConfirmationStep.tsx')
  assert.match(source, /data-review-sentinel/)
  assert.match(source, /IntersectionObserver/)
  assert.match(source, /disabled=\{!summaryReviewed\}/)
  assert.doesNotMatch(source, /setTimeout\(/)
})

test('landing copy limits the promise to Florida in PT EN and ES', () => {
  const source = read('Lib/publicQuote/landingStoryCopy.ts')
  assert.match(source, /onde você estiver na Flórida\./)
  assert.match(source, /wherever you are in Florida\./)
  assert.match(source, /donde tú estés en Florida\./)
})

test('PayPal sandbox public guard remains fail-closed', () => {
  const guard = read('Lib/payments/paypal/publicCheckout.ts')
  const capture = read('app/api/payments/paypal/capture/route.ts')
  assert.match(guard, /assertPayPalLiveCheckoutAllowed/)
  assert.match(capture, /paypalLiveNotAvailableResponse|resolvePaypalCheckoutAccess/)
  assert.match(read('Lib/payments/recordPayment.ts'), /recordSandboxTestCapture/)
})
