/**
 * Scroll-based extras review: a category is reviewed when the end of its
 * summary block is actually reached — never on mount, click or expansion.
 * Reaching the summary must not expand anything: opening a category is a
 * decision of the customer.
 */

export const ADDITIONAL_CATEGORY_EXPOSE_ZONE = {
  rootMargin: '0px 0px -112px 0px',
  threshold: 0.55,
} as const

export function shouldExposeAdditionalCategory(entry: {
  isIntersecting: boolean
  intersectionRatio: number
}): boolean {
  return (
    entry.isIntersecting &&
    entry.intersectionRatio >= ADDITIONAL_CATEGORY_EXPOSE_ZONE.threshold
  )
}
