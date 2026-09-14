import assert from 'node:assert/strict'
import test from 'node:test'
import {
  defaultPaymentPurpose,
  ignoreClientAmount,
  invoiceDueApiFields,
  isCompletedPaymentStatus,
  isCompletedRefundStatus,
  paidByPurposeFromLedger,
  resolveAmountDue,
  resolvePurposeAmounts,
} from './amountDue.ts'

const INV = {
  total: 2820,
  depositAmount: 846,
  balanceAmount: 1974,
}

function due(purpose, extra = {}) {
  return resolveAmountDue({
    ...INV,
    paidTotal: 0,
    purpose,
    ...extra,
  })
}

test('INV-2026-000009 semantics: 2820 / 846 / 1974', () => {
  const amounts = resolvePurposeAmounts({ ...INV, paidTotal: 0 })
  assert.equal(amounts.depositDue, 846)
  assert.equal(amounts.balanceDue, 1974)
  assert.equal(amounts.fullDue, 2820)
  assert.equal(due('deposit').amount, 846)
  assert.equal(due('balance').amount, 1974)
  assert.equal(due('full').amount, 2820)
  assert.notEqual(due('balance').amount, due('full').amount)
  const fields = invoiceDueApiFields({ ...INV, paidTotal: 0 })
  assert.deepEqual(fields, { deposit_due: 846, balance_due: 1974, full_due: 2820 })
})

test('A: no payments', () => {
  const paidByPurpose = paidByPurposeFromLedger([], [])
  const amounts = resolvePurposeAmounts({ ...INV, paidTotal: 0, paidByPurpose })
  assert.deepEqual(paidByPurpose, { deposit: 0, balance: 0, full: 0 })
  assert.equal(amounts.depositDue, 846)
  assert.equal(amounts.balanceDue, 1974)
  assert.equal(amounts.fullDue, 2820)
})

test('B: deposit fully paid', () => {
  const paidByPurpose = paidByPurposeFromLedger([
    { id: 'p-dep', purpose: 'deposit', amount: 846, status: 'completed' },
  ])
  const amounts = resolvePurposeAmounts({
    ...INV,
    paidTotal: 846,
    paidByPurpose,
  })
  assert.equal(amounts.depositDue, 0)
  assert.equal(amounts.balanceDue, 1974)
  assert.equal(amounts.fullDue, 1974)
  assert.equal(
    resolveAmountDue({
      ...INV,
      paidTotal: 846,
      purpose: 'deposit',
      paidByPurpose,
    }).reason,
    'deposit_already_paid',
  )
})

test('C: deposit partially paid', () => {
  const paidByPurpose = paidByPurposeFromLedger([
    { id: 'p-dep', purpose: 'deposit', amount: 400, status: 'completed' },
  ])
  const amounts = resolvePurposeAmounts({
    ...INV,
    paidTotal: 400,
    paidByPurpose,
  })
  assert.equal(amounts.depositDue, 446)
  assert.equal(amounts.balanceDue, 1974)
  assert.equal(amounts.fullDue, 2420)
})

test('D: balance partially paid', () => {
  const paidByPurpose = paidByPurposeFromLedger([
    { id: 'p-bal', purpose: 'balance', amount: 500, status: 'completed' },
  ])
  const amounts = resolvePurposeAmounts({
    ...INV,
    paidTotal: 500,
    paidByPurpose,
  })
  assert.equal(paidByPurpose.deposit, 0)
  assert.equal(paidByPurpose.balance, 500)
  assert.equal(amounts.depositDue, 846)
  assert.equal(amounts.balanceDue, 1474)
  assert.equal(amounts.fullDue, 2320)
})

test('E: deposit + part of balance paid', () => {
  const paidByPurpose = paidByPurposeFromLedger([
    { id: 'p-dep', purpose: 'deposit', amount: 846, status: 'completed' },
    { id: 'p-bal', purpose: 'balance', amount: 200, status: 'completed' },
  ])
  const amounts = resolvePurposeAmounts({
    ...INV,
    paidTotal: 1046,
    paidByPurpose,
  })
  assert.equal(amounts.depositDue, 0)
  assert.equal(amounts.balanceDue, 1774)
  assert.equal(amounts.fullDue, 1774)
})

test('F: invoice fully paid', () => {
  const paidByPurpose = paidByPurposeFromLedger([
    { id: 'p-dep', purpose: 'deposit', amount: 846, status: 'completed' },
    { id: 'p-bal', purpose: 'balance', amount: 1974, status: 'completed' },
  ])
  const amounts = resolvePurposeAmounts({
    ...INV,
    paidTotal: 2820,
    paidByPurpose,
  })
  assert.equal(amounts.depositDue, 0)
  assert.equal(amounts.balanceDue, 0)
  assert.equal(amounts.fullDue, 0)
  assert.equal(
    resolveAmountDue({
      ...INV,
      paidTotal: 2820,
      purpose: 'balance',
      paidByPurpose,
    }).reason,
    'already_paid',
  )
})

test('G: pending payment does not reduce amount due', () => {
  const paidByPurpose = paidByPurposeFromLedger([
    { id: 'p-pend', purpose: 'deposit', amount: 846, status: 'created' },
    { id: 'p-appr', purpose: 'balance', amount: 1974, status: 'approved' },
  ])
  assert.deepEqual(paidByPurpose, { deposit: 0, balance: 0, full: 0 })
  const amounts = resolvePurposeAmounts({
    ...INV,
    paidTotal: 0,
    paidByPurpose,
  })
  assert.equal(amounts.depositDue, 846)
  assert.equal(amounts.balanceDue, 1974)
  assert.equal(amounts.fullDue, 2820)
})

test('H: failed/canceled payment does not reduce amount due', () => {
  const paidByPurpose = paidByPurposeFromLedger([
    { id: 'p-fail', purpose: 'deposit', amount: 846, status: 'failed' },
    { id: 'p-can', purpose: 'balance', amount: 1974, status: 'canceled' },
  ])
  assert.deepEqual(paidByPurpose, { deposit: 0, balance: 0, full: 0 })
  assert.equal(due('deposit', { paidByPurpose }).amount, 846)
  assert.equal(due('balance', { paidByPurpose }).amount, 1974)
})

test('I: retry/idempotency does not duplicate paid amount', () => {
  const paidByPurpose = paidByPurposeFromLedger([
    { id: 'p-dep', purpose: 'deposit', amount: 846, status: 'completed' },
    { id: 'p-dep', purpose: 'deposit', amount: 846, status: 'completed' },
  ])
  assert.equal(paidByPurpose.deposit, 846)
  const amounts = resolvePurposeAmounts({
    ...INV,
    paidTotal: 846,
    paidByPurpose,
  })
  assert.equal(amounts.depositDue, 0)
  assert.equal(amounts.fullDue, 1974)
})

test('J: full payment is not confused with balance', () => {
  assert.equal(due('full').amount, 2820)
  assert.equal(due('balance').amount, 1974)
  const paidFull = paidByPurposeFromLedger([
    { id: 'p-full', purpose: 'full', amount: 2820, status: 'completed' },
  ])
  assert.equal(paidFull.full, 2820)
  assert.equal(paidFull.balance, 0)
  const afterFull = resolvePurposeAmounts({
    ...INV,
    paidTotal: 2820,
    paidByPurpose: paidFull,
  })
  assert.equal(afterFull.balanceDue, 0)
  assert.equal(afterFull.fullDue, 0)

  const partialFull = paidByPurposeFromLedger([
    { id: 'p-full-part', purpose: 'full', amount: 1000, status: 'completed' },
  ])
  const afterPartialFull = resolvePurposeAmounts({
    ...INV,
    paidTotal: 1000,
    paidByPurpose: partialFull,
  })
  assert.equal(partialFull.balance, 0)
  assert.equal(afterPartialFull.depositDue, 846)
  assert.equal(afterPartialFull.fullDue, 1820)
  assert.equal(afterPartialFull.balanceDue, 1820)
})

test('completed refund reduces the source payment purpose only', () => {
  const paidByPurpose = paidByPurposeFromLedger(
    [
      { id: 'p-dep', purpose: 'deposit', amount: 846, status: 'completed' },
      { id: 'p-bal', purpose: 'balance', amount: 200, status: 'completed' },
    ],
    [
      { payment_id: 'p-bal', amount: 200, status: 'completed' },
      { payment_id: 'p-dep', amount: 100, status: 'requested' },
    ],
  )
  assert.equal(paidByPurpose.deposit, 846)
  assert.equal(paidByPurpose.balance, 0)
})

test('reuses completed as the only captured status', () => {
  assert.equal(isCompletedPaymentStatus('completed'), true)
  assert.equal(isCompletedPaymentStatus('created'), false)
  assert.equal(isCompletedPaymentStatus('approved'), false)
  assert.equal(isCompletedPaymentStatus('failed'), false)
  assert.equal(isCompletedPaymentStatus('canceled'), false)
  assert.equal(isCompletedRefundStatus('completed'), true)
  assert.equal(isCompletedRefundStatus('requested'), false)
})

test('waterfall fallback still keeps unpaid balance as the saldo tranche', () => {
  const unpaid = resolveAmountDue({
    total: 1000,
    depositAmount: 300,
    paidTotal: 0,
    purpose: 'balance',
  })
  assert.equal(unpaid.amount, 700)
  const afterDeposit = resolveAmountDue({
    total: 1000,
    depositAmount: 300,
    paidTotal: 300,
    purpose: 'balance',
  })
  assert.equal(afterDeposit.amount, 700)
})

test('default purpose prefers remaining deposit tranche', () => {
  assert.equal(defaultPaymentPurpose({ ...INV, paidTotal: 0 }), 'deposit')
  assert.equal(defaultPaymentPurpose({ ...INV, paidTotal: 846 }), 'balance')
  assert.equal(defaultPaymentPurpose({ ...INV, paidTotal: 2820 }), 'full')
})

test('browser amount is discarded', () => {
  assert.equal(ignoreClientAmount(9999), null)
})
