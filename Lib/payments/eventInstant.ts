const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/
export const DEFAULT_COMPANY_TIMEZONE = 'America/New_York'

export function normalizeCompanyTimezone(value: string | null | undefined): string {
  const timeZone = String(value || '').trim() || DEFAULT_COMPANY_TIMEZONE
  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format(new Date())
    return timeZone
  } catch {
    return DEFAULT_COMPANY_TIMEZONE
  }
}

export function parseEventTimeParts(
  value: string | null | undefined,
): { hour: number; minute: number; second: number } | null {
  if (value == null || String(value).trim() === '') {
    return { hour: 0, minute: 0, second: 0 }
  }
  const match = String(value)
    .trim()
    .match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/)
  if (!match) return null
  const hour = Number(match[1])
  const minute = Number(match[2])
  const second = Number(match[3] || 0)
  if (hour > 23 || minute > 59 || second > 59) return null
  return { hour, minute, second }
}

function wallClockAsUtcMs(
  instantMs: number,
  timeZone: string,
): number | null {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(instantMs))
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value)
  const year = read('year')
  const month = read('month')
  const day = read('day')
  const hour = read('hour')
  const minute = read('minute')
  const second = read('second')
  if (![year, month, day, hour, minute, second].every(Number.isFinite)) return null
  return Date.UTC(year, month - 1, day, hour, minute, second)
}

export function zonedCivilToUtcMs(input: {
  date: string
  time?: string | null
  timeZone: string
}): number | null {
  const dateMatch = DATE_RE.exec(String(input.date || '').trim())
  if (!dateMatch) return null
  const time = parseEventTimeParts(input.time)
  if (!time) return null
  const timeZone = normalizeCompanyTimezone(input.timeZone)
  const intended = Date.UTC(
    Number(dateMatch[1]),
    Number(dateMatch[2]) - 1,
    Number(dateMatch[3]),
    time.hour,
    time.minute,
    time.second,
  )
  const firstWall = wallClockAsUtcMs(intended, timeZone)
  if (firstWall == null) return null
  let instant = intended - (firstWall - intended)
  const drifted = wallClockAsUtcMs(instant, timeZone)
  if (drifted == null) return null
  const drift = drifted - intended
  if (drift !== 0) instant -= drift
  return Number.isFinite(instant) ? instant : null
}

export function resolveEventStartInstant(input: {
  date?: string | null
  startTime?: string | null
  timeZone: string
}): { ok: true; ms: number; iso: string } | { ok: false; reason: 'event_start_unknown' } {
  if (!input.date) return { ok: false, reason: 'event_start_unknown' }
  const ms = zonedCivilToUtcMs({
    date: input.date,
    time: input.startTime,
    timeZone: input.timeZone,
  })
  if (ms == null) return { ok: false, reason: 'event_start_unknown' }
  return { ok: true, ms, iso: new Date(ms).toISOString() }
}
