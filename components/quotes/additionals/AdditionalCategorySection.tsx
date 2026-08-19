'use client'

import { useEffect, useRef } from 'react'
import AdditionalItemCard from '@/components/quotes/additionals/AdditionalItemCard'
import {
  ADDITIONAL_CATEGORY_EXPOSE_ZONE,
  ADDITIONAL_CATEGORY_READING_ZONE,
  shouldAutoOpenAdditionalCategory,
  shouldExposeAdditionalCategory,
} from '@/Lib/additionalCategoryExposure'
import type { QuoteAdditionalItem } from '@/Lib/quoteAdditionalDisplay'
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
  onToggle,
  onEnterReadingZone,
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
  onToggle: () => void
  onEnterReadingZone: () => void
  onExpose: () => void
  onChangeQty: (itemId: string, qty: number) => void
}) {
  const t = getQuoteStrings(language)
  const headerRef = useRef<HTMLButtonElement>(null)
  const sentinelRef = useRef<HTMLSpanElement>(null)
  const onEnterReadingZoneRef = useRef(onEnterReadingZone)
  const onExposeRef = useRef(onExpose)
  onEnterReadingZoneRef.current = onEnterReadingZone
  onExposeRef.current = onExpose

  useEffect(() => {
    const header = headerRef.current
    if (!header || typeof IntersectionObserver === 'undefined') return

    const openObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (shouldAutoOpenAdditionalCategory(entry)) {
            onEnterReadingZoneRef.current()
          }
        }
      },
      {
        root: null,
        rootMargin: ADDITIONAL_CATEGORY_READING_ZONE.rootMargin,
        threshold: ADDITIONAL_CATEGORY_READING_ZONE.threshold,
      },
    )
    openObserver.observe(header)
    return () => openObserver.disconnect()
  }, [categoryKey])

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!expanded || !sentinel || typeof IntersectionObserver === 'undefined') {
      return
    }

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
        rootMargin: ADDITIONAL_CATEGORY_EXPOSE_ZONE.rootMargin,
        threshold: ADDITIONAL_CATEGORY_EXPOSE_ZONE.threshold,
      },
    )
    exposeObserver.observe(sentinel)
    return () => exposeObserver.disconnect()
  }, [categoryKey, expanded, items.length])

  const contentId = `additional-category-content-${categoryKey}`

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
    >
      <button
        ref={headerRef}
        type="button"
        data-additional-category-header
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={contentId}
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
          <span
            ref={sentinelRef}
            data-additional-category-sentinel
            aria-hidden
            className="block h-px w-full"
          />
        </div>
      ) : null}
    </section>
  )
}
