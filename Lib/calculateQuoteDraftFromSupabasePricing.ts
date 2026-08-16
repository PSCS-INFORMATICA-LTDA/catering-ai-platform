import {
  calculateQuoteTotals,
  type AdditionalLineInput,
  type GuestCounts,
  type QuoteTotals,
} from './calculateQuoteTotals'
import type { CommercialRulesSnapshot } from './supabaseCommercialRules'

export type QuoteDraftInput = {
  guestCounts: GuestCounts
  packagePricePerPerson: number
  additionals: AdditionalLineInput[]
  mileageDistance: number
  grillRentalRequired?: boolean
  grillRentalQty?: number
  pricing: CommercialRulesSnapshot
  reservationPercentage?: number
  reservationAmountOverride?: number
  useCustomReservation?: boolean
  eventDate?: string | null
}

export function calculateQuoteDraftFromSupabasePricing(
  input: QuoteDraftInput,
): QuoteTotals {
  const pricing = input.pricing

  return calculateQuoteTotals({
    guestCounts: input.guestCounts,
    packagePricePerPerson: input.packagePricePerPerson,
    additionals: input.additionals,
    mileageDistance: input.mileageDistance,
    mileageFreeLimit: pricing.mileageFreeLimit,
    mileageRate: pricing.mileageRate,
    grillRentalRequired: input.grillRentalRequired,
    grillRentalQty: input.grillRentalQty,
    reservationPercentage:
      input.reservationPercentage ?? pricing.reservationPercentage,
    reservationAmountOverride: input.reservationAmountOverride,
    useCustomReservation: input.useCustomReservation ?? false,
    eventDate: input.eventDate,
    commercialMinimums: {
      minOrderWeekday: pricing.minOrderWeekday,
      minOrderWeekend: pricing.minOrderWeekend,
      minOrderDecJan: pricing.minOrderDecJan,
      holidaySurchargePercent: pricing.holidaySurchargePercent,
      holidayMinOrder: pricing.holidayMinOrder,
    },
  })
}

export type QuoteDraftSnapshotPayload = QuoteTotals & {
  packageUnitPrice: number
  mileageBaseLocation: string
  mileageFreeLimit: number
  mileageRate: number
  reservationPercentage: number
}

export function buildQuoteDraftSnapshotPayload(
  input: QuoteDraftInput,
): QuoteDraftSnapshotPayload {
  const totals = calculateQuoteDraftFromSupabasePricing(input)

  return {
    ...totals,
    packageUnitPrice: input.packagePricePerPerson,
    mileageBaseLocation: input.pricing.mileageBaseLocation,
    mileageFreeLimit: input.pricing.mileageFreeLimit,
    mileageRate: input.pricing.mileageRate,
    reservationPercentage:
      input.reservationPercentage ?? input.pricing.reservationPercentage,
  }
}
