'use client'

import { useMemo, useRef } from 'react'
import AdditionalItemCard from '@/components/quotes/additionals/AdditionalItemCard'
import {
  getAdditionalChargeUnitLabel,
  getAdditionalUnitPrice,
  getLocalizedAdditionalLabel,
  hasAdditionalPrice,
  type QuoteAdditionalItem,
} from '@/Lib/quoteAdditionalDisplay'
import { getQuoteStrings, tw } from '@/Lib/quoteTranslations'
import type { QuoteLanguage } from '@/Lib/quoteWizardTypes'

function formatMenuPrice(value: number, language: QuoteLanguage): string {
  const locale = language === 'en' ? 'en-US' : language === 'es' ? 'es-US' : 'pt-BR'
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(value)
}

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
  onChangeQty: (itemId: string, qty: number) => void
}) {
  const t = getQuoteStrings(language)
  const sectionRef = useRef<HTMLElement>(null)
  const menuRows = useMemo(
    () =>
      items.map((item) => ({
        id: item.id,
        label: getLocalizedAdditionalLabel(item, language),
        chargeUnit: getAdditionalChargeUnitLabel(item, language),
        price: hasAdditionalPrice(item)
          ? formatMenuPrice(getAdditionalUnitPrice(item), language)
          : null,
        selected: (quantities[item.id] ?? 0) > 0,
      })),
    [items, language, quantities],
  )
  const contentId = `additional-category-content-${categoryKey}`

  return (
    <section
      ref={sectionRef}
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
        type="button"
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

            {!expanded && menuRows.length > 0 ? (
              <ul
                data-additional-category-preview
                className="mt-3 space-y-1.5"
              >
                {menuRows.map((row) => (
                  <li
                    key={row.id}
                    className="flex min-w-0 items-baseline gap-2 text-sm leading-5"
                  >
                    <span
                      className={`min-w-0 truncate ${
                        row.selected
                          ? 'font-bold text-[var(--brand-primary)]'
                          : 'text-cdl-text-secondary'
                      }`}
                    >
                      {row.selected ? '✓ ' : ''}
                      {row.label}
                    </span>
                    <span
                      className="h-px min-w-4 flex-1 self-center border-b border-dotted border-cdl-border"
                      aria-hidden
                    />
                    <span className="shrink-0 whitespace-nowrap font-semibold tabular-nums text-cdl-title">
                      {row.price ?? tw(language, 'priceUnavailable')}
                    </span>
                    <span className="min-w-0 shrink-0 text-xs text-cdl-muted">
                      {row.chargeUnit}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}

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
      ) : null}
    </section>
  )
}
