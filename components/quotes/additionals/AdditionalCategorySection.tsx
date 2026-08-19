'use client'

import { useEffect, useRef } from 'react'
import AdditionalItemCard from '@/components/quotes/additionals/AdditionalItemCard'
import {
  ADDITIONAL_CATEGORY_EXPOSE_FALLBACK_BOTTOM_PX,
  ADDITIONAL_CATEGORY_EXPOSE_ZONE,
  getAdditionalCategoryExposeRootMargin,
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

export default function AdditionalCategorySection({
  categoryKey,
  categoryLabel,
  items,
  expanded,
  selectedCount,
  visited,
  emphasize = false,
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
  quantities: Record<string, number>
  billableGuestCount: number
  language: QuoteLanguage
  /** Bumped by the wizard to re-evaluate summaries already on screen. */
  exposeEpoch?: number
  /** Sticky CTA height so a summary behind Voltar/Próximo is not counted. */
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
          if (shouldExposeAdditionalCategory(entry)) {
            onExposeRef.current()
          }
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

  const contentId = `additional-category-content-${categoryKey}`
  const summaryId = `additional-category-summary-${categoryKey}`

  return (
    <section
      id={`additional-category-${categoryKey}`}
      data-category-key={categoryKey}
      data-category-reviewed={visited ? 'true' : 'false'}
      className={`overflow-hidden rounded-2xl border bg-cdl-surface shadow-cdl transition ${
        emphasize
          ? 'border-[var(--brand-primary)] ring-2 ring-[color-mix(in_srgb,var(--brand-primary)_35%,transparent)]'
          : 'border-cdl-border'
      }`}
      style={{ scrollMarginBottom: ctaReservePx }}
    >
      <button
        type="button"
        data-additional-category-header
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={expanded ? contentId : summaryId}
        className="w-full p-4 text-left transition-colors hover:bg-cdl-hover sm:p-5"
      >
        <div className="flex min-w-0 items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-base font-extrabold uppercase tracking-wide text-cdl-title sm:text-lg">
                {categoryLabel}
              </span>
              <span className="text-sm font-medium text-cdl-muted">
                {t.itemsCount(items.length)}
              </span>
            </div>

            {selectedCount > 0 ? (
              <div className="mt-2">
                <span className="rounded-full bg-[var(--brand-primary)] px-2.5 py-0.5 text-xs font-bold text-white">
                  {t.selectedCount(selectedCount)}
                </span>
              </div>
            ) : null}
          </div>
          <span
            className={`mt-1 shrink-0 text-sm text-[var(--brand-primary)] transition-transform duration-200 ${
              expanded ? 'rotate-180' : ''
            }`}
            aria-hidden
          >
            ▼
          </span>
        </div>
      </button>

      {expanded ? (
        <div
          id={contentId}
          role="region"
          aria-label={categoryLabel}
          className="border-t border-cdl-border-subtle p-3 sm:p-4"
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
      ) : (
        // Collapsed categories still list every item with its registered price
        // and charge unit, so the customer can read before deciding to open.
        <ul
          id={summaryId}
          data-additional-category-summary
          className="border-t border-cdl-border-subtle px-4 py-3 sm:px-5"
        >
          {items.map((item) => {
            const quantity = quantities[item.id] ?? 0
            return (
              <li
                key={item.id}
                data-additional-summary-item
                className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-0.5 py-1 text-sm leading-snug"
              >
                <span
                  className="shrink-0 text-[var(--brand-primary)]"
                  aria-hidden
                >
                  •
                </span>
                <span className="min-w-0 flex-1 break-words text-cdl-text">
                  {getLocalizedAdditionalLabel(item, language)}
                  {quantity > 0 ? (
                    <span className="ml-2 font-bold text-[var(--brand-primary)]">
                      ×{quantity}
                    </span>
                  ) : null}
                </span>
                <span className="min-w-0 shrink-0 break-words text-right text-cdl-muted">
                  <span className="font-semibold text-cdl-title">
                    {getAdditionalPriceLabel(item, language)}
                  </span>{' '}
                  {getAdditionalChargeUnitLabel(item, language)}
                </span>
              </li>
            )
          })}
        </ul>
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
