export type OperationalTeamContact = {
  id: string
  full_name?: string | null
  ab_name?: string | null
  phone?: string | null
  email?: string | null
  address_line?: string | null
  city?: string | null
  state?: string | null
  preferred_language?: string | null
}

export type OperationalTeam = {
  id: string
  company_id: string
  name: string
  color: string
  notes: string | null
  /** Idioma das mensagens WhatsApp: pt | en | es (fallback se a pessoa não tiver) */
  preferred_language?: string | null
  /** Pessoa do Address Book (telefone, e-mail, endereço) */
  contact_person_id?: string | null
  contact?: OperationalTeamContact | null
  active: boolean
  created_at?: string
  updated_at?: string
}

export type AgendaEventStatus = 'reserved' | 'scheduled' | 'completed' | 'cancelled'

export type AgendaEvent = {
  id: string
  company_id: string
  team_id: string | null
  code: string
  title: string
  client_name: string | null
  event_date: string
  start_time: string
  end_time: string
  presentation_time?: string | null
  status: AgendaEventStatus
  notes: string | null
  quote_id: string | null
  service_order_id?: string | null
  team_assignment_token?: string | null
  team_assignment_response?: string | null
  team_assignment_sent_at?: string | null
  created_at?: string
  updated_at?: string
}

export type AgendaSegment = {
  eventId: string
  teamId: string | null
  dayKey: string
  code: string
  title: string
  clientName: string | null
  quoteId: string | null
  startMin: number
  endMin: number
  presentationTime: string | null
  assignmentToken: string | null
  assignmentResponse: string | null
  status: AgendaEventStatus
  blocksAvailability: boolean
  isHistorical: boolean
}
