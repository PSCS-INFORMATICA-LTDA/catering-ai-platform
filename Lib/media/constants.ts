export const COMPANY_PUBLIC_MEDIA_BUCKET = 'company-public-media'
export const PUBLIC_MEDIA_ENTITY_TYPE = 'public_landing'

export const MEDIA_PLACEMENTS = ['hero', 'how_it_works', 'video'] as const
export type MediaPlacement = (typeof MEDIA_PLACEMENTS)[number]

export const MEDIA_VARIANTS = ['original', 'mobile', 'tablet', 'desktop'] as const
export type MediaVariant = (typeof MEDIA_VARIANTS)[number]

export const MEDIA_STATUSES = ['draft', 'active', 'inactive'] as const
export type MediaStatus = (typeof MEDIA_STATUSES)[number]

export const MEDIA_LOCALES = ['pt', 'en', 'es'] as const
export type MediaLocale = (typeof MEDIA_LOCALES)[number]

export const MAX_PUBLIC_IMAGE_BYTES = 8 * 1024 * 1024
export const MAX_PUBLIC_VIDEO_BYTES = 40 * 1024 * 1024

export const ALLOWED_PUBLIC_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
])

export const ALLOWED_PUBLIC_VIDEO_TYPES = new Set([
  'video/mp4',
  'video/webm',
])

export const FALLBACK_HOW_IT_WORKS_VIDEO_SRC = '/cdl/video/cdl-como-funciona.mp4'
export const FALLBACK_HOW_IT_WORKS_POSTER_SRC =
  '/cdl/video/cdl-como-funciona-poster.webp'
