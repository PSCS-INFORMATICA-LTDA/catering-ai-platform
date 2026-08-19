/**
 * Scroll-based extras review: a category is exposed when its content
 * sentinel actually enters the reading zone — not on mount, click, or
 * a 1px header intersection.
 */

export const ADDITIONAL_CATEGORY_READING_ZONE = {
  rootMargin: '-16% 0px -36% 0px',
  threshold: 0.45,
} as const

export const ADDITIONAL_CATEGORY_EXPOSE_ZONE = {
  rootMargin: '0px 0px -112px 0px',
  threshold: 0.55,
} as const

export function shouldAutoOpenAdditionalCategory(entry: {
  isIntersecting: boolean
  intersectionRatio: number
}): boolean {
  return (
    entry.isIntersecting &&
    entry.intersectionRatio >= ADDITIONAL_CATEGORY_READING_ZONE.threshold
  )
}

export function shouldExposeAdditionalCategory(entry: {
  isIntersecting: boolean
  intersectionRatio: number
}): boolean {
  return (
    entry.isIntersecting &&
    entry.intersectionRatio >= ADDITIONAL_CATEGORY_EXPOSE_ZONE.threshold
  )
}
