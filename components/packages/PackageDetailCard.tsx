'use client'

import Link from 'next/link'
import {
  BackofficeAccentBadge,
  BackofficeBtnDanger,
  BackofficeBtnOutline,
  BackofficeBtnSecondary,
  BackofficeMetaRow,
  BackofficeStatusBadge,
} from '@/components/backoffice/BackofficeCardPrimitives'
import { BackofficeInventoryButton } from '@/components/backoffice/BackofficeSectionPrimitives'
import CatalogImageFrame from '@/components/CatalogImageFrame'
import {
  ExpandableDescription,
  PremiumCard,
  PriceBreakdownCard,
} from '@/components/premium/PremiumPrimitives'
import type { PackageListItem } from '@/Lib/fetchPackages'
import {
  getPackageCurrencyCode,
  getPackageDisplayOrder,
  getPackageHasGarnish,
  getPackageImageUrl,
  getPackageKey,
  getPackageLabel,
  getPackagePrice,
} from '@/Lib/packageFieldAccess'
import {
  formatPackageItemsText,
  formatPackageSideItemsText,
  getPackageItemsForPackage,
  getPackageSideItemsForPackage,
  type PackageItem,
  type PackageSideItem,
} from '@/Lib/packageConfiguration'
import {
  getPackageGarnishDisplayText,
  getPackageItemsDisplayText,
  parsePackageHighlightsText,
} from '@/Lib/packageDisplay'
import {
  formatPackageOptionGroupsSummary,
  getPackageOptionGroupsForPackage,
  type PackageOptionGroupItem,
  type PackageOptionGroupRecord,
} from '@/Lib/packageOptionGroups'
import { tCommon } from '@/Lib/i18n/common'
import { tPackages } from '@/Lib/i18n/packages'
import { useAuthLocaleFromMe } from '@/Lib/i18n/useAuthLocaleFromMe'

function formatPrice(value: number, currency = 'USD') {
  return `${currency === 'USD' ? '$' : ''}${value.toFixed(2)}`
}

export default function PackageDetailCard({
  pkg,
  allPackages = [],
  packageItems = [],
  packageSideItems = [],
  packageOptionGroups = [],
  packageOptionGroupItems = [],
  onEdit,
  onPhoto,
  onDeactivate,
  uploading = false,
}: {
  pkg: PackageListItem
  allPackages?: PackageListItem[]
  packageItems?: PackageItem[]
  packageSideItems?: PackageSideItem[]
  packageOptionGroups?: PackageOptionGroupRecord[]
  packageOptionGroupItems?: PackageOptionGroupItem[]
  onEdit: () => void
  onPhoto: () => void
  onDeactivate: () => void
  uploading?: boolean
}) {
  const locale = useAuthLocaleFromMe()
  const packageKey = getPackageKey(pkg) || '—'
  const displayName = getPackageLabel(pkg, locale)
  const withSides = getPackageHasGarnish(pkg)
  const imageUrl = getPackageImageUrl(pkg)
  const currency = getPackageCurrencyCode(pkg)
  const price = getPackagePrice(pkg)
  const configuredItemsForPackage = getPackageItemsForPackage(pkg.id, packageItems)
  const configuredSidesForPackage = getPackageSideItemsForPackage(
    pkg.id,
    packageSideItems,
  )
  const itemsText =
    configuredItemsForPackage.length > 0
      ? formatPackageItemsText(configuredItemsForPackage, locale)
      : getPackageItemsDisplayText(pkg, locale)
  const garnishText =
    configuredSidesForPackage.length > 0
      ? formatPackageSideItemsText(configuredSidesForPackage, locale)
      : getPackageGarnishDisplayText(pkg, locale)
  const highlightItems = parsePackageHighlightsText(pkg.package_highlights_pt)
  const optionGroupSummaries = formatPackageOptionGroupsSummary(
    getPackageOptionGroupsForPackage(
      pkg.id,
      packageOptionGroups,
      packageOptionGroupItems,
    ),
    locale,
  )

  let basePrice = price
  let garnishAddon = 0
  if (withSides && packageKey.endsWith('+')) {
    const baseKey = packageKey.replace(/\+$/, '')
    const basePkg = allPackages.find((row) => getPackageKey(row) === baseKey)
    if (basePkg) {
      basePrice = getPackagePrice(basePkg)
      garnishAddon = Math.max(0, price - basePrice)
    }
  }

  return (
    <PremiumCard className="overflow-hidden">
      <div className="aspect-[4/3] w-full bg-neutral-50 sm:aspect-[16/10]">
        <CatalogImageFrame
          src={imageUrl}
          alt={displayName}
          variant="package"
          fallbackLabel={tCommon(locale, 'noImageRegistered')}
          rounded="none"
          className="!h-full !min-h-0 !max-h-none !w-full !rounded-none"
        />
      </div>

      <div className="space-y-5 p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">
            {packageKey}
          </span>
          {withSides ? (
            <BackofficeAccentBadge>{tCommon(locale, 'withSides')}</BackofficeAccentBadge>
          ) : (
            <BackofficeAccentBadge>{tCommon(locale, 'withoutSides')}</BackofficeAccentBadge>
          )}
          <BackofficeStatusBadge active={pkg.active !== false} />
        </div>

        <div>
          <h3 className="text-2xl font-black text-neutral-900">{displayName}</h3>
          <p className="mt-2 text-3xl font-black text-red-600">
            {formatPrice(price, currency)}
            <span className="ml-1 text-sm font-semibold text-neutral-500">
              {tPackages(locale, 'perPersonSuffix')}
            </span>
          </p>
        </div>

        {highlightItems.length > 0 ? (
          <div className="package-highlights-box !mt-0">
            <p className="package-highlights-title">{tPackages(locale, 'highlights')}</p>
            <div className="package-highlights-list">
              {highlightItems.map((item) => (
                <span key={item}>• {item}</span>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-neutral-100 bg-neutral-50 px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-wide text-neutral-500">
              {tPackages(locale, 'highlights')}
            </p>
            <p className="mt-1 text-sm text-neutral-400">
              {tPackages(locale, 'highlightsEmpty')}
            </p>
          </div>
        )}

        <PriceBreakdownCard
          rows={[
            {
              label: tPackages(locale, 'basePackage'),
              value: tPackages(locale, 'pricePerPerson', {
                price: formatPrice(basePrice, currency),
              }),
            },
            {
              label: tCommon(locale, 'sides'),
              value:
                garnishAddon > 0
                  ? tPackages(locale, 'sidesAddon', {
                      price: formatPrice(garnishAddon, currency),
                    })
                  : withSides
                    ? tPackages(locale, 'sidesIncluded')
                    : tCommon(locale, 'no'),
            },
            {
              label: tPackages(locale, 'totalPerPerson'),
              value: tPackages(locale, 'pricePerPerson', {
                price: formatPrice(price, currency),
              }),
              emphasis: true,
            },
            {
              label: tCommon(locale, 'currency'),
              value: currency,
            },
          ]}
        />

        <ExpandableDescription
          label={tPackages(locale, 'packageItems')}
          text={itemsText || '—'}
        />
        <ExpandableDescription label={tCommon(locale, 'sides')} text={garnishText} />
        {optionGroupSummaries.length > 0 ? (
          <div className="rounded-xl border border-amber-100 bg-amber-50/50 px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-wide text-amber-900">
              {tPackages(locale, 'includedChoices')}
            </p>
            <ul className="mt-2 space-y-1 text-sm text-neutral-800">
              {optionGroupSummaries.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="rounded-xl border border-neutral-100 bg-white p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-red-600">
            {tPackages(locale, 'operation')}
          </p>
          <div className="mt-3 space-y-1">
            <BackofficeMetaRow
              label={tCommon(locale, 'displayOrder')}
              value={getPackageDisplayOrder(pkg)}
            />
            <BackofficeMetaRow
              label={tCommon(locale, 'status')}
              value={
                pkg.active === false
                  ? tCommon(locale, 'inactive')
                  : tCommon(locale, 'active')
              }
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2 border-t border-neutral-100 pt-4">
          <BackofficeBtnSecondary onClick={onEdit}>
            {tCommon(locale, 'edit')}
          </BackofficeBtnSecondary>
          <BackofficeBtnOutline accent onClick={onPhoto} disabled={uploading}>
            {uploading ? tCommon(locale, 'uploading') : tCommon(locale, 'photo')}
          </BackofficeBtnOutline>
          <Link
            href="/commercial-rules"
            className="inline-flex min-h-[40px] items-center justify-center rounded-xl border border-neutral-300 bg-white px-4 py-2 text-sm font-bold text-neutral-800 transition hover:bg-neutral-50"
          >
            {tPackages(locale, 'rules')}
          </Link>
          <BackofficeInventoryButton source="package" id={pkg.id} />
          {pkg.active !== false ? (
            <BackofficeBtnDanger onClick={onDeactivate}>
              {tCommon(locale, 'deactivate')}
            </BackofficeBtnDanger>
          ) : null}
        </div>
      </div>
    </PremiumCard>
  )
}
