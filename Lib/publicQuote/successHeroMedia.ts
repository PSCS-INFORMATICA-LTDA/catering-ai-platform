/**
 * Closing signature for the public confirmation screen.
 * Fire is web-native (`CdlFireSignature`). The historical CDL MP4 may stay
 * in the repo for archive, but must not feed Success or Landing.
 */
export const PUBLIC_SUCCESS_CDL_LOGO_SRC = '/cdl/logo.png'
export const PUBLIC_SUCCESS_FIRE_LOGO_SRC = PUBLIC_SUCCESS_CDL_LOGO_SRC

/** Historical archive only. Do not render on Success. */
export const PUBLIC_SUCCESS_CDL_FIRE_MP4_SRC =
  '/cdl/video/CDL_LOGO_FOGO_SEM_BOOK_NOW_FINAL.mp4'
export const PUBLIC_SUCCESS_CDL_FIRE_SOURCE_NAME =
  'CDL_LOGO_FOGO_SEM_BOOK_NOW_FINAL.mp4'

export const SUCCESS_DOES_NOT_USE_CDL_MP4 = true
export const SUCCESS_HAS_CDL_FIRE_SIGNATURE = true
export const SUCCESS_FIRE_BACKGROUND_TRANSPARENT = true
export const SUCCESS_FIRE_REDUCED_MOTION_SAFE = true
export const LANDING_HAS_NO_FIRE_SIGNATURE = true
export const LANDING_HAS_STATIC_CDL_LOGO = true
export const LANDING_HAS_NO_PSCS_ONE = true
export const SUCCESS_HAS_PSCS_ONE = true
export const SUCCESS_VIDEO_HAS_NO_BOOK_NOW = true

export function resolvePublicSuccessFireLogoSrc() {
  return PUBLIC_SUCCESS_CDL_LOGO_SRC
}
