import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8')

const confirm = read('Lib/payments/confirmPaidDeposit.ts')
const advance = read('Lib/payments/paidContractAdvance.ts')
const convert = read('Lib/orders/convertAcceptedQuoteToServiceOrder.ts')
const capture = read('app/api/payments/paypal/capture/route.ts')
const webhook = read('Lib/payments/paypal/processWebhook.ts')
const record = read('Lib/payments/recordPayment.ts')
const manual = read('Lib/payments/manualFinance.ts')
const extras = read('Lib/commercialReview/loadWorkspaceExtras.ts')
const card = read('components/commercial-review/ContractLifecycleCard.tsx')

assert.match(confirm, /ensure canonical OS|convertAcceptedQuoteToServiceOrder/)
assert.match(confirm, /source: PaidContractSource/)
assert.match(advance, /manual_payment/)
assert.match(advance, /record_payment/)
assert.match(confirm, /action: 'payment_completed'/)
assert.match(confirm, /action: 'service_order_created'/)
assert.match(confirm, /quote_inactive/)
assert.match(convert, /already_existed: true/)
assert.match(convert, /duplicate key\|unique constraint/)
assert.match(capture, /confirmPaidDepositReservation/)
assert.match(webhook, /confirmPaidDepositReservation/)
assert.match(record, /confirmPaidDepositReservation/)
assert.match(record, /ensurePaidContract/)
assert.match(manual, /confirmPaidDepositReservation/)
assert.match(capture, /existing.status === 'completed'/)
assert.match(webhook, /payment.status === 'completed'/)
assert.doesNotMatch(confirm, /api-m\.paypal\.com/)
assert.match(extras, /readContractLifecycle/)
assert.match(card, /commercial-review-lifecycle/)
assert.match(card, /lifecycle-deposit/)

console.log('PAID_CONTRACT_ADVANCE_CONTRACT=PASS')
