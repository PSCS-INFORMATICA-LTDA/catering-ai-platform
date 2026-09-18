export type StuckProcessingRow = {
  send_attempted_at?: string | null
  provider_message_id?: string | null
}

/** Lease-only rows can return to pending. Anything that may have hit Meta is uncertain. */
export function classifyStuckProcessing(row: StuckProcessingRow): 'pending' | 'uncertain' {
  if (row.send_attempted_at || row.provider_message_id) return 'uncertain'
  return 'pending'
}

export function isQueueEligibleDelivery(row: {
  status: string
  attempt_count?: number | null
  max_attempts?: number | null
}) {
  if (row.status === 'pending') return true
  const attempts = Number(row.attempt_count || 0)
  const maxAttempts = Number(row.max_attempts || 5)
  return row.status === 'failed' && attempts < maxAttempts
}

export function selectClaimableBeforeLimit<T extends {
  status: string
  attempt_count?: number | null
  max_attempts?: number | null
}>(rows: T[], limit: number) {
  return rows.filter(isQueueEligibleDelivery).slice(0, Math.max(limit, 0))
}
