/**
 * PDF package per-person box — presentation of the canonical snapshot.
 * Does not invent garnish $0 and does not read prices from the artwork.
 */

export type QuotePdfPackagePerPersonBreakdown = {
  showSides: boolean
  packagePerPerson: number
  sidesPerPerson: number
  totalPerPerson: number
}

export function packageKeyIncludesSides(packageKey?: string | null): boolean {
  return (packageKey ?? '').trim().endsWith('+')
}

export function resolveQuotePdfPackagePerPersonBreakdown(input: {
  packageKey?: string | null
  packageUnitPrice?: number | null
  sidesPricePerPerson: number
}): QuotePdfPackagePerPersonBreakdown | null {
  const total = Number(input.packageUnitPrice)
  if (!Number.isFinite(total) || total <= 0) return null

  const sides = Number(input.sidesPricePerPerson)
  const withSides = packageKeyIncludesSides(input.packageKey)
  if (
    withSides &&
    Number.isFinite(sides) &&
    sides > 0 &&
    total > sides
  ) {
    return {
      showSides: true,
      packagePerPerson: total - sides,
      sidesPerPerson: sides,
      totalPerPerson: total,
    }
  }

  return {
    showSides: false,
    packagePerPerson: total,
    sidesPerPerson: 0,
    totalPerPerson: total,
  }
}
