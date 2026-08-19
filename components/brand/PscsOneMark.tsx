type PscsOneMarkProps = {
  className?: string
  /** Kept for callers; the official black/red mark is never recolored. */
  onDark?: boolean
}

/**
 * Official PSCS One mark (black/red). Same asset in light and dark mode.
 * A light plate keeps contrast on dark surfaces without inverting the logo.
 */
export function PscsOneMark({ className = '' }: PscsOneMarkProps) {
  return (
    <span
      data-pscs-one-mark
      className={`inline-flex items-center justify-center rounded-md bg-white px-2 py-1 ${className}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/pscs-one.png"
        alt="PSCS One"
        className="h-7 w-auto bg-transparent object-contain"
      />
    </span>
  )
}
