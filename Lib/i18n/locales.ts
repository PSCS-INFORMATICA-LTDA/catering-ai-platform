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
