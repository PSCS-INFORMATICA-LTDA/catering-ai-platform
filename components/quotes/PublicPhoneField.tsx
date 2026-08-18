'use client'

import { getQuoteStrings } from '@/Lib/quoteTranslations'
import {
  displayPublicPhone,
  formatPublicPhoneInput,
  isUsablePublicPhone,
} from '@/Lib/publicQuote/phone'
import type { QuoteLanguage } from '@/Lib/quoteWizardTypes'

export default function PublicPhoneField({
  value,
  language,
  onChange,
}: {
  value: string
  language: QuoteLanguage
  onChange: (value: string) => void
}) {
  const t = getQuoteStrings(language).wizard
  const display = displayPublicPhone(value)
  const usable = isUsablePublicPhone(display)

  return (
    <label className="flex flex-col gap-2">
      <span className="cdl-eyebrow">{t.customerPhone}</span>
      <div className="relative">
        <input
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={display}
          placeholder={t.publicPhonePlaceholder}
          onChange={(event) => onChange(formatPublicPhoneInput(event.target.value))}
          onFocus={() => {
            if (!value.trim()) onChange(formatPublicPhoneInput('+1'))
          }}
          aria-invalid={Boolean(value.trim()) && !usable}
          className={`w-full rounded-xl border px-4 py-3.5 pr-10 text-base text-cdl-fg shadow-cdl outline-none transition-colors placeholder:text-cdl-faint focus:border-cdl-accent-border ${
            usable ? 'cdl-field-filled' : 'cdl-field-empty'
          }`}
        />
        {usable ? (
          <span
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-bold text-cdl-success"
            aria-hidden
          >
            ✓
          </span>
        ) : null}
      </div>
      <p className="text-xs leading-5 text-cdl-muted">{t.publicPhoneHint}</p>
    </label>
  )
}
