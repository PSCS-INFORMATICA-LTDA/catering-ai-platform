'use client'

import { useEffect, useRef } from 'react'
import AdditionalItemCard from '@/components/quotes/additionals/AdditionalItemCard'
import {
  ADDITIONAL_CATEGORY_EXPOSE_FALLBACK_BOTTOM_PX,
  ADDITIONAL_CATEGORY_EXPOSE_ZONE,
  getAdditionalCategoryExposeRootMargin,
  isAdditionalCategorySentinelInView,
  shouldExposeAdditionalCategory,
} from '@/Lib/additionalCategoryExposure'
import {
  getAdditionalChargeUnitLabel,
  getAdditionalPriceLabel,
  getLocalizedAdditionalLabel,
  type QuoteAdditionalItem,
} from '@/Lib/quoteAdditionalDisplay'
import { getQuoteStrings } from '@/Lib/quoteTranslations'
import type { QuoteLanguage } from '@/Lib/quoteWizardTypes'

function CategoryHeaderCopy({
  kicker,
  categoryLabel,
  itemCountLabel,
  selectedCount,
  selectedCountLabel,
  expanded,
}: {
  kicker: string
  categoryLabel: string
  itemCountLabel: string
  selectedCount: number
  selectedCountLabel: string
  expanded: boolean
}) {
  return (
    <div className="flex min-w-0 items-start gap-3">
      <div className="min-w-0 flex-1">
        <p className="public-additional-kicker">{kicker}</p>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-base font-black uppercase tracking-wide text-[#111] sm:text-lg">
            {categoryLabel}
          </span>
          <span className="text-sm font-medium text-cdl-muted">
            {itemCountLabel}
          </span>
        </div>
        {selectedCount > 0 ? (
          <div className="mt-2">
            <span className="rounded-full bg-[var(--brand-primary)] px-2.5 py-0.5 text-xs font-bold text-white">
              {selectedCountLabel}
            </span>
          </div>
        ) : null}
      </div>
      <span
        className="mt-1 shrink-0 text-sm text-[var(--brand-primary)]"
        aria-hidden
      >
        {expanded ? '▲' : '▼'}
      </span>
    </div>
  )
}

function FeaturedCategoryHeaderCopy({
  title,
  lead,
  body,
  close,
  itemCountLabel,
  selectedCount,
  selectedCountLabel,
}: {
  title: string
  lead: string
  body: string
  close: string
  itemCountLabel: string
  selectedCount: number
  selectedCountLabel: string
}) {
  return (
    <div className="flex min-w-0 items-start gap-3">
      <div className="min-w-0 flex-1">
        <p className="public-suggested-extras-title">{title}</p>
        <p className="public-suggested-extras-lead">{lead}</p>
        <p className="public-suggested-extras-body">{body}</p>
        <p className="public-suggested-extras-close">{close}</p>
        <p className="public-suggested-extras-count">{itemCountLabel}</p>
        {selectedCount > 0 ? (
          <div className="mt-2">
            <span className="public-suggested-extras-selected">
              {selectedCountLabel}
            </span>
          </div>
        ) : null}
      </div>
      <span
        className="public-suggested-extras-chevron mt-1 shrink-0"
        aria-hidden
      >
        ▲
      </span>
    </div>
  )
}

export default function AdditionalCategorySection({
  categoryKey,
  categoryLabel,
  items,
  expanded,
  selectedCount,
  visited,
  emphasize = false,
  featured = false,
  quantities,
  billableGuestCount,
  language,
  exposeEpoch = 0,
  ctaReservePx = ADDITIONAL_CATEGORY_EXPOSE_FALLBACK_BOTTOM_PX,
  onToggle,
  onExpose,
  onChangeQty,
}: {
  categoryKey: string
  categoryLabel: string
  items: QuoteAdditionalItem[]
  expanded: boolean
  selectedCount: number
  visited: boolean
  emphasize?: boolean
  featured?: boolean
  quantities: Record<string, number>
  billableGuestCount: number
  language: QuoteLanguage
  exposeEpoch?: number
  ctaReservePx?: number
  onToggle: () => void
  onExpose: () => void
  onChangeQty: (itemId: string, qty: number) => void
}) {
  const t = getQuoteStrings(language)
  const sentinelRef = useRef<HTMLSpanElement>(null)
  const onExposeRef = useRef(onExpose)

  useEffect(() => {
    onExposeRef.current = onExpose
  }, [onExpose])

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel || typeof IntersectionObserver === 'undefined') return

    const exposeObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!shouldExposeAdditionalCategory(entry)) continue
          if (
            !isAdditionalCategorySentinelInView(
              entry.target.getBoundingClientRect(),
              window.innerHeight,
              ctaReservePx,
            )
          ) {
            continue
          }
          onExposeRef.current()
        }
      },
      {
        root: null,
        rootMargin: getAdditionalCategoryExposeRootMargin(ctaReservePx),
        threshold: ADDITIONAL_CATEGORY_EXPOSE_ZONE.threshold,
      },
    )
    exposeObserver.observe(sentinel)
    return () => exposeObserver.disconnect()
  }, [categoryKey, exposeEpoch, ctaReservePx])

  const lockExpanded = featured
  const isExpanded = lockExpanded || expanded
  const contentId = `additional-category-content-${categoryKey}`
  const summaryId = `additional-category-summary-${categoryKey}`
  const headerCopy = featured ? (
    <FeaturedCategoryHeaderCopy
      title={t.wizard.suggestedExtrasTitle}
      lead={t.wizard.suggestedExtrasLead}
      body={t.wizard.suggestedExtrasBody}
      close={t.wizard.suggestedExtrasClose}
      itemCountLabel={t.itemsCount(items.length)}
      selectedCount={selectedCount}
      selectedCountLabel={t.selectedCount(selectedCount)}
    />
  ) : (
    <CategoryHeaderCopy
      kicker={t.wizard.publicAdditionalsKicker}
      categoryLabel={categoryLabel}
      itemCountLabel={t.itemsCount(items.length)}
      selectedCount={selectedCount}
      selectedCountLabel={t.selectedCount(selectedCount)}
      expanded={expanded}
    />
  )

  const summaryList = (
    <ul
      id={summaryId}
      data-additional-category-summary
      className={
        featured
          ? 'public-suggested-extras-summary border-t px-4 py-3 sm:px-5'
          : 'border-t border-cdl-border-subtle px-4 py-3 sm:px-5'
      }
    >
      {items.map((item) => {
        const quantity = quantities[item.id] ?? 0
        return (
          <li
            key={item.id}
            data-additional-summary-item
            className={`flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-0.5 py-1 text-sm leading-snug${
              featured ? ' is-featured-summary-item' : ''
            }`}
          >
            <span
              className={
                featured
                  ? 'public-suggested-extras-bullet shrink-0'
                  : 'shrink-0 text-[var(--brand-primary)]'
              }
              aria-hidden
            >
              •
            </span>
            <span
              className={
                featured
                  ? 'public-suggested-extras-item-name min-w-0 flex-1 break-words'
                  : 'min-w-0 flex-1 break-words text-cdl-text'
              }
            >
              {getLocalizedAdditionalLabel(item, language)}
              {quantity > 0 ? (
                <span
                  className={
                    featured
                      ? 'public-suggested-extras-qty ml-2 font-bold'
                      : 'ml-2 font-bold text-[var(--brand-primary)]'
                  }
                >
                  ×{quantity}
                </span>
              ) : null}
            </span>
            <span
              className={
                featured
                  ? 'public-suggested-extras-item-price min-w-0 shrink-0 break-words text-right'
                  : 'min-w-0 shrink-0 break-words text-right text-cdl-muted'
              }
            >
              <span
                className={
                  featured
                    ? 'font-semibold'
                    : 'font-semibold text-cdl-title'
                }
              >
                {getAdditionalPriceLabel(item, language)}
              </span>{' '}
              {getAdditionalChargeUnitLabel(item, language)}
            </span>
          </li>
        )
      })}
    </ul>
  )

  const sectionClass = featured
    ? `public-additional-category is-featured is-expanded overflow-hidden rounded-2xl border shadow-cdl transition`
    : `overflow-hidden rounded-2xl border bg-cdl-surface shadow-cdl transition ${
        emphasize
          ? 'border-[var(--brand-primary)] ring-2 ring-[color-mix(in_srgb,var(--brand-primary)_35%,transparent)]'
          : 'border-cdl-border'
      }`
  const headerButtonClass =
    'w-full cursor-pointer p-4 text-left transition-colors hover:bg-cdl-hover active:bg-cdl-hover sm:p-5'
  const headerStaticClass =
    'public-suggested-extras-header w-full cursor-default p-4 pl-5 text-left sm:p-5'
  const collapsedWrapClass = 'group relative hover:bg-cdl-hover active:bg-cdl-hover'

  return (
    <section
      id={`additional-category-${categoryKey}`}
      data-category-key={categoryKey}
      data-category-reviewed={visited ? 'true' : 'false'}
      data-suggested-extras={featured ? 'true' : undefined}
      className={sectionClass}
      style={{ scrollMarginBottom: ctaReservePx }}
    >
      {isExpanded ? (
        <>
          {lockExpanded ? (
            <div
              data-additional-category-header
              data-suggested-extras-locked="true"
              className={headerStaticClass}
            >
              {headerCopy}
            </div>
          ) : (
            <button
              type="button"
              data-additional-category-header
              onClick={onToggle}
              aria-expanded={isExpanded}
              aria-controls={contentId}
              className={headerButtonClass}
            >
              {headerCopy}
            </button>
          )}
          <div
            id={contentId}
            role="region"
            aria-label={categoryLabel}
            className="border-t border-cdl-border-subtle bg-cdl-surface p-3 sm:p-4"
          >
            <div
              data-additional-items-grid
              className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4"
            >
              {items.map((item) => (
                <AdditionalItemCard
                  key={item.id}
                  item={item}
                  quantity={quantities[item.id] ?? 0}
                  billableGuestCount={billableGuestCount}
                  language={language}
                  onChangeQty={(qty) => onChangeQty(item.id, qty)}
                />
              ))}
            </div>
          </div>
        </>
      ) : (
        <div
          className={collapsedWrapClass}
          data-additional-category-header
        >
          <button
            type="button"
            data-additional-category-hitarea
            onClick={onToggle}
            aria-expanded={expanded}
            aria-controls={summaryId}
            aria-label={categoryLabel}
            className="absolute inset-0 z-10 cursor-pointer rounded-2xl focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)] focus-visible:ring-offset-2"
          />
          <div className="relative z-0 p-4 sm:p-5">{headerCopy}</div>
          {summaryList}
        </div>
      )}

      <span
        ref={sentinelRef}
        data-additional-category-sentinel
        aria-hidden
        className="block h-px w-full"
      />
    </section>
  )
}
