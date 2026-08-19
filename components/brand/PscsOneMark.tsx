type PscsOneMarkProps = {
  className?: string
  /** Kept for callers; the official black/red mark is never recolored. */
  onDark?: boolean
  size?: 'sm' | 'md'
}

/**
 * Official PSCS One mark (black/red). Same asset in light and dark mode.
 * A light plate keeps contrast on dark surfaces without inverting the logo.
 */
export function PscsOneMark({ className = '', size = 'md' }: PscsOneMarkProps) {
  const compact = size === 'sm'
  return (
    <span
      data-pscs-one-mark
      className={`inline-flex items-center justify-center rounded-md bg-white ${
        compact ? 'px-1 py-0.5' : 'px-2 py-1'
      } ${className}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/pscs-one.png"
        alt="PSCS One"
        className={`${compact ? 'h-3.5' : 'h-7'} w-auto bg-transparent object-contain`}
      />
    </span>
  )
}
