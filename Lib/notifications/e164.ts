/** Normalize a stored phone to E.164 for provider delivery. Keep the raw source. */
export function toE164(value: string | null | undefined): string | null {
  if (!value) return null
  const trimmed = String(value).trim()
  if (!trimmed) return null
  const digits = trimmed.replace(/\D/g, '')
  if (!digits) return null
  if (trimmed.startsWith('+') && digits.length >= 8 && digits.length <= 15) {
    return `+${digits}`
  }
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  if (digits.length === 10) return `+1${digits}`
  if (digits.length >= 8 && digits.length <= 15) return `+${digits}`
  return null
}

export function notificationIdempotencyKey(input: {
  companyId: string
  eventKey: string
  entityId: string
  recipientId: string
  channel: string
}) {
  return [
    input.companyId,
    input.eventKey,
    input.entityId,
    input.recipientId,
    input.channel,
  ].join(':')
}
