import {
  getCompanyPublicHeroMedia,
  type PublicHeroCaptionAlign,
  type PublicHeroMediaItem,
} from '@/Lib/publicQuote/companyPublicHeroMedia'
import { focusToCss } from './editorMeta'
import type { PublicMediaAsset } from './types'

function catalogHint(asset: PublicMediaAsset): PublicHeroMediaItem | undefined {
  const key = asset.entity_key || asset.id
  const catalogs = [
    getCompanyPublicHeroMedia('cdl'),
  ]
  for (const catalog of catalogs) {
    const match = catalog.find((item) => item.id === key || item.src === asset.media_url)
    if (match) return match
  }
  return undefined
}

function parseAlign(value: string | null | undefined): PublicHeroCaptionAlign | undefined {
  if (
    value === 'top-left' ||
    value === 'top-right' ||
    value === 'bottom-left' ||
    value === 'center' ||
    value === 'bottom-right'
  ) {
    return value
  }
  return undefined
}

export function mediaAssetToHeroItem(asset: PublicMediaAsset): PublicHeroMediaItem | null {
  const src = asset.media_url?.trim()
  if (!src) return null
  const hint = catalogHint(asset)
  const editor = asset.editor
  const mobilePosition = asset.editorStored
    ? `${focusToCss(editor.applied.mobile)}`
    : hint?.mobilePosition || '50% 50%'
  const desktopPosition = asset.editorStored
    ? `${focusToCss(editor.applied.desktop)}`
    : hint?.desktopPosition || mobilePosition
  const overlayCaption = editor.overlayEnabled
    ? {
        pt: asset.title_pt || asset.label_pt || '',
        en: asset.title_en || asset.label_en || '',
        es: asset.title_es || asset.label_es || '',
      }
    : undefined
  const hasOverlayCopy = Boolean(
    overlayCaption && (overlayCaption.pt || overlayCaption.en || overlayCaption.es),
  )
  const caption = editor.overlayDecided
    ? hasOverlayCopy
      ? overlayCaption
      : undefined
    : hasOverlayCopy
      ? overlayCaption
      : hint?.caption
  return {
    id: asset.entity_key || hint?.id || asset.id,
    src,
    originalSrc: hint?.originalSrc || src,
    sourceFilename: asset.storage_path || hint?.sourceFilename || src,
    alt: asset.alt_en || asset.alt_pt || hint?.alt || asset.label_en || asset.label_pt || 'Event photography',
    mobilePosition,
    desktopPosition,
    width: hint?.width || 1440,
    height: hint?.height || 1920,
    captionAlign: parseAlign(editor.overlayPosition) || hint?.captionAlign,
    caption,
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
