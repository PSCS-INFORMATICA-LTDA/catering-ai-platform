'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  formatPostalCode,
  inferCountryFromPostalCode,
  isUsablePostalCode,
  lookupPostalAddress,
  normalizePostalDigits,
} from '@/Lib/cep'
import type { AddressValues } from './googlePlaces'
import { enrichGooglePlaceFromGeocoder, parseGooglePlace } from './googlePlaces'
import { tCommon } from '@/Lib/i18n/common'
import { tw } from '../../../Lib/quoteTranslations'
import type { QuoteLanguage } from '../../../Lib/quoteWizardTypes'
import { locationBiasToLatLngBoundsLiteral } from '@/Lib/publicQuote/locationBias'
import PublicRequiredMark from '@/components/quotes/PublicRequiredMark'

type FieldCompletion = 'filled' | 'empty'

const ADDRESS_COPY = {
  pt: {
    search: 'Comece pelo endereço completo',
    searchHint: 'Selecione uma sugestão do Google para confirmar o local.',
    selected: 'Endereço confirmado',
    selectionRequired: 'Selecione uma sugestão válida para continuar.',
    countryBlocked: 'Este endereço está fora dos países atendidos.',
    manual: 'O Google Places está indisponível. Preencha o endereço manualmente.',
  },
  en: {
    search: 'Start with the full address',
    searchHint: 'Choose a Google suggestion to confirm the location.',
    selected: 'Address confirmed',
    selectionRequired: 'Choose a valid suggestion to continue.',
    countryBlocked: 'This address is outside the supported countries.',
    manual: 'Google Places is unavailable. Enter the address manually.',
  },
  es: {
    search: 'Comienza con la dirección completa',
    searchHint: 'Elige una sugerencia de Google para confirmar el lugar.',
    selected: 'Dirección confirmada',
    selectionRequired: 'Elige una sugerencia válida para continuar.',
    countryBlocked: 'Esta dirección está fuera de los países atendidos.',
    manual: 'Google Places no está disponible. Completa la dirección manualmente.',
  },
} as const

function getInputClassName(completion?: FieldCompletion) {
  const base =
    'w-full rounded-xl border px-4 py-3.5 pr-10 text-base text-cdl-fg shadow-cdl outline-none transition-colors placeholder:text-cdl-faint focus:border-cdl-accent-border disabled:cursor-not-allowed disabled:opacity-70'
  if (completion === 'filled') return `${base} cdl-field-filled`
  if (completion === 'empty') return `${base} cdl-field-empty`
  return `${base} border-cdl-border bg-cdl-inset`
}

function FieldLabel({
  children,
  required,
  requiredLabel,
}: {
  children: React.ReactNode
  required?: boolean
  requiredLabel?: string
}) {
  return (
    <span className="cdl-eyebrow">
      {children}
      {required ? <PublicRequiredMark label={requiredLabel || ''} /> : null}
    </span>
  )
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

function isGoogleMapsPlacesReady() {
  return typeof window.google?.maps?.importLibrary === 'function'
}

function useGooglePlacesReady(language: QuoteLanguage) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(() => !apiKey)

  useEffect(() => {
    if (!apiKey) return

    let cancelled = false
    let pollTimer: number | undefined

    const markReady = () => {
      if (cancelled || !isGoogleMapsPlacesReady()) return false
      setReady(true)
      setFailed(false)
      return true
    }

    const waitUntilReady = () => {
      if (markReady()) return
      let attempts = 0
      pollTimer = window.setInterval(() => {
        attempts += 1
        if (markReady() || cancelled) {
          if (pollTimer) window.clearInterval(pollTimer)
          return
        }
        if (attempts >= 40) {
          if (pollTimer) window.clearInterval(pollTimer)
          if (!cancelled) setFailed(true)
        }
      }, 50)
    }

    if (isGoogleMapsPlacesReady()) {
      const readyTimer = window.setTimeout(() => {
        markReady()
      }, 0)
      return () => {
        cancelled = true
        window.clearTimeout(readyTimer)
        if (pollTimer) window.clearInterval(pollTimer)
      }
    }

    const scriptId = 'google-maps-places-script'
    const existing = document.getElementById(scriptId) as HTMLScriptElement | null
    const handleFailure = () => {
      if (!cancelled) setFailed(true)
    }

    if (existing) {
      existing.addEventListener('load', waitUntilReady)
      existing.addEventListener('error', handleFailure)
      if (
        existing.getAttribute('data-loaded') === 'true' ||
        isGoogleMapsPlacesReady()
      ) {
        waitUntilReady()
      }
      return () => {
        cancelled = true
        existing.removeEventListener('load', waitUntilReady)
        existing.removeEventListener('error', handleFailure)
        if (pollTimer) window.clearInterval(pollTimer)
      }
    }

    const script = document.createElement('script')
    script.id = scriptId
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&v=weekly&loading=async&libraries=places&language=${language}`
    script.async = true
    script.defer = true
    script.onload = () => {
      script.setAttribute('data-loaded', 'true')
      waitUntilReady()
    }
    script.onerror = handleFailure
    document.head.appendChild(script)

    return () => {
      cancelled = true
      if (pollTimer) window.clearInterval(pollTimer)
    }
  }, [apiKey, language])

  return { ready, unavailable: !apiKey || failed }
}

function clearCanonicalAddress(): Partial<AddressValues> {
  return {
    address: '',
    addressFormatted: '',
    addressPlaceId: null,
    addressCountry: '',
    addressLatitude: null,
    addressLongitude: null,
    addressSource: null,
  }
}

export default function AddressAutocompleteFields({
  values,
  onChange,
  className = '',
  fieldCompletions,
  language = 'pt',
  allowedCountries = ['US'],
  locationBias = null,
  markRequired = false,
  requiredLabel,
  placeholders,
}: {
  values: AddressValues
  onChange: (patch: Partial<AddressValues>) => void
  className?: string
  language?: QuoteLanguage | string | null
  allowedCountries?: string[]
  locationBias?: {
    lat: number
    lng: number
    radiusMeters: number
  } | null
  fieldCompletions?: {
    city?: FieldCompletion
    state?: FieldCompletion
    zipCode?: FieldCompletion
  }
  markRequired?: boolean
  requiredLabel?: string
  placeholders?: {
    search?: string
    number?: string
    city?: string
    state?: string
    postal?: string
  }
}) {
  const loc: QuoteLanguage = language === 'en' || language === 'es' ? language : 'pt'
  const copy = ADDRESS_COPY[loc]
  const countries = useMemo(
    () => [
      ...new Set(
        (Array.isArray(allowedCountries) ? allowedCountries : ['US'])
          .map((country) => country.trim().toUpperCase())
          .filter(Boolean),
      ),
    ],
    [allowedCountries],
  )
  const { ready, unavailable } = useGooglePlacesReady(loc)
  const googleUnavailable = unavailable
  const manualFallback = googleUnavailable
  const manualMode = manualFallback
  const onChangeRef = useRef(onChange)
  const valuesRef = useRef(values)
  const inputRef = useRef<HTMLInputElement>(null)
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null)
  const listenerRef = useRef<google.maps.MapsEventListener | null>(null)
  const mountedRef = useRef(true)
  const [query, setQuery] = useState(
    values.addressFormatted ||
      [values.address, values.addressNumber].filter(Boolean).join(', '),
  )
  const [addressError, setAddressError] = useState<string | null>(null)
  const [postalLookupError, setPostalLookupError] = useState<string | null>(null)
  const [lookingUpPostal, setLookingUpPostal] = useState(false)
  const lastPostalLookupRef = useRef('')

  useEffect(() => {
    onChangeRef.current = onChange
    valuesRef.current = values
  }, [onChange, values])

  useEffect(
    () => () => {
      mountedRef.current = false
      listenerRef.current?.remove()
    },
    [],
  )

  useEffect(() => {
    const input = inputRef.current
    const maps = window.google?.maps
    if (!input || !ready || !maps?.importLibrary) {
      return
    }
    if (autocompleteRef.current) {
      if (locationBias) {
        autocompleteRef.current.setBounds(
          locationBiasToLatLngBoundsLiteral(locationBias),
        )
        autocompleteRef.current.setOptions({ strictBounds: false })
      }
      return
    }
    let cancelled = false

    void maps
      .importLibrary('places')
      .then(({ Autocomplete }) => {
        if (cancelled) return
        const autocomplete = new Autocomplete(input, {
          types: ['address'],
          componentRestrictions:
            countries.length > 0
              ? { country: countries.map((country) => country.toLowerCase()) }
              : undefined,
          fields: [
            'place_id',
            'address_components',
            'formatted_address',
            'geometry',
          ],
          ...(locationBias
            ? {
                bounds: locationBiasToLatLngBoundsLiteral(locationBias),
                strictBounds: false,
              }
            : {}),
        })
        autocompleteRef.current = autocomplete
        listenerRef.current = autocomplete.addListener('place_changed', () => {
          const place = autocomplete.getPlace()
          void (async () => {
            const selected = await enrichGooglePlaceFromGeocoder(
              place,
              parseGooglePlace(place),
            )
            if (!mountedRef.current) return
            if (
              countries.length > 0 &&
              (!selected.addressCountry ||
                !countries.includes(selected.addressCountry))
            ) {
              setAddressError(copy.countryBlocked)
              setQuery(place.formatted_address || input.value)
              onChangeRef.current(clearCanonicalAddress())
              return
            }
            if (
              !selected.address ||
              !selected.city ||
              !selected.state ||
              !selected.zipCode
            ) {
              setAddressError(copy.selectionRequired)
              setQuery(place.formatted_address || input.value)
              onChangeRef.current(clearCanonicalAddress())
              return
            }

            setAddressError(null)
            setPostalLookupError(null)
            setQuery(
              selected.addressFormatted ||
                place.formatted_address ||
                selected.address,
            )
            onChangeRef.current(selected)
          })()
        })
      })
      .catch(() => setAddressError(tw(loc, 'googleLoadError')))

    return () => {
      cancelled = true
    }
  }, [copy.countryBlocked, copy.selectionRequired, countries, loc, locationBias, ready])

  useEffect(() => {
    if (!manualMode) return
    const digits = normalizePostalDigits(values.zipCode)
    if (
      !isUsablePostalCode(values.zipCode) ||
      lastPostalLookupRef.current === digits
    ) {
      return
    }

    let cancelled = false
    const timer = window.setTimeout(() => {
      setLookingUpPostal(true)
      setPostalLookupError(null)
      void lookupPostalAddress(values.zipCode)
        .then((result) => {
          if (cancelled) return
          lastPostalLookupRef.current = digits
          onChangeRef.current({
            address: valuesRef.current.address || result.address,
            city: valuesRef.current.city || result.city,
            state: valuesRef.current.state || result.state,
            zipCode: result.zipCode,
            addressCountry:
              inferCountryFromPostalCode(result.zipCode) ?? '',
            addressSource: 'manual',
          })
        })
        .catch(() => {
          if (!cancelled) {
            setPostalLookupError(tCommon(loc, 'postalNotFound'))
          }
        })
        .finally(() => {
          if (!cancelled) setLookingUpPostal(false)
        })
    }, 400)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [loc, manualMode, values.zipCode])

  const zipDigits = normalizePostalDigits(values.zipCode)
  const zipInvalid =
    zipDigits.length >= 5 && !isUsablePostalCode(values.zipCode)
  const canonicalConfirmed =
    values.addressSource === 'google' && Boolean(values.addressPlaceId)
  const manualPatch = (patch: Partial<AddressValues>) =>
    onChange({ ...patch, addressSource: 'manual', addressPlaceId: null })

  return (
    <div className={`grid grid-cols-1 gap-4 lg:grid-cols-12 ${className}`}>
      <label className="flex flex-col gap-2 lg:col-span-12">
        <FieldLabel required={markRequired} requiredLabel={requiredLabel}>
          {copy.search}
        </FieldLabel>
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            autoComplete="street-address"
            value={query}
            onChange={(event) => {
              const next = event.target.value
              setQuery(next)
              setAddressError(null)
              if (manualMode) {
                manualPatch({ address: next, addressFormatted: next })
              } else {
                onChange(clearCanonicalAddress())
              }
            }}
            placeholder={placeholders?.search || tw(loc, 'addressPlaceholder')}
            className={getInputClassName(
              canonicalConfirmed || (manualMode && values.address)
                ? 'filled'
                : 'empty',
            )}
            aria-invalid={
              Boolean(addressError) ||
              (!manualMode && Boolean(query) && !canonicalConfirmed)
            }
          />
          <FieldCheck
            show={canonicalConfirmed || (manualMode && Boolean(values.address))}
          />
        </div>
        <p
          className={`text-xs ${
            addressError
              ? 'text-cdl-action'
              : canonicalConfirmed
                ? 'text-cdl-success'
                : 'text-cdl-muted'
          }`}
        >
          {addressError ??
            (manualMode
              ? copy.manual
              : canonicalConfirmed
                ? copy.selected
                : copy.searchHint)}
        </p>
      </label>

      <label className="flex flex-col gap-2 lg:col-span-2">
        <FieldLabel>{tCommon(loc, 'streetNumber')}</FieldLabel>
        <input
          type="text"
          inputMode="numeric"
          value={values.addressNumber}
          placeholder={placeholders?.number}
          onChange={(event) => onChange({ addressNumber: event.target.value })}
          className={getInputClassName(
            values.addressNumber ? 'filled' : undefined,
          )}
        />
      </label>

      <label className="flex flex-col gap-2 lg:col-span-3">
        <FieldLabel required={markRequired} requiredLabel={requiredLabel}>
          {tCommon(loc, 'postalCode')}
        </FieldLabel>
        <div className="relative">
          <input
            type="text"
            inputMode="numeric"
            autoComplete="postal-code"
            value={values.zipCode}
            readOnly={!manualMode}
            onChange={(event) => {
              lastPostalLookupRef.current = ''
              manualPatch({ zipCode: formatPostalCode(event.target.value) })
            }}
            placeholder={
              placeholders?.postal || tCommon(loc, 'postalCodePlaceholder')
            }
            className={getInputClassName(fieldCompletions?.zipCode)}
            aria-invalid={zipInvalid || Boolean(postalLookupError)}
          />
          <FieldCheck show={fieldCompletions?.zipCode === 'filled'} />
        </div>
        {zipInvalid ? (
          <p className="text-xs text-cdl-action">
            {tCommon(loc, 'invalidPostalCode')}
          </p>
        ) : lookingUpPostal ? (
          <p className="text-xs text-cdl-muted">
            {tCommon(loc, 'postalLookingUp')}
          </p>
        ) : postalLookupError ? (
          <p className="text-xs text-cdl-action">{postalLookupError}</p>
        ) : null}
      </label>

      <label className="flex flex-col gap-2 lg:col-span-4">
        <FieldLabel required={markRequired} requiredLabel={requiredLabel}>
          {tCommon(loc, 'city')}
        </FieldLabel>
        <div className="relative">
          <input
            type="text"
            value={values.city}
            readOnly={!manualMode}
            onChange={(event) => manualPatch({ city: event.target.value })}
            placeholder={placeholders?.city || tw(loc, 'cityPlaceholder')}
            className={getInputClassName(fieldCompletions?.city)}
          />
          <FieldCheck show={fieldCompletions?.city === 'filled'} />
        </div>
      </label>

      <label className="flex flex-col gap-2 lg:col-span-3">
        <FieldLabel required={markRequired} requiredLabel={requiredLabel}>
          {tCommon(loc, 'state')}
        </FieldLabel>
        <div className="relative">
          <input
            type="text"
            value={values.state}
            readOnly={!manualMode}
            onChange={(event) => manualPatch({ state: event.target.value })}
            placeholder={placeholders?.state || tw(loc, 'statePlaceholder')}
            className={getInputClassName(fieldCompletions?.state)}
          />
          <FieldCheck show={fieldCompletions?.state === 'filled'} />
        </div>
      </label>
    </div>
  )
}
