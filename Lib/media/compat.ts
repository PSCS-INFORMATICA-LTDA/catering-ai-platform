/**
 * Maps media_assets rows to the admin/public model.
 * Editor focus/overlay lives in editor_meta jsonb.
 * label_pt / label_en / label_es are multilingual content only.
 */
import {
  MEDIA_PLACEMENTS,
  type MediaPlacement,
  type MediaStatus,
} from './constants'
import {
  defaultEditorMeta,
  isEditorMeta,
  isOverlayPosition,
  parseCssFocus,
  type MediaEditorMeta,
} from './editorMeta'
import type { MediaSchema } from './schema'
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

function contentLabel(
  explicit: unknown,
  fallback: string | null | undefined = null,
) {
  if (typeof explicit !== 'string') return fallback ?? null
  if (explicit.startsWith('__m1|')) return fallback ?? null
  return explicit
}

function editorFromRow(row: Record<string, unknown>, extended: boolean): MediaEditorMeta {
  if (isEditorMeta(row.editor_meta)) {
    return defaultEditorMeta(row.editor_meta)
  }
  if (
    extended &&
    (row.focal_x != null ||
      row.overlay_enabled === true ||
      typeof row.title_pt === 'string')
  ) {
    const focal = parseCssFocus(
      `${Number(row.focal_x ?? 0.5) * 100}% ${Number(row.focal_y ?? 0.5) * 100}%`,
    )
    return defaultEditorMeta({
      overlayEnabled: row.overlay_enabled === true,
      overlayPosition: isOverlayPosition(
        typeof row.overlay_position === 'string' ? row.overlay_position : null,
      )
        ? (row.overlay_position as MediaEditorMeta['overlayPosition'])
        : 'top-left',
      title_pt: typeof row.title_pt === 'string' ? row.title_pt : '',
      title_en: typeof row.title_en === 'string' ? row.title_en : '',
      title_es: typeof row.title_es === 'string' ? row.title_es : '',
      subtitle_pt: typeof row.subtitle_pt === 'string' ? row.subtitle_pt : '',
      subtitle_en: typeof row.subtitle_en === 'string' ? row.subtitle_en : '',
      subtitle_es: typeof row.subtitle_es === 'string' ? row.subtitle_es : '',
      suggested: { mobile: focal, tablet: focal, desktop: focal },
      applied: { mobile: focal, tablet: focal, desktop: focal },
    })
  }
  return defaultEditorMeta()
}

export function mapMediaAssetRow(
  row: Record<string, unknown>,
  schema: MediaSchema | boolean,
): PublicMediaAsset {
  const extended = typeof schema === 'boolean' ? schema : schema.extended
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
  const editor = editorFromRow(row, extended)

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
    label_pt: contentLabel(row.label_pt),
    label_en: contentLabel(row.label_en),
    label_es: contentLabel(row.label_es),
    alt_pt: contentLabel(row.alt_pt, contentLabel(row.label_pt)),
    alt_en: contentLabel(row.alt_en, contentLabel(row.label_en)),
    alt_es: contentLabel(row.alt_es, contentLabel(row.label_es)),
    title_pt: editor.title_pt || null,
    title_en: editor.title_en || null,
    title_es: editor.title_es || null,
    subtitle_pt: typeof row.subtitle_pt === 'string' ? row.subtitle_pt : null,
    subtitle_en: typeof row.subtitle_en === 'string' ? row.subtitle_en : null,
    subtitle_es: typeof row.subtitle_es === 'string' ? row.subtitle_es : null,
    overlay_enabled: editor.overlayEnabled,
    overlay_position: editor.overlayPosition,
    placement: decoded.placement,
    variant:
      typeof row.variant === 'string'
        ? (row.variant as PublicMediaAsset['variant'])
        : 'original',
    focal_x: isEditorMeta(row.editor_meta)
      ? editor.applied.mobile.x
      : row.focal_x == null
        ? null
        : Number(row.focal_x),
    focal_y: isEditorMeta(row.editor_meta)
      ? editor.applied.mobile.y
      : row.focal_y == null
        ? null
        : Number(row.focal_y),
    display_order: Number(row.display_order ?? 1),
    active,
    status,
    created_at: typeof row.created_at === 'string' ? row.created_at : null,
    updated_at: typeof row.updated_at === 'string' ? row.updated_at : null,
    editor,
  }
}

export const MEDIA_ASSET_SELECT_EXTENDED =
  'id, company_id, entity_type, entity_id, entity_key, media_type, media_url, storage_path, poster_url, label_pt, label_en, label_es, alt_pt, alt_en, alt_es, title_pt, title_en, title_es, subtitle_pt, subtitle_en, subtitle_es, overlay_enabled, overlay_position, placement, variant, focal_x, focal_y, display_order, active, status, created_at, updated_at'

export const MEDIA_ASSET_SELECT_COMPAT =
  'id, company_id, entity_type, entity_id, entity_key, media_type, media_url, storage_path, label_pt, label_en, label_es, display_order, active, created_at'

export function mediaAssetSelect(schema: MediaSchema | boolean) {
  const extended = typeof schema === 'boolean' ? schema : schema.extended
  const hasEditorMeta = typeof schema === 'boolean' ? false : schema.hasEditorMeta
  const base = extended ? MEDIA_ASSET_SELECT_EXTENDED : MEDIA_ASSET_SELECT_COMPAT
  return hasEditorMeta ? `${base}, editor_meta` : base
}

function editorFromInput(input: Record<string, unknown>): MediaEditorMeta | null {
  const raw = input.editor ?? input.editorMeta
  return isEditorMeta(raw) ? defaultEditorMeta(raw) : null
}

export function toInsertRow(
  input: Record<string, unknown>,
  schema: MediaSchema | boolean,
): Record<string, unknown> {
  const extended = typeof schema === 'boolean' ? schema : schema.extended
  const hasEditorMeta = typeof schema === 'boolean' ? false : schema.hasEditorMeta
  const placement = String(input.placement || '') as MediaPlacement
  const key =
    typeof input.entity_key === 'string' ? input.entity_key : `item-${Date.now()}`
  const status =
    typeof input.status === 'string' ? input.status : extended ? 'draft' : 'active'
  const editor =
    editorFromInput(input) ??
    defaultEditorMeta({ overlayEnabled: input.overlay_enabled === true })
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
    label_pt: contentLabel(input.label_pt),
    label_en: contentLabel(input.label_en),
    label_es: contentLabel(input.label_es),
    display_order: Number(input.display_order ?? 1),
    active: typeof input.active === 'boolean' ? input.active : status !== 'inactive',
  }
  if (hasEditorMeta) {
    row.editor_meta = editor
  }
  if (!extended) return row
  return {
    ...row,
    poster_url: typeof input.poster_url === 'string' ? input.poster_url : null,
    alt_pt: typeof input.alt_pt === 'string' ? input.alt_pt : null,
    alt_en: typeof input.alt_en === 'string' ? input.alt_en : null,
    alt_es: typeof input.alt_es === 'string' ? input.alt_es : null,
    title_pt: editor?.title_pt ?? (typeof input.title_pt === 'string' ? input.title_pt : null),
    title_en: editor?.title_en ?? (typeof input.title_en === 'string' ? input.title_en : null),
    title_es: editor?.title_es ?? (typeof input.title_es === 'string' ? input.title_es : null),
    subtitle_pt: editor?.subtitle_pt ?? (typeof input.subtitle_pt === 'string' ? input.subtitle_pt : null),
    subtitle_en: editor?.subtitle_en ?? (typeof input.subtitle_en === 'string' ? input.subtitle_en : null),
    subtitle_es: editor?.subtitle_es ?? (typeof input.subtitle_es === 'string' ? input.subtitle_es : null),
    overlay_enabled: editor ? editor.overlayEnabled : input.overlay_enabled === true,
    overlay_position: editor?.overlayPosition
      ?? (typeof input.overlay_position === 'string' ? input.overlay_position : null),
    placement,
    variant: typeof input.variant === 'string' ? input.variant : 'original',
    focal_x: editor ? editor.applied.mobile.x : input.focal_x == null ? null : Number(input.focal_x),
    focal_y: editor ? editor.applied.mobile.y : input.focal_y == null ? null : Number(input.focal_y),
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
  'editor_meta',
])

export function toUpdateRow(
  body: Record<string, unknown>,
  current: PublicMediaAsset,
  schema: MediaSchema | boolean,
  actor?: string | null,
): Record<string, unknown> {
  const extended = typeof schema === 'boolean' ? schema : schema.extended
  const hasEditorMeta = typeof schema === 'boolean' ? false : schema.hasEditorMeta
  const editor = editorFromInput(body)

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
    if (editor) {
      if (hasEditorMeta) patch.editor_meta = editor
      patch.overlay_enabled = editor.overlayEnabled
      patch.overlay_position = editor.overlayPosition
      patch.title_pt = editor.title_pt
      patch.title_en = editor.title_en
      patch.title_es = editor.title_es
      patch.subtitle_pt = editor.subtitle_pt
      patch.subtitle_en = editor.subtitle_en
      patch.subtitle_es = editor.subtitle_es
      patch.focal_x = editor.applied.mobile.x
      patch.focal_y = editor.applied.mobile.y
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
  if (typeof body.label_pt === 'string') patch.label_pt = body.label_pt
  if (typeof body.label_en === 'string') patch.label_en = body.label_en
  if (typeof body.label_es === 'string') patch.label_es = body.label_es
  if (body.display_order != null) patch.display_order = Number(body.display_order)
  if (typeof body.status === 'string') {
    patch.active = body.status !== 'inactive'
  } else if (typeof body.active === 'boolean') {
    patch.active = body.active
  }
  if (editor && hasEditorMeta) {
    patch.editor_meta = editor
  }
  for (const key of Object.keys(patch)) {
    if (!COMPAT_UPDATABLE.has(key)) delete patch[key]
  }
  return patch
}

export function toSoftDisableRow(schema: MediaSchema | boolean, actor?: string | null) {
  const extended = typeof schema === 'boolean' ? schema : schema.extended
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
  schema: MediaSchema | boolean,
  actor?: string | null,
) {
  const extended = typeof schema === 'boolean' ? schema : schema.extended
  if (extended) {
    return {
      display_order: displayOrder,
      updated_at: new Date().toISOString(),
      updated_by: actor ?? null,
    }
  }
  return { display_order: displayOrder }
}
