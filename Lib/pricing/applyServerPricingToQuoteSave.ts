import type { QuoteSaveInput } from '@/Lib/buildQuoteSavePayload'
import {
  computeQuotePricing,
  type ComputeQuotePricingResult,
} from './computeQuotePricing'

export async function computeServerPricingForSave(
  input: QuoteSaveInput,
): Promise<ComputeQuotePricingResult> {
  return computeQuotePricing({
    packageId: input.packageId,
    additionals: input.additionals.map((line) => ({
      itemId: line.itemId,
      quantity: line.quantity,
    })),
    guestCounts: {
      adultCount: input.adultCount,
      childrenUnder3Count: input.childrenUnder3Count,
      children4To12Count: input.children4To12Count,
    },
    eventDate: input.eventDate,
    mileageDistance: input.distance,
    grillRentalRequired: input.grillRentalRequired,
    grillRentalQty: input.grillRentalQty,
    reservationPercentage: input.reservationPercentage,
    reservationAmountOverride: input.reservationAmount,
    useCustomReservation: false,
    language: input.language ?? null,
  })
}

export function mergeServerPricingIntoSaveInput(
  input: QuoteSaveInput,
  pricing: Extract<ComputeQuotePricingResult, { ok: true }>,
): QuoteSaveInput {
  return {
    ...input,
    packagePricePerPerson: pricing.packagePricePerPerson,
    additionals: pricing.resolvedAdditionals,
    pricing: pricing.breakdown.rules_applied,
    reservationPercentage:
      input.reservationPercentage ??
      pricing.breakdown.rules_applied.reservationPercentage,
  }
}
