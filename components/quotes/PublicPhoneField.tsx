'use client'

import { useEffect, useMemo, useRef, useState, type Ref } from 'react'
import { getQuoteStrings } from '@/Lib/quoteTranslations'
import {
  composePublicPhoneE164,
  formatNationalPhoneDisplay,
  isUsablePublicPhone,
  splitPublicPhone,
} from '@/Lib/publicQuote/phone'
import {
  countryFlagEmoji,
  filterPhoneCountries,
  getPhoneCountry,
  getPhoneCountryLabel,
  resolveDefaultPhoneCountryIso2,
} from '@/Lib/publicQuote/phoneCountries'
import type { QuoteLanguage } from '@/Lib/quoteWizardTypes'
import PublicRequiredMark from '@/components/quotes/PublicRequiredMark'

export default function PublicPhoneField({
  value,
  language,
  onChange,
  required = false,
  requiredLabel,
  inputRef,
  allowedCountries,
  branchCountry,
}: {
  value: string
  language: QuoteLanguage
  onChange: (value: string) => void
  required?: boolean
  requiredLabel?: string
  inputRef?: Ref<HTMLInputElement>
  allowedCountries?: ReadonlyArray<string>
  branchCountry?: string | null
}) {
  const t = getQuoteStrings(language).wizard
  const defaultIso2 = resolveDefaultPhoneCountryIso2({
    allowedCountries,
    branchCountry,
  })
  const parts = splitPublicPhone(value, defaultIso2)
  const [iso2, setIso2] = useState<string | null>(parts.iso2)
  const [national, setNational] = useState(parts.nationalDigits)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const next = splitPublicPhone(value, defaultIso2)
    setIso2(next.iso2)
    setNational(next.nationalDigits)
  }, [value, defaultIso2])

  useEffect(() => {
    if (!open) return
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onPointer)
    return () => document.removeEventListener('mousedown', onPointer)
  }, [open])

  const country = getPhoneCountry(iso2)
  const countries = useMemo(
    () => filterPhoneCountries(query, language),
    [query, language],
  )
  const canonical = composePublicPhoneE164(iso2, national)
  const displayNational = formatNationalPhoneDisplay(iso2, national)
  const filled = Boolean(iso2 || national)
  const usable = Boolean(canonical && isUsablePublicPhone(canonical))
  const countryMissing = required && !iso2
  const nationalMissing = required && Boolean(iso2) && !national

  function emit(nextIso2: string | null, nextNational: string) {
    setIso2(nextIso2)
    setNational(nextNational)
    onChange(composePublicPhoneE164(nextIso2, nextNational) || '')
  }

  return (
    <div
      ref={rootRef}
      className="flex flex-col gap-2"
      data-public-phone-split
      data-phone-canonical={canonical ?? ''}
      data-phone-default-country={defaultIso2 ?? ''}
    >
      <span className="cdl-eyebrow">
        {t.customerPhone}
        {required ? <PublicRequiredMark label={requiredLabel || ''} /> : null}
      </span>
      <div className="grid grid-cols-[minmax(7.5rem,0.42fr)_minmax(0,1fr)] gap-2">
        <div className="relative">
          <button
            type="button"
            data-phone-country
            aria-expanded={open}
            aria-haspopup="listbox"
            onClick={() => setOpen((current) => !current)}
            className={`flex min-h-12 w-full items-center justify-between gap-1 rounded-xl border px-3 py-3 text-left text-sm font-semibold shadow-cdl ${
              country ? 'cdl-field-filled' : 'cdl-field-empty'
            }`}
          >
            <span className="flex min-w-0 items-center gap-1.5">
              <span aria-hidden>{country ? countryFlagEmoji(country.iso2) : '🌐'}</span>
              <span className="truncate">
                {country ? `+${country.callingCode}` : t.phoneCountryPlaceholder}
              </span>
            </span>
            <span aria-hidden className="text-cdl-muted">
              ▾
            </span>
          </button>
          {open ? (
            <div
              role="listbox"
              className="absolute z-30 mt-1 max-h-64 w-[min(18rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-cdl-border bg-cdl-surface shadow-cdl"
            >
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t.phoneCountrySearch}
                className="w-full border-b border-cdl-border px-3 py-2 text-sm outline-none"
                autoFocus
              />
              <div className="max-h-52 overflow-y-auto">
                {countries.map((row) => (
                  <button
                    key={row.iso2}
                    type="button"
                    role="option"
                    aria-selected={row.iso2 === iso2}
                    onClick={() => {
                      emit(row.iso2, national)
                      setQuery('')
                      setOpen(false)
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-cdl-hover"
                  >
                    <span aria-hidden>{countryFlagEmoji(row.iso2)}</span>
                    <span className="min-w-0 flex-1 truncate">
                      {getPhoneCountryLabel(row, language)}
                    </span>
                    <span className="shrink-0 font-semibold text-cdl-muted">
                      +{row.callingCode}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
        <div className="relative">
          <input
            ref={inputRef}
            data-phone-national
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            value={displayNational}
            placeholder={t.publicPhonePlaceholder}
            onChange={(event) => emit(iso2, event.target.value)}
            aria-invalid={filled && !usable}
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
      </div>
      <p className="text-xs leading-5 text-cdl-muted">{t.publicPhoneHint}</p>
      {countryMissing ? (
        <p className="text-sm text-cdl-action">{t.phoneCountryRequired}</p>
      ) : nationalMissing ? (
        <p className="text-sm text-cdl-action">{t.phoneNationalRequired}</p>
      ) : filled && !usable ? (
        <p className="text-sm text-cdl-action">{t.phoneInvalidSplit}</p>
      ) : null}
    </div>
  )
}
