'use client'

import { getQuoteStrings } from '@/Lib/quoteTranslations'
import type { QuoteLanguage } from '@/Lib/quoteWizardTypes'

const SELECTED_OPTION_CLASS =
  'border-[var(--brand-primary-2)] bg-[color-mix(in_srgb,var(--brand-primary)_10%,white)] text-[var(--brand-primary)] ring-1 ring-[color-mix(in_srgb,var(--brand-primary-2)_35%,transparent)]'

const OPTION_CHIP_CLASS =
  'min-h-[2.5rem] rounded-lg border px-2 py-2 text-center text-xs font-semibold leading-tight transition sm:text-sm'

export default function NoSidesDisposableKitOffer({
  selected,
  language,
  priceLabel,
  onToggle,
}: {
  selected: boolean
  language: QuoteLanguage
  priceLabel?: string
  onToggle: (selected: boolean) => void
}) {
  const t = getQuoteStrings(language).wizard

  return (
    <section
      data-disposable-kit-offer
      data-disposable-kit-inline
      className="rounded-xl border border-neutral-200 bg-white px-3 py-2.5"
    >
      <div className="mb-2 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <p className="text-sm font-bold uppercase tracking-wide text-neutral-900">
          {t.disposableKitTitle}
        </p>
        <span className="text-[10px] font-medium text-neutral-500">
          {t.disposableKitOptional}
        </span>
      </div>
      <p className="mb-1 text-xs text-neutral-500">{t.disposableKitDescription}</p>
      <p className="mb-2 text-xs font-semibold text-[var(--brand-primary)]">
        {priceLabel || t.disposableKitPrice}
      </p>
      <div
        className="grid grid-cols-2 gap-2"
        role="group"
        aria-label={t.disposableKitTitle}
      >
        <button
          type="button"
          data-disposable-kit-choice="off"
          aria-pressed={!selected}
          onClick={() => onToggle(false)}
          className={`${OPTION_CHIP_CLASS} ${
            !selected
              ? SELECTED_OPTION_CLASS
              : 'border-neutral-200 bg-neutral-50 text-neutral-800 hover:border-neutral-300 hover:bg-white'
          }`}
        >
          {t.disposableKitDecline}
        </button>
        <button
          type="button"
          data-disposable-kit-choice="on"
          aria-pressed={selected}
          onClick={() => onToggle(true)}
          className={`${OPTION_CHIP_CLASS} ${
            selected
              ? SELECTED_OPTION_CLASS
              : 'border-neutral-200 bg-neutral-50 text-neutral-800 hover:border-neutral-300 hover:bg-white'
          }`}
        >
          {t.disposableKitAdd}
        </button>
      </div>
    </section>
  )
}
