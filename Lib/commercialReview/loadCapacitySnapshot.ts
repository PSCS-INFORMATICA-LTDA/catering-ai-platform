import { loadScheduleTurnaroundConfig } from '@/Lib/agenda/loadScheduleTurnaroundConfig'
import { getSupabaseServerClient } from '@/Lib/supabaseServer'
import {
  classifyCapacityOccupancy,
  intervalsOverlapWithGap,
  occupancyWindow,
  parseMaxConcurrentEvents,
  type CapacityOccupancy,
} from './capacityOccupancy'

type AgendaRow = {
  id: string
  quote_id?: string | null
  event_date: string
  start_time: string
  end_time: string
  status: string
}

type HoldRow = {
  id: string
  quote_id?: string | null
  invoice_id?: string | null
  event_date: string
  start_time: string
  end_time: string
  min_gap_minutes?: number | null
  status: string
  expires_at?: string | null
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
}

export async function loadCapacitySnapshot(input: {
  companyId: string
  quoteId: string
  eventDate?: string | null
  startTime?: string | null
  endTime?: string | null
  reservationConfirmedAt?: string | null
}): Promise<CapacityOccupancy> {
  const { config } = await loadScheduleTurnaroundConfig(input.companyId)
  const db = getSupabaseServerClient()
  const { data: rule } = await db
    .from('commercial_rules')
    .select('rule_value')
    .eq('company_id', input.companyId)
    .eq('rule_key', 'schedule_turnaround_buffer')
    .eq('active', true)
    .maybeSingle()

  const capacity = parseMaxConcurrentEvents(rule?.rule_value)
  const gap = Number(config.min_gap_minutes ?? 0)
  const thisQuoteReserved = Boolean(input.reservationConfirmedAt)

  if (!input.eventDate || !input.startTime || !input.endTime) {
    return classifyCapacityOccupancy({
      eventDate: input.eventDate,
      startTime: input.startTime,
      endTime: input.endTime,
      capacity,
      reservedCount: 0,
      thisQuoteReserved,
    })
  }

  const window = occupancyWindow({
    eventDate: input.eventDate,
    startTime: input.startTime,
    endTime: input.endTime,
  })

  const day = input.eventDate
  const prev = new Date(`${day}T12:00:00`)
  prev.setDate(prev.getDate() - 1)
  const next = new Date(`${day}T12:00:00`)
  next.setDate(next.getDate() + 1)

  const [agendaRes, holdsRes] = await Promise.all([
    db
      .from('agenda_events')
      .select('id, quote_id, event_date, start_time, end_time, status')
      .eq('company_id', input.companyId)
      .gte('event_date', prev.toISOString().slice(0, 10))
      .lte('event_date', next.toISOString().slice(0, 10))
      .in('status', ['reserved', 'scheduled', 'completed']),
    db
      .from('payment_schedule_holds')
      .select('id, quote_id, invoice_id, event_date, start_time, end_time, min_gap_minutes, status, expires_at')
      .eq('company_id', input.companyId)
      .eq('status', 'active')
      .gt('expires_at', new Date().toISOString()),
  ])

  const occupied = new Set<string>()
  for (const row of (agendaRes.data ?? []) as AgendaRow[]) {
    if (row.quote_id && row.quote_id === input.quoteId) continue
    const other = occupancyWindow({
      eventDate: String(row.event_date),
      startTime: String(row.start_time),
      endTime: String(row.end_time),
    })
    if (
      intervalsOverlapWithGap(window.start, window.end, other.start, other.end, gap)
    ) {
      occupied.add(`agenda:${row.id}`)
    }
  }

  const agendaQuoteIds = new Set(
    ((agendaRes.data ?? []) as AgendaRow[])
      .filter((row) => row.quote_id)
      .map((row) => String(row.quote_id)),
  )

  for (const raw of holdsRes.data ?? []) {
    const row = asRecord(raw) as HoldRow
    if (row.quote_id && String(row.quote_id) === input.quoteId) continue
    if (row.quote_id && agendaQuoteIds.has(String(row.quote_id))) continue
    if (!row.event_date || !row.start_time || !row.end_time) continue
    const other = occupancyWindow({
      eventDate: String(row.event_date),
      startTime: String(row.start_time),
      endTime: String(row.end_time),
    })
    const holdGap = Math.max(gap, Number(row.min_gap_minutes ?? 0))
    if (
      intervalsOverlapWithGap(
        window.start,
        window.end,
        other.start,
        other.end,
        holdGap,
      )
    ) {
      occupied.add(`hold:${row.id}`)
    }
  }

  return classifyCapacityOccupancy({
    eventDate: input.eventDate,
    startTime: input.startTime,
    endTime: input.endTime,
    capacity,
    reservedCount: occupied.size,
    thisQuoteReserved,
  })
}
