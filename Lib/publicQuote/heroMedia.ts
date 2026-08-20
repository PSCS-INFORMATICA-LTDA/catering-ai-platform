/**
 * Public landing hero media.
 * Photography is company-scoped (see companyPublicHeroMedia).
 * Do not fetch substitutes from the internet or use package flyer art.
 */
import {
  getCompanyPublicHeroMedia,
  type PublicHeroMediaItem,
} from './companyPublicHeroMedia'

export const PUBLIC_QUOTE_HERO_VIDEO_SRCS: readonly string[] = []

export type { PublicHeroMediaItem }

export function collectPublicHeroImages(input: {
  companySlug?: string | null
  heroImageUrl?: string | null
}): PublicHeroMediaItem[] {
  const configured = getCompanyPublicHeroMedia(input.companySlug)
  if (configured.length > 0) return [...configured]

  const fallback = input.heroImageUrl?.trim()
  if (!fallback) return []

  return [
    {
      id: 'tenant-hero',
      src: fallback,
      originalSrc: fallback,
      sourceFilename: fallback,
      alt: 'Catering event photography',
      mobilePosition: '50% 50%',
      desktopPosition: '50% 50%',
      width: 1600,
      height: 900,
    },
  ]
}
