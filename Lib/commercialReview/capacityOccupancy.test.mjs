import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  classifyCapacityOccupancy,
  eventDurationMinutes,
  parseMaxConcurrentEvents,
} from './capacityOccupancy.ts'

describe('capacity occupancy', () => {
  it('reads the configured max concurrent events including the admin 4 slot', () => {
    assert.equal(parseMaxConcurrentEvents({ max_concurrent_events: 3 }), 3)
    assert.equal(
      parseMaxConcurrentEvents({
        type: 'json',
        value: JSON.stringify({ max_concurrent_events: 4 }),
      }),
      4,
    )
    assert.equal(parseMaxConcurrentEvents(null), 1)
  })

  it('classifies available, attention and blocked from the existing capacity rule', () => {
    const base = {
      eventDate: '2026-10-10',
      startTime: '12:00',
      endTime: '16:00',
      thisQuoteReserved: false,
    }
    assert.equal(
      classifyCapacityOccupancy({ ...base, capacity: 3, reservedCount: 0 }).state,
      'available',
    )
    assert.equal(
      classifyCapacityOccupancy({ ...base, capacity: 3, reservedCount: 2 }).state,
      'attention',
    )
    assert.equal(
      classifyCapacityOccupancy({ ...base, capacity: 3, reservedCount: 3 }).state,
      'blocked',
    )
    assert.equal(
      classifyCapacityOccupancy({
        ...base,
        capacity: 3,
        reservedCount: 2,
        thisQuoteReserved: true,
      }).reservedCount,
      3,
    )
    assert.equal(
      classifyCapacityOccupancy({
        eventDate: null,
        startTime: null,
        endTime: null,
        capacity: 3,
        reservedCount: 0,
        thisQuoteReserved: false,
      }).state,
      'unknown',
    )
  })

  it('derives duration from the persisted start and end times', () => {
    assert.equal(eventDurationMinutes('12:00', '16:00'), 240)
    assert.equal(eventDurationMinutes('12:00', null), null)
  })
})
