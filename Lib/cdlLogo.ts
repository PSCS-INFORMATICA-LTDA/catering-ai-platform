export const CDL_LOGO_PATH = '/cdl/logo.png'

/** Official circular emblem with transparent corners — Review cover only. */
export const CDL_REVIEW_LOGO_PATH = '/cdl/logo-review-circle.png'

/** @deprecated Use CDL_LOGO_PATH */
export const CDL_LOGO_SRC = CDL_LOGO_PATH

export const CDL_LOGO_ALT = 'CDL BBQ Logo'

export const CDL_LOGO_PLACEHOLDER = 'CDL BBQ'

export const CDL_LOGO_COVER_HEIGHT = 96
export const CDL_LOGO_COMPACT_HEIGHT = 26
export const CDL_LOGO_COMPACT_HEADER_HEIGHT = 40

export type PdfLogoSource = {
  /** Absolute filesystem path for @react-pdf on the server */
  filePath: string | null
  /** Base64 data URI fallback */
  src: string | null
}
