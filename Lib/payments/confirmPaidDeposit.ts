import 'server-only'

import { syncReservedAgendaEventForQuote } from '@/Lib/quotes/confirmQuoteDepositAndReserveSchedule'
import { writeOperationalAudit } from '@/Lib/orders/writeOperationalAudit'
import { getSupabaseServerClient } from '@/Lib/supabaseServer'
import { isDepositSatisfied } from './invoiceStatus'

export async function confirmPaidDepositReservation(input: {
  companyId: string
  invoiceId: string
  source: 'paypal_capture' | 'paypal_webhook'
  providerOrderId?: string | null
  providerCaptureId?: string | null
}) {
  const db = getSupabaseServerClient()
  const { data: invoice } = await db
    .from('invoices')
    .select('id, quote_id, deposit_amount, paid_total')
    .eq('id', input.invoiceId)
    .eq('company_id', input.companyId)
    .maybeSingle()

  if (!invoice) return { ok: false as const, error: 'invoice_not_found' }
  if (!isDepositSatisfied({
    depositAmount: Number(invoice.deposit_amount),
    paidTotal: Number(invoice.paid_total),
  })) {
    return { ok: true as const, reservationRequired: false }
  }

  const { data: quote } = await db
    .from('quotes')
    .select('id, reservation_confirmed_at')
    .eq('id', invoice.quote_id)
    .eq('company_id', input.companyId)
    .maybeSingle()
  if (!quote) return { ok: false as const, error: 'quote_not_found' }

  let confirmedAt = quote.reservation_confirmed_at as string | null
  if (!confirmedAt) {
    confirmedAt = new Date().toISOString()
    const { data: updated, error } = await db
      .from('quotes')
      .update({
        reservation_confirmed_at: confirmedAt,
        reservation_confirmed_by: null,
        updated_at: confirmedAt,
      })
      .eq('id', invoice.quote_id)
      .eq('company_id', input.companyId)
      .is('reservation_confirmed_at', null)
      .select('reservation_confirmed_at')
      .maybeSingle()

    if (error) return { ok: false as const, error: 'reservation_confirm_failed' }
    confirmedAt = (updated?.reservation_confirmed_at as string | null) ?? confirmedAt

    await writeOperationalAudit({
      companyId: input.companyId,
      actorUserId: null,
      entityType: 'quote',
      entityId: String(invoice.quote_id),
      action: 'reservation_confirmed_by_payment',
      newData: {
        source: input.source,
        reservation_confirmed_at: confirmedAt,
        provider_order_id: input.providerOrderId ?? null,
        provider_capture_id: input.providerCaptureId ?? null,
      },
    })
  }

  const agenda = await syncReservedAgendaEventForQuote({
    companyId: input.companyId,
    quoteId: String(invoice.quote_id),
    actorUserId: null,
    requireConfirmed: true,
  })

  return {
    ok: agenda.ok,
    reservationRequired: true,
    reservationConfirmedAt: confirmedAt,
    agendaEventId: agenda.agenda_event_id ?? null,
    agendaStatus: agenda.agenda_status ?? null,
    error: agenda.error ?? null,
  }
}
