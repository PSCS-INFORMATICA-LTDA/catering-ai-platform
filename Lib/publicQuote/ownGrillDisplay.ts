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
  return tw(language, 'grillNoPhotoWarning')
}

export function resolvePublicGrillSummaryImageUrl(
  uploadedPhotoUrl: string | null | undefined,
  defaultItemImageUrl: string | null | undefined,
): string | null {
  return uploadedPhotoUrl?.trim() || defaultItemImageUrl?.trim() || null
}
