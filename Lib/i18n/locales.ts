import type { AuthLocale } from './authUsers.ts'
import { resolveAuthLocale } from './authUsers.ts'
import type { QuoteLanguage } from '../quoteWizardTypes.ts'

export type ProductLocale = AuthLocale

/** Idioma da interface (menus, botões, labels). Fonte: app_users.preferred_language. */
export function resolveUiLocale(
  preferredLanguage: string | null | undefined,
): ProductLocale {
  return resolveAuthLocale(preferredLanguage)
}

/** Idioma do documento (proposta, PDF, e-mail). Fonte: quotes.language. */
export function resolveDocumentLocale(
  quoteLanguage: string | null | undefined,
): QuoteLanguage {
  const v = String(quoteLanguage || 'pt').toLowerCase()
  if (v.startsWith('en')) return 'en'
  if (v.startsWith('es')) return 'es'
  return 'pt'
}

/** BCP 47 para Intl (datas, números). UI continua pt | en | es. */
export function toBcp47Locale(locale: string | null | undefined): string {
  const loc = resolveUiLocale(locale)
  if (loc === 'en') return 'en-US'
  if (loc === 'es') return 'es'
  return 'pt-BR'
}

export function formatUiDate(
  value: string | null | undefined,
  locale: string | null | undefined,
  options?: Intl.DateTimeFormatOptions,
): string {
  if (!value) return '—'
  const normalized = value.includes('T') ? value : `${value}T00:00:00`
  const date = new Date(normalized)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString(
    toBcp47Locale(locale),
    options ?? { day: '2-digit', month: 'short', year: 'numeric' },
  )
}

/**
 * Nunca devolve a chave crua ao usuário.
 * requested → pt → en → es → string vazia.
 */
export function pickLocalizedText(
  values: { pt?: string; en?: string; es?: string },
  locale: string | null | undefined,
): string {
  const loc = resolveUiLocale(locale)
  const ordered: ProductLocale[] =
    loc === 'en' ? ['en', 'pt', 'es'] : loc === 'es' ? ['es', 'pt', 'en'] : ['pt', 'en', 'es']
  for (const l of ordered) {
    const v = values[l]
    if (typeof v === 'string' && v.trim()) return v
  }
  return ''
}
