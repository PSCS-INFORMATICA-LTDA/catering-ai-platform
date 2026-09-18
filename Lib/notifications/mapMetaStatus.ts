import { canAdvanceDeliveryStatus } from './deliveryStatusRank.ts'
import type { NotificationDeliveryStatus } from './types.ts'

export function mapMetaWhatsAppStatus(value: string | null | undefined): NotificationDeliveryStatus | null {
  const status = String(value || '').trim().toLowerCase()
  if (status === 'sent') return 'sent'
  if (status === 'delivered') return 'delivered'
  if (status === 'read') return 'read'
  if (status === 'failed' || status === 'undelivered') return 'failed'
  return null
}

export type MetaStatusUpdate = {
  providerMessageId: string
  status: NotificationDeliveryStatus
  timestamp: string | null
  error: string | null
  phoneNumberId: string | null
  wabaId: string | null
  displayPhoneNumber: string | null
}

export function parseMetaStatusWebhook(body: unknown): MetaStatusUpdate[] {
  const root = body && typeof body === 'object' ? (body as Record<string, unknown>) : null
  const entries = Array.isArray(root?.entry) ? root.entry : []
  const updates: MetaStatusUpdate[] = []
  for (const entry of entries) {
    const wabaId = String((entry as { id?: string })?.id || '') || null
    const changes = Array.isArray((entry as { changes?: unknown[] })?.changes)
      ? (entry as { changes: unknown[] }).changes
      : []
    for (const change of changes) {
      const value = (change as {
        value?: {
          statuses?: unknown[]
          metadata?: { phone_number_id?: string; display_phone_number?: string }
        }
      })?.value
      const phoneNumberId = value?.metadata?.phone_number_id
        ? String(value.metadata.phone_number_id)
        : null
      const displayPhoneNumber = value?.metadata?.display_phone_number
        ? String(value.metadata.display_phone_number)
        : null
      const statuses = Array.isArray(value?.statuses) ? value.statuses : []
      for (const row of statuses) {
        const item = row as {
          id?: string
          status?: string
          timestamp?: string | number
          errors?: Array<{ title?: string; message?: string }>
        }
        const mapped = mapMetaWhatsAppStatus(item.status)
        if (!item.id || !mapped) continue
        updates.push({
          providerMessageId: String(item.id),
          status: mapped,
          timestamp: item.timestamp ? new Date(Number(item.timestamp) * 1000).toISOString() : null,
          error: item.errors?.[0]?.message || item.errors?.[0]?.title || null,
          phoneNumberId,
          wabaId,
          displayPhoneNumber,
        })
      }
    }
  }
  return updates
}

export function deliveryStatusPatch(update: MetaStatusUpdate) {
  const patch: Record<string, unknown> = {
    status: update.status,
  }
  if (update.status === 'sent') patch.sent_at = update.timestamp || new Date().toISOString()
  if (update.status === 'delivered') patch.delivered_at = update.timestamp || new Date().toISOString()
  if (update.status === 'read') patch.read_at = update.timestamp || new Date().toISOString()
  if (update.status === 'failed') {
    patch.failed_at = update.timestamp || new Date().toISOString()
    patch.last_error = (update.error || 'whatsapp_failed').slice(0, 240)
  }
  return patch
}

export function shouldApplyMetaStatus(
  currentStatus: string | null | undefined,
  nextStatus: string,
) {
  return canAdvanceDeliveryStatus(currentStatus, nextStatus)
}
