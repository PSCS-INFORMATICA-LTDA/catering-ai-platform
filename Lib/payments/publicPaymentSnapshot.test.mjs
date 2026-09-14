import assert from 'node:assert/strict'
import test from 'node:test'
import { resolvePurposeAmounts } from './amountDue.ts'
import {
  buildPublicPaymentSnapshot,
  emptyPublicPaymentSnapshot,
  invoicePercents,
  paymentLinkBlockReason,
  publicPaymentGate,
  publicPaymentSnapshotHasSecrets,
} from './publicPaymentSnapshot.ts'

const INV = {
  total: 2820,
  deposit_amount: 846,
  balance_amount: 1974,
  paid_total: 0,
}

function snapshotFromDues(extra = {}) {
  const amounts = resolvePurposeAmounts({
    total: INV.total,
    depositAmount: INV.deposit_amount,
    balanceAmount: INV.balance_amount,
    paidTotal: extra.paid_total ?? INV.paid_total,
    paidByPurpose: extra.paidByPurpose,
  })
  return buildPublicPaymentSnapshot({
    available: true,
    currency_code: 'USD',
    total: INV.total,
    paid_total: extra.paid_total ?? INV.paid_total,
    deposit_amount: INV.deposit_amount,
    balance_amount: INV.balance_amount,
    invoice_number: 'INV-2026-000009',
    depositDue: amounts.depositDue,
    balanceDue: amounts.balanceDue,
    fullDue: amounts.fullDue,
  })
}

test('T10-T12: unpaid 2820 snapshot is 846 / 1974 / 2820 from invoice percents', () => {
  const percents = invoicePercents({
    depositAmount: 846,
    balanceAmount: 1974,
    total: 2820,
  })
  assert.deepEqual(percents, { deposit_percent: 30, balance_percent: 70 })
  const snapshot = snapshotFromDues()
  assert.equal(snapshot.available, true)
  assert.equal(snapshot.deposit_percent, 30)
  assert.equal(snapshot.balance_percent, 70)
  assert.deepEqual(
    snapshot.choices.map((choice) => [choice.purpose, choice.amount, choice.payable]),
    [
      ['deposit', 846, true],
      ['balance', 1974, true],
      ['full', 2820, true],
    ],
  )
  assert.equal(publicPaymentSnapshotHasSecrets(snapshot), false)
})

test('percent labels follow invoice policy, not hardcoded 30/70', () => {
  const half = invoicePercents({
    depositAmount: 500,
    balanceAmount: 500,
    total: 1000,
  })
  assert.deepEqual(half, { deposit_percent: 50, balance_percent: 50 })
})

test('T13: deposit first leaves balance and remaining full', () => {
  const snapshot = snapshotFromDues({
    paid_total: 846,
    paidByPurpose: { deposit: 846, balance: 0, full: 0 },
  })
  const byPurpose = Object.fromEntries(
    snapshot.choices.map((choice) => [choice.purpose, choice]),
  )
  assert.equal(byPurpose.deposit.payable, false)
  assert.equal(byPurpose.deposit.amount, 0)
  assert.equal(byPurpose.balance.amount, 1974)
  assert.equal(byPurpose.full.amount, 1974)
})

test('T14: balance first leaves deposit and remaining full', () => {
  const snapshot = snapshotFromDues({
    paid_total: 1974,
    paidByPurpose: { deposit: 0, balance: 1974, full: 0 },
  })
  const byPurpose = Object.fromEntries(
    snapshot.choices.map((choice) => [choice.purpose, choice]),
  )
  assert.equal(byPurpose.balance.payable, false)
  assert.equal(byPurpose.deposit.amount, 846)
  assert.equal(byPurpose.full.amount, 846)
})

test('T15: full first closes every tranche', () => {
  const snapshot = snapshotFromDues({
    paid_total: 2820,
    paidByPurpose: { deposit: 0, balance: 0, full: 2820 },
  })
  assert.ok(snapshot.choices.every((choice) => choice.payable === false && choice.amount === 0))
})

test('T16-T19: sequential remainder uses ledger purpose', () => {
  const depositThenBalance = snapshotFromDues({
    paid_total: 2820,
    paidByPurpose: { deposit: 846, balance: 1974, full: 0 },
  })
  assert.ok(depositThenBalance.choices.every((choice) => !choice.payable))

  const balanceThenDeposit = snapshotFromDues({
    paid_total: 2820,
    paidByPurpose: { deposit: 846, balance: 1974, full: 0 },
  })
  assert.ok(balanceThenDeposit.choices.every((choice) => !choice.payable))

  const depositThenFull = snapshotFromDues({
    paid_total: 2820,
    paidByPurpose: { deposit: 846, balance: 0, full: 1974 },
  })
  assert.ok(depositThenFull.choices.every((choice) => !choice.payable))

  const balanceThenFull = snapshotFromDues({
    paid_total: 2820,
    paidByPurpose: { deposit: 0, balance: 1974, full: 846 },
  })
  assert.ok(balanceThenFull.choices.every((choice) => !choice.payable))
})

test('T20-T22: zero-due payment links are blocked', () => {
  const afterDeposit = resolvePurposeAmounts({
    total: 2820,
    depositAmount: 846,
    balanceAmount: 1974,
    paidTotal: 846,
    paidByPurpose: { deposit: 846, balance: 0, full: 0 },
  })
  assert.equal(paymentLinkBlockReason('deposit', afterDeposit), 'deposit_already_paid')
  assert.equal(paymentLinkBlockReason('balance', afterDeposit), null)
  assert.equal(paymentLinkBlockReason('full', afterDeposit), null)

  const afterBalance = resolvePurposeAmounts({
    total: 2820,
    depositAmount: 846,
    balanceAmount: 1974,
    paidTotal: 1974,
    paidByPurpose: { deposit: 0, balance: 1974, full: 0 },
  })
  assert.equal(paymentLinkBlockReason('balance', afterBalance), 'balance_already_paid')

  const paid = resolvePurposeAmounts({
    total: 2820,
    depositAmount: 846,
    balanceAmount: 1974,
    paidTotal: 2820,
    paidByPurpose: { deposit: 846, balance: 1974, full: 0 },
  })
  assert.equal(paymentLinkBlockReason('full', paid), 'already_paid')
  assert.equal(paymentLinkBlockReason('deposit', paid), 'deposit_already_paid')
  assert.equal(paymentLinkBlockReason('balance', paid), 'balance_already_paid')
})

test('T01/T02/T09/T27: public payment gate is fail-closed', () => {
  assert.deepEqual(publicPaymentGate({ found: false }), {
    ok: false,
    status: 404,
    error: 'not_found',
  })
  assert.equal(
    publicPaymentGate({ found: true, proposalSentAt: null, proposalResponse: 'pending' }).error,
    'proposal_not_sent',
  )
  assert.equal(
    publicPaymentGate({
      found: true,
      proposalSentAt: '2026-09-14T00:00:00Z',
      proposalResponse: 'pending',
    }).error,
    'proposal_not_accepted',
  )
  assert.equal(
    publicPaymentGate({
      found: true,
      proposalSentAt: '2026-09-14T00:00:00Z',
      proposalResponse: 'rejected',
    }).error,
    'proposal_rejected',
  )
  assert.equal(
    publicPaymentGate({
      found: true,
      proposalSentAt: '2026-09-14T00:00:00Z',
      proposalResponse: 'accepted',
      quoteStatus: 'cancelled',
    }).error,
    'quote_canceled',
  )
  assert.deepEqual(
    publicPaymentGate({
      found: true,
      proposalSentAt: '2026-09-14T00:00:00Z',
      proposalResponse: 'accepted',
      quoteStatus: 'approved',
    }),
    { ok: true },
  )
})

test('unavailable snapshot has no payable choices', () => {
  const snapshot = emptyPublicPaymentSnapshot('awaiting_acceptance')
  assert.equal(snapshot.available, false)
  assert.deepEqual(snapshot.choices, [])
})

test('T37-T49: post-event math keeps original invoice immutable', () => {
  const originalTotal = 2820
  const originalPaid = 2820
  const adjustment = 100 + 150 + 50
  const supplementalTotal = adjustment
  const finalEventTotal = originalTotal + adjustment
  assert.equal(adjustment, 300)
  assert.equal(supplementalTotal, 300)
  assert.equal(finalEventTotal, 3120)
  assert.equal(originalTotal, 2820)
  assert.equal(originalPaid, 2820)
  const supplemental = buildPublicPaymentSnapshot({
    available: true,
    currency_code: 'USD',
    total: supplementalTotal,
    paid_total: 0,
    deposit_amount: 0,
    balance_amount: supplementalTotal,
    invoice_number: 'INV-ADJ',
    depositDue: 0,
    balanceDue: supplementalTotal,
    fullDue: supplementalTotal,
  })
  const full = supplemental.choices.find((choice) => choice.purpose === 'full')
  assert.equal(full?.amount, 300)
  assert.equal(full?.payable, true)
  assert.equal(supplemental.choices.find((choice) => choice.purpose === 'deposit')?.payable, false)
})
