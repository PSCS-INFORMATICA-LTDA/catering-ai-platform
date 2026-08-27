import { GRILL_RENTAL_FEE } from './cdlCommercialRules'

/** Public and server grill rental is yes/no. Quantity is never customer-editable. */
export function normalizeGrillRentalQty(required: boolean): 0 | 1 {
  return required ? 1 : 0
}

export function calcNormalizedGrillRentalFee(
  required: boolean,
  feePerUnit: number = GRILL_RENTAL_FEE,
): number {
  if (!required) return 0
  const fee = Math.max(0, Number(feePerUnit) || 0)
  return Math.round(fee * 100) / 100
}
