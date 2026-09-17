import { getSupabaseServerClient } from '@/Lib/supabaseServer'
import { quoteDeepLinkPath } from './env'
import { enqueueNotificationEventSafe } from './enqueueEvent'
import type { NotificationPayload } from './types'

export type EnqueueQuoteCreatedInput = {
  companyId: string
  quoteId: string
  quoteNumber?: string | null
  eventId?: string | null
  customerName?: string | null
  eventDate?: string | null
  eventTime?: string | null
  total?: number | null
  currency?: string | null
  locale?: 'pt' | 'en' | 'es' | null
  source: string
}

export async function enqueueQuoteCreatedNotification(input: EnqueueQuoteCreatedInput) {
  if (!input.companyId || !input.quoteId) {
    return { eventId: null, deliveryCount: 0 }
  }
  const db = getSupabaseServerClient()
  let cateringEventId = input.eventId ?? null
  if (!cateringEventId) {
    const quoteRow = await db
      .from('quotes')
      .select('event_id')
      .eq('id', input.quoteId)
      .eq('company_id', input.companyId)
      .maybeSingle()
    cateringEventId = (quoteRow.data?.event_id as string | undefined) ?? null
  }
  const payload: NotificationPayload = {
    eventKey: 'quote.created',
    entityType: 'quote',
    entityId: input.quoteId,
    quoteId: input.quoteId,
    quoteNumber: input.quoteNumber ?? null,
    eventId: cateringEventId,
    customerName: input.customerName ?? null,
    eventDate: input.eventDate ?? null,
    eventTime: input.eventTime ?? null,
    total: input.total ?? null,
    currency: input.currency ?? null,
    locale: input.locale === 'en' || input.locale === 'es' ? input.locale : 'pt',
    source: input.source,
    deepLinkPath: quoteDeepLinkPath(input.quoteId),
  }
  return enqueueNotificationEventSafe({
    companyId: input.companyId,
    eventKey: 'quote.created',
    entityType: 'quote',
    entityId: input.quoteId,
    payload,
    source: input.source,
  })
}

export async function enqueueQuoteCreatedNotificationSafe(input: EnqueueQuoteCreatedInput) {
  try {
    return await enqueueQuoteCreatedNotification(input)
  } catch (error) {
    console.warn('[notifications] quote.created enqueue failed', {
      quoteId: input.quoteId,
      error: error instanceof Error ? error.message : 'unknown',
    })
    return { eventId: null, deliveryCount: 0 }
  }
}
