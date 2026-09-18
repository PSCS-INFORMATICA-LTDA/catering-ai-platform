import type { NotificationConsentStatus } from './types'

export function isRecipientConsentConfirmed(
  consentStatus: NotificationConsentStatus | string | null | undefined,
) {
  return consentStatus === 'confirmed'
}

/** Only an enabled recipient with recorded confirmed consent may be sent. */
export function isRecipientSendable(recipient: {
  enabled?: boolean | null
  consent_status?: string | null
}) {
  if (recipient.enabled === false) return false
  return isRecipientConsentConfirmed(recipient.consent_status)
}

export function recipientSendBlockReason(recipient: {
  enabled?: boolean | null
  consent_status?: string | null
}) {
  if (recipient.enabled === false) return 'recipient_disabled'
  if (!isRecipientConsentConfirmed(recipient.consent_status)) return 'recipient_consent_missing'
  return null
}
