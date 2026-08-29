export type PublicGrillDraftFields = {
  setupAnswered?: boolean | null
  hasGrill?: boolean | null
  photoReference?: string | null
  rentalRequired?: boolean | null
  rentalQty?: number | null
  notes?: string | null
}

/**
 * A leftover `hasGrill: false` in an empty session draft is not a BBQ answer.
 * Only treat the grill step as answered when the user actually reached it or
 * recorded a real choice.
 */
export function isPublicGrillDraftAnswered(
  grill: PublicGrillDraftFields | null | undefined,
  currentStep = 0,
): boolean {
  if (!grill) return false
  if (grill.setupAnswered === true) return true
  if (grill.setupAnswered === false) return false
  if (currentStep >= 2) return true
  if (grill.hasGrill === true) return true
  if (grill.rentalRequired === true) return true
  if (Number(grill.rentalQty) > 0) return true
  if (String(grill.photoReference ?? '').trim()) return true
  if (String(grill.notes ?? '').trim()) return true
  return false
}
