type PscsOneMarkProps = {
  className?: string
  onDark?: boolean
}

export function PscsOneMark({ className = '', onDark = false }: PscsOneMarkProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/brand/pscs-one.png"
      alt="PSCS One"
      className={`h-7 w-auto bg-transparent object-contain ${
        onDark ? 'opacity-80 brightness-0 invert' : 'opacity-90'
      } ${className}`}
    />
  )
}
