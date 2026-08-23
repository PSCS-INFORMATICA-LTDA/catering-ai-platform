export type ScrollableRoot = HTMLElement | null | undefined

function isScrollable(node: HTMLElement) {
  const style = window.getComputedStyle(node)
  const overflowY = style.overflowY
  const overflow = style.overflow
  return /(auto|scroll|overlay)/.test(overflowY) || /(auto|scroll|overlay)/.test(overflow)
}

function resetElement(node: HTMLElement | null | undefined) {
  if (!node) return
  node.scrollTop = 0
  node.scrollLeft = 0
}

/**
 * Reset window + document + any overflow container so the public success
 * screen always opens at the hero, never at the previous review offset.
 */
export function scrollPublicQuoteToTop(root?: ScrollableRoot) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return

  const top = { top: 0, left: 0, behavior: 'auto' as const }
  window.scrollTo(top)
  document.documentElement.scrollTop = 0
  document.documentElement.scrollLeft = 0
  document.body.scrollTop = 0
  document.body.scrollLeft = 0
  resetElement(root ?? null)

  const shell = document.querySelector<HTMLElement>('[data-public-quote-shell]')
  resetElement(shell)

  let node = root ?? shell
  while (node) {
    if (isScrollable(node)) resetElement(node)
    node = node.parentElement
  }

  const scrolling = document.scrollingElement
  if (scrolling instanceof HTMLElement) resetElement(scrolling)

  if (window.location.hash) {
    const url = `${window.location.pathname}${window.location.search}`
    window.history.replaceState(window.history.state, '', url)
  }
}
