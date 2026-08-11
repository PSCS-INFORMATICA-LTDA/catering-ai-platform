'use client'

import type { ReactNode } from 'react'
import PackageHeroImage from '@/components/quotes/PackageHeroImage'
import { SectionHeader } from '@/components/premium/PremiumPrimitives'
import {
  formatCountOrDash,
  formatMoneyOrDash,
} from '@/Lib/readQuoteSnapshot'
import { displayValue, formatCurrency } from '@/app/quotes/[id]/quoteDetailTypes'
import type { PackageSelectionLabel } from '@/Lib/packageOptionGroups'
import type { QuoteReviewPackageSummary } from './quoteReviewPackageSummary'
import { tw } from '@/Lib/quoteTranslations'
import type { QuoteLanguage } from '@/Lib/quoteWizardTypes'

function PackageDetailLine({
  label,
  value,
}: {
  label: string
  value: ReactNode
}) {
  return (
    <p className="quote-proposal-package-detail">
      <span className="quote-proposal-package-detail-label font-bold">{label}</span>{' '}
      {value}
    </p>
  )
}

function PackageValueCard({
  label,
  value,
  subValue,
  variant = 'default',
}: {
  label: string
  value: ReactNode
  subValue?: ReactNode
  variant?: 'default' | 'price' | 'grand-total'
}) {
  const variantClass =
    variant === 'grand-total'
      ? ' quote-proposal-highlight-card--grand-total'
      : variant === 'price'
        ? ' quote-proposal-highlight-card--price'
        : ''

  return (
    <div className={`quote-proposal-highlight-card${variantClass}`}>
      <span className="quote-proposal-label">{label}</span>
      <p className="quote-proposal-highlight-value">{value}</p>
      {subValue ? (
        <p className="quote-proposal-muted mt-1 text-xs">{subValue}</p>
      ) : null}
    </div>
  )
}

type PackageValueCardsProps = {
  packageSummary?: QuoteReviewPackageSummary | null
  physicalGuestCount: number | null
  billableGuestCount: number | null
  packageTotal: number | null
  packageUnitPrice: number | null
  additionalTotal?: number | null
  mileageFee?: number | null
  language?: QuoteLanguage | string | null
}

export function QuoteReviewPackageValueCards({
  packageSummary,
  physicalGuestCount,
  billableGuestCount,
  packageTotal,
  packageUnitPrice,
  additionalTotal = null,
  mileageFee = null,
  language = 'pt',
}: PackageValueCardsProps) {
  const loc: QuoteLanguage =
    language === 'en' || language === 'es' ? language : 'pt'
  const chargedPeople = packageSummary?.chargedPeople ?? billableGuestCount
  const baseUnit = packageSummary?.packageUnitPrice ?? packageUnitPrice
  const baseTotal =
    packageSummary?.packageTotalPrice ??
    (baseUnit != null && chargedPeople != null
      ? baseUnit * chargedPeople
      : packageTotal)
  const garnishUnit = packageSummary?.hasGarnish
    ? packageSummary.garnishUnitPrice
    : 0
  const garnishTotal = packageSummary?.hasGarnish
    ? packageSummary.garnishTotalPrice
    : 0
  const totalUnit = packageSummary?.totalUnitPrice ?? packageUnitPrice
  const grandTotal = packageSummary?.grandTotalPrice ?? packageTotal
  const additionalAmount = Number(additionalTotal ?? 0)
  const mileageAmount = Number(mileageFee ?? 0)
  const showMileage = mileageAmount > 0

  return (
    <div
      className={`quote-proposal-highlight-grid${
        showMileage ? ' quote-proposal-highlight-grid--dense' : ''
      }`}
    >
      <PackageValueCard
        label={tw(loc, 'physicalGuests')}
        value={formatCountOrDash(physicalGuestCount)}
      />
      <PackageValueCard
        label={tw(loc, 'billedPeople')}
        value={formatCountOrDash(chargedPeople)}
      />
      <PackageValueCard
        label={tw(loc, 'basePackageValue')}
        value={formatMoneyOrDash(baseTotal)}
        subValue={
          baseUnit != null && chargedPeople != null && chargedPeople > 0
            ? `${formatCurrency(baseUnit)} × ${chargedPeople}`
            : undefined
        }
        variant="price"
      />
      <PackageValueCard
        label={tw(loc, 'garnishValue')}
        value={
          packageSummary?.hasGarnish
            ? formatMoneyOrDash(garnishTotal)
            : '$0.00'
        }
        subValue={
          packageSummary?.hasGarnish
            ? garnishUnit > 0 && chargedPeople != null && chargedPeople > 0
              ? `${formatCurrency(garnishUnit)} × ${chargedPeople}`
              : undefined
            : tw(loc, 'no')
        }
        variant="price"
      />
      <PackageValueCard
        label={tw(loc, 'additionalValue')}
        value={formatMoneyOrDash(additionalAmount)}
        variant="price"
      />
      <PackageValueCard
        label={tw(loc, 'totalPerPerson')}
        value={totalUnit != null ? formatCurrency(totalUnit) : '—'}
        variant="price"
      />
      {showMileage ? (
        <PackageValueCard
          label={tw(loc, 'mileageValue')}
          value={formatMoneyOrDash(mileageAmount)}
          variant="price"
        />
      ) : null}
      <PackageValueCard
        label={tw(loc, 'packageTotal')}
        value={formatMoneyOrDash(grandTotal)}
        variant="grand-total"
      />
    </div>
  )
}

export default function QuoteReviewPackageCdlSection({
  packageName,
  packageImageUrl,
  packageSummary,
  packageSelections = [],
  additionalItems = [],
  physicalGuestCount,
  billableGuestCount,
  packageTotal,
  packageUnitPrice,
  additionalTotal = null,
  mileageFee = null,
  language = 'pt',
  showHeroImage = true,
  showValueCards = true,
}: {
  packageName: string | null
  packageImageUrl?: string | null
  packageSummary?: QuoteReviewPackageSummary | null
  packageSelections?: PackageSelectionLabel[]
  additionalItems?: Array<{ label: string; amount: number }>
  physicalGuestCount: number | null
  billableGuestCount: number | null
  packageTotal: number | null
  packageUnitPrice: number | null
  additionalTotal?: number | null
  mileageFee?: number | null
  language?: QuoteLanguage | string | null
  showHeroImage?: boolean
  showValueCards?: boolean
}) {
  const loc: QuoteLanguage =
    language === 'en' || language === 'es' ? language : 'pt'
  const itemsText = packageSummary?.packageItemsDescription?.trim() || '—'
  const garnishText =
    packageSummary?.garnishDescription?.trim() || tw(loc, 'notIncluded')
  const additionalsText =
    additionalItems.length > 0
      ? additionalItems
          .map(
            (item) =>
              `${item.label} (${formatCurrency(item.amount)})`,
          )
          .join(' · ')
      : tw(loc, 'none')

  const details = (
    <div className="quote-proposal-package-split-main">
      {showHeroImage && packageImageUrl?.trim() ? (
        <PackageHeroImage
          src={packageImageUrl}
          alt={packageName ?? tw(loc, 'packageSummary')}
          fallbackLabel={tw(loc, 'packageImageMissing')}
          compact
          expand={false}
        />
      ) : null}
      {packageSelections.length > 0 ? (
        <div className="space-y-1">
          <p className="quote-proposal-package-detail">
            <span className="quote-proposal-package-detail-label font-bold">
              {tw(loc, 'includedChoices')}
            </span>
          </p>
          <ul className="ml-4 list-disc text-sm text-neutral-700">
            {packageSelections.map((selection) => (
              <li key={selection.groupId}>
                {selection.groupTitle}: {selection.itemLabel}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <PackageDetailLine label={tw(loc, 'packageItems')} value={itemsText} />
      <PackageDetailLine label={tw(loc, 'garnish')} value={garnishText} />
      <PackageDetailLine
        label={tw(loc, 'additionalItems')}
        value={additionalsText}
      />
    </div>
  )

  const resolvedAdditionalTotal =
    additionalTotal ??
    additionalItems.reduce((sum, item) => sum + Number(item.amount ?? 0), 0)

  const valueCards = (
    <QuoteReviewPackageValueCards
      packageSummary={packageSummary}
      physicalGuestCount={physicalGuestCount}
      billableGuestCount={billableGuestCount}
      packageTotal={packageTotal}
      packageUnitPrice={packageUnitPrice}
      additionalTotal={resolvedAdditionalTotal}
      mileageFee={mileageFee}
      language={loc}
    />
  )

  return (
    <div className="space-y-5">
      <SectionHeader
        title={tw(loc, 'packageSummary')}
        subtitle={displayValue(packageName)}
      />
      {showValueCards ? (
        <div className="quote-proposal-package-split">
          {details}
          {valueCards}
        </div>
      ) : (
        details
      )}
    </div>
  )
}
