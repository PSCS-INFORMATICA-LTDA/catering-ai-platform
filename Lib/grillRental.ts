import { GRILL_RENTAL_FEE } from './cdlCommercialRules'

/** Public and server grill rental is yes/no. Quantity is never customer-editable. */
export function normalizeGrillRentalQty(required: boolean): 0 | 1 {
  return required ? 1 : 0
}

/**
 * CDL: if the venue has no grill, rental is mandatory (qty 1).
 * If the venue has a grill, rental is never offered.
 */
export function resolveGrillRentalFromSite(
  hasGrill: boolean | null | undefined,
): { required: boolean; qty: 0 | 1 } | null {
  if (hasGrill === true) return { required: false, qty: 0 }
  if (hasGrill === false) return { required: true, qty: 1 }
  return null
}

export function calcNormalizedGrillRentalFee(
  required: boolean,
  feePerUnit: number = GRILL_RENTAL_FEE,
): number {
  if (!required) return 0
  const fee = Math.max(0, Number(feePerUnit) || 0)
  return Math.round(fee * 100) / 100
}
