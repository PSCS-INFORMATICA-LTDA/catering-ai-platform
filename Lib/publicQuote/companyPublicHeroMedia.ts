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
  mobilePosition: string
  desktopPosition: string
  width: number
  height: number
}

export const PUBLIC_HERO_HOLD_MS = 7000
export const PUBLIC_HERO_FADE_MS = 1500

const CDL_PUBLIC_HERO_PHOTOS: readonly PublicHeroMediaItem[] = [
  {
    id: 'cdl-event-tent',
    src: '/cdl/hero/cdl-event-tent.webp',
    originalSrc: 'assets/branding/cdl/hero/originals/cdl-event-tent-original.jpeg',
    sourceFilename: '12A42ED0-52E8-4D95-BAE0-E2A58F200A26.jpeg',
    mobilePosition: '50% 68%',
    desktopPosition: '48% 62%',
    width: 1440,
    height: 1920,
  },
  {
    id: 'cdl-event-van',
    src: '/cdl/hero/cdl-event-van.webp',
    originalSrc: 'assets/branding/cdl/hero/originals/cdl-event-van-original.jpeg',
    sourceFilename: 'E91AAB0B-CD8C-4C9A-946B-71AFEBE96C96.jpeg',
    mobilePosition: '50% 78%',
    desktopPosition: '46% 72%',
    width: 1440,
    height: 1920,
  },
  {
    id: 'cdl-event-buffet',
    src: '/cdl/hero/cdl-event-buffet.webp',
    originalSrc: 'assets/branding/cdl/hero/originals/cdl-event-buffet-original.jpeg',
    sourceFilename: 'BCC58DBB-6448-4AFE-85C1-C8277D075AEE.jpeg',
    mobilePosition: '50% 58%',
    desktopPosition: '50% 62%',
    width: 1440,
    height: 1920,
  },
  {
    id: 'cdl-event-board',
    src: '/cdl/hero/cdl-event-board.webp',
    originalSrc: 'assets/branding/cdl/hero/originals/cdl-event-board-original.jpeg',
    sourceFilename: '228C5DB0-5F5F-4B30-B72E-7E3337965435.jpeg',
    mobilePosition: '50% 62%',
    desktopPosition: '48% 58%',
    width: 1440,
    height: 1920,
  },
  {
    id: 'cdl-event-fleet',
    src: '/cdl/hero/cdl-event-fleet.webp',
    originalSrc: 'assets/branding/cdl/hero/originals/cdl-event-fleet-original.jpeg',
    sourceFilename: '14D84C20-F765-434F-9EAE-444855C148C4.jpeg',
    mobilePosition: '50% 76%',
    desktopPosition: '44% 70%',
    width: 1440,
    height: 1920,
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
