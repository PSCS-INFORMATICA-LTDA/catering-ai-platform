import { getSupabaseServerClient } from '@/Lib/supabaseServer'
import { toE164 } from './e164'
import { dispatchNotificationDelivery } from './dispatch'
import type { NotificationPayload } from './types'

export async function retryNotificationDelivery(input: {
  companyId: string
  deliveryId: string
}) {
  const db = getSupabaseServerClient()
  const { data: delivery } = await db
    .from('notification_deliveries')
    .select('id, company_id, event_id, recipient_id, channel, status')
    .eq('id', input.deliveryId)
    .eq('company_id', input.companyId)
    .maybeSingle()
  if (!delivery) return { ok: false as const, error: 'delivery_not_found' }
  if (delivery.status === 'sent' || delivery.status === 'delivered' || delivery.status === 'read') {
    return { ok: true as const, duplicate: true }
  }
  if (delivery.status === 'uncertain') {
    await db
      .from('notification_deliveries')
      .update({
        status: 'pending',
        next_attempt_at: new Date().toISOString(),
        last_error: 'manual_retry_after_uncertain',
      })
      .eq('id', input.deliveryId)
      .eq('company_id', input.companyId)
  }

  const [{ data: event }, { data: recipient }] = await Promise.all([
    db
      .from('notification_events')
      .select('payload')
      .eq('id', delivery.event_id)
      .eq('company_id', input.companyId)
      .maybeSingle(),
    db
      .from('notification_recipients')
      .select('phone_e164, phone_raw, locale, enabled')
      .eq('id', delivery.recipient_id)
      .eq('company_id', input.companyId)
      .maybeSingle(),
  ])
  if (!event || !recipient) return { ok: false as const, error: 'delivery_context_missing' }
  if (recipient.enabled === false) {
    return { ok: false as const, error: 'recipient_disabled' }
  }

  const payload = (event.payload || {}) as NotificationPayload
  return dispatchNotificationDelivery({
    deliveryId: delivery.id,
    companyId: input.companyId,
    channel: String(delivery.channel),
    toE164: toE164(recipient.phone_e164 || recipient.phone_raw),
    locale: recipient.locale === 'en' || recipient.locale === 'es' ? recipient.locale : 'pt',
    payload,
  })
}
