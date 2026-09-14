import type { QuoteDetail, QuoteAdditionalItem } from '@/app/quotes/[id]/quoteDetailTypes'
import { omitInternalNotes } from './internalNotes.ts'

export const SHARE_VERSION_REQUIRED = 'quote_version_required'
export const SHARED_VERSION_MISSING = 'shared_version_missing'

export type ProposalSource = 'shared_version' | 'legacy_live_quote'

export type SharedVersionRow = {
  id: string
  quote_id?: string | null
  company_id?: string | null
  version_number?: number | null
  quote_total?: number | null
  reservation_amount?: number | null
  balance_due?: number | null
  discount_amount?: number | null
  package_total?: number | null
  additional_total?: number | null
  mileage_fee?: number | null
  commercial_snapshot?: Record<string, unknown> | null
}

export type FrozenCommercialFacts = {
  source: ProposalSource
  versionId: string | null
  quote_total: number | null
  reservation_amount: number | null
  balance_due: number | null
  discount_amount: number | null
  package_total: number | null
  additional_total: number | null
  mileage_fee: number | null
  mileage_distance: number | null
  mileage_free_limit: number | null
  mileage_rate: number | null
  mileage_base_location: string | null
  reservation_percentage: number | null
  package_id: string | null
  package_price_per_person: number | null
  adult_count: number | null
  children_under_3_count: number | null
  children_4_to_12_count: number | null
  physical_guest_count: number | null
  billable_guest_count: number | null
  language: string | null
  currency_code: string | null
  event_name: string | null
  event_date: string | null
  start_time: string | null
  end_time: string | null
  venue_name: string | null
  address_line: string | null
  city: string | null
  state: string | null
  postal_code: string | null
  pricing_breakdown: Record<string, unknown> | null
  additional_items: QuoteAdditionalItem[] | null
  coupon: {
    code: string | null
    approval_status: string | null
    applied_discount_amount: number | null
  } | null
}

export function requireShareableQuoteVersion(version: {
  data?: { id?: string | null } | null
  error?: { message?: string } | null
}):
  | { ok: true; versionId: string }
  | { ok: false; code: typeof SHARE_VERSION_REQUIRED; error: string } {
  const versionId = version.data?.id
  if (version.error?.message) {
    return {
      ok: false,
      code: SHARE_VERSION_REQUIRED,
      error: version.error.message,
    }
  }
  if (!versionId) {
    return {
      ok: false,
      code: SHARE_VERSION_REQUIRED,
      error: 'Não foi possível obter uma quote_version para pin da proposta.',
    }
  }
  return { ok: true, versionId }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function asNumber(value: unknown): number | null {
  if (value == null || value === '') return null
  const next = Number(value)
  return Number.isFinite(next) ? next : null
}

function asText(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const next = value.trim()
  return next ? next : null
}

function readCoupon(breakdown: Record<string, unknown> | null) {
  const coupon = asRecord(breakdown?.coupon)
  const code = asText(coupon.code)
  if (!code && coupon.approval_status == null) return null
  return {
    code,
    approval_status: asText(coupon.approval_status),
    applied_discount_amount: asNumber(coupon.applied_discount_amount),
  }
}

function mapSnapshotAdditionals(value: unknown): QuoteAdditionalItem[] | null {
  if (!Array.isArray(value)) return null
  return value.map((raw) => {
    const row = asRecord(raw)
    return {
      item_id: String(row.additional_item_id ?? row.item_id ?? ''),
      quantity: asNumber(row.quantity),
      unit_price: asNumber(row.unit_price),
      total_price: asNumber(row.total_price ?? row.total),
    }
  })
}

function firstNumber(...values: unknown[]) {
  for (const value of values) {
    const next = asNumber(value)
    if (next != null) return next
  }
  return null
}

function firstText(...values: unknown[]) {
  for (const value of values) {
    const next = asText(value)
    if (next) return next
  }
  return null
}

export function readFrozenCommercialFacts(
  version: SharedVersionRow,
): FrozenCommercialFacts {
  const snapshot = asRecord(version.commercial_snapshot)
  const guests = asRecord(snapshot.guest_counts)
  const pkg = asRecord(snapshot.package)
  const reservation = asRecord(snapshot.reservation)
  const mileage = asRecord(snapshot.mileage)
  const event = asRecord(snapshot.event)
  const totals = asRecord(snapshot.totals)
  const selection = asRecord(snapshot.selection)
  const address = asRecord(event.address)
  const breakdownRaw = snapshot.pricing_breakdown
  const pricing_breakdown =
    breakdownRaw && typeof breakdownRaw === 'object' && !Array.isArray(breakdownRaw)
      ? (breakdownRaw as Record<string, unknown>)
      : null
  const breakdownGuests = asRecord(pricing_breakdown?.guest_counts)
  const topCoupon = asRecord(snapshot.coupon)
  const coupon =
    readCoupon(pricing_breakdown) ||
    (topCoupon.code || topCoupon.approval_status
      ? {
          code: asText(topCoupon.code),
          approval_status: asText(topCoupon.approval_status),
          applied_discount_amount: asNumber(topCoupon.applied_discount_amount),
        }
      : null)

  return {
    source: 'shared_version',
    versionId: version.id,
    quote_total: firstNumber(
      version.quote_total,
      snapshot.quote_total,
      totals.quoteTotal,
      pricing_breakdown?.total,
    ),
    reservation_amount: firstNumber(
      version.reservation_amount,
      reservation.amount,
      totals.reservationAmount,
      pricing_breakdown?.deposit,
    ),
    balance_due: firstNumber(
      version.balance_due,
      snapshot.balance_due,
      totals.balanceDue,
      pricing_breakdown?.balance,
    ),
    discount_amount: firstNumber(
      version.discount_amount,
      snapshot.discount_amount,
      coupon?.applied_discount_amount,
    ),
    package_total: firstNumber(
      version.package_total,
      pkg.total,
      totals.packageTotal,
    ),
    additional_total: firstNumber(
      version.additional_total,
      snapshot.additional_total,
      totals.additionalTotal,
    ),
    mileage_fee: firstNumber(version.mileage_fee, mileage.fee, totals.mileageFee),
    mileage_distance: firstNumber(mileage.distance, snapshot.mileage_distance),
    mileage_free_limit: firstNumber(
      mileage.free_limit,
      totals.mileageFreeLimit,
    ),
    mileage_rate: firstNumber(mileage.rate, totals.mileageRate),
    mileage_base_location: firstText(
      mileage.base_location,
      totals.mileageBaseLocation,
    ),
    reservation_percentage: firstNumber(
      reservation.percentage,
      totals.reservationPercentage,
    ),
    package_id: firstText(pkg.id, selection.packageId),
    package_price_per_person: firstNumber(
      pkg.price_per_person,
      totals.packageUnitPrice,
    ),
    adult_count: firstNumber(
      guests.adult_count,
      guests.adultCount,
      breakdownGuests.adult_count,
      breakdownGuests.adultCount,
      event.adultCount,
      totals.billableAdults,
    ),
    children_under_3_count: firstNumber(
      guests.children_under_3_count,
      guests.childrenUnder3Count,
      breakdownGuests.children_under_3_count,
      breakdownGuests.childrenUnder3Count,
      event.childrenUnder3Count,
    ),
    children_4_to_12_count: firstNumber(
      guests.children_4_to_12_count,
      guests.children4To12Count,
      breakdownGuests.children_4_to_12_count,
      breakdownGuests.children4To12Count,
      event.children4To12Count,
    ),
    physical_guest_count: firstNumber(
      guests.physical_guest_count,
      guests.physicalGuestCount,
      breakdownGuests.physical_guest_count,
      totals.physicalGuestCount,
    ),
    billable_guest_count: firstNumber(
      guests.billable_guest_count,
      guests.billableGuestCount,
      breakdownGuests.billable_guest_count,
      totals.billableGuestCount,
    ),
    language: asText(snapshot.language),
    currency_code: firstText(snapshot.currency_code, totals.currency) ?? 'USD',
    event_name: firstText(event.event_name, event.eventName),
    event_date: firstText(event.event_date, event.eventDate),
    start_time: firstText(event.start_time, event.startTime),
    end_time: firstText(event.end_time, event.endTime),
    venue_name: firstText(event.venue_name),
    address_line: firstText(
      event.address_line,
      address.formattedAddress,
      [address.route, address.number].filter(Boolean).join(', ') || null,
    ),
    city: firstText(event.city, address.city),
    state: firstText(event.state, address.region),
    postal_code: firstText(event.postal_code, address.postalCode),
    pricing_breakdown,
    additional_items: mapSnapshotAdditionals(
      snapshot.additional_items ?? selection.additionals,
    ),
    coupon,
  }
}

export function applySharedVersionToQuoteDetail(
  quote: QuoteDetail,
  version: SharedVersionRow,
  extras: {
    package_name_pt?: string | null
    package_name_en?: string | null
    package_name_es?: string | null
    package_key?: string | null
  } = {},
): QuoteDetail {
  const facts = readFrozenCommercialFacts(version)
  const next: QuoteDetail = {
    ...quote,
    quote_total: facts.quote_total,
    reservation_amount: facts.reservation_amount,
    balance_due: facts.balance_due,
    discount_amount: facts.discount_amount,
    discount: facts.discount_amount,
    package_total: facts.package_total,
    additional_total: facts.additional_total,
    mileage_fee: facts.mileage_fee,
    mileage_distance: facts.mileage_distance,
    mileage_free_limit: facts.mileage_free_limit,
    mileage_rate: facts.mileage_rate,
    mileage_base_location: facts.mileage_base_location,
    reservation_percentage: facts.reservation_percentage,
    package_id: facts.package_id ?? quote.package_id,
    package_price_per_person: facts.package_price_per_person,
    package_unit_price: facts.package_price_per_person,
    adult_count: facts.adult_count,
    children_under_3_count: facts.children_under_3_count,
    children_4_to_12_count: facts.children_4_to_12_count,
    physical_guest_count: facts.physical_guest_count,
    billable_guest_count: facts.billable_guest_count,
    language: facts.language ?? quote.language,
    currency_code: facts.currency_code ?? quote.currency_code,
    event_name: facts.event_name ?? quote.event_name,
    event_date: facts.event_date ?? quote.event_date,
    start_time: facts.start_time ?? quote.start_time,
    end_time: facts.end_time ?? quote.end_time,
    venue_name: facts.venue_name ?? quote.venue_name,
    address_line: facts.address_line ?? quote.address_line,
    city: facts.city ?? quote.city,
    state: facts.state ?? quote.state,
    postal_code: facts.postal_code ?? quote.postal_code,
    pricing_breakdown: facts.pricing_breakdown ?? quote.pricing_breakdown,
    additional_items: facts.additional_items ?? quote.additional_items,
    proposal_shared_version_id: version.id,
    accepted_version_id: quote.accepted_version_id ?? version.id,
    package_name_pt: extras.package_name_pt ?? quote.package_name_pt,
    package_name_en: extras.package_name_en ?? quote.package_name_en,
    package_name_es: extras.package_name_es ?? quote.package_name_es,
    package_key: extras.package_key ?? quote.package_key,
  }
  return omitInternalNotes(next as QuoteDetail & Record<string, unknown>) as QuoteDetail
}

export function publicProposalQuoteFromFacts(
  input: {
    quoteId: string
    quoteNumber: string | null
    quoteStatus: string | null
    packageLabel: string | null
    customerName: string | null
    customerPhone: string | null
    customerEmail: string | null
    eventName: string | null
    facts: FrozenCommercialFacts
  },
) {
  return {
    id: input.quoteId,
    quote_number: input.quoteNumber,
    quote_status: input.quoteStatus,
    quote_total: input.facts.quote_total,
    reservation_amount: input.facts.reservation_amount,
    balance_due: input.facts.balance_due,
    discount_amount: input.facts.discount_amount,
    currency_code: input.facts.currency_code ?? 'USD',
    package_label: input.packageLabel,
    adult_count: input.facts.adult_count,
    children_under_3_count: input.facts.children_under_3_count,
    children_4_to_12_count: input.facts.children_4_to_12_count,
    physical_guest_count: input.facts.physical_guest_count,
    billable_guest_count: input.facts.billable_guest_count,
    customer_name: input.customerName,
    customer_phone: input.customerPhone,
    customer_email: input.customerEmail,
    event_name: input.eventName,
    event_date: input.facts.event_date,
    language: input.facts.language ?? 'pt',
    coupon: input.facts.coupon,
  }
}

export function stripInternalNotesFromPublicPayload<T>(value: T): T {
  if (!value || typeof value !== 'object') return value
  const json = JSON.parse(JSON.stringify(value)) as unknown
  const walk = (node: unknown) => {
    if (!node || typeof node !== 'object') return
    if (Array.isArray(node)) {
      for (const item of node) walk(item)
      return
    }
    const record = node as Record<string, unknown>
    delete record.internal_notes
    for (const nested of Object.values(record)) walk(nested)
  }
  walk(json)
  return json as T
}
