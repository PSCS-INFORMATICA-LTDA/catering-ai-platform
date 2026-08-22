import { encodePublicEntityKey } from './compat'
import {
  MEDIA_BATCH_LIMIT as BATCH_LIMIT,
  MEDIA_UPLOAD_CONCURRENCY as UPLOAD_CONCURRENCY,
  type MediaPlacement,
} from './constants'
import type { PublicMediaAsset } from './types'

export const MEDIA_BATCH_LIMIT = BATCH_LIMIT
export const MEDIA_UPLOAD_CONCURRENCY = UPLOAD_CONCURRENCY
export const MEDIA_REORDER_OFFSET = 100000

export function newPublicEntityKey(placement: MediaPlacement) {
  const stamp = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
  return encodePublicEntityKey(placement, `item-${stamp}`)
}

export function insertAtPosition<T>(existing: T[], incoming: T[], startAt: number): T[] {
  const raw = Number.isFinite(startAt) ? Math.floor(startAt) : existing.length + 1
  const index = Math.max(0, Math.min(existing.length, raw - 1))
  return [...existing.slice(0, index), ...incoming, ...existing.slice(index)]
}

export function normalizePlaylistOrder<T extends { id: string }>(
  items: T[],
): Array<T & { display_order: number }> {
  return items.map((item, index) => ({ ...item, display_order: index + 1 }))
}

export function composeReorderIds(currentIds: string[], requestedIds: string[]) {
  const current = new Set(currentIds)
  const requested = requestedIds.filter((id, index, list) => id && list.indexOf(id) === index)
  if (requested.some((id) => !current.has(id))) {
    return { ids: [] as string[], error: 'foreign_id' as const }
  }
  const missing = currentIds.filter((id) => !requested.includes(id))
  return { ids: [...requested, ...missing], error: null }
}

export function sortByCanonicalOrder<T extends { display_order: number; id: string }>(items: T[]) {
  return [...items].sort((left, right) => {
    const order = (left.display_order || 0) - (right.display_order || 0)
    return order !== 0 ? order : left.id.localeCompare(right.id)
  })
}

export function matchesPlacement(
  asset: Pick<PublicMediaAsset, 'placement' | 'entity_key'>,
  placement: MediaPlacement,
) {
  return asset.placement === placement
}

export function fileBaseName(value: string | null | undefined) {
  const raw = String(value || '').split('?')[0] || ''
  const part = raw.split('/').pop() || raw
  return part.toLowerCase().replace(/[^a-z0-9._-]+/g, '')
}

export function looksLikeExistingDuplicate(input: {
  fileName: string
  existing: Array<{ media_url?: string | null; storage_path?: string | null; label_pt?: string | null }>
}) {
  const base = fileBaseName(input.fileName).replace(/\.[a-z0-9]+$/, '')
  if (!base || base.length < 4) return false
  return input.existing.some((row) => {
    const hay = [
      fileBaseName(row.media_url).replace(/\.[a-z0-9]+$/, ''),
      fileBaseName(row.storage_path).replace(/\.[a-z0-9]+$/, ''),
      String(row.label_pt || '').toLowerCase(),
    ].join(' ')
    return hay.includes(base)
  })
}
