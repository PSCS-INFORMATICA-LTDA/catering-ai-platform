'use client'

import { useState } from 'react'
import {
  CDL_LOGO_ALT,
  CDL_LOGO_PATH,
  CDL_LOGO_PLACEHOLDER,
  CDL_REVIEW_LOGO_PATH,
} from '../Lib/cdlLogo'

type CdlBrandLogoProps = {
  size?: 'sm' | 'md' | 'lg'
  variant?: 'default' | 'cover' | 'compact' | 'review'
  className?: string
}

const sizeClass: Record<NonNullable<CdlBrandLogoProps['size']>, string> = {
  sm: 'h-6 w-6 max-h-6 max-w-6 object-contain object-center',
  md: 'h-24 w-auto max-h-24 max-w-[7rem] sm:max-h-28 sm:max-w-[7rem]',
  lg: 'h-24 w-auto max-h-24 max-w-[6rem] sm:max-h-[5.625rem] sm:max-w-[6rem]',
}

const variantClass: Record<
  NonNullable<CdlBrandLogoProps['variant']>,
  string
> = {
  default: '',
  cover: 'pdf-cover-logo',
  compact: 'pdf-logo',
  review:
    'cdl-review-logo h-32 w-32 max-h-32 max-w-32 bg-transparent object-contain object-center',
}

const placeholderClass: Record<NonNullable<CdlBrandLogoProps['size']>, string> =
  {
    sm: 'h-10 min-w-10 px-2 text-xs',
    md: 'h-24 min-w-24 px-3 text-base sm:h-28 sm:min-w-28 sm:text-lg',
    lg: 'h-24 min-w-24 px-3 text-base sm:h-28 sm:min-w-28 sm:text-lg',
  }

export { CDL_LOGO_PATH, CDL_LOGO_PATH as CDL_LOGO_SRC } from '../Lib/cdlLogo'

export default function CdlBrandLogo({
  size = 'md',
  variant = 'default',
  className = '',
}: CdlBrandLogoProps) {
  const [usePlaceholder, setUsePlaceholder] = useState(false)
  const src = variant === 'review' ? CDL_REVIEW_LOGO_PATH : CDL_LOGO_PATH
  const pixelSize = variant === 'review' ? 128 : size === 'sm' ? 24 : size === 'lg' ? 96 : 80

  if (usePlaceholder) {
    return (
      <span
        role="img"
        aria-label={CDL_LOGO_ALT}
        className={`inline-flex shrink-0 items-center justify-center rounded-xl border border-cdl-border bg-cdl-inset font-black uppercase tracking-wider text-cdl-title ${placeholderClass[size]} ${variantClass[variant]} ${className}`}
      >
        {CDL_LOGO_PLACEHOLDER}
      </span>
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={CDL_LOGO_ALT}
      width={pixelSize}
      height={pixelSize}
      className={`cdl-brand-logo shrink-0 object-contain object-center ${variant === 'review' ? '' : sizeClass[size]} ${variantClass[variant]} ${className}`}
      onError={() => {
        console.error(`[CDL Logo] Failed to load ${src}`)
        setUsePlaceholder(true)
      }}
    />
  )
}
