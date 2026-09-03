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
