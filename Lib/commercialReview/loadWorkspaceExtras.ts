import type { QuoteDetail } from '@/app/quotes/[id]/quoteDetailTypes'
import { getSupabaseServerClient } from '@/Lib/supabaseServer'
import { getCurrentQuoteVersion, type QuoteVersionRow } from '@/Lib/quotes/versions'
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
}

export async function loadCommercialReviewExtras(input: {
  companyId: string
  quote: QuoteDetail
}): Promise<CommercialReviewExtras> {
  const supabase = getSupabaseServerClient()
  const quoteId = input.quote.id

  const [versionRes, capacity, auditRes] = await Promise.all([
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
      .in('entity_type', ['quote', 'quote_version', 'quote_proposal'])
      .order('created_at', { ascending: false })
      .limit(40),
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

  return {
    currentVersion: versionRes.data,
    sharedVersionId: input.quote.proposal_shared_version_id ?? null,
    sharedBy: input.quote.proposal_shared_by ?? null,
    capacity,
    history,
  }
}
