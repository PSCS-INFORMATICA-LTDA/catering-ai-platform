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
import { getGrillPhotoStatusLabel } from '@/Lib/grillPhotoStatus'
import { tw } from '@/Lib/quoteTranslations'
import {
  buildQuoteReviewPackageSummary,
  type QuoteReviewPackageFields,
} from './quoteReviewPackageSummary'
import type { QuoteReviewAdditional, QuoteReviewData } from './quoteReviewTypes'

export type WizardSelectedAdditional = {
  id: string
  label: string
  category: string
  quantity: number
  unitPrice: number
  totalPrice: number
  imageUrl?: string | null
  itemType?: string | null
  categoryPt?: string | null
  perPerson?: boolean
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
}

export function mapWizardToQuoteReview(
  input: MapWizardToQuoteReviewInput,
): QuoteReviewData {
  const { state, quoteTotals, commercialRules } = input

  const reviewAdditionals: QuoteReviewAdditional[] = input.additionals.map(
    (item) => ({
      id: item.id,
      label: item.label,
      category: item.category,
      quantity: item.perPerson ? input.billableGuestCount : item.quantity,
      unitPrice: item.unitPrice,
      totalPrice: item.totalPrice,
      imageUrl: item.imageUrl,
      itemType: item.itemType,
      categoryPt: item.categoryPt,
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
          state.language,
        )
      : []

  const packageSummaryBase = buildQuoteReviewPackageSummary({
    pkg: input.selectedPackage,
    allPackages: input.allPackages,
    sidesPricePerPerson: commercialRules.sidesPricePerPerson,
    chargedPeople: quoteTotals.billableGuestCount,
    fromWithSidesSection: input.fromWithSidesSection,
    language: state.language,
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
      ? formatPackageItemsText(configuredItems, state.language)
      : getPackageItemsDescription(input.selectedPackage, state.language)

  const resolvedItemsDescription =
    input.selectedPackage && baseItemsText
      ? packageSelectionLabels.length > 0
        ? resolvePackageItemsWithSelections(
            baseItemsText,
            state.packageSelections,
            packageGroups,
            state.language,
          )
        : baseItemsText
      : null

  const resolvedGarnishDescription =
    configuredSides.length > 0
      ? formatPackageSideItemsText(configuredSides, state.language)
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
    eventName: state.eventName.trim() || input.customerName,
    eventDate: state.eventDate || null,
    startTime: state.startTime || null,
    endTime: state.endTime || null,
    addressLine: state.address || null,
    city: state.city || null,
    state: state.state || null,
    zipCode: state.zipCode || null,
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
      ? getGrillPhotoStatusLabel(state.grillPhotoStatus, state.language)
      : tw(state.language, 'notApplicable'),
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
    language: state.language,
  }
}
