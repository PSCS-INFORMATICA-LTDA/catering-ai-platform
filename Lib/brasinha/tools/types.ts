import type { BrasinhaLanguage, BrasinhaToolTrace } from '../types'

export type PackageSummary = {
  id: string
  packageKey: string | null
  label: string
  pricePerPerson: number | null
  currency: string
  description: string | null
  custom: boolean
}

export type CatalogHit = {
  id: string
  itemKey: string | null
  label: string
  price: number | null
  currency: string
  category: string | null
}

export type PublicRulesSnapshot = {
  sidesPricePerPerson: number
  waiterServiceFee: number
  grillRentalFee: number
  minOrderWeekday: number
  minOrderWeekend: number
  reservationPercentage: number
  serviceDurationHours: number
  crewSetupLeadMinutes: number
  source: string
}

export type CompanyPublicProfile = {
  id: string
  slug: string
  name: string
  currency: string
  supportPhone: string | null
}

export type QuotePublicLookup = {
  quoteNumber: string
  status: string | null
  eventDate: string | null
  total: number | null
}

export type PackageConfigurationView = {
  packageId: string
  packageKey: string | null
  packageName: string
  includedItems: Array<{ id: string | null; label: string; itemKey: string | null }>
  requiredOptionGroups: Array<{
    id: string
    label: string
    required: boolean
    minChoices: number | null
    maxChoices: number | null
    selectedItemId: string | null
    choices: Array<{ id: string; label: string; catalogItemId: string | null }>
  }>
}

export type ExtraAvailabilityView = {
  available: Array<{
    id: string
    itemKey: string | null
    label: string
    price: number | null
    currency: string
    category: string | null
    status: 'AVAILABLE'
  }>
  includedInPackage: Array<{ id: string; itemKey: string | null; label: string; status: 'INCLUDED_IN_PACKAGE' }>
  selectedInPackage: Array<{ id: string; itemKey: string | null; label: string; status: 'SELECTED_IN_PACKAGE' }>
}

export type PublicServiceOptionsView = {
  waiter: { id: string | null; itemKey: string; label: string; price: number | null; currency: string } | null
  disposableKit: {
    id: string | null
    itemKey: string
    label: string
    price: number | null
    currency: string
    included: boolean
    offerable: boolean
  } | null
  grillRental: {
    id: string | null
    itemKey: string
    label: string
    price: number | null
    currency: string
    qtyWhenRequired: 1
  }
}

export type BrasinhaCatalogPort = {
  getCompanyPublicProfile(
    companyId: string,
    language: BrasinhaLanguage,
  ): Promise<{ data: CompanyPublicProfile | null; trace: BrasinhaToolTrace }>
  getPackages(
    companyId: string,
    language: BrasinhaLanguage,
  ): Promise<{ data: PackageSummary[]; trace: BrasinhaToolTrace }>
  getPackageDetails(
    companyId: string,
    query: string,
    language: BrasinhaLanguage,
  ): Promise<{ data: PackageSummary | null; trace: BrasinhaToolTrace }>
  getCatalogItem(
    companyId: string,
    query: string,
    language: BrasinhaLanguage,
  ): Promise<{ data: CatalogHit | null; trace: BrasinhaToolTrace }>
  searchCatalog(
    companyId: string,
    query: string,
    language: BrasinhaLanguage,
  ): Promise<{ data: CatalogHit[]; trace: BrasinhaToolTrace }>
  getPublicBusinessRules(
    companyId: string,
  ): Promise<{ data: PublicRulesSnapshot; trace: BrasinhaToolTrace }>
  getQuoteByPublicReference(
    companyId: string,
    reference: string,
  ): Promise<{ data: QuotePublicLookup | null; trace: BrasinhaToolTrace }>
  getPackageConfiguration(
    companyId: string,
    query: string,
    language: BrasinhaLanguage,
    selections?: Record<string, string>,
  ): Promise<{ data: PackageConfigurationView | null; trace: BrasinhaToolTrace }>
  getAvailableAdditionalsForPackage(
    companyId: string,
    query: string,
    language: BrasinhaLanguage,
    selections?: Record<string, string>,
  ): Promise<{ data: ExtraAvailabilityView | null; trace: BrasinhaToolTrace }>
  getPublicServiceOptions(
    companyId: string,
    query: string,
    language: BrasinhaLanguage,
  ): Promise<{ data: PublicServiceOptionsView | null; trace: BrasinhaToolTrace }>
}

export const BLOCKED_WRITE_TOOLS = [
  'create_quote_draft',
  'approve_discount',
  'mark_payment_paid',
  'alter_price',
  'alter_invoice',
  'alter_inventory',
  'alter_supplier',
  'reserve_date',
  'approve_quote',
  'alter_commercial_rules',
] as const
