/**
 * Tenant-scoped public landing photography.
 * CDL is the pilot. Other companies stay on the dark gradient until they
 * receive their own official set. Do not inline these URLs in JSX.
 */

export type PublicHeroMediaItem = {
  id: string
  src: string
  originalSrc: string
  sourceFilename: string
  alt: string
  mobilePosition: string
  desktopPosition: string
  width: number
  height: number
}

export const PUBLIC_HERO_HOLD_MS = 6500
export const PUBLIC_HERO_FADE_MS = 1400

const CDL_PUBLIC_HERO_PHOTOS: readonly PublicHeroMediaItem[] = [
  {
    id: 'cdl-event-pool-station',
    src: '/cdl/hero/cdl-event-pool-station.webp',
    originalSrc:
      'assets/branding/cdl/hero/originals/cdl-event-pool-station-original.jpeg',
    sourceFilename: 'cdl-event-pool-station.jpeg',
    alt: 'CDL Brazilian BBQ station under a branded tent beside a luxury pool',
    mobilePosition: '50% 42%',
    desktopPosition: '48% 38%',
    width: 1920,
    height: 1080,
  },
  {
    id: 'cdl-fleet-neighborhood',
    src: '/cdl/hero/cdl-fleet-neighborhood.webp',
    originalSrc:
      'assets/branding/cdl/hero/originals/cdl-fleet-neighborhood-original.jpeg',
    sourceFilename: 'cdl-fleet-neighborhood.jpeg',
    alt: 'CDL Services branded catering van at a residential event',
    mobilePosition: '50% 55%',
    desktopPosition: '46% 52%',
    width: 1920,
    height: 1080,
  },
]

const COMPANY_PUBLIC_HERO_MEDIA: Record<
  string,
  readonly PublicHeroMediaItem[]
> = {
  cdl: CDL_PUBLIC_HERO_PHOTOS,
}

export function getCompanyPublicHeroMedia(
  companySlug: string | null | undefined,
): readonly PublicHeroMediaItem[] {
  const slug = companySlug?.trim().toLowerCase()
  if (!slug) return []
  return COMPANY_PUBLIC_HERO_MEDIA[slug] ?? []
}

export function shuffleHeroPlaylist<T extends { id: string }>(
  items: readonly T[],
  previousLastId?: string | null,
  random: () => number = Math.random,
): T[] {
  const next = [...items]
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1))
    const left = next[index]
    const right = next[swapIndex]
    if (!left || !right) continue
    next[index] = right
    next[swapIndex] = left
  }

  if (previousLastId && next.length > 1 && next[0]?.id === previousLastId) {
    const swapIndex = 1 + Math.floor(random() * (next.length - 1))
    const first = next[0]
    const other = next[swapIndex]
    if (first && other) {
      next[0] = other
      next[swapIndex] = first
    }
  }

  return next
}

export function playlistHasImmediateRepeat(
  current: readonly { id: string }[],
  next: readonly { id: string }[],
): boolean {
  const last = current.at(-1)?.id
  const first = next[0]?.id
  return Boolean(last && first && last === first)
}
