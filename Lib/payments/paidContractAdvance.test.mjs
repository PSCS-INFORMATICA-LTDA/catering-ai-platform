import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  readContractLifecycle,
  shouldAdvancePaidContract,
} from './paidContractAdvance.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8')

test('1 accepted + unpaid → awaiting payment, no reservation, no OS', () => {
  const life = readContractLifecycle({
    proposalAccepted: true,
    invoiceStatus: 'awaiting_deposit',
    paidTotal: 0,
    depositAmount: 555,
    total: 1850,
    reservationConfirmedAt: null,
    serviceOrderId: null,
  })
  assert.equal(life.awaitingDeposit, true)
  assert.equal(life.depositPaid, false)
  assert.equal(life.reservationConfirmed, false)
  assert.equal(life.serviceOrderPresent, false)
  assert.equal(life.financialStatus, 'awaiting_payment')
  assert.equal(shouldAdvancePaidContract({ depositAmount: 555, paidTotal: 0 }).advance, false)
})

test('2 deposit completed → reservation + OS may advance', () => {
  const decision = shouldAdvancePaidContract({ depositAmount: 555, paidTotal: 555 })
  assert.equal(decision.advance, true)
  const life = readContractLifecycle({
    proposalAccepted: true,
    invoiceStatus: 'partially_paid',
    paidTotal: 555,
    depositAmount: 555,
    total: 1850,
    reservationConfirmedAt: '2026-09-16T18:00:00.000Z',
    serviceOrderId: 'os-1',
    serviceOrderNumber: 'OS-2026-000001',
  })
  assert.equal(life.depositPaid, true)
  assert.equal(life.reservationConfirmed, true)
  assert.equal(life.serviceOrderPresent, true)
  assert.equal(life.serviceOrderNumber, 'OS-2026-000001')
  assert.equal(life.paidInFull, false)
  assert.equal(life.financialStatus, 'partially_paid')
})

test('3 full completed → reservation + same OS + paid in full', () => {
  const life = readContractLifecycle({
    proposalAccepted: true,
    invoiceStatus: 'paid',
    paidTotal: 1850,
    depositAmount: 555,
    total: 1850,
    reservationConfirmedAt: '2026-09-16T18:00:00.000Z',
    serviceOrderId: 'os-1',
    serviceOrderNumber: 'OS-2026-000001',
  })
  assert.equal(shouldAdvancePaidContract({ depositAmount: 555, paidTotal: 1850 }).advance, true)
  assert.equal(life.reservationConfirmed, true)
  assert.equal(life.serviceOrderId, 'os-1')
  assert.equal(life.paidInFull, true)
  assert.equal(life.financialStatus, 'paid')
})

test('4 balance after deposit keeps the same OS', () => {
  const afterDeposit = readContractLifecycle({
    proposalAccepted: true,
    invoiceStatus: 'partially_paid',
    paidTotal: 555,
    depositAmount: 555,
    total: 1850,
    reservationConfirmedAt: '2026-09-16T18:00:00.000Z',
    serviceOrderId: 'os-1',
    serviceOrderNumber: 'OS-2026-000001',
  })
  const afterBalance = readContractLifecycle({
    proposalAccepted: true,
    invoiceStatus: 'paid',
    paidTotal: 1850,
    depositAmount: 555,
    total: 1850,
    reservationConfirmedAt: '2026-09-16T18:00:00.000Z',
    serviceOrderId: 'os-1',
    serviceOrderNumber: 'OS-2026-000001',
  })
  assert.equal(afterDeposit.serviceOrderId, afterBalance.serviceOrderId)
})

test('5-8 duplicate/retry/concurrent still decide a single advance', () => {
  const first = shouldAdvancePaidContract({ depositAmount: 555, paidTotal: 555 })
  const retry = shouldAdvancePaidContract({ depositAmount: 555, paidTotal: 555 })
  assert.deepEqual(first, retry)
  assert.equal(first.advance, true)
})

test('9 Zelle completed uses the same advance gate', () => {
  assert.equal(
    shouldAdvancePaidContract({ depositAmount: 300, paidTotal: 300 }).reason,
    'advance',
  )
})

test('10 tenant isolation stays on company-scoped callers', () => {
  const confirm = read('Lib/payments/confirmPaidDeposit.ts')
  assert.match(confirm, /\.eq\('company_id', input\.companyId\)/)
  assert.match(confirm, /convertAcceptedQuoteToServiceOrder/)
  assert.doesNotMatch(confirm, /paypal_capture' \| 'paypal_webhook'/)
})

test('inactive paid quote does not create an OS in the orchestrator', () => {
  const confirm = read('Lib/payments/confirmPaidDeposit.ts')
  assert.match(confirm, /quote.active === false/)
  assert.match(confirm, /quote_inactive/)
})

test('11 payment failure / unpaid deposit does not confirm reservation', () => {
  const life = readContractLifecycle({
    proposalAccepted: true,
    invoiceStatus: 'awaiting_deposit',
    paidTotal: 0,
    depositAmount: 555,
    total: 1850,
    reservationConfirmedAt: '2026-09-16T18:00:00.000Z',
    serviceOrderId: null,
  })
  assert.equal(life.reservationConfirmed, false)
  assert.equal(life.awaitingDeposit, true)
})

test('12 post-event adjustment does not advance reservation or OS', () => {
  const decision = shouldAdvancePaidContract({
    invoiceKind: 'post_event_adjustment',
    depositAmount: 200,
    paidTotal: 200,
  })
  assert.equal(decision.advance, false)
  assert.equal(decision.reason, 'post_event_adjustment')
})

test('13 reservation display requires financial confirmation', () => {
  const life = readContractLifecycle({
    proposalAccepted: true,
    paidTotal: 0,
    depositAmount: 555,
    total: 1850,
    reservationConfirmedAt: 'legacy-manual',
  })
  assert.equal(life.reservationConfirmed, false)
})

test('14 Commercial Review lifecycle keys exist in PT/EN/ES', () => {
  const i18n = read('Lib/i18n/commercialReview.ts')
  assert.match(i18n, /lifecycleProposalAccepted/)
  assert.match(i18n, /lifecycleAwaitingDeposit/)
  assert.match(i18n, /lifecycleReservationConfirmed/)
  assert.match(i18n, /lifecycleServiceOrder/)
  assert.match(i18n, /lifecyclePaidInFull/)
  const workspace = read('components/commercial-review/CommercialReviewWorkspace.tsx')
  assert.match(workspace, /ContractLifecycleCard/)
})

test('canonical conversion is reused, not duplicated', () => {
  const confirm = read('Lib/payments/confirmPaidDeposit.ts')
  const convert = read('Lib/orders/convertAcceptedQuoteToServiceOrder.ts')
  const record = read('Lib/payments/recordPayment.ts')
  const manual = read('Lib/payments/manualFinance.ts')
  assert.match(confirm, /from '@\/Lib\/orders\/convertAcceptedQuoteToServiceOrder'/)
  assert.match(convert, /uq_service_orders_company_quote_version|quote_version_id/)
  assert.match(convert, /already_existed: true/)
  assert.match(record, /confirmPaidDepositReservation/)
  assert.match(record, /ensurePaidContract/)
  assert.match(manual, /confirmPaidDepositReservation/)
  assert.doesNotMatch(confirm, /from\('service_orders'\)\s*\.insert/)
})
