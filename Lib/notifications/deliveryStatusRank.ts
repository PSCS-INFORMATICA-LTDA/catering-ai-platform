import type { NotificationDeliveryStatus } from './types.ts'

const RANK: Record<NotificationDeliveryStatus, number> = {
  pending: 0,
  processing: 1,
  uncertain: 1,
  sent: 2,
  delivered: 3,
  read: 4,
  failed: 2,
  cancelled: 5,
}

export function deliveryStatusRank(status: string | null | undefined) {
  return RANK[status as NotificationDeliveryStatus] ?? -1
}

/** Never regress read → sent/delivered, or delivered → sent. Failed may follow a send. */
export function canAdvanceDeliveryStatus(
  current: string | null | undefined,
  next: string | null | undefined,
) {
  if (!next) return false
  if (current === next) return false
  if (!current) return true
  if (current === 'cancelled') return false
  if (current === 'read' && (next === 'sent' || next === 'delivered' || next === 'processing')) {
    return false
  }
  if (current === 'delivered' && (next === 'sent' || next === 'processing' || next === 'pending')) {
    return false
  }
  if (current === 'sent' && (next === 'processing' || next === 'pending')) return false
  if (next === 'failed') return current !== 'cancelled'
  return deliveryStatusRank(next) >= deliveryStatusRank(current)
}
