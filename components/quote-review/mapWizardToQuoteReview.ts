import type { QuoteTotals } from '@/Lib/calculateQuoteTotals'
import {
  formatPackageItemsText,
  formatPackageSideItemsText,
  getPackageItemsForPackage,
  getPackageSideItemsForPackage,
  type PackageItem,
  type PackageSideItem,
} from '@/Lib/packageConfiguration'
import { getPackageItemsDescription } from '@/Lib/packageDisplay'
import { resolvePackageCatalogImageUrl } from '@/Lib/packageCatalogVisual'
import {
  buildPackageSelectionLabels,
  getPackageOptionGroupsForPackage,
  isCustomPackage,
  resolvePackageItemsWithSelections,
  type PackageOptionGroupItem,
  type PackageOptionGroupRecord,
} from '@/Lib/packageOptionGroups'
import type { WizardState } from '@/Lib/quoteWizardTypes'
import type { CommercialRulesSnapshot } from '@/Lib/supabaseCommercialRules'
import type {
  PricingBreakdown,
  PricingBreakdownLine,
} from '@/Lib/pricing/pricingBreakdownTypes'
import { getGrillPhotoStatusLabel } from '@/Lib/grillPhotoStatus'
import { tw } from '@/Lib/quoteTranslations'
import {
  buildQuoteReviewPackageSummary,
  type QuoteReviewPackageFields,
} from './quoteReviewPackageSummary'
import type { QuoteReviewAdditional, QuoteReviewData } from './quoteReviewTypes'

export type WizardSelectedAdditional = {
  id: string
  itemKey?: string | null
  label: string
  category: string
  quantity: number
  unitPrice: number
  totalPrice: number
  imageUrl?: string | null
  itemType?: string | null
  categoryPt?: string | null
  perPerson?: boolean
  quantity2?: number | null
  uom2?: string | null
}

export type MapWizardToQuoteReviewInput = {
  state: WizardState
  quoteTotals: QuoteTotals
  customerName: string
  packageName: string | null
  packageImageUrl: string | null
  packageUnitPrice: number
  selectedPackage: QuoteReviewPackageFields | null
  allPackages?: ReadonlyArray<QuoteReviewPackageFields>
  packageOptionGroups?: ReadonlyArray<PackageOptionGroupRecord>
  packageOptionGroupItems?: ReadonlyArray<PackageOptionGroupItem>
  packageItems?: ReadonlyArray<PackageItem>
  packageSideItems?: ReadonlyArray<PackageSideItem>
  fromWithSidesSection?: boolean
  additionals: WizardSelectedAdditional[]
  billableGuestCount: number
  commercialRules: CommercialRulesSnapshot
  /** Idioma da UI do operador (perfil). Itens e chrome da revisão seguem este locale. */
  displayLanguage?: WizardState['language']
}

export function mapWizardToQuoteReview(
  input: MapWizardToQuoteReviewInput,
): QuoteReviewData {
  const { state, quoteTotals, commercialRules } = input
  const lang = input.displayLanguage ?? state.language

  const reviewAdditionals: QuoteReviewAdditional[] = input.additionals.map(
    (item) => ({
      id: item.id,
      itemKey: item.itemKey ?? null,
      label: item.label,
      category: item.category,
      quantity: item.perPerson ? input.billableGuestCount : item.quantity,
      unitPrice: item.unitPrice,
      totalPrice: item.totalPrice,
      imageUrl: item.imageUrl,
      itemType: item.itemType,
      categoryPt: item.categoryPt,
      quantity2: item.quantity2 ?? null,
      uom2: item.uom2 ?? null,
    }),
  )

  const packageGroups =
    state.packageId && input.packageOptionGroups
      ? getPackageOptionGroupsForPackage(
          state.packageId,
          input.packageOptionGroups,
          input.packageOptionGroupItems,
        )
      : []

  const packageSelectionLabels =
    input.selectedPackage && !isCustomPackage(input.selectedPackage)
      ? buildPackageSelectionLabels(
          state.packageSelections,
          packageGroups,
          lang,
        )
      : []

  const packageSummaryBase = buildQuoteReviewPackageSummary({
    pkg: input.selectedPackage,
    allPackages: input.allPackages,
    sidesPricePerPerson: commercialRules.sidesPricePerPerson,
    chargedPeople: quoteTotals.billableGuestCount,
    fromWithSidesSection: input.fromWithSidesSection,
    language: lang,
  })

  const configuredItems =
    state.packageId && input.packageItems
      ? getPackageItemsForPackage(state.packageId, input.packageItems)
      : []
  const configuredSides =
    state.packageId && input.packageSideItems
      ? getPackageSideItemsForPackage(state.packageId, input.packageSideItems)
      : []

  const baseItemsText =
    configuredItems.length > 0
      ? formatPackageItemsText(configuredItems, lang)
      : getPackageItemsDescription(input.selectedPackage, lang)

  const resolvedItemsDescription =
    input.selectedPackage && baseItemsText
      ? packageSelectionLabels.length > 0
        ? resolvePackageItemsWithSelections(
            baseItemsText,
            state.packageSelections,
            packageGroups,
            lang,
          )
        : baseItemsText
      : null

  const resolvedGarnishDescription =
    configuredSides.length > 0
      ? formatPackageSideItemsText(configuredSides, lang)
      : null

  const packageSummary = packageSummaryBase
    ? {
        ...packageSummaryBase,
        packageItemsDescription:
          resolvedItemsDescription ??
          packageSummaryBase.packageItemsDescription,
        garnishDescription:
          resolvedGarnishDescription ??
          packageSummaryBase.garnishDescription,
      }
    : null

  const packageImageUrl =
    resolvePackageCatalogImageUrl(
      input.selectedPackage,
      input.allPackages ?? [],
      state.packageId,
    ) ||
    input.packageImageUrl?.trim() ||
    null

  return {
    preview: true,
    customerName: input.customerName,
    customerPhone: state.customerDraftPhone.trim() || null,
    customerEmail: state.customerDraftEmail.trim() || null,
    eventName: state.eventName.trim() || input.customerName,
    eventDate: state.eventDate || null,
    startTime: state.startTime || null,
    endTime: state.endTime || null,
    addressLine: state.address || null,
    addressNumber: state.addressNumber.trim() || null,
    city: state.city || null,
    state: state.state || null,
    zipCode: state.zipCode || null,
    country: state.addressCountry?.trim() || null,
    packageName: input.packageName,
    packageImageUrl,
    packageUnitPrice: input.packageUnitPrice,
    packageTotal: quoteTotals.packageTotal,
    packageSummary,
    packageSelections: packageSelectionLabels,
    guestCounts: {
      adultCount: state.adultCount,
      childrenUnder3Count: state.childrenUnder3Count,
      children4To12Count: state.children4To12Count,
    },
    billableGuestCount: quoteTotals.billableGuestCount,
    physicalGuestCount: quoteTotals.physicalGuestCount,
    hasGrill: state.grillSetupAnswered ? state.hasGrill : null,
    grillPhotoRequired: state.grillPhotoRequired,
    grillPhotoStatusLabel: state.hasGrill
      ? getGrillPhotoStatusLabel(state.grillPhotoStatus, lang)
      : tw(lang, 'notApplicable'),
    grillPhotoUrl: state.grillPhotoUrl,
    grillRentalRequired: state.grillRentalRequired,
    grillRentalQty: state.grillRentalRequired ? state.grillRentalQty : null,
    grillRentalTotal: quoteTotals.grillRentalTotal,
    grillNotes: state.grillNotes.trim() || null,
    mileageBaseLocation:
      state.baseLocation.trim() || commercialRules.mileageBaseLocation,
    mileageDistance: state.distance,
    mileageFreeLimit: state.freeLimit ?? commercialRules.mileageFreeLimit,
    mileageRate: state.rate ?? commercialRules.mileageRate,
    mileageFee: quoteTotals.mileageFee,
    distanceDisplayUnit: commercialRules.distanceDisplayUnit,
    additionalTotal: quoteTotals.additionalTotal,
    holidaySurchargeAmount: quoteTotals.holidaySurchargeAmount,
    minimumOrderAdjustment: quoteTotals.minimumOrderAdjustment,
    minimumOrderApplied: quoteTotals.minimumOrderApplied,
    minimumOrderAmount: quoteTotals.minimumOrderAmount,
    reservationPercentage: state.reservationPercentage,
    reservationAmount: quoteTotals.reservationAmount,
    balanceDue: quoteTotals.balanceDue,
    quoteTotal: quoteTotals.quoteTotal,
    additionals: reviewAdditionals,
    language: lang,
  }
}

type MapWizardBreakdownToQuoteReviewInput = Omit<
  MapWizardToQuoteReviewInput,
  'quoteTotals' | 'commercialRules' | 'packageUnitPrice'
> & {
  breakdown: PricingBreakdown
}

function firstBreakdownLine(
  breakdown: PricingBreakdown,
  lineKey: string,
): PricingBreakdownLine | null {
  return (
    [...breakdown.lines, ...breakdown.adjustments].find(
      (line) => line.line_key === lineKey,
    ) ?? null
  )
}

function breakdownLineTotal(
  breakdown: PricingBreakdown,
  lineKey: string,
): number {
  return [...breakdown.lines, ...breakdown.adjustments]
    .filter((line) => line.line_key === lineKey)
    .reduce((total, line) => total + Number(line.amount ?? 0), 0)
}

/**
 * Adapta o snapshot canônico do Pricing Engine para o layout de proposta.
 * Não executa fórmulas comerciais: apenas seleciona e formata valores já
 * calculados no servidor.
 */
export function mapWizardBreakdownToQuoteReview(
  input: MapWizardBreakdownToQuoteReviewInput,
): QuoteReviewData {
  const { breakdown } = input
  const packageLine = firstBreakdownLine(breakdown, 'package')
  const mileageLine = firstBreakdownLine(breakdown, 'mileage')
  const grillRentalLine = firstBreakdownLine(breakdown, 'grill_rental')
  const holidayLine = firstBreakdownLine(breakdown, 'holiday_surcharge')
  const minimumLine = firstBreakdownLine(breakdown, 'minimum_order')
  const discountLine = firstBreakdownLine(breakdown, 'discount')
  const additionalLinesById = new Map(
    breakdown.lines
      .filter(
        (line): line is PricingBreakdownLine & { source_id: string } =>
          line.line_key === 'additional_item' &&
          typeof line.source_id === 'string' &&
          line.source_id.length > 0,
      )
      .map((line) => [line.source_id, line]),
  )

  const canonicalAdditionals = input.additionals.map((item) => {
    const line = additionalLinesById.get(item.id)
    return line
      ? {
          ...item,
          quantity: line.quantity,
          unitPrice: line.unit_price,
          totalPrice: line.amount,
        }
      : item
  })

  const guestCounts = breakdown.guest_counts
  const quoteTotals: QuoteTotals = {
    billableAdults: 0,
    freeChildren: 0,
    halfPriceChildren: 0,
    billableGuestCount: guestCounts.billable_guest_count,
    physicalGuestCount: guestCounts.physical_guest_count,
    packageTotal: Number(packageLine?.amount ?? 0),
    additionalTotal: breakdownLineTotal(breakdown, 'additional_item'),
    mileageFee: Number(mileageLine?.amount ?? 0),
    grillRentalTotal: Number(grillRentalLine?.amount ?? 0),
    quoteSubtotal: breakdown.subtotal,
    holidaySurchargeAmount: Number(holidayLine?.amount ?? 0),
    holidaySurchargePercent: breakdown.rules_applied.holidaySurchargePercent,
    minimumOrderAmount: Number(
      minimumLine?.metadata?.minimum_order_amount ?? 0,
    ),
    minimumOrderApplied: Boolean(minimumLine),
    minimumOrderAdjustment: Number(minimumLine?.amount ?? 0),
    reservationAmount: breakdown.deposit,
    balanceDue: breakdown.balance,
    quoteTotal: breakdown.total,
  }

  const mapped = mapWizardToQuoteReview({
    ...input,
    additionals: canonicalAdditionals,
    packageUnitPrice: Number(packageLine?.unit_price ?? 0),
    quoteTotals,
    commercialRules: breakdown.rules_applied,
  })

  return {
    ...mapped,
    packageUnitPrice: packageLine?.unit_price ?? null,
    packageTotal: packageLine?.amount ?? null,
    additionalTotal: quoteTotals.additionalTotal,
    guestCounts: {
      adultCount: guestCounts.adultCount,
      childrenUnder3Count: guestCounts.childrenUnder3Count,
      children4To12Count: guestCounts.children4To12Count,
    },
    billableGuestCount: guestCounts.billable_guest_count,
    physicalGuestCount: guestCounts.physical_guest_count,
    grillRentalQty: grillRentalLine?.quantity ?? null,
    grillRentalTotal: grillRentalLine?.amount ?? null,
    mileageBaseLocation:
      String(
        mileageLine?.metadata?.base_location ??
          breakdown.rules_applied.mileageBaseLocation,
      ) || null,
    mileageDistance:
      mileageLine?.metadata?.distance != null
        ? Number(mileageLine.metadata.distance)
        : null,
    mileageFreeLimit:
      mileageLine?.metadata?.free_limit != null
        ? Number(mileageLine.metadata.free_limit)
        : breakdown.rules_applied.mileageFreeLimit,
    mileageRate:
      mileageLine?.unit_price ?? breakdown.rules_applied.mileageRate,
    mileageFee: mileageLine?.amount ?? 0,
    holidaySurchargeAmount: quoteTotals.holidaySurchargeAmount,
    minimumOrderAdjustment: quoteTotals.minimumOrderAdjustment,
    minimumOrderApplied: quoteTotals.minimumOrderApplied,
    minimumOrderAmount: quoteTotals.minimumOrderAmount,
    reservationPercentage:
      breakdown.rules_applied.reservationPercentage ?? null,
    reservationAmount: breakdown.deposit,
    balanceDue: breakdown.balance,
    quoteTotal: breakdown.total,
    discount: Math.abs(Number(discountLine?.amount ?? 0)),
  }
}
