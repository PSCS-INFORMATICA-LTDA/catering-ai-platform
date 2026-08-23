/**
 * Closing signature for the public confirmation screen.
 * Fire comes only from the approved CDL MP4. Landing never uses this video.
 * Do not recreate flames in CSS or place this file in Media Manager.
 */
export const PUBLIC_SUCCESS_CDL_LOGO_SRC = '/cdl/logo.png'
export const PUBLIC_SUCCESS_FIRE_LOGO_SRC = PUBLIC_SUCCESS_CDL_LOGO_SRC
export const PUBLIC_SUCCESS_CDL_FIRE_MP4_SRC = '/cdl/brand/cdl-logo-fire-spin.mp4'
export const PUBLIC_SUCCESS_CDL_FIRE_SOURCE_NAME =
  'CDL_LOGO_FOGO_SEM_BOOK_NOW_FINAL.mp4'
export const SUCCESS_VIDEO_HAS_NO_BOOK_NOW = true
export const LANDING_HAS_NO_PSCS_ONE = true
export const SUCCESS_HAS_PSCS_ONE = true

export function resolvePublicSuccessFireLogoSrc() {
  return PUBLIC_SUCCESS_CDL_LOGO_SRC
}

export function resolvePublicSuccessCdlFireVideoSrc() {
  return PUBLIC_SUCCESS_CDL_FIRE_MP4_SRC
}
