'use client'

import { useEffect, useMemo, useState } from 'react'
import SelectedPackageDetails from '@/components/quotes/SelectedPackageDetails'
import {
  getPackageCascadeFriendlyLabel,
  getPackageHighlights,
  parsePackageHighlightsText,
  sortPackagesByCommercialTier,
} from '@/Lib/packageDisplay'
import { getPackageHasGarnish } from '@/Lib/packageFieldAccess'
import type { PackageCatalogFields } from '@/Lib/packageCatalogVisual'
import {
  getPackageSideItemLabel,
  getPackageSideItemsForPackage,
  type PackageItem,
  type PackageSideItem,
} from '@/Lib/packageConfiguration'
import type { PackageOptionGroup } from '@/Lib/packageOptionGroups'
import type { CatalogItemListItem } from '@/Lib/itemCatalog'
import type { QuoteLanguage } from '@/Lib/quoteWizardTypes'
import { tw } from '@/Lib/quoteTranslations'

type PackageRow = PackageCatalogFields & {
  id: string
  package_highlights_pt?: string | null
  package_highlights_en?: string | null
  package_highlights_es?: string | null
}
type GarnishGroup = 'with' | 'without'

function PackageSelectionCard({
  pkg,
  active,
  language,
  packageSideItems,
  onClick,
}: {
  pkg: PackageRow
  active: boolean
  language: QuoteLanguage
  packageSideItems: ReadonlyArray<PackageSideItem>
  onClick: () => void
}) {
  const withSides = getPackageHasGarnish(pkg)
  const highlights = parsePackageHighlightsText(
    getPackageHighlights(pkg, language),
  )
  const sides = withSides
    ? getPackageSideItemsForPackage(pkg.id, packageSideItems).map((item) =>
        getPackageSideItemLabel(item, language),
      )
    : []

  const activeClass =
    'border-[var(--brand-primary-2)] bg-[color-mix(in_srgb,var(--brand-primary)_8%,white)] shadow-sm ring-2 ring-[color-mix(in_srgb,var(--brand-primary-2)_28%,transparent)]'

  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`grid w-full grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-3 rounded-2xl border p-3 text-left transition sm:gap-4 sm:p-4 ${
        active
          ? activeClass
          : 'border-cdl-border bg-cdl-surface hover:border-neutral-300 hover:bg-cdl-hover'
      }`}
    >
      <span className="flex min-w-0 flex-col items-start justify-center">
        <span
          className={`inline-flex max-w-full rounded-full px-2 py-0.5 text-[9px] font-bold uppercase leading-4 tracking-wide sm:text-[10px] ${
            withSides
              ? 'bg-amber-100 text-amber-900'
              : 'bg-neutral-100 text-neutral-600'
          }`}
        >
          {tw(language, withSides ? 'withSides' : 'withoutSides')}
        </span>
        <span className="mt-2 break-words text-base font-extrabold leading-tight tracking-tight text-cdl-title sm:text-lg">
          {getPackageCascadeFriendlyLabel(pkg, language)}
        </span>
      </span>

      <span className="min-w-0 border-l border-cdl-border pl-3 sm:pl-4">
        {highlights.length > 0 ? (
          <span className="block">
            <span className="block text-[10px] font-bold uppercase tracking-[0.14em] text-cdl-muted sm:text-xs">
              {tw(language, 'highlights')}
            </span>
            <span className="mt-1 block space-y-0.5 text-[11px] leading-4 text-cdl-title sm:text-xs sm:leading-5">
              {highlights.map((highlight, index) => (
                <span
                  key={`${pkg.id}-highlight-${index}`}
                  className="flex min-w-0 gap-1.5"
                >
                  <span aria-hidden="true" className="shrink-0 text-cdl-accent">
                    •
                  </span>
                  <span className="min-w-0 break-words">{highlight}</span>
                </span>
              ))}
            </span>
          </span>
        ) : null}

        {sides.length > 0 ? (
          <span className="mt-2.5 block border-t border-cdl-border pt-2 sm:mt-3">
            <span className="block text-[10px] font-bold uppercase tracking-[0.14em] text-cdl-muted sm:text-xs">
              {tw(language, 'garnish')}
            </span>
            <span className="mt-1 block break-words text-[11px] leading-4 text-cdl-title sm:text-xs sm:leading-5">
              {sides.join(' • ')}
            </span>
          </span>
        ) : null}
      </span>
    </button>
  )
}

function PackageGroupToggle({
  title,
  count,
  badge,
  expanded,
  onClick,
}: {
  title: string
  count: number
  badge: string
  expanded: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between gap-3 rounded-xl border border-cdl-border bg-cdl-surface px-4 py-3 text-left shadow-sm transition hover:bg-cdl-hover"
    >
      <div className="min-w-0">
        <p className="text-base font-bold text-cdl-title">{title}</p>
        <p className="text-xs text-cdl-muted">
          {count} · {badge}
        </p>
      </div>
      <span
        className={`shrink-0 text-sm text-cdl-accent transition-transform ${
          expanded ? 'rotate-180' : ''
        }`}
      >
        ▼
      </span>
    </button>
  )
}

function PackageListWithInlineDetails({
  packages,
  selectedPackageId,
  allPackages,
  language,
  sidesPricePerPerson,
  optionGroupsForPackage,
  packageSideItems,
  selections,
  onSelectionChange,
  pendingSelectionGroupIds,
  onSelect,
  onNext,
  nextDisabled,
  onNextBlockedClick,
  stepMessage,
}: {
  packages: PackageRow[]
  selectedPackageId: string | null
  allPackages: PackageRow[]
  language: QuoteLanguage
  sidesPricePerPerson: number
  optionGroupsForPackage: (packageId: string) => PackageOptionGroup[]
  packageSideItems: ReadonlyArray<PackageSideItem>
  selections: Record<string, string>
  onSelectionChange: (groupId: string, itemId: string) => void
  pendingSelectionGroupIds: string[]
  onSelect: (id: string) => void
  onNext?: () => void
  nextDisabled?: boolean
  onNextBlockedClick?: () => void
  stepMessage?: string | null
}) {
  return (
    <div className="space-y-3">
      {packages.map((pkg) => {
        const isSelected = selectedPackageId === pkg.id
        const optionGroups = optionGroupsForPackage(pkg.id)

        return (
          <div key={pkg.id}>
            <PackageSelectionCard
              pkg={pkg}
              active={isSelected}
              language={language}
              packageSideItems={packageSideItems}
              onClick={() => onSelect(pkg.id)}
            />
            {isSelected ? (
              <SelectedPackageDetails
                pkg={pkg}
                allPackages={allPackages}
                language={language}
                sidesPricePerPerson={sidesPricePerPerson}
                optionGroups={optionGroups}
                packageSideItems={packageSideItems}
                selections={selections}
                onSelectionChange={onSelectionChange}
                pendingSelectionGroupIds={pendingSelectionGroupIds}
                onNext={onNext}
                nextDisabled={nextDisabled}
                onNextBlockedClick={onNextBlockedClick}
                stepMessage={stepMessage}
              />
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

export default function QuotePackageStepExplorer({
  packagesWithoutSides,
  packagesWithSides,
  allPackages,
  selectedPackageId,
  language = 'pt',
  sidesPricePerPerson = 13,
  optionGroupsForPackage,
  packageSideItems = [],
  selections = {},
  onSelectionChange,
  pendingSelectionGroupIds = [],
  onSelect,
  onNext,
  nextDisabled,
  onNextBlockedClick,
  stepMessage,
}: {
  packagesWithoutSides: PackageRow[]
  packagesWithSides: PackageRow[]
  allPackages: PackageRow[]
  selectedPackageId: string | null
  language?: QuoteLanguage
  sidesPricePerPerson?: number
  optionGroupsForPackage: (packageId: string) => PackageOptionGroup[]
  packageItems?: ReadonlyArray<PackageItem>
  packageSideItems?: ReadonlyArray<PackageSideItem>
  catalogItems?: ReadonlyArray<CatalogItemListItem>
  selections?: Record<string, string>
  onSelectionChange: (groupId: string, itemId: string) => void
  pendingSelectionGroupIds?: string[]
  onSelect: (id: string) => void
  onNext?: () => void
  nextDisabled?: boolean
  onNextBlockedClick?: () => void
  stepMessage?: string | null
}) {
  const sortedWithSides = useMemo(
    () => sortPackagesByCommercialTier(packagesWithSides),
    [packagesWithSides],
  )
  const sortedWithoutSides = useMemo(
    () => sortPackagesByCommercialTier(packagesWithoutSides),
    [packagesWithoutSides],
  )

  const selectedPackage = useMemo(
    () => allPackages.find((pkg) => pkg.id === selectedPackageId) ?? null,
    [allPackages, selectedPackageId],
  )

  const [expandedGroup, setExpandedGroup] = useState<GarnishGroup | null>(() => {
    if (selectedPackage) {
      return getPackageHasGarnish(selectedPackage) ? 'with' : 'without'
    }
    if (sortedWithSides.length > 0) return 'with'
    if (sortedWithoutSides.length > 0) return 'without'
    return null
  })

  const selectedInWithSides = useMemo(
    () =>
      Boolean(
        selectedPackageId &&
          sortedWithSides.some((pkg) => pkg.id === selectedPackageId),
      ),
    [selectedPackageId, sortedWithSides],
  )
  const selectedInWithoutSides = useMemo(
    () =>
      Boolean(
        selectedPackageId &&
          sortedWithoutSides.some((pkg) => pkg.id === selectedPackageId),
      ),
    [selectedPackageId, sortedWithoutSides],
  )

  useEffect(() => {
    if (!selectedPackage) return
    // Keep the open group synchronized when the selected package changes
    // outside this component (for example while loading an editable quote).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setExpandedGroup(getPackageHasGarnish(selectedPackage) ? 'with' : 'without')
  }, [selectedPackage])

  const listProps = {
    selectedPackageId,
    allPackages,
    language,
    sidesPricePerPerson,
    optionGroupsForPackage,
    packageSideItems,
    selections,
    onSelectionChange,
    pendingSelectionGroupIds: pendingSelectionGroupIds ?? [],
    onSelect,
    onNext,
    nextDisabled,
    onNextBlockedClick,
    stepMessage,
  }

  const totalCount = packagesWithoutSides.length + packagesWithSides.length
  if (totalCount === 0) {
    return (
      <p className="text-sm text-cdl-muted">{tw(language, 'noPackages')}</p>
    )
  }

  const showBothGroups =
    sortedWithSides.length > 0 && sortedWithoutSides.length > 0

  if (!showBothGroups) {
    const packages =
      sortedWithSides.length > 0 ? sortedWithSides : sortedWithoutSides
    return (
      <PackageListWithInlineDetails packages={packages} {...listProps} />
    )
  }

  return (
    <div className="space-y-3">
      {sortedWithSides.length > 0 ? (
        <section>
          <PackageGroupToggle
            title={tw(language, 'withSides')}
            count={sortedWithSides.length}
            badge={tw(language, 'withSides')}
            expanded={expandedGroup === 'with'}
            onClick={() => {
              if (selectedInWithSides && expandedGroup === 'with') return
              setExpandedGroup((current) => (current === 'with' ? null : 'with'))
            }}
          />
          {expandedGroup === 'with' ? (
            <div className="mt-3">
              <PackageListWithInlineDetails
                packages={sortedWithSides}
                {...listProps}
              />
            </div>
          ) : null}
        </section>
      ) : null}

      {sortedWithoutSides.length > 0 ? (
        <section>
          <PackageGroupToggle
            title={tw(language, 'withoutSides')}
            count={sortedWithoutSides.length}
            badge={tw(language, 'withoutSides')}
            expanded={expandedGroup === 'without'}
            onClick={() => {
              if (selectedInWithoutSides && expandedGroup === 'without') return
              setExpandedGroup((current) =>
                current === 'without' ? null : 'without',
              )
            }}
          />
          {expandedGroup === 'without' ? (
            <div className="mt-3">
              <PackageListWithInlineDetails
                packages={sortedWithoutSides}
                {...listProps}
              />
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  )
}
