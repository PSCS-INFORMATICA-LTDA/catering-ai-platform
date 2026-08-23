const KM_PER_MILE = 1.609344

/** Company-scoped presentation preference. Pricing remains in miles. */
export type DistanceDisplayUnit = 'miles' | 'kilometers' | 'both'

/** Presentation-only conversion: commercial mileage rules stay in miles. */
export function milesToKilometers(miles: number): number {
  if (!Number.isFinite(miles)) return 0
  return Math.round(miles * KM_PER_MILE * 10) / 10
}

export function kilometersToMiles(kilometers: number): number {
  if (!Number.isFinite(kilometers)) return 0
  return Math.round((kilometers / KM_PER_MILE) * 10) / 10
}

export function parseDistanceDisplayUnit(
  value: unknown,
): DistanceDisplayUnit {
  const raw = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
  if (
    raw === 'miles' ||
    raw === 'mi' ||
    raw === 'mile' ||
    raw === 'imperial'
  ) {
    return 'miles'
  }
  if (
    raw === 'kilometers' ||
    raw === 'kilometres' ||
    raw === 'km' ||
    raw === 'metric'
  ) {
    return 'kilometers'
  }
  if (raw === 'both' || raw === 'mi_km' || raw === 'miles_km') {
    return 'both'
  }
  return 'both'
}

/**
 * Presentation-only mileage quantity. Does not change the commercial value
 * used by the pricing engine — it only collapses binary floating-point
 * noise such as `11.600000000000001` into `11.6`.
 */
export function formatMileageQuantity(
  value: number | null | undefined,
): string {
  if (value == null || !Number.isFinite(Number(value))) return '0'
  const rounded = Math.round(Number(value) * 10) / 10
  if (Object.is(rounded, -0) || rounded === 0) return '0'
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
}

export function formatMilesWithKilometers(
  miles: number | null | undefined,
  template: string,
): string | null {
  if (miles == null || !Number.isFinite(Number(miles))) return null
  const value = Number(miles)
  return template
    .replace('{mi}', formatMileageQuantity(value))
    .replace('{km}', formatMileageQuantity(milesToKilometers(value)))
}

export function formatDistanceForDisplay(
  miles: number | null | undefined,
  unit: DistanceDisplayUnit,
  templates: {
    miles: string
    kilometers: string
    both: string
  },
): string | null {
  if (unit === 'miles') {
    if (miles == null || !Number.isFinite(Number(miles))) return null
    return templates.miles.replace('{mi}', formatMileageQuantity(Number(miles)))
  }
  if (unit === 'kilometers') {
    if (miles == null || !Number.isFinite(Number(miles))) return null
    return templates.kilometers.replace(
      '{km}',
      formatMileageQuantity(milesToKilometers(Number(miles))),
    )
  }
  return formatMilesWithKilometers(miles, templates.both)
}
