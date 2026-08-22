/**
 * Maps media_assets rows to the admin/public model.
 * active is the publish switch. editor_meta holds technical editor config.
 * label/alt/title/subtitle columns are multilingual content only.
 */
import { MEDIA_PLACEMENTS, type MediaPlacement } from './constants'
import {
  defaultEditorMeta,
  emptyMediaCopy,
  hasStoredEditorMeta,
  persistableEditorMeta,
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

function contentText(value: unknown, fallback: string | null = null): string | null {
  if (typeof value === 'string') return value
  return fallback
}

export function mapMediaAssetRow(
  row: Record<string, unknown>,
  _schema: MediaSchema | boolean,
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
  const editorStored = hasStoredEditorMeta(row.editor_meta)
  const editor = editorStored ? persistableEditorMeta(row.editor_meta) : defaultEditorMeta()

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
    label_pt: contentText(row.label_pt),
    label_en: contentText(row.label_en),
    label_es: contentText(row.label_es),
    alt_pt: contentText(row.alt_pt, contentText(row.label_pt)),
    alt_en: contentText(row.alt_en, contentText(row.label_en)),
    alt_es: contentText(row.alt_es, contentText(row.label_es)),
    title_pt: contentText(row.title_pt),
    title_en: contentText(row.title_en),
    title_es: contentText(row.title_es),
    subtitle_pt: contentText(row.subtitle_pt),
    subtitle_en: contentText(row.subtitle_en),
    subtitle_es: contentText(row.subtitle_es),
    placement: decoded.placement,
    variant:
      typeof row.variant === 'string'
        ? (row.variant as PublicMediaAsset['variant'])
        : 'original',
    display_order: Number(row.display_order ?? 1),
    active: row.active !== false,
    created_at: typeof row.created_at === 'string' ? row.created_at : null,
    updated_at: typeof row.updated_at === 'string' ? row.updated_at : null,
    editor,
    editorStored,
  }
}

export const MEDIA_ASSET_SELECT_EXTENDED =
  'id, company_id, entity_type, entity_id, entity_key, media_type, media_url, storage_path, poster_url, label_pt, label_en, label_es, alt_pt, alt_en, alt_es, title_pt, title_en, title_es, subtitle_pt, subtitle_en, subtitle_es, placement, variant, display_order, active, created_at, updated_at'

export const MEDIA_ASSET_SELECT_COMPAT =
  'id, company_id, entity_type, entity_id, entity_key, media_type, media_url, storage_path, label_pt, label_en, label_es, display_order, active, created_at'

export function mediaAssetSelect(schema: MediaSchema | boolean) {
  const extended = typeof schema === 'boolean' ? schema : schema.extended
  const hasEditorMeta = typeof schema === 'boolean' ? false : schema.hasEditorMeta
  const base = extended ? MEDIA_ASSET_SELECT_EXTENDED : MEDIA_ASSET_SELECT_COMPAT
  return hasEditorMeta ? `${base}, editor_meta` : base
}

function editorFromInput(input: Record<string, unknown>) {
  const raw = input.editor ?? input.editorMeta
  return raw == null ? null : persistableEditorMeta(raw)
}

function copyFromInput(input: Record<string, unknown>) {
  return emptyMediaCopy({
    title_pt: typeof input.title_pt === 'string' ? input.title_pt : '',
    title_en: typeof input.title_en === 'string' ? input.title_en : '',
    title_es: typeof input.title_es === 'string' ? input.title_es : '',
    subtitle_pt: typeof input.subtitle_pt === 'string' ? input.subtitle_pt : '',
    subtitle_en: typeof input.subtitle_en === 'string' ? input.subtitle_en : '',
    subtitle_es: typeof input.subtitle_es === 'string' ? input.subtitle_es : '',
  })
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
  const editor = editorFromInput(input) ?? persistableEditorMeta()
  const copy = copyFromInput(input)
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
    label_pt: contentText(input.label_pt),
    label_en: contentText(input.label_en),
    label_es: contentText(input.label_es),
    display_order: Number(input.display_order ?? 1),
    active: typeof input.active === 'boolean' ? input.active : true,
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
    title_pt: copy.title_pt || null,
    title_en: copy.title_en || null,
    title_es: copy.title_es || null,
    subtitle_pt: copy.subtitle_pt || null,
    subtitle_en: copy.subtitle_en || null,
    subtitle_es: copy.subtitle_es || null,
    placement,
    variant: typeof input.variant === 'string' ? input.variant : 'original',
    created_by: input.created_by ?? null,
    updated_by: input.updated_by ?? null,
  }
}

export const MEDIA_IDENTITY_KEYS = [
  'id',
  'company_id',
  'entity_type',
  'entity_id',
  'entity_key',
] as const

export const MEDIA_EDIT_PATCH_ALLOWLIST = [
  'display_order',
  'active',
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
  'editor_meta',
] as const

export const MEDIA_REPLACE_PATCH_ALLOWLIST = [
  'media_url',
  'storage_path',
  'poster_url',
  'media_type',
] as const

export type MediaUpdateMode = 'edit' | 'replace'

/** Edit PATCH never writes identity or file paths. Replace is file-only. */
export function toUpdateRow(
  body: Record<string, unknown>,
  _current: PublicMediaAsset,
  schema: MediaSchema | boolean,
  actor?: string | null,
  mode: MediaUpdateMode = 'edit',
): Record<string, unknown> {
  const extended = typeof schema === 'boolean' ? schema : schema.extended
  const hasEditorMeta = typeof schema === 'boolean' ? false : schema.hasEditorMeta
  const editor = editorFromInput(body)
  const allow = new Set<string>(
    mode === 'replace' ? MEDIA_REPLACE_PATCH_ALLOWLIST : MEDIA_EDIT_PATCH_ALLOWLIST,
  )

  const patch: Record<string, unknown> = {}
  if (extended) {
    patch.updated_at = new Date().toISOString()
    patch.updated_by = actor ?? null
  }

  for (const key of allow) {
    if (key === 'editor_meta') continue
    if (body[key] !== undefined) patch[key] = body[key]
  }
  if (mode === 'edit' && editor && hasEditorMeta) {
    patch.editor_meta = editor
  }
  if (mode === 'edit' && body.display_order != null) {
    patch.display_order = Number(body.display_order)
  }

  for (const key of MEDIA_IDENTITY_KEYS) {
    delete patch[key]
  }
  for (const key of Object.keys(patch)) {
    if (key === 'updated_at' || key === 'updated_by') continue
    if (!allow.has(key)) delete patch[key]
  }
  return patch
}

export function toSoftDisableRow(schema: MediaSchema | boolean, actor?: string | null) {
  const extended = typeof schema === 'boolean' ? schema : schema.extended
  if (extended) {
    return {
      active: false,
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
