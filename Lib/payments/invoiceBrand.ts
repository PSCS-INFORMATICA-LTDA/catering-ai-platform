/**
 * Company-configurable invoice brand metrics. CDL is the pilot, not a
 * hardcoded renderer. Callers pass the current company logo source.
 */
export const INVOICE_LOGO_PDF = {
  width: 108,
  height: 56,
} as const

/** +20% versus the previous public-payment compact mark (h-10 → h-12). */
export const INVOICE_LOGO_WEB_CLASS = 'mb-3 h-12 w-auto max-w-[180px] object-contain'
