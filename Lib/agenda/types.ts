export type OperationalTeam = {
  id: string
  company_id: string
  name: string
  color: string
  notes: string | null
  active: boolean
  created_at?: string
  updated_at?: string
}

export type AgendaEventStatus = 'scheduled' | 'completed' | 'cancelled'

export type AgendaEvent = {
  id: string
  company_id: string
  team_id: string
  code: string
  title: string
  client_name: string | null
  event_date: string
  start_time: string
  end_time: string
  status: AgendaEventStatus
  notes: string | null
  quote_id: string | null
  created_at?: string
  updated_at?: string
}

export type AgendaSegment = {
  eventId: string
  teamId: string
  dayKey: string
  code: string
  title: string
  clientName: string | null
  startMin: number
  endMin: number
  status: AgendaEventStatus
  blocksAvailability: boolean
  isHistorical: boolean
}
