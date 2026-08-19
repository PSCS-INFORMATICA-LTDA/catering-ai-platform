const KM_PER_MILE = 1.609344

/** Presentation-only conversion: commercial mileage rules stay in miles. */
export function milesToKilometers(miles: number): number {
  if (!Number.isFinite(miles)) return 0
  return Math.round(miles * KM_PER_MILE * 10) / 10
}

export function kilometersToMiles(kilometers: number): number {
  if (!Number.isFinite(kilometers)) return 0
  return Math.round((kilometers / KM_PER_MILE) * 10) / 10
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
