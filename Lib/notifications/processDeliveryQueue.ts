import { getSupabaseServerClient } from '@/Lib/supabaseServer'
import { toE164 } from './e164'
import { dispatchNotificationDelivery } from './dispatch'
import type { NotificationPayload } from './types'

const STUCK_MS = 2 * 60_000

export type ProcessQueueResult = {
  recovered: number
  processed: number
  sent: number
  failed: number
  skipped: number
  companies: string[]
}

function recipientSendable(recipient: {
  enabled?: boolean | null
  consent_status?: string | null
}) {
  if (recipient.enabled === false) return false
  if (recipient.consent_status === 'denied' || recipient.consent_status === 'unknown') return false
  return recipient.consent_status === 'confirmed' || recipient.consent_status == null
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

  let recoveredQuery = db
    .from('notification_deliveries')
    .update({
      status: 'pending',
      claimed_at: null,
      last_error: 'recovered_stuck_processing',
      next_attempt_at: now.toISOString(),
    })
    .eq('status', 'processing')
    .lt('claimed_at', stuckBefore)
    .select('id, company_id')
  if (input?.companyId) recoveredQuery = recoveredQuery.eq('company_id', input.companyId)
  const recovered = await recoveredQuery

  let pendingQuery = db
    .from('notification_deliveries')
    .select(
      'id, company_id, event_id, recipient_id, channel, status, attempt_count, max_attempts, notification_events(payload), notification_recipients(phone_e164, phone_raw, locale, enabled, consent_status)',
    )
    .in('status', ['pending', 'failed'])
    .lte('next_attempt_at', now.toISOString())
    .order('created_at', { ascending: true })
    .limit(limit)
  if (input?.companyId) pendingQuery = pendingQuery.eq('company_id', input.companyId)
  const pending = await pendingQuery

  const result: ProcessQueueResult = {
    recovered: recovered.data?.length ?? 0,
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
    if (!recipientSendable(recipient)) {
      await db
        .from('notification_deliveries')
        .update({
          status: 'cancelled',
          last_error:
            recipient.enabled === false ? 'recipient_disabled' : 'recipient_consent_missing',
          claimed_at: null,
        })
        .eq('id', row.id)
        .eq('company_id', row.company_id)
      result.skipped += 1
      continue
    }
    if (Number(row.attempt_count || 0) >= Number(row.max_attempts || 5) && row.status === 'failed') {
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
