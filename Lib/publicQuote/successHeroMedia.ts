/**
 * Closing signature for the public confirmation screen.
 * Official CDL fire MP4 is treated (mask + screen blend + sharp logo).
 * Landing never uses this video.
 */
export const PUBLIC_SUCCESS_CDL_LOGO_SRC = '/cdl/logo.png'
export const PUBLIC_SUCCESS_FIRE_LOGO_SRC = PUBLIC_SUCCESS_CDL_LOGO_SRC
/**
 * Same footage as the plate below, re-framed on a constant 610x610 canvas so the
 * ring keeps ~19% safe area through the whole cycle.
 * Rebuild with `npm run build:dev:cdl-fire-safe-asset`.
 */
export const PUBLIC_SUCCESS_CDL_FIRE_MP4_SRC =
  '/cdl/video/CDL_LOGO_FOGO_SEM_BOOK_NOW_SAFE_V6.mp4'
export const PUBLIC_SUCCESS_CDL_FIRE_SOURCE_MP4_SRC =
  '/cdl/video/CDL_LOGO_FOGO_SEM_BOOK_NOW_FINAL.mp4'
export const PUBLIC_SUCCESS_CDL_FIRE_SOURCE_NAME =
  'CDL_LOGO_FOGO_SEM_BOOK_NOW_FINAL.mp4'
/** Treated canvas is square, so the stage never letterboxes and never resizes. */
export const PUBLIC_SUCCESS_CDL_FIRE_CANVAS = 610

export const SUCCESS_DOES_NOT_USE_CDL_MP4 = false
export const SUCCESS_FIRE_USES_TREATED_OFFICIAL_MP4 = true
export const SUCCESS_HAS_CDL_FIRE_SIGNATURE = true
export const SUCCESS_FIRE_BACKGROUND_TRANSPARENT = true
export const SUCCESS_FIRE_REDUCED_MOTION_SAFE = true
export const SUCCESS_FIRE_NO_RED_BLOB = true
export const SUCCESS_VIDEO_HAS_NO_BOOK_NOW = true
export const SUCCESS_FIRE_FIXED_VIEWPORT = true
export const SUCCESS_FIRE_SAFE_AREA_TREATED = true
export const SUCCESS_LOGO_IS_FIRST_VISUAL = true
export const SUCCESS_HAS_NO_PAYMENT_BLOCK = true
export const LANDING_HAS_NO_FIRE_SIGNATURE = true
export const LANDING_HAS_STATIC_CDL_LOGO = true
export const LANDING_HAS_NO_PSCS_ONE = true
export const SUCCESS_HAS_PSCS_ONE = true

export function resolvePublicSuccessFireLogoSrc() {
  return PUBLIC_SUCCESS_CDL_LOGO_SRC
}

export function resolvePublicSuccessCdlFireVideoSrc() {
  return PUBLIC_SUCCESS_CDL_FIRE_MP4_SRC
}
