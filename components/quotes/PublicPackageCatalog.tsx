'use client'

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
      className={`flex h-full w-full flex-col overflow-hidden rounded-2xl border text-left transition ${
        active
          ? 'border-[var(--brand-primary-2)] ring-2 ring-[color-mix(in_srgb,var(--brand-primary-2)_40%,transparent)]'
          : 'border-cdl-border hover:border-neutral-300'
      }`}
    >
      <span className="relative block aspect-[4/3] w-full overflow-hidden bg-cdl-inset sm:aspect-[16/10]">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt={name}
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center bg-gradient-to-br from-stone-200 to-stone-100 px-4 text-center text-sm font-bold text-stone-600">
            {name}
          </span>
        )}
        {active ? (
          <span className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white text-sm font-black text-emerald-700 shadow">
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
      <span className="flex flex-1 flex-col gap-1 px-4 py-3">
        <span className="text-base font-black leading-tight text-cdl-title">
          {name}
        </span>
        {getPackageCatalogPrice(pkg) > 0 ? (
          <span className="text-sm font-semibold text-[var(--brand-primary)]">
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
  onNext,
  nextDisabled = false,
  onNextBlockedClick,
  stepMessage,
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
  onNext?: () => void
  nextDisabled?: boolean
  onNextBlockedClick?: () => void
  stepMessage?: string | null
}) {
  const t = getQuoteStrings(language)
  const catalog = [...packagesWithSides, ...packagesWithoutSides]
  const selected =
    catalog.find((pkg) => pkg.id === selectedPackageId) ??
    allPackages.find((pkg) => pkg.id === selectedPackageId) ??
    null
  const optionGroups = selected ? optionGroupsForPackage(selected.id) : []
  const selectableGroups = optionGroups.filter((group) => group.items.length > 0)

  if (catalog.length === 0) {
    return <p className="text-sm text-cdl-muted">{tw(language, 'noPackages')}</p>
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-cdl-muted">{t.wizard.publicPackageChooseHint}</p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {catalog.map((pkg) => (
          <PackageCatalogCard
            key={pkg.id}
            pkg={pkg}
            allPackages={allPackages}
            active={selectedPackageId === pkg.id}
            language={language}
            onClick={() => onSelect(pkg.id)}
          />
        ))}
      </div>

      {selected && selectableGroups.length > 0 ? (
        <section className="rounded-2xl border border-cdl-border bg-cdl-surface p-4 sm:p-5">
          <h3 className="text-sm font-black uppercase tracking-wide text-cdl-title">
            {t.wizard.publicPackageOptionsTitle}
          </h3>
          <p className="mt-1 text-sm font-semibold text-cdl-title">
            {getPackageCatalogName(selected, language)}
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
      ) : null}

      {onNext ? (
        <div className="space-y-2">
          {stepMessage ? (
            <p className="text-sm font-medium text-[var(--brand-primary)]">
              {stepMessage}
            </p>
          ) : null}
          <div className="relative">
            {nextDisabled && onNextBlockedClick ? (
              <button
                type="button"
                aria-label={tw(language, 'nextCompleteOptions')}
                className="absolute inset-0 z-10 cursor-not-allowed rounded-xl"
                onClick={onNextBlockedClick}
              />
            ) : null}
            <button
              type="button"
              data-testid="public-package-next"
              onClick={onNext}
              disabled={nextDisabled}
              className="cdl-btn-primary w-full bg-[var(--brand-primary-2)] text-white disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
            >
              {t.next}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
