'use client'

/**
 * Continuity cue for the landing chapters.
 *
 * The first chapter fills the viewport, so without a cue it reads as the whole
 * page. `lead` spells the invitation out once; every chapter after it carries a
 * quiet corner arrow, and the last one closes the sequence with a dot instead.
 * Purely an orientation aid — the page still scrolls freely.
 */
export type LandingCueVariant = 'lead' | 'arrow' | 'end'

export default function PublicLandingChapterCue({
  variant,
  label,
  ariaLabel,
}: {
  variant: LandingCueVariant
  /** Only rendered by `lead`. */
  label?: string
  ariaLabel: string
}) {
  const scrollToNext = (node: HTMLElement | null) => {
    const chapter = node?.closest('[data-landing-chapter]')
    const next = chapter?.nextElementSibling
    if (!(next instanceof HTMLElement)) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    next.scrollIntoView({
      behavior: reduced ? 'auto' : 'smooth',
      block: 'start',
    })
  }

  if (variant === 'end') {
    return (
      <span
        data-landing-chapter-cue="end"
        className="public-landing-cue public-landing-cue--end"
        aria-hidden
      >
        <span className="public-landing-cue-dot" />
      </span>
    )
  }

  return (
    <button
      type="button"
      data-landing-chapter-cue={variant}
      aria-label={ariaLabel}
      onClick={(event) => scrollToNext(event.currentTarget)}
      className={`public-landing-cue public-landing-cue--${variant}`}
    >
      {variant === 'lead' && label ? (
        <span className="public-landing-cue-label">{label}</span>
      ) : null}
      <svg viewBox="0 0 24 24" className="public-landing-cue-arrow" aria-hidden>
        <path
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M6 9.5 12 15.5 18 9.5"
        />
      </svg>
    </button>
  )
}
