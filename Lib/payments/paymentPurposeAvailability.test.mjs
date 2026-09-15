import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  isPurposeAvailable,
  resolvePaymentPurposeAvailability,
} from './paymentPurposeAvailability.ts'

const TZ = 'America/New_York'
const EVENT = { date: '2026-09-30', startTime: '11:00:00' }
const START = new Date('2026-09-30T15:00:00.000Z')

describe('payment purpose availability', () => {
  it('after accept and before event: deposit+full open, balance locked', () => {
    const availability = resolvePaymentPurposeAvailability({
      invoiceKind: 'original',
      depositDue: 958.86,
      balanceDue: 2089.04,
      fullDue: 3047.9,
      eventDate: EVENT.date,
      eventStartTime: EVENT.startTime,
      companyTimezone: TZ,
      now: new Date(START.getTime() - 1000),
    })
    assert.equal(availability.depositAvailable, true)
    assert.equal(availability.fullAvailable, true)
    assert.equal(availability.balanceAvailable, false)
    assert.equal(availability.reason, 'balance_not_available_yet')
    assert.equal(availability.balanceAvailableAt, '2026-09-30T15:00:00.000Z')
    assert.equal(isPurposeAvailable(availability, 'deposit'), true)
    assert.equal(isPurposeAvailable(availability, 'full'), true)
    assert.equal(isPurposeAvailable(availability, 'balance'), false)
  })

  it('one second before event start keeps balance blocked', () => {
    const availability = resolvePaymentPurposeAvailability({
      invoiceKind: 'original',
      depositDue: 0,
      balanceDue: 2089.04,
      fullDue: 2089.04,
      eventDate: EVENT.date,
      eventStartTime: EVENT.startTime,
      companyTimezone: TZ,
      now: new Date(START.getTime() - 1000),
    })
    assert.equal(availability.balanceAvailable, false)
  })

  it('at event start the contractual balance becomes available', () => {
    const availability = resolvePaymentPurposeAvailability({
      invoiceKind: 'original',
      depositDue: 0,
      balanceDue: 2089.04,
      fullDue: 2089.04,
      eventDate: EVENT.date,
      eventStartTime: EVENT.startTime,
      companyTimezone: TZ,
      now: START,
    })
    assert.equal(availability.balanceAvailable, true)
    assert.equal(availability.reason, null)
  })

  it('after the event an unpaid original balance remains collectible', () => {
    const availability = resolvePaymentPurposeAvailability({
      invoiceKind: 'original',
      depositDue: 0,
      balanceDue: 2089.04,
      fullDue: 2089.04,
      eventDate: EVENT.date,
      eventStartTime: EVENT.startTime,
      companyTimezone: TZ,
      now: new Date('2026-10-01T16:00:00.000Z'),
    })
    assert.equal(availability.balanceAvailable, true)
  })

  it('does not lock post-event supplemental invoices', () => {
    const availability = resolvePaymentPurposeAvailability({
      invoiceKind: 'post_event_adjustment',
      depositDue: 0,
      balanceDue: 300,
      fullDue: 300,
      eventDate: EVENT.date,
      eventStartTime: EVENT.startTime,
      companyTimezone: TZ,
      now: new Date(START.getTime() - 60_000),
    })
    assert.equal(availability.balanceAvailable, true)
    assert.equal(availability.fullAvailable, true)
  })

  it('fails closed when the frozen event start cannot be resolved', () => {
    const availability = resolvePaymentPurposeAvailability({
      invoiceKind: 'original',
      depositDue: 100,
      balanceDue: 200,
      fullDue: 300,
      eventDate: null,
      eventStartTime: '11:00',
      companyTimezone: TZ,
      now: new Date(),
    })
    assert.equal(availability.balanceAvailable, false)
    assert.equal(availability.reason, 'event_start_unknown')
    assert.equal(availability.depositAvailable, true)
  })
})
