import type { QuoteLanguage } from '../quoteWizardTypes.ts'

export const PORK_SAUSAGE_ITEM_KEY = 'ITEM_LINGUICA_TOSCANA_TRADICIONAL'
export const CHICKEN_SAUSAGE_ITEM_KEY = 'ITEM_024'

const SAUSAGE_DISPLAY_LABELS = {
  [PORK_SAUSAGE_ITEM_KEY]: {
    pt: 'TRADICIONAL PORCO',
    en: 'TRADITIONAL PORK SAUSAGE',
    es: 'SALCHICHA TRADICIONAL DE CERDO',
  },
  [CHICKEN_SAUSAGE_ITEM_KEY]: {
    pt: 'TRADICIONAL FRANGO',
    en: 'TRADITIONAL CHICKEN SAUSAGE',
    es: 'SALCHICHA TRADICIONAL DE POLLO',
  },
} as const

export function resolveSausageDisplayLabel(
  item:
    | {
        item_key?: string | null
        option_item_key?: string | null
        label_pt?: string | null
      }
    | null
    | undefined,
  language: QuoteLanguage,
  fallback = '',
): string {
  const key = (
    item?.item_key ??
    item?.option_item_key ??
    ''
  )
    .trim()
    .toUpperCase()
  const mapped = SAUSAGE_DISPLAY_LABELS[key as keyof typeof SAUSAGE_DISPLAY_LABELS]
  if (mapped) return mapped[language]
  return fallback
}
