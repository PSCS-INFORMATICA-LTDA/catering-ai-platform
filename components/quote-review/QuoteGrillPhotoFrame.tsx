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
      <div className="quote-proposal-grill-photo quote-proposal-grill-photo--empty">
        <p className="quote-proposal-value">{emptyLabel}</p>
      </div>
    )
  }

  return (
    <PackageHeroImage src={url} alt={alt} compact expand={false} />
  )
}
