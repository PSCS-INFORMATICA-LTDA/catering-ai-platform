import {
  canScheduleNextEvent,
  type ScheduleConflictResult,
  type ScheduleTurnaroundConfig,
  DEFAULT_SCHEDULE_TURNAROUND_CONFIG,
} from '@/Lib/agenda/scheduleTurnaround'

export type ScheduleEventLike = {
  id: string
  team_id: string | null
  event_date: string
  start_time: string
  end_time: string
  status: string
  distance_miles?: number | null
}

export type MemberAssignmentLike = {
  person_id: string
  team_id: string
  agenda_event_id: string
  status: string
}

export type TeamScheduleConflict = {
  event: ScheduleEventLike
  result: ScheduleConflictResult
}

export type PersonScheduleConflict = {
  personId: string
  event: ScheduleEventLike
  result: ScheduleConflictResult
}

function statusBlocksSchedule(status: string): boolean {
  return status === 'reserved' || status === 'scheduled' || status === 'completed'
}

function confirmationBlocksPerson(status: string): boolean {
  return status === 'pending' || status === 'confirmed'
}

/**
 * Conflito de equipe: overlap OU janela operacional (turnaround).
 */
export function findTeamTimeConflict(
  events: ScheduleEventLike[],
  teamId: string,
  eventDate: string,
  startTime: string,
  endTime: string,
  excludeEventId?: string | null,
  config: ScheduleTurnaroundConfig = DEFAULT_SCHEDULE_TURNAROUND_CONFIG,
  distanceMiles?: number | null,
): TeamScheduleConflict | null {
  const next = {
    event_date: eventDate,
    start_time: startTime,
    end_time: endTime,
    distance_miles: distanceMiles ?? null,
  }

  for (const e of events) {
    if (e.team_id !== teamId) continue
    if (!statusBlocksSchedule(e.status)) continue
    if (excludeEventId && e.id === excludeEventId) continue
    const result = canScheduleNextEvent(e, next, config, { scope: 'team' })
    if (result) {
      return { event: e, result }
    }
  }
  return null
}

/**
 * Conflito de pessoa: overlap OU janela operacional entre escalas.
 */
export function findPersonTimeConflict(params: {
  personIds: string[]
  eventDate: string
  startTime: string
  endTime: string
  excludeEventId?: string | null
  eventsById: Map<string, ScheduleEventLike>
  confirmations: MemberAssignmentLike[]
  config?: ScheduleTurnaroundConfig
  personNames?: Map<string, string>
  distanceMiles?: number | null
}): PersonScheduleConflict | null {
  const {
    personIds,
    eventDate,
    startTime,
    endTime,
    excludeEventId,
    eventsById,
    confirmations,
    config = DEFAULT_SCHEDULE_TURNAROUND_CONFIG,
    personNames,
    distanceMiles,
  } = params

  const next = {
    event_date: eventDate,
    start_time: startTime,
    end_time: endTime,
    distance_miles: distanceMiles ?? null,
  }

  for (const personId of personIds) {
    for (const conf of confirmations) {
      if (conf.person_id !== personId) continue
      if (!confirmationBlocksPerson(conf.status)) continue
      if (excludeEventId && conf.agenda_event_id === excludeEventId) continue
      const other = eventsById.get(conf.agenda_event_id)
      if (!other) continue
      if (!statusBlocksSchedule(other.status)) continue
      const result = canScheduleNextEvent(other, next, config, {
        scope: 'person',
        personName: personNames?.get(personId) ?? null,
      })
      if (result) {
        return { personId, event: other, result }
      }
    }
  }
  return null
}

/** Mensagens legadas — preferir result.messagePt do motor. */
export const TEAM_TIME_OVERLAP_MESSAGE =
  'Equipe com janela operacional insuficiente entre eventos.'
export const PERSON_TIME_OVERLAP_MESSAGE =
  'Integrante com janela operacional insuficiente entre eventos.'

export type { ScheduleConflictResult, ScheduleTurnaroundConfig }
