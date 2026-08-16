'use client'

import CatalogImageFrame from '@/components/CatalogImageFrame'
import PackageHeroImage from '@/components/quotes/PackageHeroImage'
import { resolveCatalogItemImageForLink } from '@/Lib/catalogItemVisual'
import { PriceBreakdownCard } from '@/components/premium/PremiumPrimitives'
import PackageFixedItemsByCategory from '@/components/quotes/PackageFixedItemsByCategory'
import PackageIncludedOptions from '@/components/quotes/PackageIncludedOptions'
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
import {
  getDisplayableFixedPackageItems,
  getPackageSideItemLabel,
  type PackageItem,
  type PackageSideItem,
} from '@/Lib/packageConfiguration'
import {
  getPackageDetailTitle,
  getPackageHighlights,
  parsePackageHighlightsText,
} from '@/Lib/packageDisplay'
import {
  groupFixedPackageItemsForQuote,
  getQuoteDisplaySideItems,
} from '@/Lib/packageQuoteDisplay'
import {
  hasPackageIncludedChoices,
  isCustomPackage,
  type PackageOptionGroup,
} from '@/Lib/packageOptionGroups'
import type { QuoteLanguage } from '@/Lib/quoteWizardTypes'
import { getQuoteStrings, tw } from '@/Lib/quoteTranslations'

function formatCurrency(value: number) {
  return `$${value.toFixed(2)}`
}

type PackageWithHighlights = PackageCatalogFields & {
  id?: string
  package_highlights_pt?: string | null
}

export default function QuotePackageSummary({
  pkg,
  allPackages = [],
  language = 'pt',
  sidesPricePerPerson = 13,
  selected = false,
  compact = false,
  optionGroups = [],
  packageItems = [],
  packageSideItems = [],
  catalogItems = [],
  selections = {},
  onSelectionChange,
  showIncludedOptionsEditor = false,
  showIncludedOptionsSummary = false,
  showImage = true,
  pendingSelectionGroupIds = [],
}: {
  pkg: PackageWithHighlights
  allPackages?: ReadonlyArray<PackageCatalogFields>
  language?: QuoteLanguage
  sidesPricePerPerson?: number
  selected?: boolean
  compact?: boolean
  optionGroups?: ReadonlyArray<PackageOptionGroup>
  packageItems?: ReadonlyArray<PackageItem>
  packageSideItems?: ReadonlyArray<PackageSideItem>
  catalogItems?: ReadonlyArray<import('@/Lib/itemCatalog').CatalogItemListItem>
  selections?: Record<string, string>
  onSelectionChange?: (groupId: string, itemId: string) => void
  showIncludedOptionsEditor?: boolean
  showIncludedOptionsSummary?: boolean
  showImage?: boolean
  pendingSelectionGroupIds?: string[]
}) {
  const image = getPackageCatalogImage(pkg, allPackages)
  const variant = getPackageCatalogVariant(pkg)
  const detailTitle = getPackageDetailTitle(pkg, language)
  const priceOnRequest = isPackageCatalogPriceOnRequest(pkg)
  const perPerson = getQuoteStrings(language).perPerson
  const basePackage = findBasePackage(pkg, allPackages)
  const sidesPricing =
    variant === 'with_sides'
      ? resolvePackageSidesPricing(pkg, basePackage, sidesPricePerPerson)
      : null

  const isCustom = isCustomPackage(pkg)
  const choiceContext = { optionGroups }
  const hasIncludedOptions = hasPackageIncludedChoices(pkg.id, optionGroups, pkg)
  const showOptionGroups =
    hasIncludedOptions &&
    showIncludedOptionsEditor &&
    Boolean(onSelectionChange)

  const packagePrice = getPackageCatalogPrice(pkg)
  const totalPerPerson =
    sidesPricing?.totalPerPerson ?? packagePrice

  const itemCategoryGroups = pkg.id
    ? groupFixedPackageItemsForQuote({
        packageId: pkg.id,
        packageItems,
        catalogItems,
        choiceContext,
        language,
      })
    : []

  const hasFixedItems =
    pkg.id &&
    getDisplayableFixedPackageItems(pkg.id, packageItems, choiceContext).length >
      0

  const configuredSides = pkg.id
    ? getQuoteDisplaySideItems(pkg.id, packageSideItems)
    : []

  const highlightItems = parsePackageHighlightsText(
    getPackageHighlights(pkg, language) || pkg.package_highlights_pt,
  )

  const breakdownRows = priceOnRequest
    ? [
        {
          label: tw(language, 'packageValue'),
          value: formatPackageCatalogPriceLabel(pkg, language, formatCurrency),
          emphasis: true,
        },
      ]
    : variant === 'without_sides'
      ? [
          {
            label: tw(language, 'totalPerPerson'),
            value: `${formatCurrency(packagePrice)} / ${perPerson}`,
            emphasis: true,
          },
        ]
      : sidesPricing?.mode === 'breakdown' &&
          sidesPricing.basePricePerPerson != null
        ? [
            {
              label: tw(language, 'packageValue'),
              value: `${formatCurrency(sidesPricing.basePricePerPerson)} / ${perPerson}`,
            },
            {
              label: tw(language, 'garnish'),
              value: `+ ${formatCurrency(sidesPricing.sidesPricePerPerson)} / ${perPerson}`,
            },
            {
              label: tw(language, 'totalPerPerson'),
              value: `${formatCurrency(sidesPricing.totalPerPerson)} / ${perPerson}`,
              emphasis: true,
            },
          ]
        : [
            {
              label: tw(language, 'totalPerPerson'),
              value: `${formatCurrency(totalPerPerson)} / ${perPerson}`,
              emphasis: true,
            },
          ]

  const sectionClass = compact
    ? 'rounded-xl border border-neutral-100 bg-white p-3'
    : 'rounded-xl border border-neutral-100 bg-white p-4 sm:p-5'

  return (
    <div
      className={`space-y-3 ${selected ? 'rounded-2xl ring-2 ring-emerald-400 ring-offset-2' : ''}`}
    >
      {showImage ? (
        <PackageHeroImage
          src={image}
          alt={detailTitle}
          fallbackLabel={tw(language, 'packageImage')}
          expand={!compact}
        />
      ) : null}

      <section className={sectionClass}>
        <h3
          className={
            compact
              ? 'text-xl font-black tracking-tight text-neutral-900'
              : 'text-2xl font-black tracking-tight text-neutral-900 sm:text-3xl'
          }
        >
          {detailTitle}
        </h3>
        <p
          className={
            compact
              ? 'mt-2 text-2xl font-black text-red-600'
              : 'mt-3 text-3xl font-black text-red-600'
          }
        >
          {priceOnRequest
            ? formatPackageCatalogPriceLabel(pkg, language, formatCurrency)
            : `${formatCurrency(totalPerPerson)}`}
          {!priceOnRequest ? (
            <span className="ml-1 text-sm font-semibold text-neutral-500">
              / {perPerson}
            </span>
          ) : null}
        </p>
      </section>

      {highlightItems.length > 0 ? (
        <section className={sectionClass}>
          <p className="text-sm font-bold text-neutral-900">
            {tw(language, 'packageHighlights')}
          </p>
          <ul className="mt-2 space-y-1">
            {highlightItems.map((item) => (
              <li
                key={item}
                className="text-sm leading-relaxed text-neutral-700 before:mr-2 before:content-['•']"
              >
                {item}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className={sectionClass}>
        <p className="text-sm font-bold text-neutral-900">
          {tw(language, 'includedItems')}
        </p>
        {hasFixedItems ? (
          <div className="mt-2">
            <PackageFixedItemsByCategory
              groups={itemCategoryGroups}
              compact={compact}
            />
          </div>
        ) : isCustom ? (
          <p className="mt-2 text-sm text-neutral-600">
            {tw(language, 'customPackageHint')}
          </p>
        ) : (
          <p className="mt-2 text-sm text-amber-800">
            {tw(language, 'itemsConfiguring')}
          </p>
        )}
      </section>

      {variant === 'with_sides' && configuredSides.length > 0 ? (
        <section className={`${sectionClass} border-amber-200 bg-amber-50/50`}>
          <p className="text-sm font-bold text-amber-950">
            {tw(language, 'includedSides')}
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            {configuredSides.map((side) => {
              const label =
                getPackageSideItemLabel(side, language) || '—'
              const visual = resolveCatalogItemImageForLink(catalogItems, {
                additional_item_id: side.additional_item_id,
                image_url: side.image_url,
                item_type: 'SIDE',
                category_pt: side.label_pt,
              })
              return (
                <div
                  key={side.id}
                  className="flex w-[4.5rem] flex-col items-center gap-1 text-center sm:w-24"
                >
                  <CatalogImageFrame
                    src={visual.imageUrl}
                    alt={label}
                    variant="catalogItem"
                    itemType={visual.itemType ?? 'SIDE'}
                    categoryPt={visual.categoryPt}
                    imageStatus={visual.imageStatus}
                    size="thumbnail"
                    rounded="all"
                    className="!w-full"
                  />
                  <span className="text-[10px] font-semibold leading-tight text-amber-950 sm:text-[11px]">
                    {label}
                  </span>
                </div>
              )
            })}
          </div>
        </section>
      ) : null}

      {showOptionGroups ? (
        <section className={sectionClass}>
          <PackageIncludedOptions
            optionGroups={optionGroups}
            selections={selections}
            onChange={onSelectionChange}
            language={language}
            mode="select"
            pendingGroupIds={pendingSelectionGroupIds}
          />
        </section>
      ) : null}

      {showIncludedOptionsSummary && !showOptionGroups && hasIncludedOptions ? (
        <section className={sectionClass}>
          <PackageIncludedOptions
            optionGroups={optionGroups}
            selections={selections}
            language={language}
            mode="summary"
          />
        </section>
      ) : null}

      <section className={sectionClass}>
        <p className="mb-2 text-sm font-bold text-neutral-900">
          {tw(language, 'price')}
        </p>
        <PriceBreakdownCard rows={breakdownRows} />
      </section>
    </div>
  )
}
