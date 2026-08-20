/**
 * Espelho JS de Lib/agenda/scheduleTurnaround.ts para testes DEV.
 */

export const DEFAULT_SCHEDULE_TURNAROUND_CONFIG = {
  enabled: true,
  base_radius_miles: 20,
  min_gap_minutes: 0,
  outside_radius_policy: 'manual_review',
}

export const CDL_SCHEDULE_TURNAROUND_CONFIG = {
  enabled: true,
  base_radius_miles: 20,
  min_gap_minutes: 120,
  outside_radius_policy: 'manual_review',
}

function pad2(n) {
  return String(n).padStart(2, '0')
}

export function combineEventDateTime(date, time) {
  const [y, mo, d] = date.split('-').map(Number)
  const parts = time.trim().slice(0, 8).split(':').map(Number)
  return new Date(y, (mo ?? 1) - 1, d ?? 1, parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0, 0)
}

export function formatTimeHHMM(date) {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`
}

export function getOperationalBlockedUntil(eventEndAt, minGapMinutes) {
  const gap = Math.max(0, Math.floor(minGapMinutes))
  return new Date(eventEndAt.getTime() + gap * 60_000)
}

export function canScheduleNextEvent(previousEvent, nextEvent, config, options = {}) {
  const scope = options.scope ?? 'team'
  const cfg =
    config?.enabled === false
      ? { ...DEFAULT_SCHEDULE_TURNAROUND_CONFIG, min_gap_minutes: 0 }
      : config || DEFAULT_SCHEDULE_TURNAROUND_CONFIG

  const prevStart = combineEventDateTime(previousEvent.event_date, previousEvent.start_time)
  const prevEnd = combineEventDateTime(previousEvent.event_date, previousEvent.end_time)
  const nextStart = combineEventDateTime(nextEvent.event_date, nextEvent.start_time)
  const nextEnd = combineEventDateTime(nextEvent.event_date, nextEvent.end_time)

  const dist = nextEvent.distance_miles ?? previousEvent.distance_miles ?? null
  if (
    dist != null &&
    Number.isFinite(dist) &&
    dist > cfg.base_radius_miles &&
    cfg.outside_radius_policy === 'manual_review'
  ) {
    return {
      code: 'DISTANCE_REQUIRES_REVIEW',
      blockedUntil: null,
      nextAvailableStart: null,
      minGapMinutes: cfg.min_gap_minutes,
    }
  }

  const blockedUntil = getOperationalBlockedUntil(prevEnd, cfg.min_gap_minutes)
  const overlap =
    prevStart.getTime() < nextEnd.getTime() && prevEnd.getTime() > nextStart.getTime()

  if (overlap) {
    return {
      code: 'EVENT_TIME_OVERLAP',
      blockedUntil: formatTimeHHMM(blockedUntil),
      nextAvailableStart: formatTimeHHMM(blockedUntil),
      minGapMinutes: cfg.min_gap_minutes,
    }
  }

  if (nextStart >= prevEnd) {
    if (nextStart.getTime() < blockedUntil.getTime() && cfg.min_gap_minutes > 0) {
      return {
        code:
          scope === 'person'
            ? 'PERSON_TURNAROUND_CONFLICT'
            : 'TEAM_TURNAROUND_CONFLICT',
        blockedUntil: formatTimeHHMM(blockedUntil),
        nextAvailableStart: formatTimeHHMM(blockedUntil),
        minGapMinutes: cfg.min_gap_minutes,
      }
    }
    return null
  }

  const nextBlocked = getOperationalBlockedUntil(nextEnd, cfg.min_gap_minutes)
  if (prevStart >= nextEnd) {
    if (prevStart.getTime() < nextBlocked.getTime() && cfg.min_gap_minutes > 0) {
      return {
        code:
          scope === 'person'
            ? 'PERSON_TURNAROUND_CONFLICT'
            : 'TEAM_TURNAROUND_CONFLICT',
        blockedUntil: formatTimeHHMM(nextBlocked),
        nextAvailableStart: formatTimeHHMM(nextBlocked),
        minGapMinutes: cfg.min_gap_minutes,
      }
    }
  }

  return null
}
