/**
 * Public Hero accepts two media_url sources:
 * - legacy static files (/cdl/hero/*.webp)
 * - Supabase Storage public URLs (company-public-media)
 * Batch uploads must not depend on a hardcoded catalog filename.
 */

export function isLegacyStaticHeroSrc(src: string) {
  return src.startsWith('/')
}

export function isSupabasePublicStorageSrc(src: string) {
  try {
    const url = new URL(src)
    return (
      url.protocol === 'https:' &&
      url.hostname.endsWith('.supabase.co') &&
      url.pathname.startsWith('/storage/v1/object/public/')
    )
  } catch {
    return false
  }
}

export function isAllowedPublicHeroSrc(src: string | null | undefined) {
  const value = src?.trim() || ''
  if (!value) return false
  return isLegacyStaticHeroSrc(value) || isSupabasePublicStorageSrc(value)
}

export function publicHeroUrlKind(src: string | null | undefined) {
  const value = src?.trim() || ''
  if (isSupabasePublicStorageSrc(value)) return 'supabase-storage'
  if (isLegacyStaticHeroSrc(value)) return 'static'
  return 'unknown'
}
