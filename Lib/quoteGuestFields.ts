export type GuestCounts = {
  adultCount: number
  childrenUnder3Count: number
  children4To12Count: number
}

function toNumber(value: number | null | undefined) {
  return Math.max(0, Number(value ?? 0))
}

/**
 * Public Event children must be answered explicitly.
 * 0 is a real answer. Empty / null / undefined is not.
 */
export function isExplicitNonNegativeInteger(value: unknown): boolean {
  if (value === null || value === undefined || value === '') return false
  if (typeof value === 'string' && value.trim() === '') return false
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isInteger(parsed) && parsed >= 0
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100
}

export function calcBillableGuestCount(guestCounts: GuestCounts) {
  const adultCount = toNumber(guestCounts.adultCount)
  const children4To12Count = toNumber(guestCounts.children4To12Count)
  return roundMoney(adultCount + children4To12Count * 0.5)
}

export function calcPhysicalGuestCount(guestCounts: GuestCounts) {
  return (
    toNumber(guestCounts.adultCount) +
    toNumber(guestCounts.childrenUnder3Count) +
    toNumber(guestCounts.children4To12Count)
  )
}

export const OFFICIAL_GUEST_FIELD_NAMES = [
  'adult_count',
  'children_under_3_count',
  'children_4_to_12_count',
  'physical_guest_count',
  'billable_guest_count',
] as const

export type OfficialGuestFieldName = (typeof OFFICIAL_GUEST_FIELD_NAMES)[number]

export type QuoteOfficialGuestRecord = {
  adult_count?: number | null
  children_under_3_count?: number | null
  children_4_to_12_count?: number | null
  physical_guest_count?: number | null
  billable_guest_count?: number | null
}

export function logMissingOfficialGuestFields(
  quote: QuoteOfficialGuestRecord,
  context: string,
): OfficialGuestFieldName[] {
  const missing = OFFICIAL_GUEST_FIELD_NAMES.filter(
    (field) => quote[field] == null,
  )

  if (missing.length > 0) {
    console.error(
      `[CDL Quote] Missing official Supabase guest fields (${context}): ${missing.join(', ')}`,
      { quoteId: 'id' in quote ? (quote as { id?: string }).id : undefined },
    )
  }

  return missing
}

export function readOfficialGuestCountsFromQuote(
  quote: QuoteOfficialGuestRecord,
  context = 'quote',
): GuestCounts {
  logMissingOfficialGuestFields(quote, context)

  const guestCounts: GuestCounts = {
    adultCount: Math.max(0, Number(quote.adult_count ?? 0)),
    childrenUnder3Count: Math.max(0, Number(quote.children_under_3_count ?? 0)),
    children4To12Count: Math.max(0, Number(quote.children_4_to_12_count ?? 0)),
  }

  const computedPhysical = calcPhysicalGuestCount(guestCounts)
  const computedBillable = calcBillableGuestCount(guestCounts)

  if (
    quote.physical_guest_count != null &&
    Number(quote.physical_guest_count) !== computedPhysical
  ) {
    console.error(
      `[CDL Quote] physical_guest_count mismatch (${context}): stored=${quote.physical_guest_count}, computed=${computedPhysical}`,
    )
  }

  if (
    quote.billable_guest_count != null &&
    Number(quote.billable_guest_count) !== computedBillable
  ) {
    console.error(
      `[CDL Quote] billable_guest_count mismatch (${context}): stored=${quote.billable_guest_count}, computed=${computedBillable}`,
    )
  }

  return guestCounts
}

export function buildOfficialGuestPayload(guestCounts: GuestCounts) {
  return {
    adult_count: guestCounts.adultCount,
    children_under_3_count: guestCounts.childrenUnder3Count,
    children_4_to_12_count: guestCounts.children4To12Count,
    physical_guest_count: calcPhysicalGuestCount(guestCounts),
    billable_guest_count: calcBillableGuestCount(guestCounts),
  }
}
