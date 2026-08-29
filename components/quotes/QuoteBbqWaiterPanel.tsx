'use client'

import { formatAdditionalPrice } from '@/Lib/quoteAdditionalDisplay'
import { getQuoteStrings } from '@/Lib/quoteTranslations'
import type { QuoteLanguage } from '@/Lib/quoteWizardTypes'

export default function QuoteBbqWaiterPanel({
  quantity,
  unitPrice,
  language,
  onChangeQty,
}: {
  quantity: number
  unitPrice: number
  language: QuoteLanguage
  onChangeQty: (qty: number) => void
}) {
  const t = getQuoteStrings(language).wizard
  const safeQty = Number.isInteger(quantity) && quantity > 0 ? quantity : 0
  const subtotal = safeQty * unitPrice

  return (
    <section
      data-waiter-service
      className="rounded-2xl border border-cdl-border bg-cdl-surface p-5 shadow-cdl sm:p-6"
    >
      <p className="cdl-eyebrow">{t.waiterSectionTitle}</p>
      <h3 className="mt-2 text-lg font-black text-cdl-title">
        {t.waiterSectionTitle}
      </h3>
      <p className="mt-1 text-sm text-cdl-muted">{t.waiterSectionHint}</p>
      <p className="mt-2 text-sm font-bold text-[var(--brand-primary)]">
        {t.waiterUnitPrice}
      </p>
      <div className="mt-4 flex items-center justify-between gap-3">
        <button
          type="button"
          aria-label={t.decreaseWaiters}
          disabled={safeQty === 0}
          onClick={() => onChangeQty(Math.max(0, safeQty - 1))}
          className="flex h-11 w-11 items-center justify-center rounded-xl border border-cdl-border bg-cdl-inset text-lg font-black disabled:opacity-30"
        >
          −
        </button>
        <p className="text-2xl font-black tabular-nums text-cdl-title">
          {safeQty}
        </p>
        <button
          type="button"
          aria-label={t.increaseWaiters}
          onClick={() => onChangeQty(safeQty + 1)}
          className="flex h-11 w-11 items-center justify-center rounded-xl border border-cdl-border bg-cdl-inset text-lg font-black"
        >
          +
        </button>
      </div>
      <p className="mt-4 text-sm font-semibold text-cdl-title">
        {t.waiterSubtotal}: {formatAdditionalPrice(subtotal)}
      </p>
    </section>
  )
}
