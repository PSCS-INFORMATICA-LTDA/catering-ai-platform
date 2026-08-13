/**
 * Confirma sinal (depósito) e reserva a Agenda imediatamente.
 *
 * Fluxo canônico:
 *   Cotação aceita → Sinal confirmado → agenda_events (status=reserved)
 *   → depois designação de equipe / conversão OS (mesmo evento, sem duplicar)
 *
 * Idempotente: re-confirmar devolve o mesmo agenda_event.
 */
import { loadScheduleTurnaroundConfig } from '@/Lib/agenda/loadScheduleTurnaroundConfig'
import { logScheduleConflictAudit } from '@/Lib/agenda/logScheduleConflictAudit'
import { canScheduleNextEvent } from '@/Lib/agenda/scheduleTurnaround'
import { getCustomerDisplayName } from '@/Lib/getCustomerDisplayName'
import { writeOperationalAudit } from '@/Lib/orders/writeOperationalAudit'
import { getSupabaseServerClient } from '@/Lib/supabaseServer'
import type { SupabaseClient } from '@supabase/supabase-js'

export type ConfirmDepositResult = {
  ok: boolean
  already_confirmed?: boolean
  reservation_confirmed_at?: string | null
  agenda_event_id?: string | null
  agenda_status?: string | null
  error?: string
  conflict?: Record<string, unknown>
  status?: number
}

type QuoteRow = {
  id: string
  company_id: string
  quote_number: string | null
  proposal_response: string | null
  quote_status: string | null
  reservation_confirmed_at: string | null
  event_id: string | null
  customer_id: string | null
  active: boolean | null
}

type EventRow = {
  id: string
  event_name: string | null
  event_date: string | null
  start_time: string | null
  end_time: string | null
}

function normalizeTimeForDb(value: string): string {
  const v = value.trim()
  if (v.length === 5) return `${v}:00`
  return v.slice(0, 8)
}

function statusBlocksSchedule(status: string): boolean {
  return status === 'reserved' || status === 'scheduled' || status === 'completed'
}

async function nextEventCode(
  db: SupabaseClient,
  companyId: string,
): Promise<string> {
  const { data } = await db
    .from('agenda_events')
    .select('code')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(50)

  let max = 0
  for (const row of data ?? []) {
    const m = String(row.code ?? '').match(/EVT-(\d+)/i)
    if (m) max = Math.max(max, Number(m[1]))
  }
  return `EVT-${String(max + 1).padStart(4, '0')}`
}

/**
 * Conflito de janela na empresa (reserva sem equipe ainda).
 * Bloqueia overlap/turnaround com qualquer evento reserved/scheduled/completed.
 */
export function findCompanyTimeConflict(
  events: Array<{
    id: string
    event_date: string
    start_time: string
    end_time: string
    status: string
  }>,
  eventDate: string,
  startTime: string,
  endTime: string,
  excludeEventId?: string | null,
  config?: Parameters<typeof canScheduleNextEvent>[2],
) {
  const next = {
    event_date: eventDate,
    start_time: startTime,
    end_time: endTime,
    distance_miles: null as number | null,
  }
  for (const e of events) {
    if (!statusBlocksSchedule(e.status)) continue
    if (excludeEventId && e.id === excludeEventId) continue
    const result = canScheduleNextEvent(e, next, config, { scope: 'team' })
    if (result) return { event: e, result }
  }
  return null
}

export async function syncReservedAgendaEventForQuote(input: {
  companyId: string
  quoteId: string
  actorUserId?: string | null
  /** When true, only sync if reservation already confirmed */
  requireConfirmed?: boolean
}): Promise<ConfirmDepositResult> {
  const db = getSupabaseServerClient()
  const { companyId, quoteId, actorUserId = null } = input

  const { data: quote, error: quoteError } = await db
    .from('quotes')
    .select(
      'id, company_id, quote_number, proposal_response, quote_status, reservation_confirmed_at, event_id, customer_id, active',
    )
    .eq('id', quoteId)
    .eq('company_id', companyId)
    .eq('active', true)
    .maybeSingle()

  if (quoteError) {
    return { ok: false, error: quoteError.message, status: 500 }
  }
  if (!quote) {
    return { ok: false, error: 'Cotação não encontrada', status: 404 }
  }

  if (input.requireConfirmed !== false && !quote.reservation_confirmed_at) {
    return { ok: true, already_confirmed: false }
  }

  return upsertReservedAgendaFromQuote({
    db,
    companyId,
    quote: quote as QuoteRow,
    actorUserId,
    alreadyConfirmed: true,
  })
}

async function upsertReservedAgendaFromQuote(input: {
  db: SupabaseClient
  companyId: string
  quote: QuoteRow
  actorUserId: string | null
  alreadyConfirmed: boolean
  reservationConfirmedAt?: string
}): Promise<ConfirmDepositResult> {
  const { db, companyId, quote, actorUserId, alreadyConfirmed } = input

  if (!quote.event_id) {
    return {
      ok: false,
      error: 'Cotação sem evento (data/horário). Informe o evento antes de confirmar o sinal.',
      status: 409,
    }
  }

  const { data: event, error: eventError } = await db
    .from('events')
    .select('id, event_name, event_date, start_time, end_time')
    .eq('id', quote.event_id)
    .maybeSingle()

  if (eventError) {
    return { ok: false, error: eventError.message, status: 500 }
  }
  const ev = event as EventRow | null
  if (!ev?.event_date || !ev.start_time || !ev.end_time) {
    return {
      ok: false,
      error: 'Evento sem data ou horário completo.',
      status: 409,
    }
  }

  const startDb = normalizeTimeForDb(String(ev.start_time))
  const endDb = normalizeTimeForDb(String(ev.end_time))

  const { data: existingRows } = await db
    .from('agenda_events')
    .select('id, status, team_id, service_order_id, event_date, start_time, end_time')
    .eq('company_id', companyId)
    .eq('quote_id', quote.id)
    .neq('status', 'cancelled')
    .order('created_at', { ascending: false })
    .limit(1)

  const existing = existingRows?.[0] ?? null

  const { config } = await loadScheduleTurnaroundConfig(companyId)
  const day = new Date(`${ev.event_date}T12:00:00`)
  const prevDay = new Date(day)
  prevDay.setDate(prevDay.getDate() - 1)
  const nextDay = new Date(day)
  nextDay.setDate(nextDay.getDate() + 1)

  const { data: nearby } = await db
    .from('agenda_events')
    .select('id, code, team_id, event_date, start_time, end_time, status')
    .eq('company_id', companyId)
    .gte('event_date', prevDay.toISOString().slice(0, 10))
    .lte('event_date', nextDay.toISOString().slice(0, 10))
    .in('status', ['reserved', 'scheduled', 'completed'])

  const busy = findCompanyTimeConflict(
    (nearby ?? []).map((e) => ({
      id: e.id,
      event_date: e.event_date,
      start_time: e.start_time,
      end_time: e.end_time,
      status: e.status,
    })),
    ev.event_date,
    startDb,
    endDb,
    existing?.id ?? null,
    config,
  )

  if (busy) {
    await logScheduleConflictAudit({
      companyId,
      actorUserId,
      entityId: busy.event.id,
      teamId: null,
      conflictingEventId: busy.event.id,
      proposedEventId: existing?.id ?? null,
      result: busy.result,
      minGapMinutes: busy.result.minGapMinutes,
      baseRadiusMiles: config.base_radius_miles,
    })
    return {
      ok: false,
      status: 409,
      error: busy.result.messagePt,
      conflict: {
        code: busy.result.code,
        eventId: busy.event.id,
        start_time: busy.event.start_time,
        end_time: busy.event.end_time,
        blocked_until: busy.result.blockedUntil,
        next_available_start: busy.result.nextAvailableStart,
        min_gap_minutes: busy.result.minGapMinutes,
        message_pt: busy.result.messagePt,
        message_en: busy.result.messageEn,
        message_es: busy.result.messageEs,
      },
    }
  }

  let clientName: string | null = null
  if (quote.customer_id) {
    const { data: customer } = await db
      .from('customers')
      .select('id, full_name, ab_name, contact_name, company_name, email, phone')
      .eq('id', quote.customer_id)
      .maybeSingle()
    if (customer) clientName = getCustomerDisplayName(customer)
  }

  const title =
    (ev.event_name?.trim() ||
      (quote.quote_number ? `Reserva ${quote.quote_number}` : 'Reserva confirmada')) ??
    'Reserva confirmada'

  // Already has OS / team scheduled → keep scheduled, only sync times
  const nextStatus =
    existing?.service_order_id || existing?.team_id || existing?.status === 'scheduled'
      ? 'scheduled'
      : 'reserved'

  let agendaEventId: string
  let agendaStatus: string

  if (existing) {
    const { data: updated, error: updErr } = await db
      .from('agenda_events')
      .update({
        title,
        client_name: clientName,
        event_date: ev.event_date,
        start_time: startDb,
        end_time: endDb,
        status: nextStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .eq('company_id', companyId)
      .select('id, status')
      .single()

    if (updErr || !updated) {
      return { ok: false, error: updErr?.message || 'Falha ao atualizar agenda', status: 500 }
    }
    agendaEventId = updated.id
    agendaStatus = updated.status
  } else {
    const code = await nextEventCode(db, companyId)
    const { data: created, error: insErr } = await db
      .from('agenda_events')
      .insert({
        company_id: companyId,
        team_id: null,
        code,
        title,
        client_name: clientName,
        event_date: ev.event_date,
        start_time: startDb,
        end_time: endDb,
        status: 'reserved',
        quote_id: quote.id,
        service_order_id: null,
      })
      .select('id, status')
      .single()

    if (insErr || !created) {
      // Race: unique quote active → fetch existing
      if (insErr && /duplicate|uq_agenda_events_quote/i.test(insErr.message)) {
        const { data: raced } = await db
          .from('agenda_events')
          .select('id, status')
          .eq('company_id', companyId)
          .eq('quote_id', quote.id)
          .neq('status', 'cancelled')
          .maybeSingle()
        if (raced) {
          return {
            ok: true,
            already_confirmed: alreadyConfirmed,
            reservation_confirmed_at:
              input.reservationConfirmedAt ?? quote.reservation_confirmed_at,
            agenda_event_id: raced.id,
            agenda_status: raced.status,
          }
        }
      }
      return { ok: false, error: insErr?.message || 'Falha ao reservar agenda', status: 500 }
    }
    agendaEventId = created.id
    agendaStatus = created.status
  }

  await writeOperationalAudit({
    companyId,
    actorUserId,
    entityType: 'agenda_event',
    entityId: agendaEventId,
    action: 'agenda_reserved_on_deposit',
    newData: {
      quote_id: quote.id,
      quote_number: quote.quote_number,
      status: agendaStatus,
      event_date: ev.event_date,
      start_time: startDb,
      end_time: endDb,
    },
  })

  return {
    ok: true,
    already_confirmed: alreadyConfirmed,
    reservation_confirmed_at:
      input.reservationConfirmedAt ?? quote.reservation_confirmed_at,
    agenda_event_id: agendaEventId,
    agenda_status: agendaStatus,
  }
}

export async function confirmQuoteDepositAndReserveSchedule(input: {
  companyId: string
  quoteId: string
  actorUserId: string
}): Promise<ConfirmDepositResult> {
  const db = getSupabaseServerClient()
  const { companyId, quoteId, actorUserId } = input

  const { data: quote, error } = await db
    .from('quotes')
    .select(
      'id, company_id, quote_number, proposal_response, quote_status, reservation_confirmed_at, event_id, customer_id, active',
    )
    .eq('id', quoteId)
    .eq('company_id', companyId)
    .eq('active', true)
    .maybeSingle()

  if (error) return { ok: false, error: error.message, status: 500 }
  if (!quote) return { ok: false, error: 'Cotação não encontrada', status: 404 }

  const accepted =
    quote.proposal_response === 'accepted' ||
    quote.quote_status === 'approved' ||
    quote.quote_status === 'accepted'
  if (!accepted) {
    return {
      ok: false,
      status: 409,
      error:
        'Só é possível confirmar o sinal após o aceite da cotação pelo cliente.',
    }
  }

  let confirmedAt = quote.reservation_confirmed_at
  let alreadyConfirmed = Boolean(confirmedAt)

  if (!confirmedAt) {
    confirmedAt = new Date().toISOString()
    const { error: updateError } = await db
      .from('quotes')
      .update({
        reservation_confirmed_at: confirmedAt,
        reservation_confirmed_by: actorUserId,
        updated_at: confirmedAt,
      })
      .eq('id', quoteId)
      .eq('company_id', companyId)

    if (updateError) {
      return { ok: false, error: updateError.message, status: 500 }
    }

    await writeOperationalAudit({
      companyId,
      actorUserId,
      entityType: 'quote',
      entityId: quoteId,
      action: 'reservation_confirmed',
      newData: {
        quote_number: quote.quote_number,
        reservation_confirmed_at: confirmedAt,
      },
    })
    alreadyConfirmed = false
  }

  const agenda = await upsertReservedAgendaFromQuote({
    db,
    companyId,
    quote: { ...(quote as QuoteRow), reservation_confirmed_at: confirmedAt },
    actorUserId,
    alreadyConfirmed,
    reservationConfirmedAt: confirmedAt,
  })

  if (!agenda.ok) {
    // Deposit already saved; surface schedule failure clearly
    return agenda
  }

  return {
    ok: true,
    already_confirmed: alreadyConfirmed,
    reservation_confirmed_at: confirmedAt,
    agenda_event_id: agenda.agenda_event_id,
    agenda_status: agenda.agenda_status,
  }
}

export async function cancelAgendaReservationForQuote(input: {
  companyId: string
  quoteId: string
  actorUserId?: string | null
  reason?: string
}): Promise<{ ok: boolean; cancelled: number; error?: string }> {
  const db = getSupabaseServerClient()
  const now = new Date().toISOString()
  const { data, error } = await db
    .from('agenda_events')
    .update({
      status: 'cancelled',
      cancelled_at: now,
      cancelled_by: input.actorUserId ?? null,
      updated_at: now,
      notes: input.reason
        ? `Cancelado: ${input.reason}`
        : 'Cancelado com a cotação/reserva',
    })
    .eq('company_id', input.companyId)
    .eq('quote_id', input.quoteId)
    .neq('status', 'cancelled')
    .is('service_order_id', null)
    .select('id')

  if (error) return { ok: false, cancelled: 0, error: error.message }

  for (const row of data ?? []) {
    await writeOperationalAudit({
      companyId: input.companyId,
      actorUserId: input.actorUserId ?? null,
      entityType: 'agenda_event',
      entityId: row.id,
      action: 'agenda_reservation_cancelled',
      newData: { quote_id: input.quoteId, reason: input.reason ?? null },
    })
  }

  return { ok: true, cancelled: (data ?? []).length }
}
