import type { QuoteDetail } from '@/app/quotes/[id]/quoteDetailTypes'
import { getSupabaseServerClient } from '@/Lib/supabaseServer'
import { getCurrentQuoteVersion, type QuoteVersionRow } from '@/Lib/quotes/versions'
import { ensurePaidContractAdvance } from '@/Lib/payments/confirmPaidDeposit'
import {
  readContractLifecycle,
  shouldRetryPaidContractEnsure,
  type ContractLifecycle,
} from '@/Lib/payments/paidContractAdvance'
import { isQuoteAccepted } from '@/Lib/quotes/statusMachine'
import { loadCapacitySnapshot } from './loadCapacitySnapshot'
import type { CapacityOccupancy } from './capacityOccupancy'

export type CommercialHistoryEvent = {
  id: string
  action: string
  entityType: string
  createdAt: string | null
  actorUserId: string | null
}

export type CommercialReviewExtras = {
  currentVersion: QuoteVersionRow | null
  sharedVersionId: string | null
  sharedBy: string | null
  capacity: CapacityOccupancy
  history: CommercialHistoryEvent[]
  lifecycle: ContractLifecycle
}

export async function loadCommercialReviewExtras(input: {
  companyId: string
  quote: QuoteDetail
}): Promise<CommercialReviewExtras> {
  const supabase = getSupabaseServerClient()
  const quoteId = input.quote.id

  const [versionRes, capacity, auditRes, invoiceRes, orderRes] = await Promise.all([
    getCurrentQuoteVersion(input.companyId, quoteId),
    loadCapacitySnapshot({
      companyId: input.companyId,
      quoteId,
      eventDate: input.quote.event_date,
      startTime: input.quote.start_time,
      endTime: input.quote.end_time,
      reservationConfirmedAt: input.quote.reservation_confirmed_at,
    }),
    supabase
      .from('audit_logs')
      .select('id, action, entity_type, entity_id, user_id, created_at, new_data')
      .eq('company_id', input.companyId)
      .in('entity_type', [
        'quote',
        'quote_version',
        'quote_proposal',
        'service_order',
        'invoice',
        'invoice_payment',
        'agenda_event',
      ])
      .order('created_at', { ascending: false })
      .limit(80),
    supabase
      .from('invoices')
      .select('id, invoice_number, status, total, deposit_amount, paid_total, invoice_kind')
      .eq('company_id', input.companyId)
      .eq('quote_id', quoteId)
      .neq('status', 'canceled')
      .order('created_at', { ascending: false })
      .limit(5),
    input.quote.converted_service_order_id
      ? supabase
          .from('service_orders')
          .select('id, service_order_number')
          .eq('company_id', input.companyId)
          .eq('id', input.quote.converted_service_order_id)
          .maybeSingle()
      : supabase
          .from('service_orders')
          .select('id, service_order_number')
          .eq('company_id', input.companyId)
          .eq('quote_id', quoteId)
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle(),
  ])

  const history = ((auditRes.data ?? []) as Array<Record<string, unknown>>)
    .filter((row) => {
      const entityId = String(row.entity_id ?? '')
      const newData = row.new_data && typeof row.new_data === 'object'
        ? (row.new_data as Record<string, unknown>)
        : {}
      return (
        entityId === quoteId ||
        entityId === String(input.quote.accepted_version_id ?? '') ||
        entityId === String(input.quote.converted_service_order_id ?? '') ||
        String(newData.quote_id ?? '') === quoteId
      )
    })
    .slice(0, 12)
    .map((row) => ({
      id: String(row.id),
      action: String(row.action ?? ''),
      entityType: String(row.entity_type ?? ''),
      createdAt: typeof row.created_at === 'string' ? row.created_at : null,
      actorUserId: typeof row.user_id === 'string' ? row.user_id : null,
    }))

  const invoice = ((invoiceRes.data ?? []) as Array<Record<string, unknown>>).find(
    (row) => String(row.invoice_kind || '') !== 'post_event_adjustment',
  )
  const lifecycleInput = {
    proposalAccepted: isQuoteAccepted(input.quote),
    invoiceStatus: typeof invoice?.status === 'string' ? invoice.status : null,
    paidTotal: invoice ? Number(invoice.paid_total) : 0,
    depositAmount: invoice
      ? Number(invoice.deposit_amount)
      : Number(input.quote.reservation_amount || 0),
    total: invoice ? Number(invoice.total) : Number(input.quote.quote_total || 0),
    reservationConfirmedAt: input.quote.reservation_confirmed_at ?? null,
    serviceOrderId: orderRes.data?.id ?? input.quote.converted_service_order_id ?? null,
    serviceOrderNumber: orderRes.data?.service_order_number ?? null,
  }
  let lifecycle = readContractLifecycle(lifecycleInput)

  if (shouldRetryPaidContractEnsure(lifecycle) && typeof invoice?.id === 'string') {
    const retried = await ensurePaidContractAdvance({
      companyId: input.companyId,
      invoiceId: invoice.id,
      source: 'commercial_review',
    })
    if (retried.serviceOrderId) {
      lifecycle = readContractLifecycle({
        ...lifecycleInput,
        reservationConfirmedAt:
          retried.reservationConfirmedAt ?? lifecycleInput.reservationConfirmedAt,
        serviceOrderId: retried.serviceOrderId,
        serviceOrderNumber: retried.serviceOrderNumber ?? null,
      })
    }
  }

  return {
    currentVersion: versionRes.data,
    sharedVersionId: input.quote.proposal_shared_version_id ?? null,
    sharedBy: input.quote.proposal_shared_by ?? null,
    capacity,
    history,
    lifecycle,
  }
}
