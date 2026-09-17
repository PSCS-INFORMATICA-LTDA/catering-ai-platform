import { getSupabaseServerClient } from '@/Lib/supabaseServer'
import { notificationIdempotencyKey, toE164 } from './e164'
import { dispatchNotificationDelivery } from './dispatch'
import { templateKeyForEvent } from './templates'
import type { NotificationPayload } from './types'

export type EnqueueNotificationInput = {
  companyId: string
  eventKey: string
  entityType: string
  entityId: string
  payload: NotificationPayload
  source: string
  dispatch?: boolean
}

export async function enqueueNotificationEvent(
  input: EnqueueNotificationInput,
): Promise<{ eventId: string | null; deliveryCount: number }> {
  if (!input.companyId || !input.eventKey || !input.entityId) {
    return { eventId: null, deliveryCount: 0 }
  }
  const db = getSupabaseServerClient()
  const inserted = await db
    .from('notification_events')
    .insert({
      company_id: input.companyId,
      event_key: input.eventKey,
      entity_type: input.entityType,
      entity_id: input.entityId,
      payload: input.payload,
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
      .eq('event_key', input.eventKey)
      .eq('entity_id', input.entityId)
      .maybeSingle()
    eventId = existing.data?.id as string | undefined
  }
  if (!eventId) return { eventId: null, deliveryCount: 0 }

  const subscriptions = await db
    .from('notification_subscriptions')
    .select('recipient_id, enabled, notification_recipients(id, channel, phone_raw, phone_e164, locale, enabled)')
    .eq('company_id', input.companyId)
    .eq('event_key', input.eventKey)
    .eq('enabled', true)

  const rows = subscriptions.data ?? []
  let deliveryCount = 0
  for (const row of rows) {
    const recipient = Array.isArray(row.notification_recipients)
      ? row.notification_recipients[0]
      : row.notification_recipients
    if (!recipient || recipient.enabled === false) continue
    const channel = String(recipient.channel || '')
    if (channel !== 'whatsapp' && channel !== 'web_push' && channel !== 'email' && channel !== 'in_app') {
      continue
    }
    const idempotencyKey = notificationIdempotencyKey({
      companyId: input.companyId,
      eventKey: input.eventKey,
      entityId: input.entityId,
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
        template_key: templateKeyForEvent(input.eventKey),
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
    if (
      delivery.data?.status === 'sent' ||
      delivery.data?.status === 'delivered' ||
      delivery.data?.status === 'read'
    ) {
      continue
    }
    if (input.dispatch === false) continue
    await dispatchNotificationDelivery({
      deliveryId,
      companyId: input.companyId,
      channel,
      toE164: toE164(recipient.phone_e164 || recipient.phone_raw),
      locale: recipient.locale === 'en' || recipient.locale === 'es' ? recipient.locale : 'pt',
      payload: input.payload,
    })
  }

  return { eventId, deliveryCount }
}

export async function enqueueNotificationEventSafe(input: EnqueueNotificationInput) {
  try {
    return await enqueueNotificationEvent(input)
  } catch (error) {
    console.warn('[notifications] enqueue failed', {
      eventKey: input.eventKey,
      entityId: input.entityId,
      error: error instanceof Error ? error.message : 'unknown',
    })
    return { eventId: null, deliveryCount: 0 }
  }
}
