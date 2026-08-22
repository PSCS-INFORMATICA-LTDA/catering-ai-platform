import 'server-only'

import { getSupabaseServerClient } from '@/Lib/supabaseServer'
import type { QuoteLanguage } from '@/Lib/quoteWizardTypes'
import {
  FALLBACK_HOW_IT_WORKS_POSTER_SRC,
  FALLBACK_HOW_IT_WORKS_VIDEO_SRC,
  PUBLIC_MEDIA_ENTITY_TYPE,
  type MediaPlacement,
} from './constants'
import { mediaAssetToHeroItem } from './mapPublicHero'
import type { PublicHowItWorksVideo, PublicMediaAsset } from './types'
import type { PublicHeroMediaItem } from '@/Lib/publicQuote/companyPublicHeroMedia'

function asAsset(row: Record<string, unknown>): PublicMediaAsset {
  return {
    id: String(row.id),
    company_id: String(row.company_id),
    entity_type: String(row.entity_type ?? ''),
    entity_id: typeof row.entity_id === 'string' ? row.entity_id : null,
    entity_key: typeof row.entity_key === 'string' ? row.entity_key : null,
    media_type: typeof row.media_type === 'string' ? row.media_type : 'image',
    media_url: typeof row.media_url === 'string' ? row.media_url : null,
    storage_path: typeof row.storage_path === 'string' ? row.storage_path : null,
    poster_url: typeof row.poster_url === 'string' ? row.poster_url : null,
    label_pt: typeof row.label_pt === 'string' ? row.label_pt : null,
    label_en: typeof row.label_en === 'string' ? row.label_en : null,
    label_es: typeof row.label_es === 'string' ? row.label_es : null,
    alt_pt: typeof row.alt_pt === 'string' ? row.alt_pt : null,
    alt_en: typeof row.alt_en === 'string' ? row.alt_en : null,
    alt_es: typeof row.alt_es === 'string' ? row.alt_es : null,
    title_pt: typeof row.title_pt === 'string' ? row.title_pt : null,
    title_en: typeof row.title_en === 'string' ? row.title_en : null,
    title_es: typeof row.title_es === 'string' ? row.title_es : null,
    subtitle_pt: typeof row.subtitle_pt === 'string' ? row.subtitle_pt : null,
    subtitle_en: typeof row.subtitle_en === 'string' ? row.subtitle_en : null,
    subtitle_es: typeof row.subtitle_es === 'string' ? row.subtitle_es : null,
    overlay_enabled: row.overlay_enabled === true,
    overlay_position:
      typeof row.overlay_position === 'string' ? row.overlay_position : null,
    placement: (row.placement as PublicMediaAsset['placement']) ?? null,
    variant: (row.variant as PublicMediaAsset['variant']) ?? 'original',
    focal_x: row.focal_x == null ? null : Number(row.focal_x),
    focal_y: row.focal_y == null ? null : Number(row.focal_y),
    display_order: Number(row.display_order ?? 1),
    active: row.active !== false,
    status: (typeof row.status === 'string' ? row.status : 'active') as PublicMediaAsset['status'],
    created_at: typeof row.created_at === 'string' ? row.created_at : null,
    updated_at: typeof row.updated_at === 'string' ? row.updated_at : null,
  }
}

export async function listPublishedPublicMedia(
  companyId: string,
  placement: MediaPlacement,
): Promise<PublicMediaAsset[]> {
  const supabase = getSupabaseServerClient()
  const { data, error } = await supabase
    .from('media_assets')
    .select(
      'id, company_id, entity_type, entity_id, entity_key, media_type, media_url, storage_path, poster_url, label_pt, label_en, label_es, alt_pt, alt_en, alt_es, title_pt, title_en, title_es, subtitle_pt, subtitle_en, subtitle_es, overlay_enabled, overlay_position, placement, variant, focal_x, focal_y, display_order, active, status, created_at, updated_at',
    )
    .eq('company_id', companyId)
    .eq('entity_type', PUBLIC_MEDIA_ENTITY_TYPE)
    .eq('placement', placement)
    .eq('status', 'active')
    .eq('active', true)
    .order('display_order', { ascending: true })

  if (error) {
    console.warn('[media] published query unavailable', {
      placement,
      message: error.message,
    })
    return []
  }

  return (data ?? []).map((row) => asAsset(row as Record<string, unknown>))
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
