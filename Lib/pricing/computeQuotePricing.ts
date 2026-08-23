import { buildQuoteDraftSnapshotPayload } from '@/Lib/calculateQuoteDraftFromSupabasePricing'
import {
  calcAdditionalLineTotal,
  calcBillableGuestCount,
  type GuestCounts,
} from '@/Lib/calculateQuoteTotals'
import type { QuoteAdditionalSaveLine } from '@/Lib/buildQuoteSavePayload'
import { fetchSupabaseCommercialRules } from '@/Lib/supabaseCommercialRules'
import { buildPricingBreakdown } from './buildPricingBreakdown'
import type { PricingBreakdown, PricingConfigurationError } from './pricingBreakdownTypes'
import {
  resolveQuotePricingInput,
  type QuotePricingSelectionInput,
} from './resolveQuotePricingInput'
import { validateCommercialRulesSnapshot } from './validateCommercialRules'

export type ComputeQuotePricingInput = QuotePricingSelectionInput & {
  eventDate?: string | null
  mileageDistance?: number
  grillRentalRequired?: boolean
  grillRentalQty?: number
  reservationPercentage?: number | null
  reservationAmountOverride?: number | null
  useCustomReservation?: boolean
  discountAmount?: number | null
  /** Quando true, exige commercial_rules no Supabase (sem fallback silencioso). */
  requireSupabaseRules?: boolean
}

export type ComputeQuotePricingResult =
  | {
      ok: true
      breakdown: PricingBreakdown
      totals: ReturnType<typeof buildQuoteDraftSnapshotPayload>
      resolvedAdditionals: QuoteAdditionalSaveLine[]
      packagePricePerPerson: number
    }
  | { ok: false; error: PricingConfigurationError }

function resolveAdditionalsWithGuests(
  lines: QuoteAdditionalSaveLine[],
  billableGuestCount: number,
): QuoteAdditionalSaveLine[] {
  return lines.map((line) => ({
    ...line,
    totalPrice: calcAdditionalLineTotal(
      {
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        perPerson: line.perPerson,
      },
      billableGuestCount,
    ),
  }))
}

export async function computeQuotePricing(
  input: ComputeQuotePricingInput,
): Promise<ComputeQuotePricingResult> {
  const resolved = await resolveQuotePricingInput(input)
  if (!resolved.ok) {
    return resolved
  }

  const rules = await fetchSupabaseCommercialRules(resolved.context.companyId)
  const rulesError = validateCommercialRulesSnapshot(rules, {
    requireSupabaseSource: input.requireSupabaseRules === true,
  })
  if (rulesError) {
    return { ok: false, error: rulesError }
  }

  const guestCounts: GuestCounts = resolved.context.guestCounts
  const billableGuestCount = calcBillableGuestCount(guestCounts)
  const resolvedAdditionals = resolveAdditionalsWithGuests(
    resolved.resolvedAdditionals,
    billableGuestCount,
  )

  const reservationPercentage =
    input.reservationPercentage ?? rules.reservationPercentage

  const totals = buildQuoteDraftSnapshotPayload({
    guestCounts,
    packagePricePerPerson: resolved.context.packagePricePerPerson,
    additionals: resolvedAdditionals.map((line) => ({
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      perPerson: line.perPerson,
    })),
    mileageDistance: input.mileageDistance ?? 0,
    grillRentalRequired: input.grillRentalRequired,
    grillRentalQty: input.grillRentalQty,
    pricing: rules,
    reservationPercentage,
    reservationAmountOverride: input.reservationAmountOverride ?? undefined,
    useCustomReservation: input.useCustomReservation ?? false,
    eventDate: input.eventDate,
  })

  const discountAmount = Math.max(0, Number(input.discountAmount ?? 0))

  const breakdown = buildPricingBreakdown({
    context: resolved.context,
    totals,
    resolvedAdditionals,
    rules,
    discountAmount,
    mileageDistance: input.mileageDistance ?? 0,
    grillRentalRequired: Boolean(input.grillRentalRequired),
    grillRentalQty: input.grillRentalQty ?? 0,
  })

  if (discountAmount > 0) {
    breakdown.total = Math.max(0, roundMoney(breakdown.total - discountAmount))
    breakdown.balance = roundMoney(breakdown.total - breakdown.deposit)
  }

  return {
    ok: true,
    breakdown,
    totals,
    resolvedAdditionals,
    packagePricePerPerson: resolved.context.packagePricePerPerson,
  }
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100
}

export type QuotePricingPreviewBody = {
  packageId: string
  additionals?: Array<{ itemId: string; quantity: number }>
  adultCount?: number
  childrenUnder3Count?: number
  children4To12Count?: number
  eventDate?: string | null
  mileageDistance?: number
  grillRentalRequired?: boolean
  grillRentalQty?: number
  reservationPercentage?: number | null
  reservationAmount?: number | null
  useCustomReservation?: boolean
  discountAmount?: number | null
  language?: 'pt' | 'en' | 'es' | null
}

export function parseQuotePricingPreviewBody(
  body: QuotePricingPreviewBody,
): ComputeQuotePricingInput | { error: string } {
  if (!body.packageId?.trim()) {
    return { error: 'Pacote é obrigatório.' }
  }

  return {
    packageId: body.packageId.trim(),
    additionals: body.additionals ?? [],
    guestCounts: {
      adultCount: Math.max(0, Number(body.adultCount ?? 0)),
      childrenUnder3Count: Math.max(0, Number(body.childrenUnder3Count ?? 0)),
      children4To12Count: Math.max(0, Number(body.children4To12Count ?? 0)),
    },
    eventDate: body.eventDate ?? null,
    mileageDistance: Math.max(0, Number(body.mileageDistance ?? 0)),
    grillRentalRequired: Boolean(body.grillRentalRequired),
    grillRentalQty: Math.max(0, Number(body.grillRentalQty ?? 0)),
    reservationPercentage:
      body.reservationPercentage != null
        ? Number(body.reservationPercentage)
        : null,
    reservationAmountOverride:
      body.reservationAmount != null ? Number(body.reservationAmount) : null,
    useCustomReservation: Boolean(body.useCustomReservation),
    discountAmount:
      body.discountAmount != null ? Number(body.discountAmount) : null,
    language: body.language ?? null,
  }
}
