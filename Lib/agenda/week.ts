/** Semana da agenda (segunda → domingo), padrão Logistics. */

export function toDayKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function parseDayKey(dayKey: string): Date {
  const [y, m, d] = dayKey.split('-').map(Number)
  return new Date(y!, m! - 1, d!, 12, 0, 0, 0)
}

/** Segunda-feira da semana que contém `anchor`. */
export function startOfWeekMonday(anchor: Date): Date {
  const d = new Date(anchor)
  d.setHours(12, 0, 0, 0)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d
}

export function weekDayKeys(weekStart: Date): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart)
    d.setDate(weekStart.getDate() + i)
    return toDayKey(d)
  })
}

export function shiftWeek(weekStart: Date, weeks: number): Date {
  const d = new Date(weekStart)
  d.setDate(d.getDate() + weeks * 7)
  return d
}

const WEEKDAY_PT = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

export function dayLabel(dayKey: string): string {
  const d = parseDayKey(dayKey)
  const wd = d.getDay()
  const idx = wd === 0 ? 6 : wd - 1
  return `${WEEKDAY_PT[idx]} ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function timeToMinutes(time: string): number {
  const raw = time.length >= 5 ? time.slice(0, 5) : time
  const [h, m] = raw.split(':').map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}

export function formatMinutes(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}
