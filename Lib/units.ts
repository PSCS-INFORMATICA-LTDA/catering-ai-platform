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

export function formatMilesWithKilometers(
  miles: number | null | undefined,
  template: string,
): string | null {
  if (miles == null || !Number.isFinite(Number(miles))) return null
  const value = Number(miles)
  return template
    .replace('{mi}', String(value))
    .replace('{km}', String(milesToKilometers(value)))
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
    return templates.miles.replace('{mi}', String(Number(miles)))
  }
  if (unit === 'kilometers') {
    if (miles == null || !Number.isFinite(Number(miles))) return null
    return templates.kilometers.replace(
      '{km}',
      String(milesToKilometers(Number(miles))),
    )
  }
  return formatMilesWithKilometers(miles, templates.both)
}
