/**
 * Bring a just-opened popover fully into view.
 *
 * The wizard's date and time pickers open below their trigger, which on a phone
 * routinely lands past the fold. Scrolling is derived from the panel's measured
 * rect and from the real heights of whatever is pinned over the viewport, never
 * from a fixed offset, so it behaves the same under a virtual keyboard and on a
 * short landscape window.
 */

/** Breathing room kept between the panel and whatever is pinned next to it. */
const GUTTER = 12
/** Below this the scroll is not worth the motion. */
const MIN_SHIFT = 2

export type StickyInsets = { top: number; bottom: number }

/** Heights of the elements pinned over the viewport, measured live. */
export function measureStickyInsets(doc: Document = document): StickyInsets {
  const rectHeight = (selector: string) => {
    const el = doc.querySelector(selector)
    if (!(el instanceof HTMLElement)) return 0
    if (getComputedStyle(el).position === 'static') return 0
    return el.getBoundingClientRect().height
  }
  return {
    top: rectHeight('.public-quote-header'),
    bottom: rectHeight('[data-wizard-step-nav]'),
  }
}

/**
 * Scrolls the window just enough for `panel` to sit inside the usable viewport.
 * Returns the applied delta in pixels — 0 when the panel already fits.
 */
export function revealFloatingPanel(
  panel: HTMLElement | null,
  options: {
    insets?: StickyInsets
    behavior?: ScrollBehavior
  } = {},
): number {
  if (!panel || typeof window === 'undefined') return 0

  const insets = options.insets ?? measureStickyInsets(panel.ownerDocument)
  const rect = panel.getBoundingClientRect()
  if (rect.height === 0) return 0

  // visualViewport shrinks when the mobile keyboard is up; innerHeight does not.
  const viewportHeight = window.visualViewport?.height ?? window.innerHeight
  const usableTop = insets.top + GUTTER
  const usableBottom = viewportHeight - insets.bottom - GUTTER

  let delta = 0
  if (rect.bottom > usableBottom) delta = rect.bottom - usableBottom
  // A panel taller than the usable strip cannot fit; showing its top wins, so
  // this also stops an over-scroll from hiding the panel behind the header.
  if (rect.top - delta < usableTop) delta = rect.top - usableTop

  if (Math.abs(delta) < MIN_SHIFT) return 0

  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  window.scrollBy({
    top: delta,
    behavior: options.behavior ?? (reduced ? 'auto' : 'smooth'),
  })
  return delta
}

/**
 * Runs `revealFloatingPanel` once the panel has been laid out. Returns a cleanup
 * that cancels the pending frames.
 */
export function revealFloatingPanelWhenReady(
  getPanel: () => HTMLElement | null,
  options: Parameters<typeof revealFloatingPanel>[1] = {},
): () => void {
  if (typeof window === 'undefined') return () => {}
  let inner = 0
  const outer = window.requestAnimationFrame(() => {
    inner = window.requestAnimationFrame(() => revealFloatingPanel(getPanel(), options))
  })
  return () => {
    window.cancelAnimationFrame(outer)
    if (inner) window.cancelAnimationFrame(inner)
  }
}
