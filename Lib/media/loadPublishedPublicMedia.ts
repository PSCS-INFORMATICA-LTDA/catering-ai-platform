import 'server-only'

import { getSupabaseServerClient } from '@/Lib/supabaseServer'
import type { QuoteLanguage } from '@/Lib/quoteWizardTypes'
import {
  FALLBACK_HOW_IT_WORKS_POSTER_SRC,
  FALLBACK_HOW_IT_WORKS_VIDEO_SRC,
  type MediaPlacement,
} from './constants'
import { mediaAssetToHeroItem } from './mapPublicHero'
import { listCompanyPublicMedia } from './repository'
import type { PublicHowItWorksVideo, PublicMediaAsset } from './types'
import type { PublicHeroMediaItem } from '@/Lib/publicQuote/companyPublicHeroMedia'

export async function listPublishedPublicMedia(
  companyId: string,
  placement: MediaPlacement,
): Promise<PublicMediaAsset[]> {
  const supabase = getSupabaseServerClient()
  const { assets, error } = await listCompanyPublicMedia(
    supabase,
    companyId,
    placement,
    true,
  )
  if (error) {
    console.warn('[media] published query unavailable', {
      placement,
      message: error,
    })
    return []
  }
  return assets
}

export async function loadManagedPublicHero(
  companyId: string,
): Promise<PublicHeroMediaItem[]> {
  const rows = await listPublishedPublicMedia(companyId, 'hero')
  const originals = rows.filter(
    (row) => !row.variant || row.variant === 'original',
  )
  return originals
    .map(mediaAssetToHeroItem)
    .filter((item): item is PublicHeroMediaItem => Boolean(item))
}

export async function loadManagedHowItWorksVideo(
  companyId: string,
  locale: QuoteLanguage,
  defaultLocale: QuoteLanguage,
): Promise<PublicHowItWorksVideo | null> {
  const rows = await listPublishedPublicMedia(companyId, 'video')
  if (rows.length === 0) return null

  const match =
    rows.find((row) => row.entity_key === locale) ||
    rows.find((row) => row.entity_key === defaultLocale) ||
    rows[0]
  if (!match?.media_url) return null

  return {
    src: match.media_url,
    poster: match.poster_url,
    locale: (match.entity_key as QuoteLanguage) || locale,
  }
}

export function fallbackHowItWorksVideo(
  companySlug: string | null | undefined,
): PublicHowItWorksVideo | null {
  const slug = companySlug?.trim().toLowerCase()
  if (slug !== 'cdl') return null
  return {
    src: FALLBACK_HOW_IT_WORKS_VIDEO_SRC,
    poster: FALLBACK_HOW_IT_WORKS_POSTER_SRC,
    locale: 'pt',
  }
}
