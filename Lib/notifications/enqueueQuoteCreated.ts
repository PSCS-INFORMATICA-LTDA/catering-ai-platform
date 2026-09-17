import { getSupabaseServerClient } from '@/Lib/supabaseServer'
import { notificationIdempotencyKey, toE164 } from './e164'
import { quoteDeepLinkPath } from './env'
import { dispatchNotificationDelivery } from './dispatch'
import type { QuoteCreatedPayload } from './types'

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
  source: QuoteCreatedPayload['source']
}

/**
 * Post-commit enqueue. Never throws to the quote transaction.
 * Idempotent on company + quote.created + quote_id.
 */
export async function enqueueQuoteCreatedNotification(
  input: EnqueueQuoteCreatedInput,
): Promise<{ eventId: string | null; deliveryCount: number }> {
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
  const payload: QuoteCreatedPayload = {
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

  const inserted = await db
    .from('notification_events')
    .insert({
      company_id: input.companyId,
      event_key: 'quote.created',
      entity_type: 'quote',
      entity_id: input.quoteId,
      payload,
      actor_source: input.source,
    })
    .select('id')
    .maybeSingle()

  let eventId = inserted.data?.id as string | undefined
  if (!eventId) {
    const existing = await db
      .from('notification_events')
      .select('id')
      .eq('company_id', input.companyId)
      .eq('event_key', 'quote.created')
      .eq('entity_id', input.quoteId)
      .maybeSingle()
    eventId = existing.data?.id as string | undefined
  }
  if (!eventId) return { eventId: null, deliveryCount: 0 }

  const recipients = await db
    .from('notification_recipients')
    .select('id, channel, phone_raw, phone_e164, locale, enabled')
    .eq('company_id', input.companyId)
    .eq('event_key', 'quote.created')
    .eq('enabled', true)

  const rows = recipients.data ?? []
  let deliveryCount = 0
  for (const recipient of rows) {
    const channel = String(recipient.channel || '')
    if (channel !== 'whatsapp' && channel !== 'web_push' && channel !== 'email' && channel !== 'in_app') {
      continue
    }
    const idempotencyKey = notificationIdempotencyKey({
      companyId: input.companyId,
      eventKey: 'quote.created',
      entityId: input.quoteId,
      recipientId: String(recipient.id),
      channel,
    })
    await db.from('notification_deliveries').upsert(
      {
        company_id: input.companyId,
        event_id: eventId,
        recipient_id: recipient.id,
        channel,
        provider: channel === 'whatsapp' ? 'meta_whatsapp' : channel,
        template_key: channel === 'whatsapp' ? 'new_quote_internal' : null,
        status: 'pending',
        idempotency_key: idempotencyKey,
      },
      { onConflict: 'idempotency_key', ignoreDuplicates: true },
    )
    const delivery = await db
      .from('notification_deliveries')
      .select('id, status')
      .eq('idempotency_key', idempotencyKey)
      .eq('company_id', input.companyId)
      .maybeSingle()

    const deliveryId = delivery.data?.id as string | undefined
    if (!deliveryId) continue
    deliveryCount += 1
    if (delivery.data?.status === 'sent' || delivery.data?.status === 'delivered' || delivery.data?.status === 'read') {
      continue
    }
    await dispatchNotificationDelivery({
      deliveryId,
      companyId: input.companyId,
      channel,
      toE164: toE164(recipient.phone_e164 || recipient.phone_raw),
      locale:
        recipient.locale === 'en' || recipient.locale === 'es' ? recipient.locale : 'pt',
      payload,
    })
  }

  return { eventId, deliveryCount }
}

export async function enqueueQuoteCreatedNotificationSafe(
  input: EnqueueQuoteCreatedInput,
) {
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
