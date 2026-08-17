import type { CommercialRulesSnapshot } from './supabaseCommercialRules'

import type { GrillPhotoStatus } from './grillPhotoStatus'

export type QuoteLanguage = 'pt' | 'en' | 'es'

export type WizardState = {
  language: QuoteLanguage
  customerId: string | null
  customerDraftPhone: string
  customerFirstName: string
  customerLastName: string
  customerDraftName: string
  customerDraftEmail: string
  customerPhoneLinking: boolean
  customerPhoneLinkError: string | null
  eventName: string
  eventDate: string
  startTime: string
  endTime: string
  adultCount: number
  childrenUnder3Count: number
  children4To12Count: number
  address: string
  addressNumber: string
  city: string
  state: string
  zipCode: string
  addressFormatted: string
  addressPlaceId: string | null
  addressCountry: string
  addressLatitude: number | null
  addressLongitude: number | null
  addressSource: 'google' | 'manual' | null
  hasGrill: boolean
  grillSetupAnswered: boolean
  grillPhotoRequired: boolean
  grillPhotoStatus: GrillPhotoStatus
  grillPhotoAnswered: boolean
  grillPhotoUrl: string | null
  grillPhotoReference: string | null
  grillRentalRequired: boolean
  grillRentalQty: number
  grillNotes: string
  packageId: string | null
  /** Filial operacional (quando a company tiver branches). */
  branchId: string | null
  /** option_group_id -> option_item_id */
  packageSelections: Record<string, string>
  additionals: Record<string, number>
  baseLocation: string
  distance: number
  freeLimit: number
  rate: number
  reservationPercentage: number
  reservationAmount: number
  reservationNotes: string
  publicConsentAccepted: boolean
  publicConsentVersion: string | null
}

export function createInitialWizardState(
  rules: CommercialRulesSnapshot,
): WizardState {
  return {
    language: 'pt',
    customerId: null,
    customerDraftPhone: '',
    customerFirstName: '',
    customerLastName: '',
    customerDraftName: '',
    customerDraftEmail: '',
    customerPhoneLinking: false,
    customerPhoneLinkError: null,
    eventName: '',
    eventDate: '',
    startTime: '',
    endTime: '',
    adultCount: 0,
    childrenUnder3Count: 0,
    children4To12Count: 0,
    address: '',
    addressNumber: '',
    city: '',
    state: '',
    zipCode: '',
    addressFormatted: '',
    addressPlaceId: null,
    addressCountry: '',
    addressLatitude: null,
    addressLongitude: null,
    addressSource: null,
    hasGrill: false,
    grillSetupAnswered: false,
    grillPhotoRequired: false,
    grillPhotoStatus: 'not_applicable',
    grillPhotoAnswered: false,
    grillPhotoUrl: null,
    grillPhotoReference: null,
    grillRentalRequired: false,
    grillRentalQty: 0,
    grillNotes: '',
    packageId: null,
    branchId: null,
    packageSelections: {},
    additionals: {},
    baseLocation: rules.mileageBaseLocation,
    distance: 0,
    freeLimit: rules.mileageFreeLimit,
    rate: rules.mileageRate,
    reservationPercentage: rules.reservationPercentage,
    reservationAmount: 0,
    reservationNotes: '',
    publicConsentAccepted: false,
    publicConsentVersion: null,
  }
}

export function buildPricingFingerprint(state: WizardState): string {
  const additionals = Object.entries(state.additionals)
    .filter(([, qty]) => qty > 0)
    .sort(([a], [b]) => a.localeCompare(b))

  return JSON.stringify({
    packageId: state.packageId,
    adultCount: state.adultCount,
    childrenUnder3Count: state.childrenUnder3Count,
    children4To12Count: state.children4To12Count,
    distance: state.distance,
    baseLocation: state.baseLocation.trim(),
    additionals,
  })
}
