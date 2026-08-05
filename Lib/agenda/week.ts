/** Semana da agenda (segunda → domingo), padrão Logistics / LogRx. */

/** Fuso operacional da agenda (evita dia errado no SSR UTC da Vercel). */
export const AGENDA_TIMEZONE = 'America/Sao_Paulo'

export function toDayKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Data civil de “hoje” no fuso da agenda (não usa o timezone do servidor). */
export function todayDayKey(timeZone: string = AGENDA_TIMEZONE): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

export function parseDayKey(dayKey: string): Date {
  const [y, m, d] = dayKey.split('-').map(Number)
  return new Date(y!, (m ?? 1) - 1, d ?? 1, 12, 0, 0, 0)
}

/** Segunda-feira da semana que contém `anchor` (igual Logistics). */
export function startOfWeekMonday(anchor: Date): Date {
  const d = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate())
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d
}

export function startOfWeekMondayFromDayKey(dayKey: string): Date {
  return startOfWeekMonday(parseDayKey(dayKey))
}

/**
 * Sete chaves YYYY-MM-DD da semana (seg→dom) que contém `anchor`.
 * Aceita qualquer dia da semana — igual `weekDayKeys` do Logistics.
 */
export function weekDayKeys(anchor: Date): string[] {
  const start = startOfWeekMonday(anchor)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return toDayKey(d)
  })
}

/**
 * Colunas visíveis do quadro.
 * Na semana atual, omite dias já passados (hoje em diante) — evita “dia 3”
 * quando hoje é dia 4. Semanas futuras/passadas mostram seg→dom completo.
 */
export function visibleWeekDayKeys(
  anchor: Date,
  todayKey: string = todayDayKey(),
): string[] {
  const keys = weekDayKeys(anchor)
  const weekStartKey = keys[0]!
  const currentWeekStartKey = toDayKey(startOfWeekMondayFromDayKey(todayKey))
  if (weekStartKey !== currentWeekStartKey) return keys
  return keys.filter((key) => key >= todayKey)
}

export function shiftWeek(anchor: Date, weeks: number): Date {
  const d = new Date(anchor)
  d.setDate(d.getDate() + weeks * 7)
  return d
}

export function formatWeekRangeLabel(
  anchor: Date,
  todayKey: string = todayDayKey(),
): string {
  const keys = visibleWeekDayKeys(anchor, todayKey)
  const first = parseDayKey(keys[0]!)
  const last = parseDayKey(keys[keys.length - 1]!)
  const fmt = (dt: Date) =>
    dt.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  return `${fmt(first)} — ${fmt(last)}`
}

/** Deep-link para Nova cotação com data/horário da célula da agenda. */
export function buildAgendaQuoteHref(opts: {
  eventDate: string
  startTime?: string
  endTime?: string
  eventName?: string
}): string {
  const params = new URLSearchParams()
  params.set('from', 'agenda')
  if (opts.eventDate) params.set('event_date', opts.eventDate)
  if (opts.startTime) params.set('start_time', opts.startTime.slice(0, 5))
  if (opts.endTime) params.set('end_time', opts.endTime.slice(0, 5))
  if (opts.eventName?.trim()) params.set('event_name', opts.eventName.trim())
  return `/quotes/new?${params.toString()}`
}

/** Rótulo no estilo Logistics: weekday curto + dd/mm. */
export function dayLabelParts(dayKey: string): { weekday: string; date: string } {
  const d = parseDayKey(dayKey)
  return {
    weekday: d
      .toLocaleDateString('pt-BR', { weekday: 'short' })
      .replace('.', ''),
    date: d.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
    }),
  }
}

export function dayLabel(dayKey: string): string {
  const { weekday, date } = dayLabelParts(dayKey)
  return `${weekday} ${date}`
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
