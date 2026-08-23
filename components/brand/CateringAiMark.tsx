type CateringAiMarkProps = {
  className?: string
  size?: 'sm' | 'md' | 'footer'
  variant?: 'full' | 'icon'
}

/**
 * Discreet Catering AI product mark for tenant-facing public surfaces.
 * Do not use PSCS One here. Internal/auth shells keep PscsOneMark.
 */
export function CateringAiMark({
  className = '',
  size = 'md',
  variant = 'full',
}: CateringAiMarkProps) {
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
      data-catering-ai-mark
      data-catering-ai-variant={variant}
      data-catering-ai-size={size}
      className={`inline-flex items-center justify-center overflow-hidden rounded-md bg-white ${box} ${className}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/catering-logo-light.png"
        alt={icon ? '' : 'Catering AI'}
        className={`${height} ${
          icon ? 'w-auto max-w-none object-left' : 'w-auto'
        } bg-transparent object-contain`}
      />
    </span>
  )
}
