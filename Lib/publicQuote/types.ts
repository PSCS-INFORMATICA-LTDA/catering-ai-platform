import type { CatalogItemListItem } from '@/Lib/itemCatalog'
import type {
  PackageItem,
  PackageSideItem,
} from '@/Lib/packageConfiguration'
import type {
  PackageOptionGroupItem,
  PackageOptionGroupRecord,
} from '@/Lib/packageOptionGroups'
import type { PackageListItem } from '@/Lib/fetchPackages'
import type { QuoteLanguage } from '@/Lib/quoteWizardTypes'
import type { CommercialRulesSnapshot } from '@/Lib/supabaseCommercialRules'
import type { PublicLocationBias } from './locationBias'
import type { PublicHeroMediaItem } from './companyPublicHeroMedia'
import type { PublicHowItWorksVideo } from '@/Lib/media/types'

export const PUBLIC_QUOTE_LOCALES = ['pt', 'en', 'es'] as const

export type PublicQuoteLocale = (typeof PUBLIC_QUOTE_LOCALES)[number]

export type PublicQuoteBootstrap = {
  company: {
    id: string
    slug: string
    name: string
    logoUrl: string | null
    primaryColor: string
    accentColor: string
    currencyCode: string
  }
  settings: {
    enabled: boolean
    defaultLocale: QuoteLanguage
    allowedLocales: QuoteLanguage[]
    allowedCountries: string[]
    heroImageUrl: string | null
    heroGallery: PublicHeroMediaItem[]
    howItWorksVideo: PublicHowItWorksVideo | null
    howItWorksVideos: PublicHowItWorksVideo[]
    landing: {
      eyebrow: string
      title: string
      subtitle: string
      intro: string
      cta: string
    }
    consent: {
      version: string
      label: string
      privacyUrl: string | null
    }
    support: {
      phone: string | null
      whatsappUrl: string | null
      email?: string | null
      instagramUrl?: string | null
      instagramHandle?: string | null
    }
    serviceDurationMinutes: number
    locationBias: PublicLocationBias | null
  }
  branches: Array<{
    id: string
    name: string
    isDefault: boolean
    country: string | null
  }>
  packages: PackageListItem[]
  catalogItems: CatalogItemListItem[]
  packageItems: PackageItem[]
  packageSideItems: PackageSideItem[]
  optionGroups: PackageOptionGroupRecord[]
  optionGroupItems: PackageOptionGroupItem[]
  commercialRules: CommercialRulesSnapshot
}

export type PublicQuoteIntakeSession = {
  id: string
  company_id: string
  locale: PublicQuoteLocale
  token_hash: string
  draft: Record<string, unknown>
  current_step: number
  status: 'active' | 'submitting' | 'submitted' | 'expired' | 'revoked'
  expires_at: string
  revoked_at: string | null
  quote_id: string | null
  idempotency_key_hash: string | null
  submission_hash: string | null
  consent_at: string | null
  consent_version: string | null
  created_at: string
  updated_at: string
}

export type PublicQuoteDraft = {
  locale: PublicQuoteLocale
  contact: {
    firstName: string
    lastName: string
    phone: string
    email: string | null
  }
  event: {
    eventName: string
    eventDate: string
    startTime: string
    endTime: string
    adultCount: number
    childrenUnder3Count: number
    children4To12Count: number
    address: {
      route: string
      number: string
      city: string
      region: string
      postalCode: string
      country: string
      formattedAddress: string
      placeId: string | null
      latitude: number | null
      longitude: number | null
      source: 'google' | 'manual'
    }
  }
  selection: {
    packageId: string
    packageSelections: Record<string, string>
    additionals: Array<{ itemId: string; quantity: number }>
    reviewedCategoryKeys: string[]
  }
  grill: {
    setupAnswered: boolean
    hasGrill: boolean
    photoReference: string | null
    rentalRequired: boolean
    rentalQty: number
    notes: string | null
  }
  consents?: {
    cancellation?: {
      accepted: boolean
      version: string
      locale: PublicQuoteLocale
      acceptedAt: string | null
    }
  }
}
