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
 * Colunas visíveis do quadro: sempre segunda → domingo (semana completa).
 * Dias passados permanecem visíveis (busca de OS/ordens na agenda).
 * O destaque de “hoje” fica a cargo da UI.
 */
export function visibleWeekDayKeys(
  anchor: Date,
  _todayKey: string = todayDayKey(),
): string[] {
  return weekDayKeys(anchor)
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

/** Primeiro dia do mês (mês 0–11). */
export function startOfMonth(year: number, monthIndex: number): Date {
  return new Date(year, monthIndex, 1, 12, 0, 0, 0)
}

/** Último dia do mês (mês 0–11). */
export function endOfMonth(year: number, monthIndex: number): Date {
  return new Date(year, monthIndex + 1, 0, 12, 0, 0, 0)
}

/** Dias inclusivos entre fromKey e toKey (máx. `maxDays`, padrão 366). */
export function dayKeysInRange(
  fromKey: string,
  toKey: string,
  maxDays = 366,
): string[] {
  if (!fromKey || !toKey || fromKey > toKey) return []
  const keys: string[] = []
  let cursor = parseDayKey(fromKey)
  const end = parseDayKey(toKey)
  while (cursor <= end && keys.length < maxDays) {
    keys.push(toDayKey(cursor))
    cursor = new Date(
      cursor.getFullYear(),
      cursor.getMonth(),
      cursor.getDate() + 1,
      12,
      0,
      0,
      0,
    )
  }
  return keys
}

/** Diferença inclusiva em dias (from→to). */
export function inclusiveDaySpan(fromKey: string, toKey: string): number {
  if (!fromKey || !toKey || fromKey > toKey) return 0
  const a = parseDayKey(fromKey)
  const b = parseDayKey(toKey)
  return Math.round((b.getTime() - a.getTime()) / 86_400_000) + 1
}

export function formatRangeLabel(fromKey: string, toKey: string): string {
  if (!fromKey || !toKey) return ''
  const fmt = (key: string) =>
    parseDayKey(key).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  return `${fmt(fromKey)} — ${fmt(toKey)}`
}

export const AGENDA_MONTH_OPTIONS = [
  { value: 0, label: 'Janeiro' },
  { value: 1, label: 'Fevereiro' },
  { value: 2, label: 'Março' },
  { value: 3, label: 'Abril' },
  { value: 4, label: 'Maio' },
  { value: 5, label: 'Junho' },
  { value: 6, label: 'Julho' },
  { value: 7, label: 'Agosto' },
  { value: 8, label: 'Setembro' },
  { value: 9, label: 'Outubro' },
  { value: 10, label: 'Novembro' },
  { value: 11, label: 'Dezembro' },
] as const
