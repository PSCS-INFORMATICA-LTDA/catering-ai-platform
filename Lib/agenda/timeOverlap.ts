/**
 * Conflito de horários — intervalo semiaberto [start, end).
 * 10:00–14:00 e 14:00–18:00 → sem overlap.
 * 10:00–14:00 e 13:00–18:00 → conflito.
 */

export type Timeable = {
  start_time: string
  end_time: string
}

/** Converte HH:MM ou HH:MM:SS para minutos desde meia-noite. */
export function timeToMinutes(value: string): number {
  const parts = value.trim().slice(0, 8).split(':').map((p) => Number(p))
  const h = parts[0] ?? 0
  const m = parts[1] ?? 0
  if (!Number.isFinite(h) || !Number.isFinite(m)) return NaN
  return h * 60 + m
}

/** true se [aStart, aEnd) intersecta [bStart, bEnd). */
export function intervalsOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean {
  const as = timeToMinutes(aStart)
  const ae = timeToMinutes(aEnd)
  const bs = timeToMinutes(bStart)
  const be = timeToMinutes(bEnd)
  if ([as, ae, bs, be].some((n) => !Number.isFinite(n))) return false
  if (!(ae > as) || !(be > bs)) return false
  return as < be && ae > bs
}

export function eventsOverlapOnSameDay(
  a: Timeable & { event_date: string; status?: string },
  b: Timeable & { event_date: string; status?: string },
): boolean {
  if (a.event_date !== b.event_date) return false
  return intervalsOverlap(a.start_time, a.end_time, b.start_time, b.end_time)
}

export const TEAM_TIME_OVERLAP_MESSAGE =
  'Esta equipe já tem evento com horário sobreposto neste dia. Ajuste o intervalo ou escolha outra equipe.'

export const PERSON_TIME_OVERLAP_MESSAGE =
  'Integrante já escalado em outro evento com horário sobreposto neste dia.'
