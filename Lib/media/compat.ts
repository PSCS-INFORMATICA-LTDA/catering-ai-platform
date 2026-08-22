import {
  MEDIA_PLACEMENTS,
  type MediaPlacement,
  type MediaStatus,
} from './constants'
import type { PublicMediaAsset } from './types'

const PLACEMENT_PREFIX = /^(hero|how_it_works|video):/

export function encodePublicEntityKey(
  placement: MediaPlacement,
  key: string | null | undefined,
): string {
  const clean = (key || '').trim()
  if (clean.startsWith(`${placement}:`)) return clean
  return clean ? `${placement}:${clean}` : `${placement}:item`
}

export function decodePublicEntityKey(
  entityKey: string | null | undefined,
  placementColumn?: string | null,
): { placement: MediaPlacement | null; key: string | null } {
  if (
    placementColumn &&
    MEDIA_PLACEMENTS.includes(placementColumn as MediaPlacement)
  ) {
    return {
      placement: placementColumn as MediaPlacement,
      key: entityKey?.trim() || null,
    }
  }
  const raw = entityKey?.trim() || ''
  const match = raw.match(PLACEMENT_PREFIX)
  if (!match) return { placement: null, key: raw || null }
  const placement = match[1] as MediaPlacement
  const key = raw.slice(match[0].length).trim()
  return { placement, key: key || null }
}

function isImagePath(value: string | null | undefined) {
  if (!value) return false
  return /\.(webp|jpe?g|png)(\?|$)/i.test(value)
}

export function mapMediaAssetRow(
  row: Record<string, unknown>,
  extended: boolean,
): PublicMediaAsset {
  const decoded = decodePublicEntityKey(
    typeof row.entity_key === 'string' ? row.entity_key : null,
    typeof row.placement === 'string' ? row.placement : null,
  )
  const mediaType = typeof row.media_type === 'string' ? row.media_type : 'image'
  const storagePath =
    typeof row.storage_path === 'string' ? row.storage_path : null
  const posterFromColumn =
    typeof row.poster_url === 'string' ? row.poster_url : null
  const poster =
    posterFromColumn ||
    (mediaType === 'video' && isImagePath(storagePath) ? storagePath : null)
  const active = row.active !== false
  const status = (
    typeof row.status === 'string' ? row.status : active ? 'active' : 'inactive'
  ) as MediaStatus

  return {
    id: String(row.id),
    company_id: String(row.company_id),
    entity_type: String(row.entity_type ?? ''),
    entity_id: typeof row.entity_id === 'string' ? row.entity_id : null,
    entity_key: decoded.key,
    media_type: mediaType,
    media_url: typeof row.media_url === 'string' ? row.media_url : null,
    storage_path: storagePath,
    poster_url: poster,
    label_pt: typeof row.label_pt === 'string' ? row.label_pt : null,
    label_en: typeof row.label_en === 'string' ? row.label_en : null,
    label_es: typeof row.label_es === 'string' ? row.label_es : null,
    alt_pt:
      typeof row.alt_pt === 'string'
        ? row.alt_pt
        : typeof row.label_pt === 'string'
          ? row.label_pt
          : null,
    alt_en:
      typeof row.alt_en === 'string'
        ? row.alt_en
        : typeof row.label_en === 'string'
          ? row.label_en
          : null,
    alt_es:
      typeof row.alt_es === 'string'
        ? row.alt_es
        : typeof row.label_es === 'string'
          ? row.label_es
          : null,
    title_pt:
      typeof row.title_pt === 'string'
        ? row.title_pt
        : typeof row.label_pt === 'string'
          ? row.label_pt
          : null,
    title_en:
      typeof row.title_en === 'string'
        ? row.title_en
        : typeof row.label_en === 'string'
          ? row.label_en
          : null,
    title_es:
      typeof row.title_es === 'string'
        ? row.title_es
        : typeof row.label_es === 'string'
          ? row.label_es
          : null,
    subtitle_pt: typeof row.subtitle_pt === 'string' ? row.subtitle_pt : null,
    subtitle_en: typeof row.subtitle_en === 'string' ? row.subtitle_en : null,
    subtitle_es: typeof row.subtitle_es === 'string' ? row.subtitle_es : null,
    overlay_enabled: row.overlay_enabled === true,
    overlay_position:
      typeof row.overlay_position === 'string' ? row.overlay_position : null,
    placement: decoded.placement,
    variant:
      typeof row.variant === 'string'
        ? (row.variant as PublicMediaAsset['variant'])
        : 'original',
    focal_x: row.focal_x == null ? null : Number(row.focal_x),
    focal_y: row.focal_y == null ? null : Number(row.focal_y),
    display_order: Number(row.display_order ?? 1),
    active,
    status,
    created_at: typeof row.created_at === 'string' ? row.created_at : null,
    updated_at: typeof row.updated_at === 'string' ? row.updated_at : null,
  }
}

export const MEDIA_ASSET_SELECT_EXTENDED =
  'id, company_id, entity_type, entity_id, entity_key, media_type, media_url, storage_path, poster_url, label_pt, label_en, label_es, alt_pt, alt_en, alt_es, title_pt, title_en, title_es, subtitle_pt, subtitle_en, subtitle_es, overlay_enabled, overlay_position, placement, variant, focal_x, focal_y, display_order, active, status, created_at, updated_at'

export const MEDIA_ASSET_SELECT_COMPAT =
  'id, company_id, entity_type, entity_id, entity_key, media_type, media_url, storage_path, label_pt, label_en, label_es, display_order, active, created_at'

export function mediaAssetSelect(extended: boolean) {
  return extended ? MEDIA_ASSET_SELECT_EXTENDED : MEDIA_ASSET_SELECT_COMPAT
}

export function toInsertRow(
  input: Record<string, unknown>,
  extended: boolean,
): Record<string, unknown> {
  const placement = String(input.placement || '') as MediaPlacement
  const key =
    typeof input.entity_key === 'string' ? input.entity_key : `item-${Date.now()}`
  const status =
    typeof input.status === 'string' ? input.status : extended ? 'draft' : 'active'
  const row: Record<string, unknown> = {
    company_id: input.company_id,
    entity_type: input.entity_type,
    entity_key: extended ? key : encodePublicEntityKey(placement, key),
    media_type: typeof input.media_type === 'string' ? input.media_type : 'image',
    media_url: typeof input.media_url === 'string' ? input.media_url : null,
    storage_path:
      typeof input.storage_path === 'string'
        ? input.storage_path
        : typeof input.poster_url === 'string'
          ? input.poster_url
          : null,
    label_pt:
      typeof input.label_pt === 'string'
        ? input.label_pt
        : typeof input.title_pt === 'string'
          ? input.title_pt
          : null,
    label_en:
      typeof input.label_en === 'string'
        ? input.label_en
        : typeof input.title_en === 'string'
          ? input.title_en
          : null,
    label_es:
      typeof input.label_es === 'string'
        ? input.label_es
        : typeof input.title_es === 'string'
          ? input.title_es
          : null,
    display_order: Number(input.display_order ?? 1),
    active: status !== 'inactive',
  }
  if (!extended) return row
  return {
    ...row,
    poster_url: typeof input.poster_url === 'string' ? input.poster_url : null,
    alt_pt: typeof input.alt_pt === 'string' ? input.alt_pt : null,
    alt_en: typeof input.alt_en === 'string' ? input.alt_en : null,
    alt_es: typeof input.alt_es === 'string' ? input.alt_es : null,
    title_pt: typeof input.title_pt === 'string' ? input.title_pt : null,
    title_en: typeof input.title_en === 'string' ? input.title_en : null,
    title_es: typeof input.title_es === 'string' ? input.title_es : null,
    subtitle_pt: typeof input.subtitle_pt === 'string' ? input.subtitle_pt : null,
    subtitle_en: typeof input.subtitle_en === 'string' ? input.subtitle_en : null,
    subtitle_es: typeof input.subtitle_es === 'string' ? input.subtitle_es : null,
    overlay_enabled: input.overlay_enabled === true,
    overlay_position:
      typeof input.overlay_position === 'string' ? input.overlay_position : null,
    placement,
    variant: typeof input.variant === 'string' ? input.variant : 'original',
    focal_x: input.focal_x == null ? null : Number(input.focal_x),
    focal_y: input.focal_y == null ? null : Number(input.focal_y),
    status,
    created_by: input.created_by ?? null,
    updated_by: input.updated_by ?? null,
  }
}

const COMPAT_UPDATABLE = new Set([
  'entity_key',
  'media_type',
  'media_url',
  'storage_path',
  'label_pt',
  'label_en',
  'label_es',
  'display_order',
  'active',
])

export function toUpdateRow(
  body: Record<string, unknown>,
  current: PublicMediaAsset,
  extended: boolean,
  actor?: string | null,
): Record<string, unknown> {
  if (extended) {
    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      updated_by: actor ?? null,
    }
    const keys = [
      'entity_key',
      'media_type',
      'media_url',
      'poster_url',
      'label_pt',
      'label_en',
      'label_es',
      'alt_pt',
      'alt_en',
      'alt_es',
      'title_pt',
      'title_en',
      'title_es',
      'subtitle_pt',
      'subtitle_en',
      'subtitle_es',
      'overlay_enabled',
      'overlay_position',
      'variant',
      'focal_x',
      'focal_y',
      'display_order',
      'status',
      'storage_path',
    ] as const
    for (const key of keys) {
      if (body[key] !== undefined) patch[key] = body[key]
    }
    if (typeof patch.status === 'string') {
      patch.active = patch.status !== 'inactive'
    }
    return patch
  }

  const patch: Record<string, unknown> = {}
  if (typeof body.entity_key === 'string' && current.placement) {
    patch.entity_key = encodePublicEntityKey(current.placement, body.entity_key)
  }
  if (typeof body.media_type === 'string') patch.media_type = body.media_type
  if (typeof body.media_url === 'string') patch.media_url = body.media_url
  if (typeof body.storage_path === 'string') patch.storage_path = body.storage_path
  if (typeof body.poster_url === 'string') patch.storage_path = body.poster_url
  if (typeof body.label_pt === 'string' || typeof body.title_pt === 'string') {
    patch.label_pt = (body.label_pt ?? body.title_pt) as string
  }
  if (typeof body.label_en === 'string' || typeof body.title_en === 'string') {
    patch.label_en = (body.label_en ?? body.title_en) as string
  }
  if (typeof body.label_es === 'string' || typeof body.title_es === 'string') {
    patch.label_es = (body.label_es ?? body.title_es) as string
  }
  if (body.display_order != null) patch.display_order = Number(body.display_order)
  if (typeof body.status === 'string') {
    patch.active = body.status !== 'inactive'
  } else if (typeof body.active === 'boolean') {
    patch.active = body.active
  }
  for (const key of Object.keys(patch)) {
    if (!COMPAT_UPDATABLE.has(key)) delete patch[key]
  }
  return patch
}

export function toSoftDisableRow(extended: boolean, actor?: string | null) {
  if (extended) {
    return {
      active: false,
      status: 'inactive',
      updated_at: new Date().toISOString(),
      updated_by: actor ?? null,
    }
  }
  return { active: false }
}

export function toReorderRow(
  displayOrder: number,
  extended: boolean,
  actor?: string | null,
) {
  if (extended) {
    return {
      display_order: displayOrder,
      updated_at: new Date().toISOString(),
      updated_by: actor ?? null,
    }
  }
  return { display_order: displayOrder }
}
