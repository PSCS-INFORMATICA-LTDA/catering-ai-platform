'use client'

import { useEffect, useMemo, useRef, useState, type Ref } from 'react'
import { createPortal } from 'react-dom'
import { tCommon } from '@/Lib/i18n/common'
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

const PICKER_ID = 'public-phone-country-picker'
const PICKER_VIEWPORT_VAR = '--public-phone-country-picker-vh'

function blurActiveElement() {
  if (typeof document === 'undefined') return
  const active = document.activeElement
  if (active instanceof HTMLElement) active.blur()
}

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
  const [portalReady, setPortalReady] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const countryButtonRef = useRef<HTMLButtonElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const chosenIso2Ref = useRef<string | null>(parts.iso2)

  useEffect(() => {
    setPortalReady(true)
  }, [])

  useEffect(() => {
    const next = splitPublicPhone(value, defaultIso2)
    if (!String(value ?? '').trim()) {
      setIso2(chosenIso2Ref.current ?? next.iso2)
      setNational('')
      return
    }
    chosenIso2Ref.current = next.iso2
    setIso2(next.iso2)
    setNational(next.nationalDigits)
  }, [value, defaultIso2])

  useEffect(() => {
    if (!open) return
    const frame = window.requestAnimationFrame(() => {
      const active = document.activeElement
      if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) {
        active.blur()
      }
      closeButtonRef.current?.focus({ preventScroll: true })
    })
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const viewport = window.visualViewport
    const syncViewport = () => {
      const height = viewport?.height ?? window.innerHeight
      document.documentElement.style.setProperty(
        PICKER_VIEWPORT_VAR,
        `${Math.round(height)}px`,
      )
    }
    syncViewport()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closePicker()
    }
    viewport?.addEventListener('resize', syncViewport)
    viewport?.addEventListener('scroll', syncViewport)
    document.addEventListener('keydown', onKey)
    return () => {
      window.cancelAnimationFrame(frame)
      document.body.style.overflow = previousOverflow
      document.documentElement.style.removeProperty(PICKER_VIEWPORT_VAR)
      viewport?.removeEventListener('resize', syncViewport)
      viewport?.removeEventListener('scroll', syncViewport)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  function closePicker() {
    setQuery('')
    setOpen(false)
    countryButtonRef.current?.focus({ preventScroll: true })
  }

  function openPicker() {
    blurActiveElement()
    setQuery('')
    setOpen(true)
  }

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
    chosenIso2Ref.current = nextIso2
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
            ref={countryButtonRef}
            type="button"
            data-phone-country
            aria-expanded={open}
            aria-haspopup="dialog"
            aria-controls={PICKER_ID}
            onPointerDown={() => {
              if (open) return
              blurActiveElement()
            }}
            onClick={() => (open ? closePicker() : openPicker())}
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
          {open && portalReady
            ? createPortal(
                <div
                  id={PICKER_ID}
                  className="public-phone-country-picker"
                  data-phone-country-picker
                  data-theme="light"
                  data-public-wizard-theme="light-locked"
                  role="dialog"
                  aria-modal="true"
                  aria-label={t.phoneCountryPlaceholder}
                >
                  <button
                    type="button"
                    className="public-phone-country-picker-backdrop"
                    aria-label={tCommon(language, 'close')}
                    onClick={closePicker}
                  />
                  <div className="public-phone-country-picker-panel">
                    <div className="public-phone-country-picker-header">
                      <button
                        ref={closeButtonRef}
                        type="button"
                        data-phone-country-close
                        className="public-phone-country-picker-close"
                        onClick={closePicker}
                      >
                        {tCommon(language, 'close')}
                      </button>
                      <input
                        type="search"
                        inputMode="search"
                        enterKeyHint="search"
                        data-phone-country-search
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder={t.phoneCountrySearch}
                        className="public-phone-country-picker-search"
                        tabIndex={0}
                      />
                    </div>
                    <div
                      role="listbox"
                      data-phone-country-list
                      className="public-phone-country-picker-list"
                    >
                      {countries.map((row) => (
                        <button
                          key={row.iso2}
                          type="button"
                          role="option"
                          aria-selected={row.iso2 === iso2}
                          onClick={() => {
                            emit(row.iso2, national)
                            closePicker()
                          }}
                          className="public-phone-country-picker-option"
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
                </div>,
                document.body,
              )
            : null}
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
