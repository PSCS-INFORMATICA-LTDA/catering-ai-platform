import type { MediaPlacement } from './constants'

export function rawEntityKey(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

export function rawPlacement(value: unknown): MediaPlacement | null {
  const placement = typeof value === 'string' ? value.trim() : ''
  if (placement === 'hero' || placement === 'how_it_works' || placement === 'video') {
    return placement
  }
  return null
}

/** Canonical placement, including pre-backfill rows with placement IS NULL. */
export function resolvePublicPlacement(input: {
  placement?: unknown
  entity_key?: unknown
}): MediaPlacement | null {
  const column = rawPlacement(input.placement)
  if (column) return column
  const key = rawEntityKey(input.entity_key)
  if (key.startsWith('hero:')) return 'hero'
  if (key.startsWith('how_it_works:')) return 'how_it_works'
  if (key.startsWith('video:')) return 'video'
  return null
}

export function matchesPublicPlacement(
  input: { placement?: unknown; entity_key?: unknown },
  placement: MediaPlacement,
) {
  return resolvePublicPlacement(input) === placement
}

export function isPublicHeroRow(input: { placement?: unknown; entity_key?: unknown }) {
  return matchesPublicPlacement(input, 'hero')
}
