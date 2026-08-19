import type { GuestCounts } from '@/Lib/calculateQuoteTotals'
import type { PackageSelectionLabel } from '@/Lib/packageOptionGroups'
import type { QuoteLanguage } from '@/Lib/quoteWizardTypes'
import type { QuoteReviewPackageSummary } from './quoteReviewPackageSummary'

export type QuoteReviewAdditional = {
  id: string
  label: string
  category: string
  quantity: number | null
  unitPrice: number | null
  totalPrice: number | null
  imageUrl?: string | null
  itemType?: string | null
  categoryPt?: string | null
}

export type QuoteReviewData = {
  language?: QuoteLanguage
  quoteNumber?: string
  quoteStatus?: string | null
  preview?: boolean
  customerName: string
  customerPhone?: string | null
  customerEmail?: string | null
  eventName: string
  eventDate: string | null
  startTime: string | null
  endTime: string | null
  addressLine: string | null
  addressNumber?: string | null
  city: string | null
  state: string | null
  zipCode: string | null
  country?: string | null
  packageName: string | null
  packageImageUrl?: string | null
  packageUnitPrice: number | null
  packageTotal: number | null
  packageSummary?: QuoteReviewPackageSummary | null
  packageSelections?: PackageSelectionLabel[]
  guestCounts: GuestCounts
  billableGuestCount: number | null
  physicalGuestCount: number | null
  hasGrill: boolean | null
  grillPhotoRequired: boolean | null
  grillPhotoStatusLabel?: string | null
  grillPhotoUrl?: string | null
  grillRentalRequired: boolean | null
  grillRentalQty: number | null
  grillRentalTotal?: number | null
  grillNotes: string | null
  mileageBaseLocation: string | null
  mileageDistance: number | null
  mileageFreeLimit: number | null
  mileageRate: number | null
  mileageFee: number | null
  distanceDisplayUnit?: import('@/Lib/units').DistanceDisplayUnit
  additionalTotal: number | null
  holidaySurchargeAmount?: number | null
  minimumOrderAdjustment?: number | null
  minimumOrderApplied?: boolean
  minimumOrderAmount?: number | null
  reservationPercentage: number | null
  reservationAmount: number | null
  balanceDue: number | null
  quoteTotal: number | null
  discount?: number
  additionals: QuoteReviewAdditional[]
}
