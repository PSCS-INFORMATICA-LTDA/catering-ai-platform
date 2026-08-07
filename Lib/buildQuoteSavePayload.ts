import { getCdlCompanyId } from './cdlCompany'
import { buildQuoteDraftSnapshotPayload } from './calculateQuoteDraftFromSupabasePricing'
import { calcAdditionalLineTotal } from './calculateQuoteTotals'
import type { CommercialRulesSnapshot } from './supabaseCommercialRules'
import {
  buildOfficialGuestPayload,
  calcBillableGuestCount,
  calcPhysicalGuestCount,
} from './quoteGuestFields'
import type { QuoteSnapshotRecord } from './readQuoteSnapshot'
import {
  assertNoForbiddenEventColumns,
  pickEventsInsertPayload,
  type EventsInsertPayload,
} from './eventsTableSchema'

export type QuoteAdditionalSaveLine = {
  itemId: string
  quantity: number
  unitPrice: number
  perPerson: boolean
  totalPrice: number
}

export type QuoteCustomerDraft = {
  phone: string
  name?: string | null
  email?: string | null
}

export type QuotePackageSelectionSaveLine = {
  optionGroupId: string
  optionItemId: string
  packageId: string
}

export type QuoteSaveInput = {
  language?: 'pt' | 'en' | 'es' | null
  customerId: string | null
  /** Rascunho do wizard — cliente criado somente no save final. */
  customerDraft?: QuoteCustomerDraft | null
  packageId: string
  branchId?: string | null
  packageSelections?: QuotePackageSelectionSaveLine[]
  eventName: string
  eventDate: string
  startTime: string
  endTime: string
  adultCount: number
  childrenUnder3Count: number
  children4To12Count: number
  address: string
  city: string
  state: string
  zipCode: string
  hasGrill: boolean
  grillPhotoRequired: boolean
  grillRentalRequired: boolean
  grillRentalQty: number
  grillNotes: string
  baseLocation: string
  distance: number
  pricing: CommercialRulesSnapshot
  reservationPercentage: number
  reservationAmount: number
  packagePricePerPerson: number
  additionals: QuoteAdditionalSaveLine[]
  recalculateSnapshot?: boolean
  existingSnapshot?: QuoteSnapshotRecord
}

function addDaysIso(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next.toISOString().slice(0, 10)
}

function calcAdditionalBreakdown(
  additionals: QuoteAdditionalSaveLine[],
  billableGuestCount: number,
) {
  let additionalPerPersonTotal = 0
  let additionalPerUnitTotal = 0

  for (const line of additionals) {
    const total =
      line.totalPrice ||
      calcAdditionalLineTotal(
        {
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          perPerson: line.perPerson,
        },
        billableGuestCount,
      )

    if (line.perPerson) {
      additionalPerPersonTotal += total
    } else {
      additionalPerUnitTotal += total
    }
  }

  return {
    additional_per_person_total: Math.round(additionalPerPersonTotal * 100) / 100,
    additional_per_unit_total: Math.round(additionalPerUnitTotal * 100) / 100,
  }
}

/** Dados do evento — apenas colunas reais de `public.events`. */
export function buildEventSavePayload(input: QuoteSaveInput) {
  const guestCounts = {
    adultCount: input.adultCount,
    childrenUnder3Count: input.childrenUnder3Count,
    children4To12Count: input.children4To12Count,
  }
  const physicalGuestCount = calcPhysicalGuestCount(guestCounts)
  const billableGuestCount = calcBillableGuestCount(guestCounts)
  const childrenCount =
    input.childrenUnder3Count + input.children4To12Count

  const row: EventsInsertPayload = {
    event_name: input.eventName.trim(),
    event_date: input.eventDate || null,
    start_time: input.startTime || null,
    end_time: input.endTime || null,
    address_line: input.address.trim(),
    city: input.city.trim(),
    state: input.state.trim(),
    postal_code: input.zipCode.trim() || null,
    country: 'US',
    adults_count: input.adultCount,
    children_count: childrenCount,
    billable_guests: billableGuestCount,
    total_guests: physicalGuestCount,
    has_grill: input.hasGrill,
    grill_photo_required: input.grillPhotoRequired,
    grill_rental_required: input.grillRentalRequired,
    grill_rental_qty: input.grillRentalRequired ? input.grillRentalQty : 0,
    grill_notes: input.grillNotes.trim() || null,
    distance_from_base: input.distance,
    active: true,
  }

  const payload = pickEventsInsertPayload(row)
  assertNoForbiddenEventColumns(payload)
  return payload
}

function buildQuoteGrillAndMileagePayload(
  input: QuoteSaveInput,
  mode?: 'create' | 'update',
) {
  return {
    ...(mode !== 'update'
      ? { customer_id: input.customerId?.trim() || null }
      : {}),
    package_id: input.packageId,
    has_grill: input.hasGrill,
    grill_photo_required: input.grillPhotoRequired,
    grill_rental_required: input.grillRentalRequired,
    grill_rental_qty: input.grillRentalRequired ? input.grillRentalQty : 0,
    grill_notes: input.grillNotes.trim() || null,
    mileage_base_location:
      input.baseLocation.trim() || input.pricing.mileageBaseLocation,
    mileage_distance: input.distance,
  }
}

export function buildQuoteSavePayload(
  input: QuoteSaveInput,
  options?: { mode?: 'create' | 'update'; eventId?: string | null },
) {
  const guestCounts = {
    adultCount: input.adultCount,
    childrenUnder3Count: input.childrenUnder3Count,
    children4To12Count: input.children4To12Count,
  }

  const officialGuests = buildOfficialGuestPayload(guestCounts)
  const billableGuestCount = calcBillableGuestCount(guestCounts)
  const physicalGuestCount = calcPhysicalGuestCount(guestCounts)
  const additionalBreakdown = calcAdditionalBreakdown(
    input.additionals,
    billableGuestCount,
  )

  const shouldRecalculate =
    options?.mode !== 'update' || input.recalculateSnapshot === true

  const now = new Date()
  const quoteDate = now.toISOString().slice(0, 10)

  const basePayload = {
    ...buildQuoteGrillAndMileagePayload(input, options?.mode),
    ...officialGuests,
    total_guests: physicalGuestCount,
    additional_per_person_total: additionalBreakdown.additional_per_person_total,
    additional_per_unit_total: additionalBreakdown.additional_per_unit_total,
    updated_at: now.toISOString(),
    ...(options?.eventId ? { event_id: options.eventId } : {}),
  }

  if (!shouldRecalculate && input.existingSnapshot) {
    const existing = input.existingSnapshot
    return {
      ...basePayload,
      ...(options?.mode === 'update' && input.language
        ? {
            language: (['pt', 'en', 'es'].includes(String(input.language))
              ? input.language
              : 'pt') as 'pt' | 'en' | 'es',
          }
        : {}),
      package_price_per_person:
        existing.package_price_per_person ?? existing.package_unit_price,
      package_total: existing.package_total,
      additional_total: existing.additional_total,
      grill_rental_total:
        (existing as { grill_rental_total?: number | null }).grill_rental_total ??
        0,
      mileage_free_limit: existing.mileage_free_limit,
      mileage_rate: existing.mileage_rate,
      mileage_fee: existing.mileage_fee,
      reservation_amount: existing.reservation_amount,
      reservation_percentage: existing.reservation_percentage,
      balance_due: existing.balance_due,
      quote_total: existing.quote_total,
      minimum_order_amount:
        (existing as { minimum_order_amount?: number | null })
          .minimum_order_amount ?? 0,
      minimum_order_applied: Boolean(
        (existing as { minimum_order_applied?: boolean | null })
          .minimum_order_applied,
      ),
      holiday_surcharge_amount:
        (existing as { holiday_surcharge_amount?: number | null })
          .holiday_surcharge_amount ?? 0,
    }
  }

  const draftSnapshot = buildQuoteDraftSnapshotPayload({
    guestCounts,
    packagePricePerPerson: input.packagePricePerPerson,
    additionals: input.additionals.map((line) => ({
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      perPerson: line.perPerson,
    })),
    mileageDistance: input.distance,
    grillRentalRequired: input.grillRentalRequired,
    grillRentalQty: input.grillRentalQty,
    pricing: input.pricing,
    reservationPercentage: input.reservationPercentage,
    reservationAmountOverride: input.reservationAmount,
    useCustomReservation: false,
    eventDate: input.eventDate,
  })

  const quoteLanguage = (['pt', 'en', 'es'].includes(String(input.language ?? 'pt'))
    ? (input.language ?? 'pt')
    : 'pt') as 'pt' | 'en' | 'es'

  const createMeta =
    options?.mode === 'create'
      ? {
          active: true,
          company_id: getCdlCompanyId(),
          ...(input.branchId?.trim() ? { branch_id: input.branchId.trim() } : {}),
          source: 'wizard',
          quote_status: 'draft',
          quote_date: quoteDate,
          expiration_date: addDaysIso(now, 30),
          currency_code: 'USD',
          language: quoteLanguage,
        }
      : {}

  const updateLanguageMeta =
    options?.mode === 'update' && input.language
      ? { language: quoteLanguage }
      : {}

  return {
    ...basePayload,
    ...createMeta,
    ...updateLanguageMeta,
    package_price_per_person: draftSnapshot.packageUnitPrice,
    package_total: draftSnapshot.packageTotal,
    additional_total: draftSnapshot.additionalTotal,
    grill_rental_total: draftSnapshot.grillRentalTotal,
    mileage_free_limit: draftSnapshot.mileageFreeLimit,
    mileage_rate: draftSnapshot.mileageRate,
    mileage_fee: draftSnapshot.mileageFee,
    reservation_amount: draftSnapshot.reservationAmount,
    reservation_percentage: draftSnapshot.reservationPercentage,
    balance_due: draftSnapshot.balanceDue,
    quote_total: draftSnapshot.quoteTotal,
    minimum_order_amount: draftSnapshot.minimumOrderAmount,
    minimum_order_applied: draftSnapshot.minimumOrderApplied,
    holiday_surcharge_amount: draftSnapshot.holidaySurchargeAmount,
  }
}

export function buildPackageSelectionRows(
  quoteId: string,
  companyId: string,
  packageId: string,
  selections: QuotePackageSelectionSaveLine[],
) {
  const normalizedCompanyId = companyId?.trim()
  if (!normalizedCompanyId) {
    throw new Error(
      'company_id é obrigatório para inserir quote_package_selections.',
    )
  }

  return selections.map((line) => ({
    id: crypto.randomUUID(),
    company_id: normalizedCompanyId,
    quote_id: quoteId,
    package_id: line.packageId?.trim() || packageId,
    option_group_id: line.optionGroupId,
    option_item_id: line.optionItemId,
  }))
}

export function buildAdditionalItemRows(
  quoteId: string,
  companyId: string,
  additionals: QuoteAdditionalSaveLine[],
) {
  const normalizedCompanyId = companyId?.trim()
  if (!normalizedCompanyId) {
    throw new Error(
      'company_id é obrigatório para inserir quote_additional_items.',
    )
  }

  return additionals.map((line) => ({
    id: crypto.randomUUID(),
    company_id: normalizedCompanyId,
    quote_id: quoteId,
    additional_item_id: line.itemId,
    quantity: line.quantity,
    unit_price: line.unitPrice,
    total_price: line.totalPrice,
    selected: true,
  }))
}

export type QuoteSavePayload = ReturnType<typeof buildQuoteSavePayload>
