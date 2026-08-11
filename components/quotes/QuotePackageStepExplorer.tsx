'use client'

import { useEffect, useMemo, useState } from 'react'
import { PackageCodeOption } from '@/components/premium/PremiumPrimitives'
import SelectedPackageDetails from '@/components/quotes/SelectedPackageDetails'
import { sortPackagesByCommercialTier } from '@/Lib/packageDisplay'
import { getPackageHasGarnish } from '@/Lib/packageFieldAccess'
import type { PackageCatalogFields } from '@/Lib/packageCatalogVisual'
import type { PackageItem, PackageSideItem } from '@/Lib/packageConfiguration'
import type { PackageOptionGroup } from '@/Lib/packageOptionGroups'
import type { CatalogItemListItem } from '@/Lib/itemCatalog'
import type { QuoteLanguage } from '@/Lib/quoteWizardTypes'
import { tw } from '@/Lib/quoteTranslations'

type PackageRow = PackageCatalogFields & { id: string }
type GarnishGroup = 'with' | 'without'

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
  packageItems,
  packageSideItems,
  catalogItems,
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
  packageItems: ReadonlyArray<PackageItem>
  packageSideItems: ReadonlyArray<PackageSideItem>
  catalogItems: ReadonlyArray<CatalogItemListItem>
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
            <PackageCodeOption
              pkg={pkg}
              active={isSelected}
              hideTechnical
              selectionTone="brand"
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
  packageItems = [],
  packageSideItems = [],
  catalogItems = [],
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
    setExpandedGroup(getPackageHasGarnish(selectedPackage) ? 'with' : 'without')
  }, [selectedPackage])

  const listProps = {
    selectedPackageId,
    allPackages,
    language,
    sidesPricePerPerson,
    optionGroupsForPackage,
    packageItems,
    packageSideItems,
    catalogItems,
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
