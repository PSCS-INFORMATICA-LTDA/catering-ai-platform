'use client'

import { useTheme } from '@/components/ThemeProvider'

const LOGO_LIGHT = '/brand/catering-logo-light.png'
const LOGO_DARK = '/brand/catering-logo-dark.png'

type CateringAuthLogoProps = {
  className?: string
}

/**
 * Light theme → logo com silhuetas pretas (fundo claro).
 * Dark theme → logo com elementos claros (fundo escuro).
 */
export function CateringAuthLogo({ className = '' }: CateringAuthLogoProps) {
  const { theme } = useTheme()
  const src = theme === 'light' ? LOGO_LIGHT : LOGO_DARK

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      key={src}
      src={src}
      alt="Catering AI Platform"
      width={720}
      height={420}
      className={`mx-auto h-auto w-full max-w-[40rem] bg-transparent object-contain sm:max-w-[48rem] ${className}`}
    />
  )
}
