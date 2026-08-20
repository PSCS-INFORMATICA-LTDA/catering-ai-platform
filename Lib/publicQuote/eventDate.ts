/** CDL public quotes are booked in US Eastern, not the Vercel UTC clock. */
export const PUBLIC_QUOTE_EVENT_TIMEZONE = 'America/New_York'

export function calendarDateInTimeZone(
  timeZone = PUBLIC_QUOTE_EVENT_TIMEZONE,
  now: Date = new Date(),
): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const year = parts.find((part) => part.type === 'year')?.value
  const month = parts.find((part) => part.type === 'month')?.value
  const day = parts.find((part) => part.type === 'day')?.value
  return `${year}-${month}-${day}`
}

export function isPublicEventDateBookable(
  value: string,
  now: Date = new Date(),
): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  return value >= calendarDateInTimeZone(PUBLIC_QUOTE_EVENT_TIMEZONE, now)
}
