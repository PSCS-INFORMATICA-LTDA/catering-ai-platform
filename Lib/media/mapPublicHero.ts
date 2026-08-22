import type { PublicHeroCaptionAlign, PublicHeroMediaItem } from '@/Lib/publicQuote/companyPublicHeroMedia'
import type { PublicMediaAsset } from './types'

function focalToCss(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return '50%'
  return `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%`
}

function parseAlign(value: string | null | undefined): PublicHeroCaptionAlign | undefined {
  if (
    value === 'top-left' ||
    value === 'top-right' ||
    value === 'bottom-left'
  ) {
    return value
  }
  return undefined
}

export function mediaAssetToHeroItem(asset: PublicMediaAsset): PublicHeroMediaItem | null {
  const src = asset.media_url?.trim()
  if (!src) return null
  const mobilePosition = `${focalToCss(asset.focal_x)} ${focalToCss(asset.focal_y)}`
  const caption = asset.overlay_enabled
    ? {
        pt: asset.title_pt || asset.label_pt || '',
        en: asset.title_en || asset.label_en || '',
        es: asset.title_es || asset.label_es || '',
      }
    : undefined
  return {
    id: asset.entity_key || asset.id,
    src,
    originalSrc: src,
    sourceFilename: asset.storage_path || src,
    alt: asset.alt_en || asset.alt_pt || asset.label_en || asset.label_pt || 'Event photography',
    mobilePosition,
    desktopPosition: mobilePosition,
    width: 1440,
    height: 1920,
    captionAlign: parseAlign(asset.overlay_position),
    caption:
      caption && (caption.pt || caption.en || caption.es) ? caption : undefined,
  }
}

/** Variant fallback: mobile → tablet → original; tablet → desktop → original; desktop → original. */
export function pickVariantRow(
  rows: PublicMediaAsset[],
  prefer: 'mobile' | 'tablet' | 'desktop',
): PublicMediaAsset | null {
  const byKey = new Map<string, PublicMediaAsset[]>()
  for (const row of rows) {
    const key = row.entity_key || row.id
    const list = byKey.get(key) ?? []
    list.push(row)
    byKey.set(key, list)
  }
  const firstKey = rows[0] ? rows[0].entity_key || rows[0].id : null
  if (!firstKey) return null
  const group = byKey.get(firstKey) ?? []
  const order =
    prefer === 'mobile'
      ? ['mobile', 'tablet', 'original']
      : prefer === 'tablet'
        ? ['tablet', 'desktop', 'original']
        : ['desktop', 'original']
  for (const variant of order) {
    const match = group.find((row) => (row.variant || 'original') === variant)
    if (match) return match
  }
  return group[0] ?? null
}
