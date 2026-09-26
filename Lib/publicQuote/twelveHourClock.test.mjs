import assert from 'node:assert/strict'
import test from 'node:test'
import {
  formatPublicClock,
  from24Hour,
  to24Hour,
} from './twelveHourClock.ts'

test('12:00 AM -> 00:00', () => {
  assert.equal(to24Hour(12, 'AM'), 0)
  assert.equal(formatPublicClock('00:00'), '12:00 AM')
})

test('12:00 PM -> 12:00', () => {
  assert.equal(to24Hour(12, 'PM'), 12)
  assert.equal(formatPublicClock('12:00'), '12:00 PM')
})

test('1:00 PM -> 13:00', () => {
  assert.equal(to24Hour(1, 'PM'), 13)
  assert.equal(formatPublicClock('13:00'), '1:00 PM')
})

test('11:45 PM -> 23:45', () => {
  assert.equal(to24Hour(11, 'PM'), 23)
  assert.equal(formatPublicClock('23:45'), '11:45 PM')
})

test('round trip 0-23', () => {
  for (let hour = 0; hour < 24; hour += 1) {
    const parts = from24Hour(hour)
    assert.equal(to24Hour(parts.hour12, parts.period), hour)
  }
})
