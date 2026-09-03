import { getCatalogItemImageUrl } from '../catalogItemVisual.ts'

/** Canonical grill rental extra. Image override is presentation-only. */
export const GRILL_RENTAL_ITEM_KEY = 'ITEM_084'
export const GRILL_RENTAL_ITEM_ID = '00c14d79-3365-4024-86bd-be58185fc74b'

/**
 * Official CDL operational grill, cropped from the real pool-station photo.
 * Presentation override for the extras card only.
 */
export const GRILL_RENTAL_DISPLAY_IMAGE_PATH =
  '/cdl/additionals/cdl-operational-grill.webp'

export const GRILL_RENTAL_IMAGE_OBJECT_POSITION = '42% 55%'

export function isGrillRentalAdditional(item: {
  id?: string | null
  item_key?: string | null
}): boolean {
  const key = item.item_key?.trim().toUpperCase()
  if (key === GRILL_RENTAL_ITEM_KEY) return true
  return item.id === GRILL_RENTAL_ITEM_ID
}

export function getPublicAdditionalDisplayImageUrl(item: {
  id?: string | null
  item_key?: string | null
  image_url?: string | null
  image_status?: string | null
}): string | null {
  if (isGrillRentalAdditional(item)) return GRILL_RENTAL_DISPLAY_IMAGE_PATH
  return getCatalogItemImageUrl(item)
}

export function getPublicAdditionalImageObjectPosition(item: {
  id?: string | null
  item_key?: string | null
}): string | undefined {
  if (isGrillRentalAdditional(item)) return GRILL_RENTAL_IMAGE_OBJECT_POSITION
  return undefined
}
