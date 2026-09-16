import 'server-only'

import { convertAcceptedQuoteToServiceOrder } from '@/Lib/orders/convertAcceptedQuoteToServiceOrder'
import { syncReservedAgendaEventForQuote } from '@/Lib/quotes/confirmQuoteDepositAndReserveSchedule'
import { writeOperationalAudit } from '@/Lib/orders/writeOperationalAudit'
import { getSupabaseServerClient } from '@/Lib/supabaseServer'
import {
  shouldAdvancePaidContract,
  type PaidContractSource,
} from './paidContractAdvance'
import { consumePaymentScheduleHold } from './scheduleHold'

/**
 * Provider-neutral post-payment transition:
 *   payment completed → reservation confirmed → ensure canonical OS
 *
 * PayPal only confirms the payment. This function owns the business transition.
 * Idempotent: refresh, webhook, retry and Zelle reuse the same reservation + OS.
 */
export async function confirmPaidDepositReservation(input: {
  companyId: string
  invoiceId: string
  source: PaidContractSource
  providerOrderId?: string | null
  providerCaptureId?: string | null
  actorUserId?: string | null
}) {
  const db = getSupabaseServerClient()
  const { data: invoice } = await db
    .from('invoices')
    .select('id, quote_id, invoice_kind, deposit_amount, paid_total, status')
    .eq('id', input.invoiceId)
    .eq('company_id', input.companyId)
    .maybeSingle()

  if (!invoice) return { ok: false as const, error: 'invoice_not_found' }

  const decision = shouldAdvancePaidContract({
    invoiceKind: invoice.invoice_kind,
    depositAmount: Number(invoice.deposit_amount),
    paidTotal: Number(invoice.paid_total),
  })

  // A supplemental post-event charge belongs to an event that already happened.
  // Paying it must never confirm/recreate a reservation or create a second OS.
  if (!decision.advance) {
    return {
      ok: true as const,
      reservationRequired: false,
      reason: decision.reason,
      serviceOrderId: null,
      serviceOrderNumber: null,
    }
  }

  const { data: quote } = await db
    .from('quotes')
    .select('id, reservation_confirmed_at, active')
    .eq('id', invoice.quote_id)
    .eq('company_id', input.companyId)
    .maybeSingle()
  if (!quote) return { ok: false as const, error: 'quote_not_found' }
  if (quote.active === false) {
    return { ok: false as const, error: 'quote_inactive' }
  }

  let confirmedAt = quote.reservation_confirmed_at as string | null
  const actorUserId = input.actorUserId ?? null
  if (!confirmedAt) {
    confirmedAt = new Date().toISOString()
    const { data: updated, error } = await db
      .from('quotes')
      .update({
        reservation_confirmed_at: confirmedAt,
        reservation_confirmed_by: actorUserId,
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
      actorUserId,
      entityType: 'invoice_payment',
      entityId: input.invoiceId,
      action: 'payment_completed',
      newData: {
        source: input.source,
        invoice_id: input.invoiceId,
        quote_id: invoice.quote_id,
        invoice_status: invoice.status,
        paid_total: invoice.paid_total,
        provider_order_id: input.providerOrderId ?? null,
        provider_capture_id: input.providerCaptureId ?? null,
      },
    })

    await writeOperationalAudit({
      companyId: input.companyId,
      actorUserId,
      entityType: 'quote',
      entityId: String(invoice.quote_id),
      action: 'reservation_confirmed',
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
    actorUserId,
    requireConfirmed: true,
  })

  if (agenda.ok) {
    await consumePaymentScheduleHold({
      companyId: input.companyId,
      invoiceId: input.invoiceId,
    })
  }

  const converted = await convertAcceptedQuoteToServiceOrder({
    companyId: input.companyId,
    quoteId: String(invoice.quote_id),
    actorUserId,
  })

  if (converted.data && !converted.data.already_existed) {
    await writeOperationalAudit({
      companyId: input.companyId,
      actorUserId,
      entityType: 'service_order',
      entityId: converted.data.id,
      action: 'service_order_created',
      newData: {
        source: input.source,
        quote_id: invoice.quote_id,
        invoice_id: input.invoiceId,
        service_order_number: converted.data.service_order_number,
      },
    })
  }

  return {
    ok: true as const,
    reservationRequired: true,
    reservationConfirmedAt: confirmedAt,
    agendaEventId: agenda.agenda_event_id ?? null,
    agendaStatus: agenda.agenda_status ?? null,
    agendaOk: agenda.ok,
    serviceOrderId: converted.data?.id ?? null,
    serviceOrderNumber: converted.data?.service_order_number ?? null,
    serviceOrderAlreadyExisted: converted.data?.already_existed ?? false,
    error: converted.error?.message ?? (agenda.ok ? null : agenda.error) ?? null,
  }
}
