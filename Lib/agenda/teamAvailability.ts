import type { AgendaEvent, AgendaEventStatus, OperationalTeam } from '@/Lib/agenda/types'
import {
  findTeamTimeConflict,
  TEAM_TIME_OVERLAP_MESSAGE,
} from '@/Lib/agenda/scheduleConflicts'
import {
  DEFAULT_SCHEDULE_TURNAROUND_CONFIG,
  type ScheduleTurnaroundConfig,
} from '@/Lib/agenda/scheduleTurnaround'

/** Eventos que ocupam a equipe (conflito por overlap + janela operacional). */
export function statusBlocksTeamDay(status: AgendaEventStatus | string): boolean {
  return status === 'reserved' || status === 'scheduled' || status === 'completed'
}

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
  config: ScheduleTurnaroundConfig = DEFAULT_SCHEDULE_TURNAROUND_CONFIG,
): boolean {
  if (!startTime || !endTime) {
    return events.some(
      (e) =>
        e.team_id === teamId &&
        e.event_date === dayKey &&
        statusBlocksTeamDay(e.status) &&
        (!excludeEventId || e.id !== excludeEventId),
    )
  }
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
      config,
    ),
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
  config: ScheduleTurnaroundConfig = DEFAULT_SCHEDULE_TURNAROUND_CONFIG,
): OperationalTeam[] {
  if (!dayKey) return teams
  return teams.filter(
    (t) =>
      !teamHasBookingOnDate(
        events,
        t.id,
        dayKey,
        excludeEventId,
        startTime,
        endTime,
        config,
      ),
  )
}

export const TEAM_DAY_BUSY_MESSAGE = TEAM_TIME_OVERLAP_MESSAGE
