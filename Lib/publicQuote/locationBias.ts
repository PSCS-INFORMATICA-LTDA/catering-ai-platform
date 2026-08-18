export type PublicLocationBias = {
  lat: number
  lng: number
  radiusMeters: number
}

/** Orlando, FL — bias only, never a hard restriction. */
export const CDL_FLORIDA_LOCATION_BIAS: PublicLocationBias = {
  lat: 28.5383,
  lng: -81.3792,
  radiusMeters: 160_000,
}

const CDL_SLUGS = new Set(['cdl', 'cdl-services'])

/**
 * Company-scoped Places bias. CDL prefers Florida/Orlando results.
 * Other tenants receive no Florida bias. Callers must not set
 * `locationRestriction` from this value.
 */
export function resolvePublicLocationBias(input: {
  companySlug?: string | null
}): PublicLocationBias | null {
  const slug = input.companySlug?.trim().toLowerCase()
  if (slug && CDL_SLUGS.has(slug)) return CDL_FLORIDA_LOCATION_BIAS
  return null
}

export function locationBiasToCircleOptions(bias: PublicLocationBias) {
  return {
    center: { lat: bias.lat, lng: bias.lng },
    radius: bias.radiusMeters,
  }
}

/** Approximate circle as LatLngBoundsLiteral for legacy Places Autocomplete. */
export function locationBiasToLatLngBoundsLiteral(bias: PublicLocationBias) {
  const latDelta = bias.radiusMeters / 111_320
  const lngDelta =
    bias.radiusMeters /
    (111_320 * Math.max(Math.cos((bias.lat * Math.PI) / 180), 0.2))
  return {
    north: bias.lat + latDelta,
    south: bias.lat - latDelta,
    east: bias.lng + lngDelta,
    west: bias.lng - lngDelta,
  }
}
