'use client'

import PackageHeroImage from '@/components/quotes/PackageHeroImage'

export default function QuoteGrillPhotoFrame({
  src,
  alt,
  emptyLabel,
}: {
  src?: string | null
  alt: string
  emptyLabel: string
}) {
  const url = src?.trim() || null

  if (!url) {
    return (
      <div
        className="quote-proposal-grill-photo quote-proposal-grill-photo--empty"
        aria-hidden={emptyLabel ? undefined : true}
        aria-label={emptyLabel || undefined}
      />
    )
  }

  return (
    <PackageHeroImage src={url} alt={alt} compact expand={false} />
  )
}
