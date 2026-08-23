import type { MediaLocale } from '@/Lib/media/constants'
import type { PublicHowItWorksVideo } from '@/Lib/media/types'

export function videoLocaleFromEntityKey(
  key: string | null | undefined,
): MediaLocale | null {
  const raw = String(key || '')
    .trim()
    .toLowerCase()
  if (raw === 'pt' || raw === 'en' || raw === 'es') return raw
  if (raw === 'video:pt' || raw === 'video:en' || raw === 'video:es') {
    return raw.slice('video:'.length) as MediaLocale
  }
  return null
}

export function pickHowItWorksVideo(
  videos: readonly PublicHowItWorksVideo[],
  locale: MediaLocale,
  fallback: MediaLocale = 'pt',
): PublicHowItWorksVideo | null {
  return (
    videos.find((video) => video.locale === locale) ||
    videos.find((video) => video.locale === fallback) ||
    videos[0] ||
    null
  )
}

export function availableHowItWorksLocales(
  videos: readonly PublicHowItWorksVideo[],
): MediaLocale[] {
  const seen = new Set<MediaLocale>()
  for (const video of videos) {
    if (video.src) seen.add(video.locale)
  }
  return (['pt', 'en', 'es'] as const).filter((locale) => seen.has(locale))
}
