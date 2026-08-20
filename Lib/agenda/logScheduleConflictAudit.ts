import { writeOperationalAudit } from '@/Lib/orders/writeOperationalAudit'
import type { ScheduleConflictResult } from '@/Lib/agenda/scheduleTurnaround'

/**
 * Auditoria de conflito operacional (sem dados sensíveis).
 * Nunca bloqueia o fluxo — writeOperationalAudit já engole falhas.
 */
export async function logScheduleConflictAudit(input: {
  companyId: string
  actorUserId: string | null
  entityId: string
  teamId?: string | null
  personId?: string | null
  conflictingEventId?: string | null
  proposedEventId?: string | null
  result: ScheduleConflictResult
  minGapMinutes: number
  baseRadiusMiles?: number
}): Promise<void> {
  await writeOperationalAudit({
    companyId: input.companyId,
    actorUserId: input.actorUserId,
    entityType: 'agenda_event',
    entityId: input.entityId,
    action: 'schedule_conflict_detected',
    newData: {
      conflict_code: input.result.code,
      team_id: input.teamId ?? null,
      person_id: input.personId ?? null,
      conflicting_event_id:
        input.conflictingEventId ?? input.result.conflictingEventId ?? null,
      proposed_event_id: input.proposedEventId ?? null,
      blocked_until: input.result.blockedUntil,
      next_available_start: input.result.nextAvailableStart,
      min_gap_minutes: input.minGapMinutes,
      base_radius_miles: input.baseRadiusMiles ?? null,
    },
  })
}
