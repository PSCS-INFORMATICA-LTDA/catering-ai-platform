'use client'

import {
  calcAdditionalLineTotalForItem,
  getAdditionalImage,
  getAdditionalPackLabel,
  getAdditionalTotalWeight,
  getAdditionalUnitPrice,
  getLocalizedAdditionalLabel,
  isPerPersonAdditional,
  normalizeAdditionalQuantity,
  type QuoteAdditionalItem,
} from '@/Lib/quoteAdditionalDisplay'
import { getQuoteStrings } from '@/Lib/quoteTranslations'
import type { QuoteLanguage } from '@/Lib/quoteWizardTypes'

function formatCurrency(value: number) {
  return `$${value.toFixed(2)}`
}

function formatWeightUom(uom: string) {
  if (uom === 'LB') return 'lb'
  return uom.toLowerCase()
}

const SELECTED_CARD =
  'border-[var(--brand-primary-2)] bg-[color-mix(in_srgb,var(--brand-primary)_10%,white)] ring-1 ring-[color-mix(in_srgb,var(--brand-primary-2)_30%,transparent)]'

export default function AdditionalItemCard({
  item,
  quantity,
  billableGuestCount,
  language,
  onChangeQty,
}: {
  item: QuoteAdditionalItem
  quantity: number
  billableGuestCount: number
  language: QuoteLanguage
  onChangeQty: (qty: number) => void
}) {
  const t = getQuoteStrings(language)
  const image = getAdditionalImage(item)
  const label = getLocalizedAdditionalLabel(item, language)
  const unitPrice = getAdditionalUnitPrice(item)
  const perPerson = isPerPersonAdditional(item)
  const normalizedQty = normalizeAdditionalQuantity(item, quantity)
  const lineTotal = calcAdditionalLineTotalForItem(
    item,
    quantity,
    billableGuestCount,
  )
  const isSelected = normalizedQty > 0
  const totalWeight = getAdditionalTotalWeight(item, quantity)
  const packLabel = !perPerson ? getAdditionalPackLabel(item) : null
  const showPending =
    !image && item.image_status?.trim().toLowerCase() === 'missing'

  const cardClass = `grid h-full grid-cols-[5.75rem_minmax(0,1fr)] gap-3 rounded-2xl border bg-white p-2 shadow-sm transition sm:flex sm:flex-col sm:gap-0 ${
    isSelected ? SELECTED_CARD : 'border-neutral-200'
  }`

  const media = (
    <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-neutral-100">
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={image}
          alt={label}
          className="h-full w-full object-cover"
          loading="lazy"
          decoding="async"
        />
      ) : (
        <div className="flex h-full flex-col items-center justify-center px-1 text-center">
          <span className="text-[10px] font-semibold leading-tight text-neutral-500">
            {showPending ? t.photoPending : label}
          </span>
        </div>
      )}
      {isSelected ? (
        <span
          className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--brand-primary)] text-[10px] font-bold text-white"
          aria-hidden
        >
          ✓
        </span>
      ) : null}
    </div>
  )

  if (perPerson) {
    return (
      <article className={cardClass}>
        {media}
        <div className="flex min-w-0 flex-1 flex-col">
          <p className="line-clamp-2 text-sm font-bold leading-tight text-neutral-900 sm:mt-2 sm:line-clamp-3">
            {label}
          </p>
          <p className="mt-1 text-xs text-neutral-500">
            {formatCurrency(unitPrice)} / {t.perPerson}
          </p>
          {isSelected && billableGuestCount > 0 ? (
            <p className="mt-0.5 text-[11px] font-semibold text-[var(--brand-primary)]">
              {formatCurrency(lineTotal)}
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => onChangeQty(isSelected ? 0 : 1)}
            className={`mt-auto w-full rounded-xl px-2 py-2 text-xs font-bold transition ${
              isSelected
                ? 'bg-[var(--brand-primary)] text-white'
                : 'border border-neutral-200 bg-neutral-50 text-neutral-800 hover:border-neutral-300'
            }`}
          >
            {isSelected ? t.selected : t.select}
          </button>
        </div>
      </article>
    )
  }

  return (
    <article className={cardClass}>
      {media}
      <div className="flex min-w-0 flex-1 flex-col">
        <p className="line-clamp-2 text-sm font-bold leading-tight text-neutral-900 sm:mt-2 sm:line-clamp-3">
          {label}
        </p>
        <p className="mt-1 text-xs text-neutral-500">
          {formatCurrency(unitPrice)}
          {packLabel ? ` / ${packLabel}` : ''}
        </p>
        <div className="mt-auto flex items-center justify-between gap-1 pt-2">
          <button
            type="button"
            onClick={() => onChangeQty(normalizedQty - 1)}
            disabled={normalizedQty === 0}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-neutral-200 bg-neutral-50 text-base font-bold disabled:opacity-30"
            aria-label={t.removeUnit}
          >
            −
          </button>
          <div className="min-w-0 flex-1 text-center">
            <span className="text-sm font-bold text-neutral-900">
              {normalizedQty}
            </span>
            <p className="truncate text-[9px] font-semibold uppercase text-neutral-500">
              {item.unit_label ?? item.unit ?? 'UN'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onChangeQty(normalizedQty + 1)}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-neutral-200 bg-neutral-50 text-base font-bold"
            aria-label={t.addUnit}
          >
            +
          </button>
        </div>
        {isSelected ? (
          <div className="mt-1 text-center">
            <p className="text-[11px] font-bold text-[var(--brand-primary)]">
              {formatCurrency(lineTotal)}
            </p>
            {totalWeight ? (
              <p className="text-[10px] text-neutral-500">
                {t.totalWeight(
                  totalWeight.amount,
                  formatWeightUom(totalWeight.uom),
                )}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  )
}
