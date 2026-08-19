'use client'

import {
  formatPackageHeroPrice,
  getPackageCatalogVariant,
  getPackageHeroAccompanimentHeading,
  getPackageHeroAccompanimentLines,
  getPackageHeroMenuLines,
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
  const menuLines = image ? getPackageHeroMenuLines(pkg, language) : []
  const accompanimentLines =
    menuLines.length > 0 ? getPackageHeroAccompanimentLines(language) : []
  const accompanimentHeading = getPackageHeroAccompanimentHeading(language)

  return (
    <span className="@container relative block w-full min-w-0">
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
      {menuLines.length > 0 ? (
        <span
          data-package-hero-menu
          data-package-hero-menu-lang={language}
          className="pointer-events-none absolute left-0 top-[22%] z-10 flex w-[52%] min-w-0 flex-col bg-[#14100c] py-[2.2%] pl-[5%] pr-[7%] shadow-[14px_0_28px_16px_#14100c]"
        >
          {menuLines.map((line) => (
            <span
              key={line}
              className="text-[clamp(0.42rem,2.05cqw,0.7rem)] font-bold uppercase leading-snug tracking-wide text-white"
            >
              {line}
            </span>
          ))}
          {accompanimentLines.length > 0 ? (
            <span className="mt-[0.55em] flex min-w-0 flex-col">
              <span className="text-[clamp(0.4rem,1.85cqw,0.62rem)] font-black uppercase tracking-wider text-amber-300">
                {accompanimentHeading}
              </span>
              {accompanimentLines.map((line) => (
                <span
                  key={line}
                  className="text-[clamp(0.38rem,1.8cqw,0.6rem)] font-semibold uppercase leading-snug tracking-wide text-white/90"
                >
                  {line}
                </span>
              ))}
            </span>
          ) : null}
        </span>
      ) : null}
      {heroPrice ? (
        <span
          data-package-hero-price
          className="pointer-events-none absolute right-0 top-0 z-10 flex w-[48%] min-w-0 flex-col items-end pt-[3.5%] pr-[2%]"
        >
          <span className="flex w-full flex-col items-end rounded-sm bg-[#14100c] px-[8%] py-[7%] shadow-[0_0_22px_16px_#14100c]">
            <span className="block w-full text-right font-black leading-none tracking-tight text-white [font-size:clamp(1.9rem,18cqw,4.6rem)]">
              {heroPrice}
            </span>
            <span className="mt-[7%] inline-block max-w-full bg-[#c4161c] px-[8%] py-[3.5%] text-center font-black uppercase leading-tight tracking-wide text-white [font-size:clamp(0.42rem,3.15cqw,0.8rem)]">
              {caption}
            </span>
          </span>
        </span>
      ) : null}
      {garnishLine ? (
        <span
          data-package-hero-garnish
          className="pointer-events-none absolute inset-x-[4%] bottom-[4%] z-10 min-w-0 rounded-md bg-[#14100c] px-3 py-1.5 text-center text-[clamp(0.58rem,1.8vw,0.78rem)] font-semibold leading-snug text-amber-200"
        >
          {garnishLine}
        </span>
      ) : null}
    </span>
  )
}
