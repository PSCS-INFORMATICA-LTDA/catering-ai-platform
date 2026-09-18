import { getSupabaseServerClient } from '@/Lib/supabaseServer'
import { toE164 } from './e164'
import { dispatchNotificationDelivery } from './dispatch'
import { NOTIFICATION_EVENT_EMBED, NOTIFICATION_RECIPIENT_EMBED } from './embeds'
import { recipientSendBlockReason } from './recipientConsent'
import type { NotificationPayload } from './types'

const STUCK_MS = 2 * 60_000

export type ProcessQueueResult = {
  recovered: number
  quarantined: number
  processed: number
  sent: number
  failed: number
  skipped: number
  companies: string[]
}

export async function processNotificationQueue(input?: {
  limit?: number
  companyId?: string
  reason?: string
}): Promise<ProcessQueueResult> {
  const db = getSupabaseServerClient()
  const limit = Math.min(Math.max(input?.limit ?? 20, 1), 50)
  const now = new Date()
  const stuckBefore = new Date(now.getTime() - STUCK_MS).toISOString()

  let leaseQuery = db
    .from('notification_deliveries')
    .update({
      status: 'pending',
      claimed_at: null,
      last_error: 'recovered_lease_before_send',
      next_attempt_at: now.toISOString(),
    })
    .eq('status', 'processing')
    .lt('claimed_at', stuckBefore)
    .is('send_attempted_at', null)
    .is('provider_message_id', null)
    .select('id, company_id')
  if (input?.companyId) leaseQuery = leaseQuery.eq('company_id', input.companyId)
  const recoveredLease = await leaseQuery
  if (recoveredLease.error) {
    throw new Error(`queue_recover_failed:${recoveredLease.error.message}`)
  }

  let uncertainQuery = db
    .from('notification_deliveries')
    .update({
      status: 'uncertain',
      result_state: 'uncertain',
      claimed_at: null,
      last_error: 'recovered_possibly_sent',
    })
    .eq('status', 'processing')
    .lt('claimed_at', stuckBefore)
    .or('send_attempted_at.not.is.null,provider_message_id.not.is.null')
    .select('id, company_id')
  if (input?.companyId) uncertainQuery = uncertainQuery.eq('company_id', input.companyId)
  const recoveredUncertain = await uncertainQuery
  if (recoveredUncertain.error) {
    throw new Error(`queue_quarantine_failed:${recoveredUncertain.error.message}`)
  }

  let leftoverQuery = db
    .from('notification_deliveries')
    .update({
      status: 'uncertain',
      result_state: 'uncertain',
      claimed_at: null,
      last_error: 'recovered_possibly_sent',
    })
    .eq('status', 'processing')
    .lt('claimed_at', stuckBefore)
    .select('id, company_id')
  if (input?.companyId) leftoverQuery = leftoverQuery.eq('company_id', input.companyId)
  const leftover = await leftoverQuery
  if (leftover.error) {
    throw new Error(`queue_leftover_failed:${leftover.error.message}`)
  }

  let pendingQuery = db
    .from('notification_deliveries')
    .select(
      `id, company_id, event_id, recipient_id, channel, status, attempt_count, max_attempts, ${NOTIFICATION_EVENT_EMBED}(payload), ${NOTIFICATION_RECIPIENT_EMBED}(phone_e164, phone_raw, locale, enabled, consent_status)`,
    )
    .eq('queue_eligible', true)
    .lte('next_attempt_at', now.toISOString())
    .order('created_at', { ascending: true })
    .limit(limit)
  if (input?.companyId) pendingQuery = pendingQuery.eq('company_id', input.companyId)
  const pending = await pendingQuery
  if (pending.error) {
    throw new Error(`queue_list_failed:${pending.error.message}`)
  }

  const result: ProcessQueueResult = {
    recovered: recoveredLease.data?.length ?? 0,
    quarantined: (recoveredUncertain.data?.length ?? 0) + (leftover.data?.length ?? 0),
    processed: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
    companies: [],
  }
  const companies = new Set<string>()

  for (const row of pending.data ?? []) {
    const event = Array.isArray(row.notification_events)
      ? row.notification_events[0]
      : row.notification_events
    const recipient = Array.isArray(row.notification_recipients)
      ? row.notification_recipients[0]
      : row.notification_recipients
    if (!event || !recipient) {
      result.skipped += 1
      continue
    }
    const block = recipientSendBlockReason(recipient)
    if (block) {
      await db
        .from('notification_deliveries')
        .update({
          status: 'cancelled',
          last_error: block,
          claimed_at: null,
        })
        .eq('id', row.id)
        .eq('company_id', row.company_id)
      result.skipped += 1
      continue
    }
    companies.add(String(row.company_id))
    const outcome = await dispatchNotificationDelivery({
      deliveryId: String(row.id),
      companyId: String(row.company_id),
      channel: String(row.channel),
      toE164: toE164(recipient.phone_e164 || recipient.phone_raw),
      locale: recipient.locale === 'en' || recipient.locale === 'es' ? recipient.locale : 'pt',
      payload: (event.payload || {}) as NotificationPayload,
    })
    result.processed += 1
    if (outcome.ok) result.sent += 1
    else result.failed += 1
  }

  result.companies = [...companies]
  return result
}
