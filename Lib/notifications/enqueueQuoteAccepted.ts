import { getSupabaseServerClient } from '@/Lib/supabaseServer'
import { quoteDeepLinkPath } from './env'
import { enqueueNotificationEventSafe } from './enqueueEvent'
import { environmentBanner } from './whatsappCopy'
import type { NotificationPayload } from './types'

export type EnqueueQuoteAcceptedInput = {
  companyId: string
  quoteId: string
  acceptedVersionId?: string | null
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

export async function enqueueQuoteAcceptedNotification(input: EnqueueQuoteAcceptedInput) {
  if (!input.companyId || !input.quoteId) {
    return { eventId: null, deliveryCount: 0 }
  }
  const db = getSupabaseServerClient()
  const { data: quote } = await db
    .from('quotes')
    .select(
      'id, company_id, quote_number, event_id, customer_id, quote_total, currency_code, accepted_version_id, proposal_accepted_at, customers(full_name, ab_name, contact_name), events(name, event_date, start_time, end_time)',
    )
    .eq('id', input.quoteId)
    .eq('company_id', input.companyId)
    .maybeSingle()

  const customer = Array.isArray(quote?.customers) ? quote?.customers[0] : quote?.customers
  const event = Array.isArray(quote?.events) ? quote?.events[0] : quote?.events
  const acceptedVersionId =
    input.acceptedVersionId || (quote?.accepted_version_id as string | undefined) || null
  const entityId = acceptedVersionId || input.quoteId
  const locale = input.locale === 'en' || input.locale === 'es' ? input.locale : 'pt'
  const payload: NotificationPayload = {
    eventKey: 'quote.accepted',
    entityType: 'quote_version',
    entityId,
    quoteId: input.quoteId,
    quoteNumber: input.quoteNumber || (quote?.quote_number as string | undefined) || null,
    acceptedVersionId,
    eventId: input.eventId || (quote?.event_id as string | undefined) || null,
    customerName:
      input.customerName ||
      customer?.full_name ||
      customer?.ab_name ||
      customer?.contact_name ||
      null,
    eventName: event?.name || null,
    eventDate: input.eventDate || event?.event_date || null,
    eventTime:
      input.eventTime ||
      [event?.start_time, event?.end_time].filter(Boolean).join(' – ') ||
      null,
    total: input.total ?? (quote?.quote_total as number | undefined) ?? null,
    currency: input.currency || (quote?.currency_code as string | undefined) || 'USD',
    locale,
    source: input.source,
    deepLinkPath: quoteDeepLinkPath(input.quoteId),
    environmentBanner: environmentBanner(locale),
  }
  return enqueueNotificationEventSafe({
    companyId: input.companyId,
    eventKey: 'quote.accepted',
    entityType: 'quote_version',
    entityId,
    payload,
    source: input.source,
  })
}

export async function enqueueQuoteAcceptedNotificationSafe(input: EnqueueQuoteAcceptedInput) {
  try {
    return await enqueueQuoteAcceptedNotification(input)
  } catch (error) {
    console.warn('[notifications] quote.accepted enqueue failed', {
      quoteId: input.quoteId,
      error: error instanceof Error ? error.message : 'unknown',
    })
    return { eventId: null, deliveryCount: 0 }
  }
}
