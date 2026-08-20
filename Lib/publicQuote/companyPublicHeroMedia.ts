/**
 * Tenant-scoped public landing photography.
 * CDL is the pilot. Other companies stay on the dark gradient until they
 * receive their own official set. Do not inline these URLs in JSX.
 */

export type PublicHeroCaptionAlign = 'top-left' | 'top-right' | 'bottom-left'

export type PublicHeroCaptionCopy = {
  readonly pt: string
  readonly en: string
  readonly es: string
}

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
  captionAlign?: PublicHeroCaptionAlign
  caption?: PublicHeroCaptionCopy
}

export const PUBLIC_HERO_HOLD_MS = 6500
export const PUBLIC_HERO_FADE_MS = 1400

const CDL_PUBLIC_HERO_PHOTOS: readonly PublicHeroMediaItem[] = [
  {
    id: 'cdl-canape-sausage-crostini',
    src: '/cdl/hero/cdl-canape-sausage-crostini.webp',
    originalSrc:
      'assets/branding/cdl/hero/originals/cdl-canape-sausage-crostini-original.jpeg',
    sourceFilename: 'WhatsApp Image 2026-08-19 at 21.43.21 (2).jpeg',
    alt: 'CDL sausage crostini canapés on a branded wooden board',
    mobilePosition: '50% 46%',
    desktopPosition: '50% 42%',
    width: 1080,
    height: 1920,
  },
  {
    id: 'cdl-sliced-beef-rosemary',
    src: '/cdl/hero/cdl-sliced-beef-rosemary.webp',
    originalSrc:
      'assets/branding/cdl/hero/originals/cdl-sliced-beef-rosemary-original.jpeg',
    sourceFilename: 'WhatsApp Image 2026-08-19 at 21.43.21 (1).jpeg',
    alt: 'Sliced grilled beef with rosemary served on a wooden platter',
    mobilePosition: '50% 48%',
    desktopPosition: '50% 44%',
    width: 1108,
    height: 1920,
  },
  {
    id: 'cdl-grill-flames-steaks',
    src: '/cdl/hero/cdl-grill-flames-steaks.webp',
    originalSrc:
      'assets/branding/cdl/hero/originals/cdl-grill-flames-steaks-original.jpeg',
    sourceFilename: 'WhatsApp Image 2026-08-19 at 21.43.21.jpeg',
    alt: 'Steaks and sausages searing over live flames',
    mobilePosition: '42% 50%',
    desktopPosition: '44% 48%',
    width: 1097,
    height: 1920,
    captionAlign: 'top-right',
    caption: {
      pt: 'Da brasa à mesa',
      en: 'From the grill to the table',
      es: 'De la parrilla a la mesa',
    },
  },
  {
    id: 'cdl-platter-picanha-farofa-pool',
    src: '/cdl/hero/cdl-platter-picanha-farofa-pool.webp',
    originalSrc:
      'assets/branding/cdl/hero/originals/cdl-platter-picanha-farofa-pool-original.jpeg',
    sourceFilename: 'WhatsApp Image 2026-08-19 at 21.43.24 (2).jpeg',
    alt: 'Picanha slices around farofa served poolside',
    mobilePosition: '50% 58%',
    desktopPosition: '50% 52%',
    width: 1440,
    height: 1920,
  },
  {
    id: 'cdl-bacon-scallops',
    src: '/cdl/hero/cdl-bacon-scallops.webp',
    originalSrc:
      'assets/branding/cdl/hero/originals/cdl-bacon-scallops-original.jpeg',
    sourceFilename: 'WhatsApp Image 2026-08-19 at 21.43.24 (3).jpeg',
    alt: 'Bacon-wrapped bites on a wooden catering plate',
    mobilePosition: '50% 56%',
    desktopPosition: '50% 48%',
    width: 1440,
    height: 1920,
  },
  {
    id: 'cdl-sunset-waterfront-grill',
    src: '/cdl/hero/cdl-sunset-waterfront-grill.webp',
    originalSrc:
      'assets/branding/cdl/hero/originals/cdl-sunset-waterfront-grill-original.jpeg',
    sourceFilename: 'WhatsApp Image 2026-08-19 at 21.43.24.jpeg',
    alt: 'Picanha grilling over flames at a waterfront sunset',
    mobilePosition: '50% 66%',
    desktopPosition: '50% 60%',
    width: 1440,
    height: 1920,
    captionAlign: 'top-left',
    caption: {
      pt: 'Desde 2017 em Orlando, Flórida',
      en: 'Serving Orlando since 2017',
      es: 'Desde 2017 en Orlando, Florida',
    },
  },
  {
    id: 'cdl-mixed-platter-bull-grill',
    src: '/cdl/hero/cdl-mixed-platter-bull-grill.webp',
    originalSrc:
      'assets/branding/cdl/hero/originals/cdl-mixed-platter-bull-grill-original.jpeg',
    sourceFilename: 'WhatsApp Image 2026-08-19 at 21.43.23 (1).jpeg',
    alt: 'Mixed grilled meats, corn and garlic bread on a serving board',
    mobilePosition: '50% 44%',
    desktopPosition: '50% 40%',
    width: 1080,
    height: 1920,
  },
  {
    id: 'cdl-event-pool-station',
    src: '/cdl/hero/cdl-event-pool-station.webp',
    originalSrc:
      'assets/branding/cdl/hero/originals/cdl-event-pool-station-original.jpeg',
    sourceFilename: 'cdl-event-pool-station.jpeg',
    alt: 'CDL Brazilian BBQ station under a branded tent beside a luxury pool',
    mobilePosition: '42% 38%',
    desktopPosition: '44% 36%',
    width: 1920,
    height: 1080,
    captionAlign: 'top-right',
    caption: {
      pt: 'Churrasco brasileiro feito para o seu evento',
      en: 'Brazilian barbecue made for your event',
      es: 'Barbacoa brasileña hecha para tu evento',
    },
  },
  {
    id: 'cdl-board-steak-zucchini',
    src: '/cdl/hero/cdl-board-steak-zucchini.webp',
    originalSrc:
      'assets/branding/cdl/hero/originals/cdl-board-steak-zucchini-original.jpeg',
    sourceFilename: 'WhatsApp Image 2026-08-19 at 21.43.22 (1).jpeg',
    alt: 'CDL branded board with steak, chicken and grilled vegetables',
    mobilePosition: '50% 46%',
    desktopPosition: '50% 44%',
    width: 1440,
    height: 1920,
  },
  {
    id: 'cdl-grill-lamb-hearts',
    src: '/cdl/hero/cdl-grill-lamb-hearts.webp',
    originalSrc:
      'assets/branding/cdl/hero/originals/cdl-grill-lamb-hearts-original.jpeg',
    sourceFilename: 'WhatsApp Image 2026-08-19 at 21.43.20 (1).jpeg',
    alt: 'Lamb chops, chicken hearts and spiral sausage on a commercial grill',
    mobilePosition: '50% 54%',
    desktopPosition: '50% 48%',
    width: 1095,
    height: 1920,
  },
  {
    id: 'cdl-poolside-brazilian-spread',
    src: '/cdl/hero/cdl-poolside-brazilian-spread.webp',
    originalSrc:
      'assets/branding/cdl/hero/originals/cdl-poolside-brazilian-spread-original.jpeg',
    sourceFilename: 'WhatsApp Image 2026-08-19 at 21.43.23.jpeg',
    alt: 'Brazilian BBQ platters and sauces beside a swimming pool',
    mobilePosition: '50% 58%',
    desktopPosition: '48% 52%',
    width: 1080,
    height: 1920,
  },
  {
    id: 'cdl-grill-corn-flames',
    src: '/cdl/hero/cdl-grill-corn-flames.webp',
    originalSrc:
      'assets/branding/cdl/hero/originals/cdl-grill-corn-flames-original.jpeg',
    sourceFilename: 'WhatsApp Image 2026-08-19 at 21.43.20.jpeg',
    alt: 'Corn, steaks and sausages cooking over grill flames',
    mobilePosition: '42% 52%',
    desktopPosition: '44% 48%',
    width: 1318,
    height: 1920,
  },
  {
    id: 'cdl-fleet-neighborhood',
    src: '/cdl/hero/cdl-fleet-neighborhood.webp',
    originalSrc:
      'assets/branding/cdl/hero/originals/cdl-fleet-neighborhood-original.jpeg',
    sourceFilename: 'cdl-fleet-neighborhood.jpeg',
    alt: 'CDL Services branded catering van at a residential event',
    mobilePosition: '48% 42%',
    desktopPosition: '42% 46%',
    width: 1920,
    height: 1080,
  },
  {
    id: 'cdl-raw-tomahawk-wolf',
    src: '/cdl/hero/cdl-raw-tomahawk-wolf.webp',
    originalSrc:
      'assets/branding/cdl/hero/originals/cdl-raw-tomahawk-wolf-original.jpeg',
    sourceFilename: 'WhatsApp Image 2026-08-19 at 21.43.21 (3).jpeg',
    alt: 'Raw tomahawk steak held in front of an outdoor grill',
    mobilePosition: '50% 48%',
    desktopPosition: '50% 42%',
    width: 1440,
    height: 1920,
  },
  {
    id: 'cdl-vacuum-premium-meats',
    src: '/cdl/hero/cdl-vacuum-premium-meats.webp',
    originalSrc:
      'assets/branding/cdl/hero/originals/cdl-vacuum-premium-meats-original.jpeg',
    sourceFilename: 'WhatsApp Image 2026-08-19 at 21.43.22.jpeg',
    alt: 'Premium vacuum-sealed meats prepared poolside for churrasco',
    mobilePosition: '50% 68%',
    desktopPosition: '50% 58%',
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
