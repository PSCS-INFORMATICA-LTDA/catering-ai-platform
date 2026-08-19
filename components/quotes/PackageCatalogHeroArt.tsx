'use client'

import {
  formatPackageHeroPrice,
  getPackageCatalogVariant,
  getPackagePriceCaption,
  getPackageSidesDescription,
  type PackageCatalogFields,
} from '@/Lib/packageCatalogVisual'
import type { QuoteLanguage } from '@/Lib/quoteWizardTypes'

export default function PackageCatalogHeroArt({
  name,
  image,
  language,
  pkg,
  displayTotal,
}: {
  name: string
  image: string | null
  language: QuoteLanguage
  pkg: PackageCatalogFields
  displayTotal: number
}) {
  const variant = getPackageCatalogVariant(pkg)
  const heroPrice = formatPackageHeroPrice(displayTotal)
  const caption = getPackagePriceCaption(language)
  const garnishLine =
    variant === 'with_sides' ? getPackageSidesDescription(language) : null

  return (
    <span className="relative block w-full min-w-0">
      {image ? (
        // The art carries printed commercial copy, so it must keep its
        // natural ratio and never be cropped.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={image}
          alt={name}
          className="block h-auto w-full"
          loading="lazy"
          decoding="async"
        />
      ) : (
        <span className="flex min-h-40 w-full items-center justify-center bg-gradient-to-br from-stone-200 to-stone-100 px-4 py-10 text-center text-base font-bold text-stone-600">
          {name}
        </span>
      )}
      {heroPrice ? (
        <span
          data-package-hero-price
          className="pointer-events-none absolute right-[3%] top-[7%] flex w-[46%] min-w-0 flex-col items-end"
        >
          <span className="rounded-sm bg-black/75 px-2 py-1 text-right shadow-lg">
            <span className="block text-[clamp(1.6rem,8vw,2.85rem)] font-black leading-none tracking-tight text-white">
              {heroPrice}
            </span>
            <span className="mt-1 inline-block max-w-full bg-[#c4161c] px-2 py-0.5 text-[clamp(0.5rem,1.7vw,0.72rem)] font-black uppercase leading-tight tracking-wide text-white">
              {caption}
            </span>
          </span>
        </span>
      ) : null}
      {garnishLine ? (
        <span
          data-package-hero-garnish
          className="pointer-events-none absolute inset-x-[5%] bottom-[5%] min-w-0 rounded-md bg-black/75 px-3 py-1.5 text-center text-[clamp(0.58rem,1.8vw,0.78rem)] font-semibold leading-snug text-amber-200"
        >
          {garnishLine}
        </span>
      ) : null}
    </span>
  )
}
