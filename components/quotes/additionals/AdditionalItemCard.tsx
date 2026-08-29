'use client'

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { createPortal } from 'react-dom'
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
  getAdditionalPriceLabel,
  getAdditionalTotalWeight,
  getAdditionalWeightPerUnit,
  getLocalizedAdditionalLabel,
  isPerPersonAdditional,
  normalizeAdditionalQuantity,
  type QuoteAdditionalItem,
} from '@/Lib/quoteAdditionalDisplay'
import { getCategoryLabel, getQuoteStrings } from '@/Lib/quoteTranslations'
import type { QuoteLanguage } from '@/Lib/quoteWizardTypes'

const formatCurrency = formatAdditionalPrice

const LONG_PRESS_MS = 420
const MOVE_CANCEL_PX = 12

function AdditionalPhotoLightbox({
  src,
  alt,
  onClose,
}: {
  src: string
  alt: string
  onClose: () => void
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previous
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  return createPortal(
    <div
      className="public-additional-photo-lightbox"
      data-additional-photo-lightbox
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      onClick={onClose}
    >
      <button
        type="button"
        className="public-additional-photo-lightbox-close"
        aria-label="Close"
        onClick={onClose}
      >
        ×
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className="public-additional-photo-lightbox-image"
        onClick={(event) => event.stopPropagation()}
      />
    </div>,
    document.body,
  )
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
  const totalWeight =
    !perPerson && normalizedQty > 1
      ? getAdditionalTotalWeight(item, quantity)
      : null
  const weightPerUnit = !perPerson ? getAdditionalWeightPerUnit(item) : null
  const showPending =
    !image && item.image_status?.trim().toLowerCase() === 'missing'
  const categoryKey = getAdditionalItemCategoryKey(item)
  const categoryKicker = categoryKey
    ? getCategoryLabel(categoryKey, language)
    : null

  const cardClass = `public-additional-card grid grid-cols-[7.5rem_minmax(0,1fr)] ${
    isSelected ? 'is-selected' : ''
  }`
  const [previewOpen, setPreviewOpen] = useState(false)
  const pressRef = useRef<{
    timer: number | null
    x: number
    y: number
    opened: boolean
  } | null>(null)

  const closePreview = useCallback(() => setPreviewOpen(false), [])

  function clearPress() {
    const press = pressRef.current
    if (press?.timer) window.clearTimeout(press.timer)
    pressRef.current = null
  }

  useEffect(() => {
    const cancel = () => clearPress()
    window.addEventListener('scroll', cancel, true)
    return () => window.removeEventListener('scroll', cancel, true)
  }, [])

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (!image || event.button !== 0) return
    const isMouse = event.pointerType === 'mouse'
    pressRef.current = {
      timer: isMouse
        ? null
        : window.setTimeout(() => {
            if (!pressRef.current) return
            pressRef.current.opened = true
            pressRef.current.timer = null
            setPreviewOpen(true)
          }, LONG_PRESS_MS),
      x: event.clientX,
      y: event.clientY,
      opened: false,
    }
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const press = pressRef.current
    if (!press) return
    if (Math.hypot(event.clientX - press.x, event.clientY - press.y) > MOVE_CANCEL_PX) {
      clearPress()
    }
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    const press = pressRef.current
    if (!press) return
    const opened = press.opened
    const isMouse = event.pointerType === 'mouse'
    const moved =
      Math.hypot(event.clientX - press.x, event.clientY - press.y) > MOVE_CANCEL_PX
    clearPress()
    if (isMouse && !opened && !moved) setPreviewOpen(true)
  }

  const media = (
    <div
      className="public-additional-card-media bg-neutral-100"
      data-additional-image-crop={grillCrop ? 'operational-grill' : undefined}
      data-additional-photo={image ? '' : undefined}
      onPointerDown={image ? handlePointerDown : undefined}
      onPointerMove={image ? handlePointerMove : undefined}
      onPointerUp={image ? handlePointerUp : undefined}
      onPointerCancel={image ? clearPress : undefined}
      onPointerLeave={image ? clearPress : undefined}
      onContextMenu={
        image
          ? (event) => {
              event.preventDefault()
            }
          : undefined
      }
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
          draggable={false}
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
      {previewOpen && image ? (
        <AdditionalPhotoLightbox src={image} alt={label} onClose={closePreview} />
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
          {chargeUnitLabel}
        </span>
      </div>
      {weightPerUnit ? (
        <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-600">
          {t.weightPerUnit}
          <span className="ml-1 font-bold normal-case text-neutral-900">
            {weightPerUnit.label}
          </span>
        </p>
      ) : null}
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
            className="public-additional-qty-btn is-minus"
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
            className="public-additional-qty-btn is-plus"
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
                {t.estimatedTotalWeight}: {totalWeight.amount} {totalWeight.uom}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  )
}
