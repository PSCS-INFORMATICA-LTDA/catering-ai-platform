type PscsOneMarkProps = {
  className?: string
  /** Kept for callers; the official black/red mark is never recolored. */
  onDark?: boolean
  size?: 'sm' | 'md'
  /** `icon` crops to the left emblem so a wordmark is not repeated next to text. */
  variant?: 'full' | 'icon'
}

/**
 * Official PSCS One mark (black/red). Same asset in light and dark mode.
 * A light plate keeps contrast on dark surfaces without inverting the logo.
 */
export function PscsOneMark({
  className = '',
  size = 'md',
  variant = 'full',
}: PscsOneMarkProps) {
  const compact = size === 'sm'
  const icon = variant === 'icon'
  const height = compact ? 'h-3.5' : 'h-7'
  return (
    <span
      data-pscs-one-mark
      data-pscs-one-variant={variant}
      className={`inline-flex items-center justify-center overflow-hidden rounded-md bg-white ${
        icon
          ? compact
            ? 'h-3.5 w-3.5 p-0'
            : 'h-7 w-7 p-0'
          : compact
            ? 'px-1 py-0.5'
            : 'px-2 py-1'
      } ${className}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/pscs-one.png"
        alt={icon ? '' : 'PSCS One'}
        className={`${height} ${
          icon ? 'w-auto max-w-none object-left' : 'w-auto'
        } bg-transparent object-contain`}
      />
    </span>
  )
}
