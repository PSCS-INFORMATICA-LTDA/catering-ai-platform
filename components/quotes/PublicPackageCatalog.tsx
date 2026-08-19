'use client'

import { Fragment, useEffect, useRef } from 'react'
import {
  findBasePackage,
  formatPackageCatalogPriceLabel,
  getPackageCatalogImage,
  getPackageCatalogName,
  getPackageCatalogPrice,
  getPackageCatalogVariant,
  getPackagePriceLineLabel,
  isPackageCatalogPriceOnRequest,
  resolvePackageSidesPricing,
  type PackageCatalogFields,
} from '@/Lib/packageCatalogVisual'
import type { PackageOptionGroup } from '@/Lib/packageOptionGroups'
import type { QuoteLanguage } from '@/Lib/quoteWizardTypes'
import { getQuoteStrings, tw } from '@/Lib/quoteTranslations'
import PackageIncludedOptions from '@/components/quotes/PackageIncludedOptions'
import PackageCatalogHeroArt from '@/components/quotes/PackageCatalogHeroArt'

type PublicPackageCard = PackageCatalogFields & {
  id: string
  package_key?: string | null
}

function formatMoney(
  value: number,
  language: QuoteLanguage,
  currency: string,
): string {
  const locale = language === 'en' ? 'en-US' : language === 'es' ? 'es-US' : 'pt-BR'
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

function perPersonSuffix(language: QuoteLanguage): string {
  if (language === 'en') return 'person'
  if (language === 'es') return 'persona'
  return 'pessoa'
}

function PackageCatalogCard({
  pkg,
  allPackages,
  active,
  language,
  sidesPricePerPerson,
  onClick,
}: {
  pkg: PublicPackageCard
  allPackages: readonly PublicPackageCard[]
  active: boolean
  language: QuoteLanguage
  sidesPricePerPerson: number
  onClick: () => void
}) {
  const name = getPackageCatalogName(pkg, language)
  const image = getPackageCatalogImage(pkg, allPackages)
  const variant = getPackageCatalogVariant(pkg)
  const selectedLabel = getQuoteStrings(language).selected
  const currency = pkg.currency_code?.trim() || 'USD'
  const money = (value: number) => formatMoney(value, language, currency)
  const perPerson = perPersonSuffix(language)
  const priceOnRequest = isPackageCatalogPriceOnRequest(pkg)
  const basePackage = findBasePackage(pkg, allPackages)
  const sidesPricing =
    variant === 'with_sides'
      ? resolvePackageSidesPricing(pkg, basePackage, sidesPricePerPerson)
      : null
  const packagePrice = getPackageCatalogPrice(pkg)
  const displayTotal = sidesPricing?.totalPerPerson ?? packagePrice
  const showGarnishLine =
    sidesPricing?.mode === 'breakdown' &&
    sidesPricing.basePricePerPerson != null &&
    sidesPricing.sidesPricePerPerson > 0

  return (
    <button
      type="button"
      aria-pressed={active}
      data-package-key={pkg.package_key ?? ''}
      onClick={onClick}
      className={`flex w-full min-w-0 flex-col overflow-hidden rounded-2xl border bg-cdl-surface text-left transition ${
        active
          ? 'border-[var(--brand-primary-2)] ring-2 ring-[color-mix(in_srgb,var(--brand-primary-2)_40%,transparent)]'
          : 'border-cdl-border hover:border-neutral-300'
      }`}
    >
      <span className="relative block w-full min-w-0">
        <PackageCatalogHeroArt
          name={name}
          image={image}
          language={language}
          pkg={pkg}
          displayTotal={priceOnRequest ? 0 : displayTotal}
        />
        {active ? (
          <span className="absolute left-3 top-3 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-white text-base font-black text-emerald-700 shadow">
            ✓
            <span className="sr-only">{selectedLabel}</span>
          </span>
        ) : null}
        {variant === 'with_sides' ? (
          <span
            className={`absolute left-3 z-10 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-900 ${
              active ? 'top-14' : 'top-3'
            }`}
          >
            {tw(language, 'withSides')}
          </span>
        ) : null}
      </span>
      <span className="flex min-w-0 flex-col gap-1 px-4 py-3">
        <span className="text-base font-black leading-tight text-cdl-title sm:text-lg">
          {name}
        </span>
        {priceOnRequest ? (
          <span className="text-sm font-semibold text-[var(--brand-primary)] sm:text-base">
            {formatPackageCatalogPriceLabel(pkg, language, money)}
          </span>
        ) : displayTotal > 0 ? (
          <span
            data-package-price-breakdown
            className="mt-1 min-w-0 space-y-0.5 text-sm leading-snug"
          >
            <span className="flex min-w-0 items-baseline justify-between gap-3">
              <span className="text-cdl-muted">
                {getPackagePriceLineLabel('package', language)}
              </span>
              <span className="min-w-0 break-words text-right font-semibold tabular-nums text-cdl-title">
                {money(showGarnishLine ? sidesPricing.basePricePerPerson! : packagePrice)}{' '}
                / {perPerson}
              </span>
            </span>
            {showGarnishLine ? (
              <span className="flex min-w-0 items-baseline justify-between gap-3">
                <span className="text-cdl-muted">
                  {getPackagePriceLineLabel('sides', language)}
                </span>
                <span className="min-w-0 break-words text-right font-semibold tabular-nums text-cdl-title">
                  {money(sidesPricing.sidesPricePerPerson)} / {perPerson}
                </span>
              </span>
            ) : null}
            <span className="flex min-w-0 items-baseline justify-between gap-3 pt-1">
              <span className="font-black text-[var(--brand-primary)]">
                {getPackagePriceLineLabel('total', language)}
              </span>
              <span
                data-package-display-total
                className="min-w-0 break-words text-right text-base font-black tabular-nums text-[var(--brand-primary)]"
              >
                {money(displayTotal)} / {perPerson}
              </span>
            </span>
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
  sidesPricePerPerson,
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
  sidesPricePerPerson: number
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
    <div className="min-w-0 space-y-5">
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
                sidesPricePerPerson={sidesPricePerPerson}
                onClick={() => onSelect(pkg.id)}
              />
              {active && selectableGroups.length > 0 ? (
                <div
                  ref={optionsRef}
                  data-public-package-options
                  className="min-w-0 lg:col-span-2"
                >
                  <section className="rounded-2xl border-2 border-[color-mix(in_srgb,var(--brand-primary-2)_35%,transparent)] bg-cdl-surface p-4 sm:p-5">
                    <h3 className="text-sm font-black uppercase tracking-wide text-cdl-title">
                      {t.wizard.publicPackageOptionsTitle}
                    </h3>
                    <p className="mt-1 text-sm font-semibold text-cdl-title">
                      {getPackageCatalogName(pkg, language)}
                    </p>
                    <div className="mt-4 min-w-0">
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
