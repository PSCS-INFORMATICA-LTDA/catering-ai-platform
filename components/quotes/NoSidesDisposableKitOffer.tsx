'use client'

import { getQuoteStrings } from '@/Lib/quoteTranslations'
import type { QuoteLanguage } from '@/Lib/quoteWizardTypes'

export default function NoSidesDisposableKitOffer({
  selected,
  language,
  onToggle,
}: {
  selected: boolean
  language: QuoteLanguage
  onToggle: (selected: boolean) => void
}) {
  const t = getQuoteStrings(language).wizard
  const strings = getQuoteStrings(language)

  return (
    <section
      data-disposable-kit-offer
      className="rounded-2xl border border-cdl-border bg-cdl-surface p-5 shadow-cdl"
    >
      <p className="cdl-eyebrow">{t.disposableKitTitle}</p>
      <h3 className="mt-2 text-lg font-black text-cdl-title">
        {t.disposableKitTitle}
      </h3>
      <p className="mt-1 text-sm text-cdl-muted">{t.disposableKitDescription}</p>
      <p className="mt-2 text-sm font-bold text-[var(--brand-primary)]">
        {t.disposableKitPrice}
      </p>
      <button
        type="button"
        aria-pressed={selected}
        onClick={() => onToggle(!selected)}
        className={`mt-4 min-h-11 w-full rounded-xl px-4 py-3 text-sm font-bold transition ${
          selected
            ? 'bg-[var(--brand-primary)] text-white'
            : 'border border-cdl-border bg-cdl-inset text-cdl-title'
        }`}
      >
        {selected ? strings.selected : strings.select}
      </button>
    </section>
  )
}
