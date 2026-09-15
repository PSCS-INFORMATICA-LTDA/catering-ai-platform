import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  normalizeCompanyTimezone,
  resolveEventStartInstant,
  zonedCivilToUtcMs,
} from './eventInstant.ts'

describe('event instant in company timezone', () => {
  it('resolves America/New_York winter 12:00 as 17:00 UTC', () => {
    const ms = zonedCivilToUtcMs({
      date: '2026-12-06',
      time: '12:00',
      timeZone: 'America/New_York',
    })
    assert.equal(new Date(ms).toISOString(), '2026-12-06T17:00:00.000Z')
  })

  it('resolves America/New_York summer 12:00 as 16:00 UTC', () => {
    const ms = zonedCivilToUtcMs({
      date: '2026-07-04',
      time: '12:00:00',
      timeZone: 'America/New_York',
    })
    assert.equal(new Date(ms).toISOString(), '2026-07-04T16:00:00.000Z')
  })

  it('uses start of civil day when time is missing', () => {
    const resolved = resolveEventStartInstant({
      date: '2026-09-15',
      startTime: null,
      timeZone: 'America/New_York',
    })
    assert.equal(resolved.ok, true)
    assert.equal(resolved.iso, '2026-09-15T04:00:00.000Z')
  })

  it('fails closed without an event date', () => {
    const resolved = resolveEventStartInstant({
      date: null,
      startTime: '11:00',
      timeZone: 'America/New_York',
    })
    assert.deepEqual(resolved, { ok: false, reason: 'event_start_unknown' })
  })

  it('falls back to America/New_York for invalid IANA zones', () => {
    assert.equal(normalizeCompanyTimezone('Not/AZone'), 'America/New_York')
  })
})
