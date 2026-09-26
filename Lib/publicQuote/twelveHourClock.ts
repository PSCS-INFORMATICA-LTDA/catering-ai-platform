/** Public clock. Persistence stays HH:mm 24-hour. */

export function formatPublicClock(value: string | null | undefined): string {
  const parsed = parse24Hour(value)
  if (!parsed) return value?.trim() ? value : '—'
  const { hour12, period } = from24Hour(parsed.hours)
  return `${hour12}:${String(parsed.minutes).padStart(2, '0')} ${period}`
}

export function parse24Hour(
  value: string | null | undefined,
): { hours: number; minutes: number } | null {
  if (!value) return null
  const match = value.trim().match(/^(\d{1,2}):(\d{2})/)
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null
  return { hours, minutes }
}

export function from24Hour(hours: number): { hour12: number; period: 'AM' | 'PM' } {
  const period = hours >= 12 ? 'PM' : 'AM'
  const hour12 = hours % 12 === 0 ? 12 : hours % 12
  return { hour12, period }
}

export function to24Hour(hour12: number, period: 'AM' | 'PM'): number {
  const normalized = hour12 === 12 ? 0 : hour12
  return period === 'PM' ? normalized + 12 : normalized
}

export const PUBLIC_HOUR12_OPTIONS = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] as const
