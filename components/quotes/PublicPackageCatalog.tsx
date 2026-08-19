'use client'

import { Fragment, useEffect, useRef } from 'react'
import {
  formatPackageCatalogPriceLabel,
  getPackageCatalogImage,
  getPackageCatalogName,
  getPackageCatalogPrice,
  getPackageCatalogVariant,
  type PackageCatalogFields,
} from '@/Lib/packageCatalogVisual'
import type { PackageOptionGroup } from '@/Lib/packageOptionGroups'
import type { QuoteLanguage } from '@/Lib/quoteWizardTypes'
import { getQuoteStrings, tw } from '@/Lib/quoteTranslations'
import PackageIncludedOptions from '@/components/quotes/PackageIncludedOptions'

type PublicPackageCard = PackageCatalogFields & {
  id: string
  package_key?: string | null
}

function formatPackagePrice(pkg: PublicPackageCard, language: QuoteLanguage): string {
  return formatPackageCatalogPriceLabel(pkg, language, (value) => {
    const locale = language === 'en' ? 'en-US' : language === 'es' ? 'es-US' : 'pt-BR'
    const currency = pkg.currency_code?.trim() || 'USD'
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(value)
  })
}

function PackageCatalogCard({
  pkg,
  allPackages,
  active,
  language,
  onClick,
}: {
  pkg: PublicPackageCard
  allPackages: readonly PublicPackageCard[]
  active: boolean
  language: QuoteLanguage
  onClick: () => void
}) {
  const name = getPackageCatalogName(pkg, language)
  const image = getPackageCatalogImage(pkg, allPackages)
  const variant = getPackageCatalogVariant(pkg)
  const price = formatPackagePrice(pkg, language)
  const selectedLabel = getQuoteStrings(language).selected

  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`flex w-full flex-col overflow-hidden rounded-2xl border bg-cdl-surface text-left transition ${
        active
          ? 'border-[var(--brand-primary-2)] ring-2 ring-[color-mix(in_srgb,var(--brand-primary-2)_40%,transparent)]'
          : 'border-cdl-border hover:border-neutral-300'
      }`}
    >
      <span className="relative block w-full">
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
        {active ? (
          <span className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white text-base font-black text-emerald-700 shadow">
            ✓
            <span className="sr-only">{selectedLabel}</span>
          </span>
        ) : null}
        {variant === 'with_sides' ? (
          <span className="absolute left-3 top-3 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-900">
            {tw(language, 'withSides')}
          </span>
        ) : null}
      </span>
      <span className="flex flex-col gap-1 px-4 py-3">
        <span className="text-base font-black leading-tight text-cdl-title sm:text-lg">
          {name}
        </span>
        {getPackageCatalogPrice(pkg) > 0 ? (
          <span className="text-sm font-semibold text-[var(--brand-primary)] sm:text-base">
            {price}
          </span>
        ) : null}
      </span>
    </button>
  )
}

export default function PublicPackageCatalog({
  packagesWithoutSides,
  packagesWithSides,
  allPackages,
  selectedPackageId,
  language = 'pt',
  optionGroupsForPackage,
  selections,
  onSelectionChange,
  pendingSelectionGroupIds,
  onSelect,
}: {
  packagesWithoutSides: PublicPackageCard[]
  packagesWithSides: PublicPackageCard[]
  allPackages: PublicPackageCard[]
  selectedPackageId: string | null
  language?: QuoteLanguage
  optionGroupsForPackage: (packageId: string) => PackageOptionGroup[]
  selections: Record<string, string>
  onSelectionChange: (groupId: string, itemId: string) => void
  pendingSelectionGroupIds: string[]
  onSelect: (id: string) => void
}) {
  const t = getQuoteStrings(language)
  const catalog = [...packagesWithSides, ...packagesWithoutSides]
  const optionsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!selectedPackageId) return
    const node = optionsRef.current
    if (!node) return
    // Short nudge so the options appear without hiding the package card.
    node.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [selectedPackageId])

  if (catalog.length === 0) {
    return <p className="text-sm text-cdl-muted">{tw(language, 'noPackages')}</p>
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-cdl-muted">{t.wizard.publicPackageChooseHint}</p>
      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
        {catalog.map((pkg) => {
          const active = selectedPackageId === pkg.id
          const selectableGroups = active
            ? optionGroupsForPackage(pkg.id).filter(
                (group) => group.items.length > 0,
              )
            : []

          return (
            <Fragment key={pkg.id}>
              <PackageCatalogCard
                pkg={pkg}
                allPackages={allPackages}
                active={active}
                language={language}
                onClick={() => onSelect(pkg.id)}
              />
              {active && selectableGroups.length > 0 ? (
                <div
                  ref={optionsRef}
                  data-public-package-options
                  className="lg:col-span-2"
                >
                  <section className="rounded-2xl border-2 border-[color-mix(in_srgb,var(--brand-primary-2)_35%,transparent)] bg-cdl-surface p-4 sm:p-5">
                    <h3 className="text-sm font-black uppercase tracking-wide text-cdl-title">
                      {t.wizard.publicPackageOptionsTitle}
                    </h3>
                    <p className="mt-1 text-sm font-semibold text-cdl-title">
                      {getPackageCatalogName(pkg, language)}
                    </p>
                    <div className="mt-4">
                      <PackageIncludedOptions
                        optionGroups={selectableGroups}
                        selections={selections}
                        onChange={onSelectionChange}
                        language={language}
                        pendingGroupIds={pendingSelectionGroupIds}
                      />
                    </div>
                  </section>
                </div>
              ) : null}
            </Fragment>
          )
        })}
      </div>
    </div>
  )
}
