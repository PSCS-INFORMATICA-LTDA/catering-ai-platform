import { isUsablePhone, normalizePhone } from '@/Lib/normalizePhone'
import { parsePublicQuoteLocale, PublicQuoteHttpError } from './security'
import type { PublicQuoteDraft } from './types'

type UnknownRecord = Record<string, unknown>

function record(value: unknown): UnknownRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as UnknownRecord)
    : {}
}

function shortText(value: unknown, max = 240): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

function nullableText(value: unknown, max = 1000): string | null {
  const normalized = shortText(value, max)
  return normalized || null
}

function nonNegativeInteger(value: unknown, max = 10000): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return 0
  return Math.min(max, Math.max(0, Math.floor(parsed)))
}

function finiteCoordinate(value: unknown, min: number, max: number) {
  if (value == null || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= min && parsed <= max
    ? parsed
    : null
}

function validUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  )
}

function deriveEventName(firstName: string, lastName: string): string {
  return [firstName, lastName].filter(Boolean).join(' ').slice(0, 200)
}

export function sanitizePublicQuoteDraft(value: unknown): PublicQuoteDraft {
  const root = record(value)
  const contact = record(root.contact)
  const event = record(root.event)
  const address = record(event.address)
  const selection = record(root.selection)
  const grill = record(root.grill)
  const firstName = shortText(contact.firstName, 100)
  const lastName = shortText(contact.lastName, 120)
  const source =
    address.source === 'manual' || address.source === 'google'
      ? address.source
      : 'google'

  const rawSelections = record(selection.packageSelections)
  const packageSelections = Object.fromEntries(
    Object.entries(rawSelections)
      .slice(0, 40)
      .map(([groupId, itemId]) => [
        shortText(groupId, 64),
        shortText(itemId, 64),
      ])
      .filter(([groupId, itemId]) => validUuid(groupId) && validUuid(itemId)),
  )
  const rawAdditionals = Array.isArray(selection.additionals)
    ? selection.additionals
        .slice(0, 100)
        .map((line) => record(line))
        .map((line) => ({
          itemId: shortText(line.itemId, 64),
          quantity: nonNegativeInteger(line.quantity, 10000),
        }))
        .filter((line) => validUuid(line.itemId) && line.quantity > 0)
    : []
  const additionals = [...rawAdditionals.reduce((byId, line) => {
    const current = byId.get(line.itemId) ?? 0
    byId.set(line.itemId, Math.min(10000, current + line.quantity))
    return byId
  }, new Map<string, number>())].map(([itemId, quantity]) => ({
    itemId,
    quantity,
  }))

  return {
    locale: parsePublicQuoteLocale(root.locale) ?? 'pt',
    contact: {
      firstName,
      lastName,
      phone: shortText(contact.phone, 40),
      email: nullableText(contact.email, 254),
    },
    event: {
      eventName: deriveEventName(firstName, lastName),
      eventDate: shortText(event.eventDate, 10),
      startTime: shortText(event.startTime, 5),
      endTime: shortText(event.endTime, 5),
      adultCount: nonNegativeInteger(event.adultCount, 10000),
      childrenUnder3Count: nonNegativeInteger(
        event.childrenUnder3Count,
        10000,
      ),
      children4To12Count: nonNegativeInteger(
        event.children4To12Count,
        10000,
      ),
      address: {
        route: shortText(address.route, 240),
        number: shortText(address.number, 40),
        city: shortText(address.city, 120),
        region: shortText(address.region, 80),
        postalCode: shortText(address.postalCode, 24),
        country: shortText(address.country, 2).toUpperCase(),
        formattedAddress: shortText(address.formattedAddress, 500),
        placeId: nullableText(address.placeId, 240),
        latitude: finiteCoordinate(address.latitude, -90, 90),
        longitude: finiteCoordinate(address.longitude, -180, 180),
        source,
      },
    },
    selection: {
      packageId: shortText(selection.packageId, 64),
      packageSelections,
      additionals,
    },
    grill: {
      hasGrill: grill.hasGrill === true,
      photoReference: nullableText(grill.photoReference, 500),
      rentalRequired: grill.rentalRequired === true,
      rentalQty: nonNegativeInteger(grill.rentalQty, 20),
      notes: nullableText(grill.notes, 1000),
    },
  }
}

function isPersonName(value: string): boolean {
  return (
    value.length >= 1 &&
    /[A-Za-zÀ-ÖØ-öø-ÿ]/.test(value) &&
    !/^\d+$/.test(value)
  )
}

function timeToMinutes(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value)
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) return null
  return hours * 60 + minutes
}

export function validateCompletePublicQuoteDraft(
  value: unknown,
  options: {
    locale: string
    allowedCountries: string[]
    companyId: string
    sessionId: string
  },
): PublicQuoteDraft {
  const draft = sanitizePublicQuoteDraft(value)
  if (draft.locale !== options.locale) {
    throw new PublicQuoteHttpError(400, 'invalid_payload')
  }
  if (
    !isPersonName(draft.contact.firstName) ||
    !isPersonName(draft.contact.lastName) ||
    !isUsablePhone(draft.contact.phone)
  ) {
    throw new PublicQuoteHttpError(400, 'invalid_payload')
  }
  draft.contact.phone = normalizePhone(draft.contact.phone)
  if (
    draft.contact.email &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.contact.email)
  ) {
    throw new PublicQuoteHttpError(400, 'invalid_payload')
  }

  const eventDate = /^\d{4}-\d{2}-\d{2}$/.test(draft.event.eventDate)
    ? new Date(`${draft.event.eventDate}T00:00:00`)
    : null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  if (!eventDate || Number.isNaN(eventDate.getTime()) || eventDate < today) {
    throw new PublicQuoteHttpError(400, 'invalid_payload')
  }
  const start = timeToMinutes(draft.event.startTime)
  const end = timeToMinutes(draft.event.endTime)
  if (start == null || end == null || end <= start) {
    throw new PublicQuoteHttpError(400, 'invalid_payload')
  }
  if (draft.event.adultCount < 1) {
    throw new PublicQuoteHttpError(400, 'invalid_payload')
  }
  const address = draft.event.address
  if (
    !address.route ||
    !address.city ||
    !address.region ||
    !address.postalCode ||
    !options.allowedCountries.includes(address.country)
  ) {
    throw new PublicQuoteHttpError(400, 'invalid_payload')
  }
  if (address.source === 'google' && !address.placeId) {
    throw new PublicQuoteHttpError(400, 'invalid_payload')
  }
  if (!validUuid(draft.selection.packageId)) {
    throw new PublicQuoteHttpError(400, 'invalid_payload')
  }
  if (draft.grill.hasGrill) {
    const expectedPrefix = `public-quote-grill/${options.companyId}/${options.sessionId}/`
    if (!draft.grill.photoReference?.startsWith(expectedPrefix)) {
      throw new PublicQuoteHttpError(400, 'invalid_payload')
    }
    draft.grill.rentalRequired = false
    draft.grill.rentalQty = 0
  } else if (
    draft.grill.rentalRequired &&
    draft.grill.rentalQty < 1
  ) {
    throw new PublicQuoteHttpError(400, 'invalid_payload')
  }

  draft.event.eventName = deriveEventName(
    draft.contact.firstName,
    draft.contact.lastName,
  )
  return draft
}
