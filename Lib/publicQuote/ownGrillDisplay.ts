import { tw } from '../quoteTranslations.ts'
import type { QuoteLanguage } from '../quoteWizardTypes.ts'

export function hasOwnGrillPhoto(state: {
  grillPhotoUrl?: string | null
  grillPhotoReference?: string | null
}): boolean {
  return Boolean(
    state.grillPhotoUrl?.trim() || state.grillPhotoReference?.trim(),
  )
}

export function resolvePublicGrillSystemNotes(
  state: {
    hasGrill: boolean
    grillPhotoUrl?: string | null
    grillPhotoReference?: string | null
  },
  language: QuoteLanguage,
): string {
  if (!state.hasGrill || hasOwnGrillPhoto(state)) return ''
  return tw(language, 'grillNoPhotoReviewNote')
}

export function resolvePublicGrillSummaryImageUrl(input: {
  hasOwnGrill: boolean
  customerPhotoUrl?: string | null
  rentalImageUrl?: string | null
}): { kind: 'customer' | 'rental' | 'none'; url: string | null } {
  if (input.hasOwnGrill) {
    const customerPhotoUrl = input.customerPhotoUrl?.trim() || null
    return customerPhotoUrl
      ? { kind: 'customer', url: customerPhotoUrl }
      : { kind: 'none', url: null }
  }
  const rentalImageUrl = input.rentalImageUrl?.trim() || null
  return rentalImageUrl
    ? { kind: 'rental', url: rentalImageUrl }
    : { kind: 'none', url: null }
}
