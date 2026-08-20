'use client'

import {
  findBasePackage,
  formatPackageCatalogPriceLabel,
  getPackageCatalogImage,
  getPackageCatalogName,
  getPackageCatalogVariant,
  getPackagePriceLineLabel,
  getPackageSidesDescription,
  getPackageSidesIncludedLabel,
  isPackageCatalogPriceOnRequest,
  resolvePackageSidesPricing,
  type PackageCatalogFields,
} from '@/Lib/packageCatalogVisual'
import type { QuoteLanguage } from '@/Lib/quoteWizardTypes'
import CatalogImageFrame from '@/components/CatalogImageFrame'
import { tCommon } from '@/Lib/i18n/common'
import { tPackages } from '@/Lib/i18n/packages'
import { useAuthLocaleFromMe } from '@/Lib/i18n/useAuthLocaleFromMe'
import {
  getPackageGarnishDisplayText,
  getPackageItemsDisplayText,
} from '@/Lib/packageDisplay'

function formatCurrency(value: number) {
  return `$${value.toFixed(2)}`
}

function perPersonSuffix(language: QuoteLanguage): string {
  if (language === 'en') return 'person'
  if (language === 'es') return 'persona'
  return 'pessoa'
}

function PriceLine({
  label,
  value,
  emphasis = false,
}: {
  label: string
  value: string
  emphasis?: boolean
}) {
  return (
    <p
      className={`leading-snug ${
        emphasis
          ? 'text-sm font-black text-cdl-price sm:text-base'
          : 'text-xs text-cdl-text-secondary sm:text-sm'
      }`}
    >
      <span className="font-semibold text-cdl-muted">{label}:</span>{' '}
      <span className={emphasis ? 'font-black text-cdl-price' : 'font-bold text-cdl-fg'}>
        {value}
      </span>
    </p>
  )
}

export default function PackageCatalogCard({
  pkg,
  language = 'pt',
  selected = false,
  onSelect,
  onSelectAndAdvance,
  autoAdvanceOnSelect = false,
  allPackages = [],
  sidesPricePerPerson = 13,
}: {
  pkg: PackageCatalogFields & { id?: string }
  language?: QuoteLanguage
  selected?: boolean
  onSelect: () => void
  onSelectAndAdvance: () => void
  autoAdvanceOnSelect?: boolean
  allPackages?: ReadonlyArray<PackageCatalogFields>
  sidesPricePerPerson?: number
}) {
  const locale = useAuthLocaleFromMe()
  const image = getPackageCatalogImage(pkg, allPackages)
  const variant = getPackageCatalogVariant(pkg)
  const name = getPackageCatalogName(pkg, language)
  const priceOnRequest = isPackageCatalogPriceOnRequest(pkg)
  const perPerson = perPersonSuffix(language)
  const basePackage = findBasePackage(pkg, allPackages)
  const sidesPricing =
    variant === 'with_sides'
      ? resolvePackageSidesPricing(pkg, basePackage, sidesPricePerPerson)
      : null

  return (
    <button
      type="button"
      onClick={autoAdvanceOnSelect ? onSelectAndAdvance : onSelect}
      onDoubleClick={onSelectAndAdvance}
      title={
        autoAdvanceOnSelect
          ? tPackages(locale, 'selectAndContinue')
          : tPackages(locale, 'doubleClickAdditionals')
      }
      className={`relative flex h-full w-full flex-col overflow-hidden rounded-2xl border text-left shadow-cdl transition-colors ${
        selected
          ? 'border-cdl-success-border bg-cdl-success-soft ring-2 ring-cdl-success-border'
          : 'border-cdl-border bg-cdl-inset hover:border-cdl-accent-border'
      }`}
    >
      {selected && (
        <span className="absolute right-3 top-3 z-10 rounded-full border border-cdl-success-border bg-cdl-success-soft px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-cdl-success">
          {tCommon(locale, 'selected')}
        </span>
      )}

      <CatalogImageFrame
        src={image}
        alt={name}
        variant="package"
        className="shrink-0"
      />

      <div className="flex flex-1 flex-col p-4 md:p-3 lg:p-4">
        <p className="text-xs font-bold uppercase tracking-wider text-cdl-muted">
          {pkg.package_key}
        </p>
        <h3 className="mt-1 text-lg font-extrabold leading-tight text-cdl-title md:text-base lg:text-lg">
          {name}
        </h3>

        {getPackageItemsDisplayText(pkg, language) ? (
          <p className="mt-2 line-clamp-3 text-xs leading-snug text-cdl-text-secondary sm:text-sm">
            <span className="font-bold text-cdl-fg">
              {tPackages(locale, 'packageItems')}:
            </span>{' '}
            {getPackageItemsDisplayText(pkg, language)}
          </p>
        ) : null}

        <p className="mt-2 line-clamp-2 text-xs leading-snug text-cdl-text-secondary sm:text-sm">
          <span className="font-bold text-cdl-fg">{tCommon(locale, 'sides')}:</span>{' '}
          {variant === 'with_sides'
            ? getPackageGarnishDisplayText(pkg, language) ||
              getPackageSidesDescription(language)
            : tPackages(locale, 'sidesNotIncluded')}
        </p>

        <div className="mt-3 space-y-1 md:mt-2">
          {priceOnRequest ? (
            <p className="text-sm font-black uppercase tracking-wide text-cdl-price md:text-xs">
              {formatPackageCatalogPriceLabel(pkg, language, formatCurrency)}
            </p>
          ) : variant === 'with_sides' && sidesPricing ? (
            sidesPricing.mode === 'breakdown' &&
            sidesPricing.basePricePerPerson != null ? (
              <>
                <PriceLine
                  label={getPackagePriceLineLabel('package', language)}
                  value={`${formatCurrency(sidesPricing.basePricePerPerson)} / ${perPerson}`}
                />
                <PriceLine
                  label={getPackagePriceLineLabel('sides', language)}
                  value={`+ ${formatCurrency(sidesPricing.sidesPricePerPerson)} / ${perPerson}`}
                />
                <PriceLine
                  label={getPackagePriceLineLabel('total', language)}
                  value={`${formatCurrency(sidesPricing.totalPerPerson)} / ${perPerson}`}
                  emphasis
                />
              </>
            ) : (
              <>
                <PriceLine
                  label={getPackagePriceLineLabel('total', language)}
                  value={`${formatCurrency(sidesPricing.totalPerPerson)} / ${perPerson}`}
                  emphasis
                />
                <p className="text-xs font-semibold text-cdl-success sm:text-sm">
                  {getPackageSidesIncludedLabel(language)}
                </p>
              </>
            )
          ) : (
            <p className="text-base font-black text-cdl-price md:text-sm lg:text-base">
              {formatPackageCatalogPriceLabel(pkg, language, formatCurrency)}
            </p>
          )}
        </div>
      </div>
    </button>
  )
}
