/**
 * Public landing hero media.
 * Drop real CDL operation clips in `public/cdl/hero/` and list the public
 * paths below. Do not fetch substitutes from the internet.
 */
export const PUBLIC_QUOTE_HERO_VIDEO_SRCS: readonly string[] = []

export function collectPublicHeroImages(input: {
  heroImageUrl?: string | null
}): string[] {
  const next = input.heroImageUrl?.trim()
  return next ? [next] : []
}
