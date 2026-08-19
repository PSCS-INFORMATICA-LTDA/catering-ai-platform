/**
 * Public landing hero media.
 * Drop real CDL operation clips in `public/cdl/hero/` and list the public
 * paths below. Do not fetch substitutes from the internet.
 */
export const PUBLIC_QUOTE_HERO_VIDEO_SRCS: readonly string[] = []

export function collectPublicHeroImages(input: {
  heroImageUrl?: string | null
  packageImageUrls?: Array<string | null | undefined>
}): string[] {
  const out: string[] = []
  const add = (value?: string | null) => {
    const next = value?.trim()
    if (!next || out.includes(next)) return
    out.push(next)
  }
  add(input.heroImageUrl)
  for (const url of input.packageImageUrls ?? []) add(url)
  return out.slice(0, 5)
}
