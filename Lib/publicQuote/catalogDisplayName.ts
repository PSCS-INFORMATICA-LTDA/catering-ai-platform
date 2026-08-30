const ACRONYMS = new Map<string, string>([
  ['bbq', 'BBQ'],
  ['cdl', 'CDL'],
  ['us$', 'US$'],
  ['usd', 'USD'],
])

const SKU_LIKE =
  /^(ITEM|KIT|CDL)_[A-Z0-9_]+$|^[A-Z]{2,}[A-Z0-9]*_[A-Z0-9_]+$/

/**
 * Display-only Title Case for catalog item names.
 * Canonical DB labels / keys stay untouched.
 */
export function formatCatalogDisplayName(
  raw: string | null | undefined,
): string {
  const normalized = String(raw ?? '')
    .trim()
    .replace(/\s+/g, ' ')
  if (!normalized) return ''
  if (SKU_LIKE.test(normalized)) return normalized

  return normalized
    .split(' ')
    .map((word) => formatDisplayWord(word))
    .join(' ')
}

function formatDisplayWord(word: string): string {
  if (!word) return word
  if (/^us\$/i.test(word)) {
    return `US$${word.slice(3)}`
  }
  const lower = word.toLocaleLowerCase('pt-BR')
  const acronym = ACRONYMS.get(lower)
  if (acronym) return acronym

  const chars = Array.from(lower)
  const letterIndex = chars.findIndex((ch) => /\p{L}/u.test(ch))
  if (letterIndex < 0) return word
  chars[letterIndex] = chars[letterIndex].toLocaleUpperCase('pt-BR')
  return chars.join('')
}
