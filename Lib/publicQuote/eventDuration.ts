import { SERVICE_DURATION_HOURS } from '@/Lib/cdlCommercialRules'

const MINUTES_PER_DAY = 24 * 60
const MIN_SERVICE_MINUTES = 30
const MAX_SERVICE_MINUTES = MINUTES_PER_DAY

export function defaultServiceDurationMinutes(): number {
  return SERVICE_DURATION_HOURS * 60
}

export function resolveServiceDurationMinutes(
  configuredMinutes?: number | null,
): number {
  if (
    typeof configuredMinutes === 'number' &&
    Number.isFinite(configuredMinutes) &&
    configuredMinutes >= MIN_SERVICE_MINUTES &&
    configuredMinutes <= MAX_SERVICE_MINUTES
  ) {
    return Math.round(configuredMinutes)
  }
  return defaultServiceDurationMinutes()
}

function parseTimeParts(value: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(value.trim())
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) return null
  return { hours, minutes }
}

function toTimeValue(hours: number, minutes: number) {
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

export function addMinutesToTime(time: string, minutesToAdd: number): string {
  const parsed = parseTimeParts(time)
  if (!parsed) return ''
  const totalMinutes =
    parsed.hours * 60 + parsed.minutes + Math.round(minutesToAdd)
  const normalized =
    ((totalMinutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY
  return toTimeValue(Math.floor(normalized / 60), normalized % 60)
}

export function deriveEventEndTime(
  startTime: string,
  durationMinutes?: number | null,
): string {
  if (!startTime.trim()) return ''
  return addMinutesToTime(
    startTime,
    resolveServiceDurationMinutes(durationMinutes),
  )
}

export function isValidEventTimeWindow(startTime: string, endTime: string) {
  const start = parseTimeParts(startTime)
  const end = parseTimeParts(endTime)
  if (!start || !end) return false
  const startMinutes = start.hours * 60 + start.minutes
  const endMinutes = end.hours * 60 + end.minutes
  return startMinutes !== endMinutes
}
