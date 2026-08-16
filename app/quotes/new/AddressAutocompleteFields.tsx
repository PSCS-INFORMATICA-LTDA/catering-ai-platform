'use client'

import { useEffect, useRef, useState } from 'react'
import {
  formatPostalCode,
  inferCountryFromPostalCode,
  isSelectedPlaceCompatibleWithPostalCode,
  isUsablePostalCode,
  lookupPostalAddress,
  normalizePostalDigits,
} from '@/Lib/cep'
import type { AddressValues } from './googlePlaces'
import {
  enrichGooglePlaceFromGeocoder,
  parseGooglePlace,
} from './googlePlaces'
import { tCommon } from '@/Lib/i18n/common'
import { tw } from '../../../Lib/quoteTranslations'
import type { QuoteLanguage } from '../../../Lib/quoteWizardTypes'

type FieldCompletion = 'filled' | 'empty'

function getInputClassName(completion?: FieldCompletion) {
  const base =
    'w-full rounded-xl border px-4 py-3.5 pr-10 text-base text-cdl-fg shadow-cdl outline-none transition-colors placeholder:text-cdl-faint focus:border-cdl-accent-border'
  if (completion === 'filled') return `${base} cdl-field-filled`
  if (completion === 'empty') return `${base} cdl-field-empty`
  return `${base} border-cdl-border bg-cdl-inset`
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span className="cdl-eyebrow">{children}</span>
}

function FieldCheck({ show }: { show: boolean }) {
  if (!show) return null
  return (
    <span
      className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-bold text-cdl-success"
      aria-hidden
    >
      ✓
    </span>
  )
}

function useGooglePlacesReady(language: QuoteLanguage = 'pt') {
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

  useEffect(() => {
    if (!apiKey) {
      setError(tw(language, 'googleApiKeyMissing'))
      return
    }

    if (window.google?.maps) {
      setReady(true)
      return
    }

    const scriptId = 'google-maps-places-script'
    const existingScript = document.getElementById(scriptId) as
      | HTMLScriptElement
      | null

    function handleReady() {
      setReady(true)
      setError(null)
    }

    if (existingScript) {
      existingScript.addEventListener('load', handleReady)
      return () => existingScript.removeEventListener('load', handleReady)
    }

    const script = document.createElement('script')
    script.id = scriptId
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&v=weekly`
    script.async = true
    script.defer = true
    script.onload = handleReady
    script.onerror = () => setError(tw(language, 'googleLoadError'))
    document.head.appendChild(script)
  }, [apiKey, language])

  return { ready, error, enabled: Boolean(apiKey) }
}

export default function AddressAutocompleteFields({
  values,
  onChange,
  className = '',
  fieldCompletions,
  language = 'pt',
}: {
  values: AddressValues
  onChange: (patch: Partial<AddressValues>) => void
  className?: string
  language?: QuoteLanguage | string | null
  fieldCompletions?: {
    city?: FieldCompletion
    state?: FieldCompletion
    zipCode?: FieldCompletion
  }
}) {
  const loc: QuoteLanguage =
    language === 'en' || language === 'es' ? language : 'pt'
  const onChangeRef = useRef(onChange)
  const valuesRef = useRef(values)
  const { ready, error, enabled } = useGooglePlacesReady(loc)
  const [lookupError, setLookupError] = useState<string | null>(null)
  const [looking, setLooking] = useState(false)
  const [addressQuery, setAddressQuery] = useState(values.address)
  const [addressError, setAddressError] = useState<string | null>(null)
  const addressInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    valuesRef.current = values
  }, [values])

  const lastLookupRef = useRef('')

  useEffect(() => {
    const digits = normalizePostalDigits(values.zipCode)
    if (!isUsablePostalCode(values.zipCode)) {
      setLookupError(null)
      setLooking(false)
      return
    }
    if (lastLookupRef.current === digits) return

    const country = inferCountryFromPostalCode(values.zipCode)
    if (country === 'US' && !enabled) return
    if (country === 'US' && enabled && !ready) return

    let cancelled = false
    const timer = window.setTimeout(() => {
      setLooking(true)
      setLookupError(null)
      void lookupPostalAddress(values.zipCode)
        .then((addr) => {
          if (cancelled) return
          lastLookupRef.current = digits
          setAddressQuery(addr.address)
          onChangeRef.current({
            zipCode: addr.zipCode,
            address: '',
            addressNumber: '',
            city: addr.city,
            state: addr.state,
          })
        })
        .catch((err: unknown) => {
          if (cancelled) return
          const code = err instanceof Error ? err.message : ''
          if (code === 'GOOGLE_UNAVAILABLE' && enabled && !ready) return
          lastLookupRef.current = digits
          setLookupError(tCommon(loc, 'postalNotFound'))
        })
        .finally(() => {
          if (!cancelled) setLooking(false)
        })
    }, 400)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [values.zipCode, loc, ready, enabled])

  useEffect(() => {
    const input = addressInputRef.current
    const country = inferCountryFromPostalCode(values.zipCode)
    if (!input || !ready || !country) return

    let active = true
    let autocomplete: google.maps.places.Autocomplete | null = null
    let placeListener: google.maps.MapsEventListener | null = null

    void window.google?.maps
      .importLibrary('places')
      .then(({ Autocomplete }) => {
        if (!active) return
        autocomplete = new Autocomplete(input, {
          types: ['geocode'],
          componentRestrictions: { country: country.toLowerCase() },
          fields: ['address_components', 'formatted_address'],
        })
        placeListener = autocomplete.addListener('place_changed', () => {
          if (!autocomplete) return
          const place = autocomplete.getPlace()
          void (async () => {
            const selected = await enrichGooglePlaceFromGeocoder(
              place,
              parseGooglePlace(place),
            )
            if (!active) return

            const currentValues = valuesRef.current
            const isCompatible = isSelectedPlaceCompatibleWithPostalCode({
              expectedPostalCode: currentValues.zipCode,
              selectedPostalCode: selected.zipCode,
              expectedCity: currentValues.city,
              expectedState: currentValues.state,
              selectedCity: selected.city,
              selectedState: selected.state,
            })

            if (!selected.address || !isCompatible) {
              setAddressError(tw(loc, 'addressZipMismatch'))
              setAddressQuery(selected.address || input.value)
              onChangeRef.current({ address: '', addressNumber: '' })
              return
            }

            setAddressError(null)
            setAddressQuery(selected.address)
            onChangeRef.current({
              address: selected.address,
              addressNumber: selected.addressNumber,
              city: selected.city || currentValues.city,
              state: selected.state || currentValues.state,
              zipCode: formatPostalCode(currentValues.zipCode),
            })
          })()
        })
      })
      .catch(() => setAddressError(tw(loc, 'googleLoadError')))

    return () => {
      active = false
      placeListener?.remove()
      autocomplete = null
    }
  }, [loc, ready, values.zipCode])

  const zipDigits = normalizePostalDigits(values.zipCode)
  const zipInvalid = zipDigits.length >= 5 && !isUsablePostalCode(values.zipCode)

  return (
    <div
      className={`grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,2.4fr)_minmax(0,0.8fr)_minmax(0,1.5fr)_minmax(0,0.9fr)] ${className}`}
    >
      <label className="flex flex-col gap-2">
        <FieldLabel>{tCommon(loc, 'postalCode')}</FieldLabel>
        <div className="relative">
          <input
            type="text"
            inputMode="numeric"
            autoComplete="postal-code"
            value={values.zipCode}
            onChange={(e) => {
              const zipCode = formatPostalCode(e.target.value)
              const postalChanged =
                normalizePostalDigits(zipCode) !==
                normalizePostalDigits(valuesRef.current.zipCode)
              setAddressError(null)
              onChange({
                zipCode,
                ...(postalChanged ? { address: '', addressNumber: '' } : {}),
              })
            }}
            placeholder={tCommon(loc, 'postalCodePlaceholder')}
            className={getInputClassName(fieldCompletions?.zipCode)}
            aria-invalid={zipInvalid || Boolean(lookupError)}
          />
          <FieldCheck show={fieldCompletions?.zipCode === 'filled'} />
        </div>
        {zipInvalid ? (
          <p className="text-xs text-cdl-action">
            {tCommon(loc, 'invalidPostalCode')}
          </p>
        ) : looking ? (
          <p className="text-xs text-cdl-muted">
            {tCommon(loc, 'postalLookingUp')}
          </p>
        ) : lookupError ? (
          <p className="text-xs text-cdl-action">{lookupError}</p>
        ) : error ? (
          <p className="text-xs text-cdl-muted">{error}</p>
        ) : null}
      </label>

      <label className="flex flex-col gap-2">
        <FieldLabel>{tCommon(loc, 'address')}</FieldLabel>
        <input
          ref={addressInputRef}
          type="text"
          autoComplete="off"
          value={addressQuery}
          onChange={(e) => {
            setAddressQuery(e.target.value)
            setAddressError(null)
            onChange({ address: '', addressNumber: '' })
          }}
          placeholder={tw(loc, 'addressPlaceholder')}
          className={getInputClassName()}
          aria-invalid={
            Boolean(addressError) || Boolean(addressQuery && !values.address)
          }
        />
        <p
          className={`text-xs ${addressError ? 'text-cdl-action' : 'text-cdl-muted'}`}
        >
          {addressError ?? tw(loc, 'addressSelectionRequired')}
        </p>
      </label>

      <label className="flex flex-col gap-2">
        <FieldLabel>{tCommon(loc, 'streetNumber')}</FieldLabel>
        <input
          type="text"
          inputMode="numeric"
          value={values.addressNumber}
          onChange={(e) => onChange({ addressNumber: e.target.value })}
          className={getInputClassName()}
        />
      </label>

      <label className="flex flex-col gap-2">
        <FieldLabel>{tCommon(loc, 'city')}</FieldLabel>
        <div className="relative">
          <input
            type="text"
            value={values.city}
            onChange={(e) => onChange({ city: e.target.value })}
            placeholder={tw(loc, 'cityPlaceholder')}
            className={getInputClassName(fieldCompletions?.city)}
          />
          <FieldCheck show={fieldCompletions?.city === 'filled'} />
        </div>
      </label>

      <label className="flex flex-col gap-2">
        <FieldLabel>{tCommon(loc, 'state')}</FieldLabel>
        <div className="relative">
          <input
            type="text"
            value={values.state}
            onChange={(e) => onChange({ state: e.target.value })}
            placeholder={tw(loc, 'statePlaceholder')}
            className={getInputClassName(fieldCompletions?.state)}
          />
          <FieldCheck show={fieldCompletions?.state === 'filled'} />
        </div>
      </label>
    </div>
  )
}
