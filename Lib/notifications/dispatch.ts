import { getSupabaseServerClient } from '@/Lib/supabaseServer'
import { notificationDeepLinkUrl } from './env'
import { getNotificationProvider } from './providers'
import { recipientSendBlockReason } from './recipientConsent'
import { templateKeyForEvent } from './templates'
import type { NotificationChannel, NotificationPayload } from './types'

const META_TIMEOUT_MS = 12_000

export function nextBackoffIso(attemptCount: number) {
  const minutes = [0.5, 2, 8, 30, 60]
  const index = Math.min(Math.max(attemptCount - 1, 0), minutes.length - 1)
  return new Date(Date.now() + minutes[index] * 60_000).toISOString()
}

export async function dispatchNotificationDelivery(input: {
  deliveryId: string
  companyId: string
  channel: string
  toE164: string | null
  locale: 'pt' | 'en' | 'es'
  payload: NotificationPayload
}) {
  const db = getSupabaseServerClient()
  const claimed = await db
    .from('notification_deliveries')
    .update({
      status: 'processing',
      claimed_at: new Date().toISOString(),
      claimed_by: 'worker',
      last_attempt_at: new Date().toISOString(),
    })
    .eq('id', input.deliveryId)
    .eq('company_id', input.companyId)
    .in('status', ['pending', 'failed'])
    .select('id, attempt_count, template_key, max_attempts, status, recipient_id')
    .maybeSingle()

  if (!claimed.data?.id) return { ok: false as const, error: 'not_claimable' }

  const { data: recipient } = await db
    .from('notification_recipients')
    .select('enabled, consent_status')
    .eq('id', claimed.data.recipient_id)
    .eq('company_id', input.companyId)
    .maybeSingle()
  const block = recipientSendBlockReason(recipient || { consent_status: null })
  if (block) {
    await db
      .from('notification_deliveries')
      .update({
        status: 'cancelled',
        last_error: block,
        claimed_at: null,
      })
      .eq('id', input.deliveryId)
      .eq('company_id', input.companyId)
    return { ok: false as const, error: block }
  }

  const attemptCount = Number(claimed.data.attempt_count || 0) + 1
  const maxAttempts = Number(claimed.data.max_attempts || 5)
  const marked = await db
    .from('notification_deliveries')
    .update({
      send_attempted_at: new Date().toISOString(),
      last_attempt_at: new Date().toISOString(),
    })
    .eq('id', input.deliveryId)
    .eq('company_id', input.companyId)
    .eq('status', 'processing')
    .select('id')
    .maybeSingle()
  if (!marked.data?.id) return { ok: false as const, error: 'send_mark_failed' }

  const provider = getNotificationProvider(input.channel as NotificationChannel)
  if (!provider) {
    await db
      .from('notification_deliveries')
      .update({
        status: 'failed',
        attempt_count: attemptCount,
        failed_at: new Date().toISOString(),
        last_error: 'provider_unavailable',
        result_state: 'failed',
        claimed_at: null,
      })
      .eq('id', input.deliveryId)
      .eq('company_id', input.companyId)
    return { ok: false as const, error: 'provider_unavailable' }
  }

  const templateKey = claimed.data.template_key || templateKeyForEvent(input.payload.eventKey)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), META_TIMEOUT_MS)
  try {
    const result = await Promise.race([
      provider.send({
        companyId: input.companyId,
        channel: provider.channel,
        toE164: input.toE164 || '',
        locale: input.locale,
        templateKey,
        payload: input.payload,
        deepLinkUrl: notificationDeepLinkUrl(input.payload.deepLinkPath),
      }),
      new Promise<never>((_, reject) => {
        controller.signal.addEventListener('abort', () => {
          reject(Object.assign(new Error('send_timeout_uncertain'), { name: 'AbortError' }))
        })
      }),
    ])
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
          result_state: 'sent',
          claimed_at: null,
        })
        .eq('id', input.deliveryId)
        .eq('company_id', input.companyId)
      return { ok: true as const }
    }
    if (result.uncertain) {
      await db
        .from('notification_deliveries')
        .update({
          status: 'uncertain',
          attempt_count: attemptCount,
          provider: result.provider,
          provider_message_id: result.providerMessageId ?? null,
          last_error: (result.error || 'send_timeout_uncertain').slice(0, 240),
          result_state: 'uncertain',
          claimed_at: null,
        })
        .eq('id', input.deliveryId)
        .eq('company_id', input.companyId)
      return { ok: false as const, error: result.error || 'send_timeout_uncertain', uncertain: true }
    }
    const exhausted = attemptCount >= maxAttempts
    await db
      .from('notification_deliveries')
      .update({
        status: 'failed',
        attempt_count: attemptCount,
        failed_at: exhausted ? new Date().toISOString() : null,
        provider: result.provider,
        last_error: (result.error || 'send_failed').slice(0, 240),
        result_state: exhausted ? 'failed' : null,
        next_attempt_at: exhausted
          ? new Date().toISOString()
          : result.retryAfterSeconds
            ? new Date(Date.now() + result.retryAfterSeconds * 1000).toISOString()
            : nextBackoffIso(attemptCount),
        claimed_at: null,
      })
      .eq('id', input.deliveryId)
      .eq('company_id', input.companyId)
    return { ok: false as const, error: result.error || 'send_failed' }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'send_failed'
    const uncertain = error instanceof Error && (error.name === 'AbortError' || message.includes('timeout'))
    await db
      .from('notification_deliveries')
      .update({
        status: uncertain ? 'uncertain' : 'failed',
        attempt_count: attemptCount,
        failed_at: uncertain ? null : new Date().toISOString(),
        last_error: message.slice(0, 240),
        result_state: uncertain ? 'uncertain' : 'failed',
        next_attempt_at: uncertain ? new Date().toISOString() : nextBackoffIso(attemptCount),
        claimed_at: null,
      })
      .eq('id', input.deliveryId)
      .eq('company_id', input.companyId)
    return { ok: false as const, error: message, uncertain }
  } finally {
    clearTimeout(timer)
  }
}
