import {
  combineEventDateTime,
  getOperationalBlockedUntil,
} from '../agenda/scheduleTurnaround.ts'

export type CapacityState = 'available' | 'attention' | 'blocked' | 'unknown'

export type CapacityOccupancyInput = {
  eventDate?: string | null
  startTime?: string | null
  endTime?: string | null
  capacity: number
  reservedCount: number
  thisQuoteReserved: boolean
}

export type CapacityOccupancy = {
  state: CapacityState
  capacity: number
  reservedCount: number
  thisQuoteReserved: boolean
  hasEventWindow: boolean
}

export function parseMaxConcurrentEvents(ruleValue: unknown): number {
  let data: unknown = ruleValue
  if (typeof ruleValue === 'string') {
    try {
      data = JSON.parse(ruleValue)
    } catch {
      return 1
    }
  }
  if (!data || typeof data !== 'object') return 1
  const obj = data as Record<string, unknown>
  if (obj.type === 'json' || obj.value != null) {
    const nested = parseMaxConcurrentEvents(obj.value)
    if (nested >= 1) return nested
  }
  const raw = Number(obj.max_concurrent_events ?? 1)
  if (!Number.isFinite(raw)) return 1
  return Math.max(1, Math.min(20, Math.floor(raw)))
}

export function intervalsOverlapWithGap(
  candidateStart: Date,
  candidateEnd: Date,
  otherStart: Date,
  otherEnd: Date,
  gapMinutes: number,
): boolean {
  const gap = Math.max(0, Math.floor(gapMinutes))
  const otherBlockedUntil = getOperationalBlockedUntil(otherEnd, gap)
  const candidateBlockedUntil = getOperationalBlockedUntil(candidateEnd, gap)
  return (
    otherStart.getTime() < candidateBlockedUntil.getTime() &&
    candidateStart.getTime() < otherBlockedUntil.getTime()
  )
}

export function classifyCapacityOccupancy(
  input: CapacityOccupancyInput,
): CapacityOccupancy {
  const hasEventWindow = Boolean(
    input.eventDate && input.startTime && input.endTime,
  )
  const capacity = Math.max(1, Math.min(20, Math.floor(Number(input.capacity) || 1)))
  const reservedOthers = Math.max(0, Math.floor(Number(input.reservedCount) || 0))
  const thisQuoteReserved = Boolean(input.thisQuoteReserved)
  const reservedCount = reservedOthers + (thisQuoteReserved ? 1 : 0)

  if (!hasEventWindow) {
    return {
      state: 'unknown',
      capacity,
      reservedCount,
      thisQuoteReserved,
      hasEventWindow: false,
    }
  }

  let state: CapacityState = 'available'
  if (reservedCount >= capacity) state = 'blocked'
  else if (capacity - reservedCount === 1) state = 'attention'

  return {
    state,
    capacity,
    reservedCount,
    thisQuoteReserved,
    hasEventWindow: true,
  }
}

export function eventDurationMinutes(
  startTime?: string | null,
  endTime?: string | null,
): number | null {
  if (!startTime || !endTime) return null
  const start = combineEventDateTime('2000-01-01', startTime)
  const end = combineEventDateTime('2000-01-01', endTime)
  const minutes = Math.round((end.getTime() - start.getTime()) / 60_000)
  return minutes > 0 ? minutes : null
}

export function occupancyWindow(input: {
  eventDate: string
  startTime: string
  endTime: string
}) {
  return {
    start: combineEventDateTime(input.eventDate, input.startTime),
    end: combineEventDateTime(input.eventDate, input.endTime),
  }
}
