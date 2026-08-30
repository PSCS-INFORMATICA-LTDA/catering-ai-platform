import type { QuoteLanguage } from '../quoteWizardTypes.ts'

const SKU_PATTERN = /^(ITEM|KIT|ADD|OPT|SIDE|PKG)_[A-Z0-9_]+$/i
const SNAKE_KEY_PATTERN = /^[A-Z0-9]+(?:_[A-Z0-9]+)+$/i
const KEBAB_KEY_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)+$/

const PROTECTED_TOKENS = ['ANGUS', 'WAGYU', 'BBQ', 'CDL'] as const
const PREMIUM_QUALIFIERS = ['ANGUS', 'WAGYU'] as const

const CONNECTORS_BY_LOCALE: Record<QuoteLanguage, ReadonlySet<string>> = {
  pt: new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'em', 'com', 'sem', 'para', 'por', 'a', 'o', 'as', 'os']),
  en: new Set(['of', 'the', 'and', 'or', 'with', 'in', 'on', 'for', 'to', 'a', 'an']),
  es: new Set(['de', 'del', 'la', 'las', 'el', 'los', 'y', 'e', 'con', 'sin', 'para', 'por', 'en', 'a']),
}

function stripDiacritics(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

export function isCatalogInternalKey(value: string | null | undefined): boolean {
  const trimmed = String(value ?? '').trim()
  if (!trimmed) return false
  if (SKU_PATTERN.test(trimmed) || SNAKE_KEY_PATTERN.test(trimmed)) return true
  return KEBAB_KEY_PATTERN.test(trimmed) && !/^t-bone$/i.test(trimmed)
}

function titleCaseWord(word: string): string {
  if (!word) return word
  return word.charAt(0).toLocaleUpperCase('pt-BR') + word.slice(1).toLocaleLowerCase('pt-BR')
}

function canonicalizeHyphenatedToken(token: string): string | null {
  const compact = stripDiacritics(token).replace(/[^a-zA-Z-]/g, '').toLowerCase()
  if (compact === 't-bone' || compact === 'tbone') return 'T-Bone'
  return null
}

function isProtectedToken(token: string): string | null {
  const compact = stripDiacritics(token).replace(/[^a-zA-Z]/g, '').toUpperCase()
  return PROTECTED_TOKENS.find((protectedToken) => protectedToken === compact) ?? null
}

function isPremiumQualifier(token: string): 'ANGUS' | 'WAGYU' | null {
  const compact = stripDiacritics(token).replace(/[^a-zA-Z]/g, '').toUpperCase()
  return PREMIUM_QUALIFIERS.find((qualifier) => qualifier === compact) ?? null
}

function formatEditorialWord(word: string, locale: QuoteLanguage, isFirstVisibleWord: boolean): string {
  const hyphenated = canonicalizeHyphenatedToken(word)
  if (hyphenated) return hyphenated

  const protectedToken = isProtectedToken(word)
  if (protectedToken) return protectedToken

  const normalized = word.toLocaleLowerCase(locale === 'en' ? 'en-US' : locale === 'es' ? 'es-ES' : 'pt-BR')
  const connectors = CONNECTORS_BY_LOCALE[locale]
  if (!isFirstVisibleWord && connectors.has(stripDiacritics(normalized))) {
    return normalized
  }

  return titleCaseWord(word)
}

function extractPremiumQualifier(tokens: string[]): {
  qualifier: 'ANGUS' | 'WAGYU' | null
  rest: string[]
  position: 'start' | 'middle' | 'end' | 'none'
} {
  let qualifier: 'ANGUS' | 'WAGYU' | null = null
  let qualifierIndex = -1
  const rest: string[] = []

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index]
    const strippedParens = token.replace(/^[()]+|[()]+$/g, '').trim()
    const found = isPremiumQualifier(strippedParens)
    if (found && !qualifier) {
      qualifier = found
      qualifierIndex = index
      continue
    }
    rest.push(token)
  }

  let position: 'start' | 'middle' | 'end' | 'none' = 'none'
  if (qualifier != null) {
    if (qualifierIndex === 0) position = 'start'
    else if (qualifierIndex === tokens.length - 1) position = 'end'
    else position = 'middle'
  }

  return { qualifier, rest, position }
}

function tokenizeDisplayLabel(value: string): string[] {
  return value
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
}

/**
 * Editorial catalog display-name normalizer.
 *
 * Use on admin save, import, and DEV data cleanup — never as a public-quote
 * render mask that rewrites every catalog label on the fly.
 */
export function formatCatalogDisplayLabel(
  raw: string | null | undefined,
  locale: QuoteLanguage = 'pt',
): string {
  if (!raw) return ''
  const trimmed = raw.replace(/\s+/g, ' ').trim()
  if (!trimmed) return ''
  if (isCatalogInternalKey(trimmed)) return trimmed

  const { qualifier, rest, position } = extractPremiumQualifier(tokenizeDisplayLabel(trimmed))
  const formatted: string[] = []
  let firstVisibleWordSeen = false

  for (const token of rest) {
    if (/^\(.*\)$/.test(token)) {
      const inner = token.slice(1, -1).trim()
      if (isPremiumQualifier(inner)) continue
      formatted.push(`(${formatEditorialWord(inner, locale, true)})`)
      firstVisibleWordSeen = true
      continue
    }

    formatted.push(formatEditorialWord(token, locale, !firstVisibleWordSeen))
    firstVisibleWordSeen = true
  }

  if (!qualifier) {
    return formatted.join(' ')
  }

  if (formatted.length === 0) {
    return `(${qualifier})`
  }

  if (position === 'middle' && formatted.length > 1) {
    const [head, ...tail] = formatted
    return `${head} (${qualifier}) ${tail.join(' ')}`
  }

  return `${formatted.join(' ')} (${qualifier})`
}

/** @deprecated Use formatCatalogDisplayLabel(raw, locale). Kept for older callers. */
export function formatCatalogDisplayName(raw: string | null | undefined): string {
  return formatCatalogDisplayLabel(raw, 'pt')
}

export function normalizeCatalogItemLabelFields<
  T extends {
    item_name?: string | number | boolean | null
    label_pt?: string | number | boolean | null
    label_en?: string | number | boolean | null
    label_es?: string | number | boolean | null
  },
>(payload: T, options: { normalizeItemName?: boolean } = {}): T {
  const normalizeItemName = options.normalizeItemName !== false
  return {
    ...payload,
    ...(payload.label_pt != null
      ? { label_pt: formatCatalogDisplayLabel(String(payload.label_pt), 'pt') || payload.label_pt }
      : {}),
    ...(payload.label_en != null
      ? { label_en: formatCatalogDisplayLabel(String(payload.label_en), 'en') || payload.label_en }
      : {}),
    ...(payload.label_es != null
      ? { label_es: formatCatalogDisplayLabel(String(payload.label_es), 'es') || payload.label_es }
      : {}),
    ...(normalizeItemName && payload.item_name != null
      ? {
          item_name:
            formatCatalogDisplayLabel(String(payload.item_name), 'pt') || payload.item_name,
        }
      : {}),
  }
}

export const CATALOG_DISPLAY_PROTECTED_TOKENS = [...PROTECTED_TOKENS, 'T-Bone'] as const
export const CATALOG_DISPLAY_CONNECTORS = CONNECTORS_BY_LOCALE
