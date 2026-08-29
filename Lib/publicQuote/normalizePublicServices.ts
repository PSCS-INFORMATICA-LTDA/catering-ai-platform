import { getPublicPackageSidesGroup } from '../packageCatalogVisual.ts'
import {
  isDisposableKitCatalogItem,
  isGrillRentalCatalogItem,
  sanitizePublicAdditionalQuantity,
  type StructuralExtraItem,
} from './structuralExtras.ts'

export type PublicGrillSelection = {
  setupAnswered?: boolean | null
  hasGrill?: boolean | null
  rentalRequired?: boolean | null
  rentalQty?: number | null
}

export function normalizePublicGrillSelection<T extends PublicGrillSelection>(
  grill: T,
): T & { rentalRequired: boolean; rentalQty: number } {
  if (grill.hasGrill === true) {
    return {
      ...grill,
      rentalRequired: false,
      rentalQty: 0,
    }
  }
  if (grill.setupAnswered === true || grill.hasGrill === false) {
    return {
      ...grill,
      rentalRequired: true,
      rentalQty: 1,
    }
  }
  return {
    ...grill,
    rentalRequired: Boolean(grill.rentalRequired),
    rentalQty: sanitizePublicAdditionalQuantity(grill.rentalQty),
  }
}

export function pruneStructuralAdditionalLines<
  T extends { itemId: string; quantity: number },
>(
  lines: ReadonlyArray<T>,
  catalogById: Map<string, StructuralExtraItem>,
  packageFields?: { package_key?: string | null } | null,
): T[] {
  const hasSides =
    packageFields != null &&
    getPublicPackageSidesGroup(packageFields) === 'with_sides'

  return lines.flatMap((line) => {
    const quantity = sanitizePublicAdditionalQuantity(line.quantity)
    if (quantity <= 0) return []
    const catalog = catalogById.get(line.itemId)
    if (isGrillRentalCatalogItem(catalog)) return []
    if (hasSides && isDisposableKitCatalogItem(catalog)) return []
    return [{ ...line, quantity }]
  })
}
