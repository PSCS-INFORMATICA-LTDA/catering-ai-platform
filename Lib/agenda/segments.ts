import type { AgendaEvent, AgendaSegment } from '@/Lib/agenda/types'
import { timeToMinutes } from '@/Lib/agenda/week'

export function eventsToSegments(events: AgendaEvent[]): AgendaSegment[] {
  return events
    .filter((e) => e.status !== 'cancelled')
    .map((e) => {
      const isHistorical = e.status === 'completed'
      return {
        eventId: e.id,
        teamId: e.team_id,
        dayKey: e.event_date,
        code: e.code,
        title: e.title,
        clientName: e.client_name,
        startMin: timeToMinutes(e.start_time),
        endMin: timeToMinutes(e.end_time),
        status: e.status,
        blocksAvailability: !isHistorical,
        isHistorical,
      }
    })
}
