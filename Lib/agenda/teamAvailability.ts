import type { AgendaEvent, AgendaEventStatus, OperationalTeam } from '@/Lib/agenda/types'
import {
  findTeamTimeConflict,
  TEAM_TIME_OVERLAP_MESSAGE,
} from '@/Lib/agenda/scheduleConflicts'

/** Eventos que ocupam a equipe (conflito por overlap de horário). */
export function statusBlocksTeamDay(status: AgendaEventStatus | string): boolean {
  return status === 'scheduled' || status === 'completed'
}

/**
 * @deprecated Preferir findTeamTimeConflict — multi-evento no mesmo dia é permitido
 * sem overlap de horário.
 */
export function teamHasBookingOnDate(
  events: Pick<
    AgendaEvent,
    'id' | 'team_id' | 'event_date' | 'status' | 'start_time' | 'end_time'
  >[],
  teamId: string,
  dayKey: string,
  excludeEventId?: string | null,
  startTime?: string | null,
  endTime?: string | null,
): boolean {
  if (startTime && endTime) {
    return Boolean(
      findTeamTimeConflict(
        events.map((e) => ({
          id: e.id,
          team_id: e.team_id,
          event_date: e.event_date,
          start_time: e.start_time,
          end_time: e.end_time,
          status: e.status,
        })),
        teamId,
        dayKey,
        startTime,
        endTime,
        excludeEventId,
      ),
    )
  }
  // Sem horário: qualquer evento ativo no dia (compatibilidade limitada).
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
  events: Pick<
    AgendaEvent,
    'id' | 'team_id' | 'event_date' | 'status' | 'start_time' | 'end_time'
  >[],
  dayKey: string,
  excludeEventId?: string | null,
  startTime?: string | null,
  endTime?: string | null,
): OperationalTeam[] {
  if (!dayKey) return teams
  if (startTime && endTime) {
    const mapped = events.map((e) => ({
      id: e.id,
      team_id: e.team_id,
      event_date: e.event_date,
      start_time: e.start_time,
      end_time: e.end_time,
      status: e.status,
    }))
    return teams.filter(
      (t) =>
        !findTeamTimeConflict(
          mapped,
          t.id,
          dayKey,
          startTime,
          endTime,
          excludeEventId,
        ),
    )
  }
  return teams.filter(
    (t) => !teamHasBookingOnDate(events, t.id, dayKey, excludeEventId),
  )
}

/** Mensagem canônica de conflito por horário (substitui dia fechado). */
export const TEAM_DAY_BUSY_MESSAGE = TEAM_TIME_OVERLAP_MESSAGE
