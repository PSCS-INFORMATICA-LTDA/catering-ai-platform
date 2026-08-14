'use client'

import AdditionalItemCard from '@/components/quotes/additionals/AdditionalItemCard'
import type { QuoteAdditionalItem } from '@/Lib/quoteAdditionalDisplay'
import { getQuoteStrings, tw } from '@/Lib/quoteTranslations'
import type { QuoteLanguage } from '@/Lib/quoteWizardTypes'

export default function AdditionalCategorySection({
  categoryKey,
  categoryLabel,
  items,
  expanded,
  selectedCount,
  visited,
  quantities,
  billableGuestCount,
  language,
  onToggle,
  onChangeQty,
}: {
  categoryKey: string
  categoryLabel: string
  items: QuoteAdditionalItem[]
  expanded: boolean
  selectedCount: number
  visited: boolean
  quantities: Record<string, number>
  billableGuestCount: number
  language: QuoteLanguage
  onToggle: () => void
  onChangeQty: (itemId: string, qty: number) => void
}) {
  const t = getQuoteStrings(language)
  const reviewStatus = visited
    ? tw(language, 'categoryReviewStatusReviewed')
    : tw(language, 'categoryReviewStatusPending')

  return (
    <section className="overflow-hidden rounded-2xl border border-cdl-border bg-cdl-surface shadow-cdl">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between gap-4 p-4 text-left transition-colors hover:bg-cdl-hover sm:p-5"
      >
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-base font-extrabold uppercase tracking-wide text-cdl-title sm:text-lg">
            {categoryLabel}
          </span>
          <span className="text-sm text-cdl-muted">
            {t.itemsCount(items.length)}
          </span>
          <span
            className={`text-xs font-semibold uppercase tracking-wide ${
              visited ? 'text-cdl-muted' : 'text-cdl-text-secondary'
            }`}
          >
            {reviewStatus}
          </span>
          {selectedCount > 0 ? (
            <span className="rounded-full bg-[var(--brand-primary)] px-2.5 py-0.5 text-xs font-bold text-white">
              {t.selectedCount(selectedCount)}
            </span>
          ) : null}
        </div>
        <span
          className={`shrink-0 text-sm text-[var(--brand-primary)] transition-transform duration-200 ${
            expanded ? 'rotate-180' : ''
          }`}
          aria-hidden
        >
          ▼
        </span>
      </button>

      {expanded ? (
        <div className="border-t border-cdl-border-subtle p-3 sm:p-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
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
      ) : null}
    </section>
  )
}
