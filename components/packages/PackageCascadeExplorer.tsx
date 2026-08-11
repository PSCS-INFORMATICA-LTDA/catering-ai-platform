'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  BackofficeCascadeLayout,
  BackofficeCascadeListButton,
  BackofficeCascadePanel,
} from '@/components/backoffice/BackofficeSectionPrimitives'
import PackageDetailCard from '@/components/packages/PackageDetailCard'
import {
  PremiumChip,
  PremiumGroupBlock,
  PremiumMetricCard,
  SectionHeader,
} from '@/components/premium/PremiumPrimitives'
import type { PackageListItem } from '@/Lib/fetchPackages'
import {
  getPackageItemsForPackage,
  getPackageSideItemsForPackage,
  type PackageItem,
  type PackageSideItem,
} from '@/Lib/packageConfiguration'
import type {
  PackageOptionGroupItem,
  PackageOptionGroupRecord,
} from '@/Lib/packageOptionGroups'
import { splitPackagesByGarnish } from '@/Lib/packageCatalogAdmin'
import { getPackageGroupSummaryCodes } from '@/Lib/packageDisplay'
import {
  getPackageHasGarnish,
  getPackageKey,
  getPackageLabel,
} from '@/Lib/packageFieldAccess'
import { tCommon } from '@/Lib/i18n/common'
import { tPackages } from '@/Lib/i18n/packages'
import { useAuthLocaleFromMe } from '@/Lib/i18n/useAuthLocaleFromMe'

type GarnishGroup = 'without' | 'with'
type MobileStep = 'groups' | 'codes' | 'detail'

export default function PackageCascadeExplorer({
  packages,
  packageItems = [],
  packageSideItems = [],
  packageOptionGroups = [],
  packageOptionGroupItems = [],
  onEdit,
  onPhoto,
  onDeactivate,
  uploadingId,
}: {
  packages: PackageListItem[]
  packageItems?: PackageItem[]
  packageSideItems?: PackageSideItem[]
  packageOptionGroups?: PackageOptionGroupRecord[]
  packageOptionGroupItems?: PackageOptionGroupItem[]
  onEdit: (pkg: PackageListItem) => void
  onPhoto: (pkg: PackageListItem) => void
  onDeactivate: (pkg: PackageListItem) => void
  uploadingId?: string | null
}) {
  const locale = useAuthLocaleFromMe()
  const { withoutGarnish, withGarnish } = useMemo(
    () => splitPackagesByGarnish(packages),
    [packages],
  )

  const [selectedGroup, setSelectedGroup] = useState<GarnishGroup | null>(null)
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null)
  const [mobileStep, setMobileStep] = useState<MobileStep>('groups')

  const groupPackages =
    selectedGroup === 'with'
      ? withGarnish
      : selectedGroup === 'without'
        ? withoutGarnish
        : []

  const selectedPackage = useMemo(
    () => packages.find((pkg) => pkg.id === selectedPackageId) ?? null,
    [packages, selectedPackageId],
  )

  const metrics = useMemo(() => {
    const active = packages.filter((pkg) => pkg.active !== false).length
    const inactive = packages.length - active
    return {
      total: packages.length,
      withGarnish: withGarnish.length,
      withoutGarnish: withoutGarnish.length,
      active,
      inactive,
    }
  }, [packages, withGarnish.length, withoutGarnish.length])

  useEffect(() => {
    if (packages.length === 0) {
      setSelectedGroup(null)
      setSelectedPackageId(null)
      return
    }
    if (!selectedGroup) {
      setSelectedGroup(withoutGarnish.length > 0 ? 'without' : 'with')
    }
  }, [packages.length, selectedGroup, withoutGarnish.length])

  useEffect(() => {
    if (groupPackages.length === 0) {
      setSelectedPackageId(null)
      return
    }
    if (!selectedPackageId || !groupPackages.some((pkg) => pkg.id === selectedPackageId)) {
      setSelectedPackageId(groupPackages[0].id)
    }
  }, [groupPackages, selectedPackageId])

  function selectGroup(group: GarnishGroup) {
    setSelectedGroup(group)
    setMobileStep('codes')
    const list = group === 'with' ? withGarnish : withoutGarnish
    setSelectedPackageId(list[0]?.id ?? null)
  }

  function selectPackage(id: string) {
    setSelectedPackageId(id)
    setMobileStep('detail')
  }

  const showGroups = mobileStep === 'groups'
  const showCodes = mobileStep === 'codes'
  const showDetail = mobileStep === 'detail'

  if (packages.length === 0) {
    return null
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title={tPackages(locale, 'catalogTitle')}
        subtitle={tPackages(locale, 'catalogSubtitle')}
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <PremiumMetricCard
          label={tPackages(locale, 'metricTotal')}
          value={metrics.total}
          accent="red"
        />
        <PremiumMetricCard
          label={tCommon(locale, 'withoutSides')}
          value={metrics.withoutGarnish}
          hint={getPackageGroupSummaryCodes(withoutGarnish)}
        />
        <PremiumMetricCard
          label={tCommon(locale, 'withSides')}
          value={metrics.withGarnish}
          hint={getPackageGroupSummaryCodes(withGarnish)}
          accent="gold"
        />
        <PremiumMetricCard
          label={tCommon(locale, 'actives')}
          value={metrics.active}
          accent="green"
        />
        <PremiumMetricCard
          label={tCommon(locale, 'inactives')}
          value={metrics.inactive}
        />
      </div>

      <BackofficeCascadeLayout>
        <div
          className={
            showGroups ? 'block lg:col-span-3' : 'hidden lg:block lg:col-span-3'
          }
        >
          <BackofficeCascadePanel
            title={tCommon(locale, 'groups')}
            subtitle={tPackages(locale, 'groupsSubtitle')}
          >
            <div className="space-y-3">
              <PremiumGroupBlock
                title={tCommon(locale, 'withoutSides')}
                count={withoutGarnish.length}
                summary={getPackageGroupSummaryCodes(withoutGarnish)}
                active={selectedGroup === 'without'}
                onClick={() => selectGroup('without')}
              />
              <PremiumGroupBlock
                title={tCommon(locale, 'withSides')}
                count={withGarnish.length}
                summary={getPackageGroupSummaryCodes(withGarnish)}
                active={selectedGroup === 'with'}
                onClick={() => selectGroup('with')}
              />
            </div>
          </BackofficeCascadePanel>
        </div>

        <div
          className={
            showCodes ? 'block lg:col-span-3' : 'hidden lg:block lg:col-span-3'
          }
        >
          <BackofficeCascadePanel
            title={
              selectedGroup === 'with'
                ? tCommon(locale, 'withSides')
                : tCommon(locale, 'withoutSides')
            }
            subtitle={tPackages(locale, 'codesCount', {
              count: groupPackages.length,
            })}
            onBack={() => setMobileStep('groups')}
          >
            <div className="mb-4 flex flex-wrap gap-2">
              {groupPackages.map((pkg) => {
                const code = getPackageKey(pkg)
                const active = selectedPackageId === pkg.id
                return (
                  <PremiumChip
                    key={pkg.id}
                    active={active}
                    onClick={() => selectPackage(pkg.id)}
                    badge={
                      getPackageHasGarnish(pkg) ? (
                        <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
                          {tCommon(locale, 'plusSides')}
                        </span>
                      ) : undefined
                    }
                  >
                    {code}
                  </PremiumChip>
                )
              })}
            </div>
            <div className="space-y-2">
              {groupPackages.map((pkg) => (
                <BackofficeCascadeListButton
                  key={pkg.id}
                  active={selectedPackageId === pkg.id}
                  onClick={() => selectPackage(pkg.id)}
                >
                  <span>{getPackageKey(pkg)}</span>
                  <span className="text-xs text-neutral-400">
                    {getPackageLabel(pkg)}
                  </span>
                </BackofficeCascadeListButton>
              ))}
            </div>
          </BackofficeCascadePanel>
        </div>

        <div
          className={
            showDetail ? 'block lg:col-span-6' : 'hidden lg:block lg:col-span-6'
          }
        >
          {selectedPackage ? (
            <div>
              <button
                type="button"
                onClick={() => setMobileStep('codes')}
                className="mb-3 text-xs font-bold uppercase tracking-wider text-red-600 lg:hidden"
              >
                {tPackages(locale, 'backToCodes')}
              </button>
              <PackageDetailCard
                pkg={selectedPackage}
                allPackages={packages}
                packageItems={getPackageItemsForPackage(
                  selectedPackage.id,
                  packageItems,
                )}
                packageSideItems={getPackageSideItemsForPackage(
                  selectedPackage.id,
                  packageSideItems,
                )}
                packageOptionGroups={packageOptionGroups}
                packageOptionGroupItems={packageOptionGroupItems}
                onEdit={() => onEdit(selectedPackage)}
                onPhoto={() => onPhoto(selectedPackage)}
                onDeactivate={() => onDeactivate(selectedPackage)}
                uploading={uploadingId === selectedPackage.id}
              />
            </div>
          ) : (
            <BackofficeCascadePanel
              title={tCommon(locale, 'detail')}
              subtitle={tPackages(locale, 'selectPackage')}
              className="!col-span-full"
              onBack={() => setMobileStep('codes')}
            >
              <p className="text-sm text-neutral-500">
                {tPackages(locale, 'selectPackageHint')}
              </p>
            </BackofficeCascadePanel>
          )}
        </div>
      </BackofficeCascadeLayout>
    </div>
  )
}
