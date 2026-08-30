import type { QuoteLanguage } from '../quoteWizardTypes.ts'

export const PORK_SAUSAGE_ITEM_KEY = 'ITEM_LINGUICA_TOSCANA_TRADICIONAL'
export const CHICKEN_SAUSAGE_ITEM_KEY = 'ITEM_024'
export const PORK_SAUSAGE_OPTION_KEY = 'TRADICIONAL_PORCO'
export const CHICKEN_SAUSAGE_OPTION_KEY = 'TRADICIONAL_FRANGO'

const PORK_SAUSAGE_LABELS = {
  pt: 'Tradicional Porco',
  en: 'Traditional Pork Sausage',
  es: 'Salchicha Tradicional De Cerdo',
} as const

const CHICKEN_SAUSAGE_LABELS = {
  pt: 'Tradicional Frango',
  en: 'Traditional Chicken Sausage',
  es: 'Salchicha Tradicional De Pollo',
} as const

const SAUSAGE_DISPLAY_LABELS = {
  [PORK_SAUSAGE_ITEM_KEY]: PORK_SAUSAGE_LABELS,
  [PORK_SAUSAGE_OPTION_KEY]: PORK_SAUSAGE_LABELS,
  [CHICKEN_SAUSAGE_ITEM_KEY]: CHICKEN_SAUSAGE_LABELS,
  [CHICKEN_SAUSAGE_OPTION_KEY]: CHICKEN_SAUSAGE_LABELS,
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
