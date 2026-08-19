'use client'

import { Fragment, useEffect, useRef, useState } from 'react'
import {
  findBasePackage,
  formatPackageCatalogPriceLabel,
  getPackageCatalogImage,
  getPackageCatalogName,
  getPackageCatalogPrice,
  getPackageCatalogVariant,
  getPackagePriceLineLabel,
  getPublicPackageSidesGroup,
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

type PackageSidesGroup = 'with_sides' | 'without_sides'

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

function PackageGroupToggle({
  title,
  hint,
  count,
  expanded,
  group,
  onClick,
}: {
  title: string
  hint: string
  count: number
  expanded: boolean
  group: PackageSidesGroup
  onClick: () => void
}) {
  return (
    <button
      type="button"
      data-package-group-toggle={group}
      aria-expanded={expanded}
      onClick={onClick}
      className="flex w-full min-w-0 items-start justify-between gap-3 rounded-2xl border border-cdl-border bg-cdl-surface px-4 py-4 text-left shadow-sm transition hover:bg-cdl-hover sm:px-5"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-base font-black text-cdl-title sm:text-lg">
          {title}
        </span>
        <span className="mt-1 block text-sm leading-6 text-cdl-muted">{hint}</span>
        {count > 0 ? (
          <span
            data-package-group-count
            className="mt-2 inline-block text-xs font-semibold uppercase tracking-wide text-cdl-muted"
          >
            {count}
          </span>
        ) : null}
      </span>
      <span
        className={`mt-1 shrink-0 text-sm text-[var(--brand-primary)] transition-transform ${
          expanded ? 'rotate-180' : ''
        }`}
        aria-hidden
      >
        ▼
      </span>
    </button>
  )
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
      data-package-sides-group={getPublicPackageSidesGroup(pkg)}
      onClick={onClick}
      className={`flex w-full min-w-0 flex-col overflow-hidden rounded-2xl border bg-cdl-surface text-left transition ${
        active
          ? 'border-[var(--brand-primary-2)] ring-2 ring-[color-mix(in_srgb,var(--brand-primary-2)_40%,transparent)]'
          : 'border-cdl-border hover:border-neutral-300'
      }`}
    >
      <span className="relative block w-full min-w-0">
        <PackageCatalogHeroArt name={name} image={image} />
        {active ? (
          <span className="absolute left-3 top-3 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-white text-base font-black text-emerald-700 shadow">
            ✓
            <span className="sr-only">{selectedLabel}</span>
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
  const optionsRef = useRef<HTMLDivElement>(null)
  const [openGroup, setOpenGroup] = useState<PackageSidesGroup | null>(null)
  const syncedSelectionRef = useRef<string | null>(null)

  useEffect(() => {
    if (!selectedPackageId) {
      syncedSelectionRef.current = null
      return
    }
    if (syncedSelectionRef.current === selectedPackageId) return
    syncedSelectionRef.current = selectedPackageId
    if (packagesWithSides.some((pkg) => pkg.id === selectedPackageId)) {
      setOpenGroup('with_sides')
      return
    }
    if (packagesWithoutSides.some((pkg) => pkg.id === selectedPackageId)) {
      setOpenGroup('without_sides')
    }
  }, [selectedPackageId, packagesWithSides, packagesWithoutSides])

  useEffect(() => {
    if (!selectedPackageId) return
    const node = optionsRef.current
    if (!node) return
    node.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [selectedPackageId, openGroup])

  function renderGroup(packages: PublicPackageCard[]) {
    return (
      <div className="mt-4 grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
        {packages.map((pkg) => {
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
    )
  }

  if (packagesWithSides.length === 0 && packagesWithoutSides.length === 0) {
    return <p className="text-sm text-cdl-muted">{tw(language, 'noPackages')}</p>
  }

  return (
    <div className="min-w-0 space-y-5">
      <p className="text-sm text-cdl-muted">{t.wizard.publicPackageChooseHint}</p>
      {packagesWithSides.length > 0 ? (
        <section data-package-group="with_sides" className="min-w-0">
          <PackageGroupToggle
            group="with_sides"
            title={tw(language, 'withSides')}
            hint={tw(language, 'withSidesGroupHint')}
            count={packagesWithSides.length}
            expanded={openGroup === 'with_sides'}
            onClick={() =>
              setOpenGroup((current) =>
                current === 'with_sides' ? null : 'with_sides',
              )
            }
          />
          {openGroup === 'with_sides' ? renderGroup(packagesWithSides) : null}
        </section>
      ) : null}
      {packagesWithoutSides.length > 0 ? (
        <section data-package-group="without_sides" className="min-w-0">
          <PackageGroupToggle
            group="without_sides"
            title={tw(language, 'withoutSides')}
            hint={tw(language, 'withoutSidesGroupHint')}
            count={packagesWithoutSides.length}
            expanded={openGroup === 'without_sides'}
            onClick={() =>
              setOpenGroup((current) =>
                current === 'without_sides' ? null : 'without_sides',
              )
            }
          />
          {openGroup === 'without_sides'
            ? renderGroup(packagesWithoutSides)
            : null}
        </section>
      ) : null}
    </div>
  )
}
