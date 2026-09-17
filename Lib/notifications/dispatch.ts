import { getSupabaseServerClient } from '@/Lib/supabaseServer'
import { quoteDeepLinkUrl } from './env'
import { getNotificationProvider } from './providers'
import type { NotificationChannel, QuoteCreatedPayload } from './types'

export async function dispatchNotificationDelivery(input: {
  deliveryId: string
  companyId: string
  channel: string
  toE164: string | null
  locale: 'pt' | 'en' | 'es'
  payload: QuoteCreatedPayload
}) {
  const db = getSupabaseServerClient()
  const claimed = await db
    .from('notification_deliveries')
    .update({
      status: 'processing',
    })
    .eq('id', input.deliveryId)
    .eq('company_id', input.companyId)
    .in('status', ['pending', 'failed'])
    .select('id, attempt_count')
    .maybeSingle()

  if (!claimed.data?.id) return { ok: false as const, error: 'not_claimable' }

  const attemptCount = Number(claimed.data.attempt_count || 0) + 1
  const provider = getNotificationProvider(input.channel as NotificationChannel)
  if (!provider) {
    await db
      .from('notification_deliveries')
      .update({
        status: 'failed',
        attempt_count: attemptCount,
        failed_at: new Date().toISOString(),
        last_error: 'provider_unavailable',
      })
      .eq('id', input.deliveryId)
      .eq('company_id', input.companyId)
    return { ok: false as const, error: 'provider_unavailable' }
  }

  try {
    const result = await provider.send({
      companyId: input.companyId,
      channel: provider.channel,
      toE164: input.toE164 || '',
      locale: input.locale,
      templateKey: 'new_quote_internal',
      payload: input.payload,
      deepLinkUrl: quoteDeepLinkUrl(input.payload.quoteId),
    })
    if (result.ok) {
      await db
        .from('notification_deliveries')
        .update({
          status: 'sent',
          attempt_count: attemptCount,
          sent_at: new Date().toISOString(),
          provider: result.provider,
          provider_message_id: result.providerMessageId ?? null,
          last_error: null,
        })
        .eq('id', input.deliveryId)
        .eq('company_id', input.companyId)
      return { ok: true as const }
    }
    await db
      .from('notification_deliveries')
      .update({
        status: 'failed',
        attempt_count: attemptCount,
        failed_at: new Date().toISOString(),
        provider: result.provider,
        last_error: (result.error || 'send_failed').slice(0, 240),
      })
      .eq('id', input.deliveryId)
      .eq('company_id', input.companyId)
    return { ok: false as const, error: result.error || 'send_failed' }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'send_failed'
    await db
      .from('notification_deliveries')
      .update({
        status: 'failed',
        attempt_count: attemptCount,
        failed_at: new Date().toISOString(),
        last_error: message.slice(0, 240),
      })
      .eq('id', input.deliveryId)
      .eq('company_id', input.companyId)
    return { ok: false as const, error: message }
  }
}
