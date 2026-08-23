export function publicQuoteActiveStorageKey(companySlug: string): string {
  return `public-quote-active:${companySlug}`
}

/** True when an intake session already has contact, package, or a step past client. */
export function publicQuoteSessionHasProgress(
  draft: unknown,
  currentStep: number,
): boolean {
  if (Number.isFinite(Number(currentStep)) && Number(currentStep) > 0) {
    return true
  }
  if (!draft || typeof draft !== 'object') return false
  const root = draft as Record<string, unknown>
  const contact =
    root.contact && typeof root.contact === 'object'
      ? (root.contact as Record<string, unknown>)
      : {}
  const selection =
    root.selection && typeof root.selection === 'object'
      ? (root.selection as Record<string, unknown>)
      : {}
  return Boolean(
    String(contact.firstName ?? '').trim() ||
      String(contact.phone ?? '').trim() ||
      String(selection.packageId ?? '').trim(),
  )
}
