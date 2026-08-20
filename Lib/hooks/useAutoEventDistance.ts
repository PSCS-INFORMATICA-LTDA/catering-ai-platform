'use client'

import { useEffect, useRef } from 'react'

function destinationFromParts(parts: {
  address: string
  addressNumber?: string
  city: string
  state: string
  zipCode: string
}) {
  return [
    [parts.address, parts.addressNumber].filter(Boolean).join(', '),
    parts.city,
    parts.state,
    parts.zipCode,
  ]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(', ')
}

function milesFromMeters(meters: number) {
  return Math.round((meters / 1609.344) * 10) / 10
}

export function useAutoEventDistance({
  origin,
  address,
  addressNumber,
  city,
  state,
  zipCode,
  enabled,
  onDistance,
}: {
  origin: string
  address: string
  addressNumber?: string
  city: string
  state: string
  zipCode: string
  enabled: boolean
  onDistance: (miles: number) => void
}) {
  const onDistanceRef = useRef(onDistance)
  onDistanceRef.current = onDistance
  const lastKeyRef = useRef('')

  useEffect(() => {
    if (!enabled) return
    const destination = destinationFromParts({
      address,
      addressNumber,
      city,
      state,
      zipCode,
    })
    const originLabel = origin.trim()
    if (!originLabel || !address.trim() || !city.trim()) return

    const key = `${originLabel}|${destination}`
    if (lastKeyRef.current === key) return

    const maps = window.google?.maps
    if (!maps?.importLibrary) return

    let cancelled = false
    lastKeyRef.current = key

    void (async () => {
      try {
        const { DistanceMatrixService } = (await maps.importLibrary(
          'routes',
        )) as google.maps.RoutesLibrary
        if (cancelled) return

        const service = new DistanceMatrixService()
        service.getDistanceMatrix(
          {
            origins: [originLabel],
            destinations: [destination],
            travelMode: google.maps.TravelMode.DRIVING,
            unitSystem: google.maps.UnitSystem.IMPERIAL,
          },
          (response, status) => {
            if (cancelled) return
            if (status !== 'OK' || !response) return
            const meters = response.rows[0]?.elements[0]?.distance?.value
            if (meters == null || Number.isNaN(meters)) return
            onDistanceRef.current(milesFromMeters(meters))
          },
        )
      } catch {
        if (lastKeyRef.current === key) lastKeyRef.current = ''
      }
    })()

    return () => {
      cancelled = true
    }
  }, [enabled, origin, address, addressNumber, city, state, zipCode])
}
