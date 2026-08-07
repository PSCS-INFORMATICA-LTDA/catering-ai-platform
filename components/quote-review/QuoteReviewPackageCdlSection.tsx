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
}) {
  const itemsText = packageSummary?.packageItemsDescription?.trim() || '—'
  const garnishText = packageSummary?.garnishDescription?.trim() || 'Não inclusas'
  const additionalsText =
    additionalItems.length > 0
      ? additionalItems
          .map(
            (item) =>
              `${item.label} (${formatCurrency(item.amount)})`,
          )
          .join(' · ')
      : 'Nenhum'

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

  return (
    <div className="space-y-5">
      <SectionHeader title="Pacote CDL" subtitle={displayValue(packageName)} />
      <PackageHeroImage
        src={packageImageUrl}
        alt={packageName ?? 'Pacote'}
        fallbackLabel="Imagem do pacote não cadastrada"
      />
      {packageSelections.length > 0 ? (
        <div className="space-y-1">
          <p className="quote-proposal-package-detail">
            <span className="quote-proposal-package-detail-label font-bold">
              Escolhas inclusas:
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
      <PackageDetailLine label="Itens do pacote:" value={itemsText} />
      <PackageDetailLine label="Guarnições:" value={garnishText} />
      <PackageDetailLine label="Itens adicionais:" value={additionalsText} />
      <div className="quote-proposal-highlight-grid">
        <PackageValueCard
          label="Convidados físicos"
          value={formatCountOrDash(physicalGuestCount)}
        />
        <PackageValueCard
          label="Pessoas cobradas"
          value={formatCountOrDash(chargedPeople)}
        />
        <PackageValueCard
          label="Valor pacote base"
          value={formatMoneyOrDash(baseTotal)}
          subValue={
            baseUnit != null && chargedPeople != null && chargedPeople > 0
              ? `${formatCurrency(baseUnit)} × ${chargedPeople}`
              : undefined
          }
          variant="price"
        />
        <PackageValueCard
          label="Valor guarnições"
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
              : 'Não'
          }
          variant="price"
        />
        <PackageValueCard
          label="Total por pessoa"
          value={
            totalUnit != null ? `${formatCurrency(totalUnit)} / pessoa` : '—'
          }
          variant="price"
        />
        <PackageValueCard
          label="Total pacote"
          value={formatMoneyOrDash(grandTotal)}
          variant="grand-total"
        />
      </div>
    </div>
  )
}
