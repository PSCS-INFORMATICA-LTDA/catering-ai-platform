/**
 * Scroll-based extras review: a category is reviewed when the end of its
 * summary block is actually reached — never on mount, click or expansion.
 * Reaching the summary must not expand anything: opening a category is a
 * decision of the customer.
 *
 * The bottom inset matches the sticky CTA so a summary still sitting behind
 * Voltar/Próximo is not counted as reviewed.
 */

/** Stacked Voltar + Próximo + safe-area before the nav is measured. */
export const ADDITIONAL_CATEGORY_EXPOSE_FALLBACK_BOTTOM_PX = 176

export function getAdditionalCategoryExposeRootMargin(
  bottomInsetPx: number = ADDITIONAL_CATEGORY_EXPOSE_FALLBACK_BOTTOM_PX,
): string {
  const inset =
    Number.isFinite(bottomInsetPx) && bottomInsetPx > 0
      ? Math.round(bottomInsetPx)
      : ADDITIONAL_CATEGORY_EXPOSE_FALLBACK_BOTTOM_PX
  return `0px 0px -${inset}px 0px`
}

export const ADDITIONAL_CATEGORY_EXPOSE_ZONE = {
  rootMargin: getAdditionalCategoryExposeRootMargin(),
  threshold: 0.55,
} as const

/** End/Home/anchor jumps skip summaries; only the settled viewport counts. */
export function isExtrasExposeScrollJump(
  deltaPx: number,
  viewportHeight: number,
): boolean {
  const viewport = viewportHeight > 0 ? viewportHeight : 1
  return Math.abs(deltaPx) > viewport * 0.9
}

export function shouldExposeAdditionalCategory(entry: {
  isIntersecting: boolean
  intersectionRatio: number
  boundingClientRect?: { top: number; bottom: number }
  rootBounds?: { top: number; bottom: number } | null
}): boolean {
  if (
    !entry.isIntersecting ||
    entry.intersectionRatio < ADDITIONAL_CATEGORY_EXPOSE_ZONE.threshold
  ) {
    return false
  }
  if (entry.boundingClientRect && entry.rootBounds) {
    const { top, bottom } = entry.boundingClientRect
    if (bottom <= entry.rootBounds.top || top >= entry.rootBounds.bottom) {
      return false
    }
  }
  return true
}
