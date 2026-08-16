import type { GuestCounts } from './calculateQuoteTotals'
import { logMissingOfficialGuestFields } from './quoteGuestFields'
import {
  isPricingBreakdown,
  type PricingBreakdown,
} from './pricing/pricingBreakdownTypes'

export const QUOTE_SNAPSHOT_FINANCIAL_FIELDS = [
  'package_unit_price',
  'package_total',
  'additional_total',
  'mileage_base_location',
  'mileage_free_limit',
  'mileage_rate',
  'mileage_fee',
  'reservation_percentage',
  'reservation_amount',
  'balance_due',
  'quote_total',
  'adult_count',
  'children_under_3_count',
  'children_4_to_12_count',
  'physical_guest_count',
  'billable_guest_count',
] as const

export type QuoteSnapshotRecord = {
  id?: string
  adult_count?: number | null
  children_under_3_count?: number | null
  children_4_to_12_count?: number | null
  physical_guest_count?: number | null
  billable_guest_count?: number | null
  package_unit_price?: number | null
  package_price_per_person?: number | null
  package_total?: number | null
  additional_total?: number | null
  mileage_base_location?: string | null
  mileage_distance?: number | null
  mileage_free_limit?: number | null
  mileage_rate?: number | null
  mileage_fee?: number | null
  reservation_percentage?: number | null
  reservation_amount?: number | null
  balance_due?: number | null
  quote_total?: number | null
  pricing_breakdown?: PricingBreakdown | Record<string, unknown> | null
}

export type QuoteSavedSnapshot = {
  guestCounts: GuestCounts
  billableGuestCount: number | null
  physicalGuestCount: number | null
  packageUnitPrice: number | null
  packageTotal: number | null
  additionalTotal: number | null
  mileageBaseLocation: string | null
  mileageDistance: number | null
  mileageFreeLimit: number | null
  mileageRate: number | null
  mileageFee: number | null
  reservationPercentage: number | null
  reservationAmount: number | null
  balanceDue: number | null
  quoteTotal: number | null
  missingFields: string[]
}

function readNullableNumber(
  missingFields: string[],
  field: string,
  value: number | null | undefined,
): number | null {
  if (value == null || Number.isNaN(Number(value))) {
    missingFields.push(field)
    return null
  }
  return Number(value)
}

function readNullableText(
  missingFields: string[],
  field: string,
  value: string | null | undefined,
): string | null {
  if (value == null || value.trim() === '') {
    missingFields.push(field)
    return null
  }
  return value.trim()
}

export function readQuoteSnapshot(quote: QuoteSnapshotRecord): QuoteSavedSnapshot {
  const missingFields: string[] = []

  logMissingOfficialGuestFields(quote, quote.id ? `quote:${quote.id}` : 'quote')

  const guestCounts: GuestCounts = {
    adultCount: quote.adult_count ?? 0,
    childrenUnder3Count: quote.children_under_3_count ?? 0,
    children4To12Count: quote.children_4_to_12_count ?? 0,
  }

  if (quote.adult_count == null) missingFields.push('adult_count')
  if (quote.children_under_3_count == null) {
    missingFields.push('children_under_3_count')
  }
  if (quote.children_4_to_12_count == null) {
    missingFields.push('children_4_to_12_count')
  }

  const snapshot: QuoteSavedSnapshot = {
    guestCounts,
    billableGuestCount: readNullableNumber(
      missingFields,
      'billable_guest_count',
      quote.billable_guest_count,
    ),
    physicalGuestCount: readNullableNumber(
      missingFields,
      'physical_guest_count',
      quote.physical_guest_count,
    ),
    packageUnitPrice: readNullableNumber(
      missingFields,
      'package_unit_price',
      quote.package_unit_price ?? quote.package_price_per_person,
    ),
    packageTotal: readNullableNumber(
      missingFields,
      'package_total',
      quote.package_total,
    ),
    additionalTotal: readNullableNumber(
      missingFields,
      'additional_total',
      quote.additional_total,
    ),
    mileageBaseLocation: readNullableText(
      missingFields,
      'mileage_base_location',
      quote.mileage_base_location,
    ),
    mileageDistance: readNullableNumber(
      missingFields,
      'mileage_distance',
      quote.mileage_distance,
    ),
    mileageFreeLimit: readNullableNumber(
      missingFields,
      'mileage_free_limit',
      quote.mileage_free_limit,
    ),
    mileageRate: readNullableNumber(
      missingFields,
      'mileage_rate',
      quote.mileage_rate,
    ),
    mileageFee: readNullableNumber(
      missingFields,
      'mileage_fee',
      quote.mileage_fee,
    ),
    reservationPercentage: readNullableNumber(
      missingFields,
      'reservation_percentage',
      quote.reservation_percentage,
    ),
    reservationAmount: readNullableNumber(
      missingFields,
      'reservation_amount',
      quote.reservation_amount,
    ),
    balanceDue: readNullableNumber(
      missingFields,
      'balance_due',
      quote.balance_due,
    ),
    quoteTotal: readNullableNumber(
      missingFields,
      'quote_total',
      quote.quote_total,
    ),
    missingFields: [...new Set(missingFields)],
  }

  if (
    snapshot.missingFields.length > 0 &&
    process.env.NODE_ENV === 'development'
  ) {
    console.warn(
      `[CDL Quote] Saved snapshot incomplete (${quote.id ?? 'unknown'}):`,
      snapshot.missingFields.join(', '),
    )
  }

  return snapshot
}

export function formatMoneyOrDash(value: number | null | undefined) {
  if (value == null || Number.isNaN(Number(value))) return '—'
  return `$${Number(value).toFixed(2)}`
}

export function formatCountOrDash(value: number | null | undefined) {
  if (value == null || Number.isNaN(Number(value))) return '—'
  return String(value)
}

export function getChargedMilesFromSnapshot(
  distance: number | null,
  freeLimit: number | null,
) {
  if (distance == null || freeLimit == null) return null
  return Math.max(0, distance - freeLimit)
}

/** Preferencial: breakdown canônico persistido; legado: colunas flat via readQuoteSnapshot. */
export function readPricingBreakdown(
  quote: QuoteSnapshotRecord,
): PricingBreakdown | null {
  const raw = quote.pricing_breakdown
  if (isPricingBreakdown(raw)) return raw
  return null
}

/** Total persistido — prefer breakdown.total quando disponível. */
export function readPersistedQuoteTotal(quote: QuoteSnapshotRecord): number | null {
  const breakdown = readPricingBreakdown(quote)
  if (breakdown) return breakdown.total
  if (quote.quote_total == null || Number.isNaN(Number(quote.quote_total))) {
    return null
  }
  return Number(quote.quote_total)
}
