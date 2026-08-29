import type { QuoteLanguage } from '../quoteWizardTypes.ts'

export const PACKAGE_SAUSAGE_OPTION_KEY = 'LINGUICA_OPTION'
export const PORK_SAUSAGE_ITEM_KEY = 'ITEM_LINGUICA_TOSCANA_TRADICIONAL'
export const CHICKEN_SAUSAGE_ITEM_KEY = 'ITEM_024'

export const SAUSAGE_DISPLAY_LABELS = {
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

const SAUSAGE_LABEL_ALIASES = new Set([
  'toscana tradicional',
  'linguica toscana tradicional',
  'linguica toscana (tradicional)',
  'tradicional frango',
  'chiken (traditional)',
  'salchicha de pollo',
])

export function resolveSausageDisplayLabel(
  item:
    | {
        item_key?: string | null
        option_item_key?: string | null
        label_pt?: string | null
        item_name?: string | null
      }
    | null
    | undefined,
  language: QuoteLanguage,
  fallback = '',
): string {
  const key = item?.item_key?.trim().toUpperCase() ?? ''
  const optionAsItemKey = item?.option_item_key?.trim().toUpperCase() ?? ''
  const byKey =
    SAUSAGE_DISPLAY_LABELS[key as keyof typeof SAUSAGE_DISPLAY_LABELS] ??
    SAUSAGE_DISPLAY_LABELS[optionAsItemKey as keyof typeof SAUSAGE_DISPLAY_LABELS]
  if (byKey) return byKey[language]

  const optionKey = item?.option_item_key?.trim().toLowerCase() ?? ''
  if (optionKey === 'tradicional_porco' || optionKey === 'pork_sausage') {
    return SAUSAGE_DISPLAY_LABELS[PORK_SAUSAGE_ITEM_KEY][language]
  }
  if (optionKey === 'tradicional_frango' || optionKey === 'chicken_sausage') {
    return SAUSAGE_DISPLAY_LABELS[CHICKEN_SAUSAGE_ITEM_KEY][language]
  }

  const alias = `${item?.label_pt ?? ''} ${item?.item_name ?? ''}`
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
  if (SAUSAGE_LABEL_ALIASES.has(alias) || alias.includes('toscana tradicional')) {
    return SAUSAGE_DISPLAY_LABELS[PORK_SAUSAGE_ITEM_KEY][language]
  }
  return fallback
}
