import { sanitizePublicQuoteDraft } from './validation'
import type { PublicQuoteDraft } from './types'

type UnknownRecord = Record<string, unknown>

function record(value: unknown): UnknownRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as UnknownRecord)
    : {}
}

/**
 * Preview must use the live wizard payload, not a stale autosave draft.
 * Tenant/session still come from the opaque cookie — never from the body.
 */
export function mergePublicQuotePreviewDraft(
  sessionDraft: unknown,
  body: unknown,
): PublicQuoteDraft {
  const current = sanitizePublicQuoteDraft(sessionDraft)
  const payload = record(body)
  const eventPatch = record(payload.event)
  const addressPatch = record(eventPatch.address)
  const additionals = Array.isArray(payload.additionals)
    ? payload.additionals
    : current.selection.additionals

  return sanitizePublicQuoteDraft({
    locale: current.locale,
    contact: current.contact,
    event: {
      ...current.event,
      eventDate: eventPatch.eventDate ?? current.event.eventDate,
      startTime: eventPatch.startTime ?? current.event.startTime,
      endTime: eventPatch.endTime ?? current.event.endTime,
      adultCount: eventPatch.adultCount ?? current.event.adultCount,
      childrenUnder3Count:
        eventPatch.childrenUnder3Count ?? current.event.childrenUnder3Count,
      children4To12Count:
        eventPatch.children4To12Count ?? current.event.children4To12Count,
      address: {
        ...current.event.address,
        ...addressPatch,
      },
    },
    selection: {
      ...current.selection,
      packageId:
        typeof payload.packageId === 'string' && payload.packageId.trim()
          ? payload.packageId
          : current.selection.packageId,
      additionals,
    },
    grill: {
      ...current.grill,
      rentalRequired:
        typeof payload.grillRentalRequired === 'boolean'
          ? payload.grillRentalRequired
          : current.grill.rentalRequired,
      rentalQty:
        payload.grillRentalQty != null
          ? payload.grillRentalQty
          : current.grill.rentalQty,
    },
  })
}

export function hasConfirmedGoogleAddress(draft: PublicQuoteDraft): boolean {
  const address = draft.event.address
  return (
    address.source === 'google' &&
    Boolean(
      address.placeId ||
        (address.formattedAddress && address.city && address.region),
    )
  )
}
