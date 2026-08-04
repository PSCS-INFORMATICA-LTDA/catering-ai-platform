import type { AgendaEvent, AgendaEventStatus, OperationalTeam } from '@/Lib/agenda/types'

/** Eventos que fecham o dia da equipe (não pode outro evento na mesma data). */
export function statusBlocksTeamDay(status: AgendaEventStatus | string): boolean {
  return status === 'scheduled' || status === 'completed'
}

export function teamHasBookingOnDate(
  events: Pick<AgendaEvent, 'id' | 'team_id' | 'event_date' | 'status'>[],
  teamId: string,
  dayKey: string,
  excludeEventId?: string | null,
): boolean {
  return events.some(
    (e) =>
      e.team_id === teamId &&
      e.event_date === dayKey &&
      statusBlocksTeamDay(e.status) &&
      (!excludeEventId || e.id !== excludeEventId),
  )
}

export function availableTeamsForDate(
  teams: OperationalTeam[],
  events: Pick<AgendaEvent, 'id' | 'team_id' | 'event_date' | 'status'>[],
  dayKey: string,
  excludeEventId?: string | null,
): OperationalTeam[] {
  if (!dayKey) return teams
  return teams.filter(
    (t) => !teamHasBookingOnDate(events, t.id, dayKey, excludeEventId),
  )
}

export const TEAM_DAY_BUSY_MESSAGE =
  'Esta equipe já tem evento nesta data (dia fechado). Escolha outro dia livre (ex.: domingo, dia útil ou feriado) ou outra equipe disponível.'
