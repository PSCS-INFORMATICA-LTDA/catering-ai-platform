type PscsOneMarkProps = {
  className?: string
  /** Kept for callers; the official black/red mark is never recolored. */
  onDark?: boolean
  size?: 'sm' | 'md' | 'footer'
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
  const icon = variant === 'icon'
  const height =
    size === 'footer' ? 'h-[22px]' : size === 'sm' ? 'h-3.5' : 'h-7'
  const box =
    size === 'footer'
      ? icon
        ? 'h-[22px] w-[22px] p-0'
        : 'h-[22px] px-1 py-0'
      : size === 'sm'
        ? icon
          ? 'h-3.5 w-3.5 p-0'
          : 'px-1 py-0.5'
        : icon
          ? 'h-7 w-7 p-0'
          : 'px-2 py-1'
  return (
    <span
      data-pscs-one-mark
      data-pscs-one-variant={variant}
      data-pscs-one-size={size}
      className={`inline-flex items-center justify-center overflow-hidden rounded-md bg-white ${box} ${className}`}
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
