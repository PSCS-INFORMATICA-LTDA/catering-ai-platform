export const INTERNAL_NOTES_MAX_LENGTH = 4000

export function sanitizeInternalNotes(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .trim()
    .slice(0, INTERNAL_NOTES_MAX_LENGTH)
}

export function omitInternalNotes<T extends Record<string, unknown>>(
  quote: T,
): Omit<T, 'internal_notes'> {
  const publicQuote = { ...quote }
  delete publicQuote.internal_notes
  return publicQuote
}

export function quoteContainsInternalNotes(value: unknown) {
  if (!value || typeof value !== 'object') return false
  return Object.prototype.hasOwnProperty.call(value, 'internal_notes')
}
