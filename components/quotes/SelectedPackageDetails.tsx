'use client'

import PackageHeroImage from '@/components/quotes/PackageHeroImage'
import PackageIncludedOptions from '@/components/quotes/PackageIncludedOptions'
import PackageIncludedSidesSummary from '@/components/quotes/PackageIncludedSidesSummary'
import {
  findBasePackage,
  formatPackageCatalogPriceLabel,
  getPackageCatalogImage,
  getPackageCatalogPrice,
  getPackageCatalogVariant,
  isPackageCatalogPriceOnRequest,
  resolvePackageSidesPricing,
  type PackageCatalogFields,
} from '@/Lib/packageCatalogVisual'
import { parsePackageHighlightsText } from '@/Lib/packageDisplay'
import { hasPackageIncludedChoices, type PackageOptionGroup } from '@/Lib/packageOptionGroups'
import type { PackageSideItem } from '@/Lib/packageConfiguration'
import type { QuoteLanguage } from '@/Lib/quoteWizardTypes'

function formatCurrency(value: number) {
  return `$${value.toFixed(2)}`
}

function filterHighlightBullets(items: string[]): string[] {
  return items
    .filter((item) => {
      const normalized = item.toLowerCase()
      return !normalized.includes('selecionad')
    })
    .slice(0, 3)
}

type PackageWithHighlights = PackageCatalogFields & {
  id?: string
  package_highlights_pt?: string | null
}

function PackagePriceSummary({
  pkg,
  allPackages,
  sidesPricePerPerson,
  language,
}: {
  pkg: PackageWithHighlights
  allPackages: ReadonlyArray<PackageCatalogFields>
  sidesPricePerPerson: number
  language: QuoteLanguage
}) {
  const variant = getPackageCatalogVariant(pkg)
  const priceOnRequest = isPackageCatalogPriceOnRequest(pkg)
  const basePackage = findBasePackage(pkg, allPackages)
  const sidesPricing =
    variant === 'with_sides'
      ? resolvePackageSidesPricing(pkg, basePackage, sidesPricePerPerson)
      : null
  const packagePrice = getPackageCatalogPrice(pkg)
  const totalPerPerson = sidesPricing?.totalPerPerson ?? packagePrice

  if (priceOnRequest) {
    return (
      <div className="rounded-xl border border-[color-mix(in_srgb,var(--brand-primary-2)_22%,transparent)] bg-[color-mix(in_srgb,var(--brand-primary)_6%,white)] px-4 py-3">
        <p className="text-sm font-bold text-[var(--brand-primary)]">
          Resumo do pacote
        </p>
        <p className="mt-2 text-sm text-neutral-700">
          {formatPackageCatalogPriceLabel(pkg, language, formatCurrency)}
        </p>
      </div>
    )
  }

  const showBreakdown =
    sidesPricing?.mode === 'breakdown' &&
    sidesPricing.basePricePerPerson != null &&
    sidesPricing.sidesPricePerPerson > 0

  return (
    <div className="rounded-xl border border-[color-mix(in_srgb,var(--brand-primary-2)_22%,transparent)] bg-[color-mix(in_srgb,var(--brand-primary)_6%,white)] px-4 py-3">
      <p className="text-sm font-bold text-[var(--brand-primary)]">
        Resumo do pacote
      </p>
      <div className="mt-2 space-y-1 text-sm text-neutral-700">
        {showBreakdown ? (
          <>
            <p>
              Preço do pacote:{' '}
              <span className="font-semibold text-neutral-900">
                {formatCurrency(sidesPricing.basePricePerPerson!)} / pessoa
              </span>
            </p>
            <p>
              Preço da guarnição:{' '}
              <span className="font-semibold text-neutral-900">
                {formatCurrency(sidesPricing.sidesPricePerPerson)} / pessoa
              </span>
            </p>
          </>
        ) : (
          <>
            <p>
              Preço do pacote:{' '}
              <span className="font-semibold text-neutral-900">
                {formatCurrency(packagePrice)} / pessoa
              </span>
            </p>
            {variant === 'with_sides' ? (
              <p>
                Guarnições:{' '}
                <span className="font-semibold text-neutral-900">inclusas</span>
              </p>
            ) : null}
          </>
        )}
        <p className="pt-1 text-lg font-black text-[var(--brand-primary)] sm:text-xl">
          Total: {formatCurrency(totalPerPerson)} / pessoa
        </p>
      </div>
    </div>
  )
}

export default function SelectedPackageDetails({
  pkg,
  allPackages = [],
  language = 'pt',
  sidesPricePerPerson = 13,
  optionGroups = [],
  packageSideItems = [],
  selections = {},
  onSelectionChange,
  pendingSelectionGroupIds = [],
  onNext,
  nextDisabled = false,
  onNextBlockedClick,
  stepMessage,
}: {
  pkg: PackageWithHighlights
  allPackages?: ReadonlyArray<PackageCatalogFields>
  language?: QuoteLanguage
  sidesPricePerPerson?: number
  optionGroups?: ReadonlyArray<PackageOptionGroup>
  packageSideItems?: ReadonlyArray<PackageSideItem>
  selections?: Record<string, string>
  onSelectionChange?: (groupId: string, itemId: string) => void
  pendingSelectionGroupIds?: string[]
  onNext?: () => void
  nextDisabled?: boolean
  onNextBlockedClick?: () => void
  stepMessage?: string | null
}) {
  const image = getPackageCatalogImage(pkg, allPackages)
  const variant = getPackageCatalogVariant(pkg)
  const hasOptions =
    pkg.id && hasPackageIncludedChoices(pkg.id, optionGroups, pkg)

  const highlightItems = filterHighlightBullets(
    parsePackageHighlightsText(pkg.package_highlights_pt),
  )

  const optionProps =
    hasOptions && onSelectionChange
      ? {
          optionGroups,
          selections,
          onChange: onSelectionChange,
          language,
          mode: 'select' as const,
          pendingGroupIds: pendingSelectionGroupIds,
        }
      : null

  return (
    <div className="mt-2 border-t border-cdl-border-subtle pt-2.5 px-0">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-12 md:items-start md:gap-5">
        <div className="md:col-span-5 lg:col-span-5">
          <PackageHeroImage
            src={image}
            alt={pkg.label_pt?.trim() || pkg.package_key || 'Pacote'}
            fallbackLabel="Imagem do pacote"
            compact
          />
        </div>

        <div className="space-y-2.5 md:col-span-7 lg:col-span-7">
          {highlightItems.length > 0 ? (
            <div className="rounded-xl bg-gradient-to-br from-amber-100 via-amber-50 to-yellow-50 px-3 py-2.5 ring-1 ring-amber-200/80">
              <p className="text-[11px] font-bold uppercase tracking-wide text-amber-900">
                Destaques do pacote
              </p>
              <ul className="mt-1.5 space-y-0.5">
                {highlightItems.map((item) => (
                  <li
                    key={item}
                    className="text-xs leading-snug text-amber-950 before:mr-1.5 before:font-bold before:content-['•'] sm:text-sm"
                  >
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {optionProps ? (
            <PackageIncludedOptions
              {...optionProps}
              onlyGroupKeys={['SEAFOOD_OPTION']}
            />
          ) : null}

          {optionProps ? (
            <PackageIncludedOptions
              {...optionProps}
              onlyGroupKeys={['COSTELA_OPTION']}
            />
          ) : null}

          {variant === 'with_sides' && pkg.id ? (
            <PackageIncludedSidesSummary
              packageId={pkg.id}
              packageSideItems={packageSideItems}
              optionGroups={optionGroups}
              language={language}
            />
          ) : null}

          {optionProps ? (
            <PackageIncludedOptions
              {...optionProps}
              onlyGroupKeys={['SIDE_OPTION']}
            />
          ) : null}

          <PackagePriceSummary
            pkg={pkg}
            allPackages={allPackages}
            sidesPricePerPerson={sidesPricePerPerson}
            language={language}
          />

          {onNext ? (
            <div className="space-y-2 pt-1">
              {stepMessage ? (
                <p className="text-center text-sm font-medium text-[var(--brand-primary)] sm:text-right">
                  {stepMessage}
                </p>
              ) : null}
              <div className="relative">
                {nextDisabled && onNextBlockedClick ? (
                  <button
                    type="button"
                    aria-label="Próximo — complete as opções obrigatórias"
                    className="absolute inset-0 z-10 cursor-not-allowed rounded-xl"
                    onClick={onNextBlockedClick}
                  />
                ) : null}
                <button
                  type="button"
                  onClick={onNext}
                  disabled={nextDisabled}
                  className="cdl-btn-primary w-full disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Próximo
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
