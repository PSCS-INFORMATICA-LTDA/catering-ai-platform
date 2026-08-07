import {
  intervalsOverlap,
  PERSON_TIME_OVERLAP_MESSAGE,
  TEAM_TIME_OVERLAP_MESSAGE,
} from '@/Lib/agenda/timeOverlap'

export type ScheduleEventLike = {
  id: string
  team_id: string
  event_date: string
  start_time: string
  end_time: string
  status: string
}

export type MemberAssignmentLike = {
  person_id: string
  team_id: string
  agenda_event_id: string
  status: string
}

function statusBlocksSchedule(status: string): boolean {
  return status === 'scheduled' || status === 'completed'
}

function confirmationBlocksPerson(status: string): boolean {
  return status === 'pending' || status === 'confirmed'
}

/** Conflito de equipe no mesmo dia com overlap de horário [start,end). */
export function findTeamTimeConflict(
  events: ScheduleEventLike[],
  teamId: string,
  eventDate: string,
  startTime: string,
  endTime: string,
  excludeEventId?: string | null,
): ScheduleEventLike | null {
  for (const e of events) {
    if (e.team_id !== teamId) continue
    if (e.event_date !== eventDate) continue
    if (!statusBlocksSchedule(e.status)) continue
    if (excludeEventId && e.id === excludeEventId) continue
    if (intervalsOverlap(startTime, endTime, e.start_time, e.end_time)) {
      return e
    }
  }
  return null
}

/**
 * Conflito de pessoa: mesma pessoa em eventos distintos com overlap.
 * `personEventMap`: person_id → lista de eventos em que está escalada (pending/confirmed).
 */
export function findPersonTimeConflict(params: {
  personIds: string[]
  eventDate: string
  startTime: string
  endTime: string
  excludeEventId?: string | null
  /** Eventos já carregados (id → event) */
  eventsById: Map<string, ScheduleEventLike>
  /** Confirmações ativas (pending/confirmed) */
  confirmations: MemberAssignmentLike[]
}): { personId: string; conflictingEvent: ScheduleEventLike } | null {
  const {
    personIds,
    eventDate,
    startTime,
    endTime,
    excludeEventId,
    eventsById,
    confirmations,
  } = params

  for (const personId of personIds) {
    for (const conf of confirmations) {
      if (conf.person_id !== personId) continue
      if (!confirmationBlocksPerson(conf.status)) continue
      if (excludeEventId && conf.agenda_event_id === excludeEventId) continue
      const other = eventsById.get(conf.agenda_event_id)
      if (!other) continue
      if (other.event_date !== eventDate) continue
      if (!statusBlocksSchedule(other.status)) continue
      if (
        intervalsOverlap(startTime, endTime, other.start_time, other.end_time)
      ) {
        return { personId, conflictingEvent: other }
      }
    }
  }
  return null
}

export { TEAM_TIME_OVERLAP_MESSAGE, PERSON_TIME_OVERLAP_MESSAGE }
