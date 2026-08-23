/**
 * Closing hero for the public confirmation screen.
 * Prefer a short muted fire clip when present; otherwise a still of the
 * CDL grill in flames. Do not reuse the how-it-works explainer video.
 */
export const PUBLIC_SUCCESS_FIRE_VIDEO_SRC: string | null = null
export const PUBLIC_SUCCESS_FIRE_VIDEO_CANDIDATE = '/cdl/video/cdl-fire-hero.mp4'
export const PUBLIC_SUCCESS_FIRE_POSTER_SRC = '/cdl/hero/cdl-grill-flames-steaks.webp'
export const PUBLIC_SUCCESS_FIRE_FALLBACK_SRC = '/cdl/hero/cdl-grill-corn-flames.webp'

export function resolvePublicSuccessFireVideoSrc() {
  return PUBLIC_SUCCESS_FIRE_VIDEO_SRC
}
