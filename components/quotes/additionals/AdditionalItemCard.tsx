'use client'

import { getAdditionalItemCategoryKey } from '@/Lib/additionalItemFieldAccess'
import {
  getPublicAdditionalImageObjectPosition,
  isGrillRentalAdditional,
} from '@/Lib/publicQuote/grillRentalDisplay'
import {
  calcAdditionalLineTotalForItem,
  formatAdditionalPrice,
  getAdditionalChargeUnitLabel,
  getAdditionalImage,
  getAdditionalPackLabel,
  getAdditionalPriceLabel,
  getAdditionalTotalWeight,
  getLocalizedAdditionalLabel,
  isPerPersonAdditional,
  normalizeAdditionalQuantity,
  type QuoteAdditionalItem,
} from '@/Lib/quoteAdditionalDisplay'
import { getCategoryLabel, getQuoteStrings } from '@/Lib/quoteTranslations'
import type { QuoteLanguage } from '@/Lib/quoteWizardTypes'

const formatCurrency = formatAdditionalPrice

function formatWeightUom(uom: string) {
  if (uom === 'LB') return 'lb'
  return uom.toLowerCase()
}

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
  const imagePosition = getPublicAdditionalImageObjectPosition(item)
  const grillCrop = isGrillRentalAdditional(item)
  const label = getLocalizedAdditionalLabel(item, language)
  const priceLabel = getAdditionalPriceLabel(item, language)
  const chargeUnitLabel = getAdditionalChargeUnitLabel(item, language)
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
  const categoryKey = getAdditionalItemCategoryKey(item)
  const categoryKicker = categoryKey
    ? getCategoryLabel(categoryKey, language)
    : null

  const cardClass = `public-additional-card grid grid-cols-[7.5rem_minmax(0,1fr)] ${
    isSelected ? 'is-selected' : ''
  }`

  const media = (
    <div
      className="public-additional-card-media bg-neutral-100"
      data-additional-image-crop={grillCrop ? 'operational-grill' : undefined}
    >
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={image}
          alt={label}
          className="h-full w-full object-cover"
          style={imagePosition ? { objectPosition: imagePosition } : undefined}
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
          className="public-additional-card-check"
          aria-hidden
        >
          ✓
        </span>
      ) : null}
    </div>
  )

  const copy = (
    <>
      {categoryKicker ? (
        <p className="public-additional-card-kicker">{categoryKicker}</p>
      ) : null}
      <p className="public-additional-card-name">{label}</p>
      <div className="public-additional-card-price">
        <span className="public-additional-card-price-kicker">
          {t.wizard.additionalPriceKicker}
        </span>
        <span className="public-additional-card-price-value">{priceLabel}</span>
        <span className="public-additional-card-price-unit">
          {packLabel ?? chargeUnitLabel}
        </span>
      </div>
    </>
  )

  if (perPerson) {
    return (
      <article data-additional-item-card className={cardClass}>
        {media}
        <div className="public-additional-card-body">
          {copy}
          {isSelected && billableGuestCount > 0 ? (
            <p className="public-additional-card-line-total">
              {formatCurrency(lineTotal)}
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => onChangeQty(isSelected ? 0 : 1)}
            className={`public-additional-card-select ${
              isSelected ? 'is-on' : ''
            }`}
          >
            {isSelected ? t.selected : t.select}
          </button>
        </div>
      </article>
    )
  }

  return (
    <article data-additional-item-card className={cardClass}>
      {media}
      <div className="public-additional-card-body">
        {copy}
        {/* The stepper number was unlabelled; per-person cards keep a button. */}
        <span
          data-additional-qty-label
          className="public-additional-card-qty-label"
        >
          {t.wizard.additionalQuantityLabel}
        </span>
        <div className="public-additional-qty">
          <button
            type="button"
            onClick={() => onChangeQty(normalizedQty - 1)}
            disabled={normalizedQty === 0}
            className="public-additional-qty-btn"
            aria-label={t.removeUnit}
          >
            −
          </button>
          <div className="min-w-0 flex-1 text-center">
            <span className="text-sm font-black text-[#111]">{normalizedQty}</span>
            <p className="truncate text-[9px] font-semibold uppercase text-neutral-500">
              {item.unit_label ?? item.unit ?? 'UN'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onChangeQty(normalizedQty + 1)}
            className="public-additional-qty-btn"
            aria-label={t.addUnit}
          >
            +
          </button>
        </div>
        {isSelected ? (
          <div className="mt-1 text-center">
            <p className="public-additional-card-line-total">
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
