import type { QuoteDetail } from '@/app/quotes/[id]/quoteDetailTypes'
import { getCustomerDisplayNameFromQuote } from '@/Lib/getCustomerDisplayName'
import { packageSelectionsFromRows } from '@/Lib/packageOptionGroups'
import {
  deriveGrillPhotoStatus,
  grillPhotoStatusToRequired,
} from '@/Lib/grillPhotoStatus'
import type { CommercialRulesSnapshot } from './supabaseCommercialRules'
import {
  buildPricingFingerprint,
  createInitialWizardState,
  type WizardState,
} from './quoteWizardTypes'
import { splitAddressNumber } from './addressLine'
import { getMileageBaseLocation } from './cdlCommercialRules'

function normalizeDate(value: string | null | undefined) {
  if (!value) return ''
  return value.includes('T') ? value.slice(0, 10) : value
}

function normalizeTime(value: string | null | undefined) {
  if (!value) return ''
  const parts = value.split(':')
  if (parts.length < 2) return value
  return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`
}

export function mapQuoteDetailToWizardState(
  quote: QuoteDetail,
  rules: CommercialRulesSnapshot,
): { state: WizardState; pricingFingerprint: string } {
  const additionals: Record<string, number> = {}
  for (const item of quote.additional_items ?? []) {
    if (item.item_id && (item.quantity ?? 0) > 0) {
      additionals[item.item_id] = Number(item.quantity)
    }
  }

  const grillPhotoUrl =
    (quote as { grill_photo_url?: string | null }).grill_photo_url ?? null
  const grillPhotoMediaId =
    (quote as { grill_photo_media_id?: string | null }).grill_photo_media_id ??
    null
  const grillPhotoStatus = deriveGrillPhotoStatus({
    hasGrill: quote.has_grill,
    grillPhotoRequired: quote.grill_photo_required,
    grillPhotoUrl,
    grillPhotoMediaId,
  })

  const quoteLanguage = quote.language
  const language =
    quoteLanguage === 'en' || quoteLanguage === 'es' || quoteLanguage === 'pt'
      ? quoteLanguage
      : 'pt'

  const state: WizardState = {
    ...createInitialWizardState(rules),
    language,
    customerId: quote.customer_id ?? null,
    eventName:
      quote.event_name ??
      getCustomerDisplayNameFromQuote(quote, { emptyLabel: '' }),
    eventDate: normalizeDate(quote.event_date),
    startTime: normalizeTime(quote.start_time),
    endTime: normalizeTime(quote.end_time),
    adultCount: quote.adult_count ?? 0,
    childrenUnder3Count: quote.children_under_3_count ?? 0,
    children4To12Count: quote.children_4_to_12_count ?? 0,
    ...splitAddressNumber(quote.address_line),
    city: quote.city ?? '',
    state: quote.state ?? '',
    zipCode: quote.zip_code ?? quote.postal_code ?? '',
    hasGrill: quote.has_grill ?? false,
    grillSetupAnswered: quote.has_grill != null,
    grillPhotoRequired: grillPhotoStatusToRequired(grillPhotoStatus),
    grillPhotoStatus,
    grillPhotoAnswered: quote.has_grill != null,
    grillPhotoUrl,
    grillRentalRequired: quote.grill_rental_required ?? false,
    grillRentalQty: quote.grill_rental_qty ?? 0,
    grillNotes: quote.grill_notes ?? '',
    packageId: quote.package_id ?? null,
    branchId:
      (quote as { branch_id?: string | null }).branch_id?.trim() || null,
    packageSelections: packageSelectionsFromRows(
      quote.package_selections ?? [],
    ),
    additionals,
    baseLocation: getMileageBaseLocation(quote.mileage_base_location),
    distance: quote.mileage_distance ?? 0,
    freeLimit: quote.mileage_free_limit ?? rules.mileageFreeLimit,
    rate: quote.mileage_rate ?? rules.mileageRate,
    reservationPercentage:
      quote.reservation_percentage ?? rules.reservationPercentage,
    reservationAmount: quote.reservation_amount ?? 0,
    reservationNotes: '',
  }

  return {
    state,
    pricingFingerprint: buildPricingFingerprint(state),
  }
}
