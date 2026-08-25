import { resolveUiLocale } from '@/Lib/i18n/locales'
import type { QuoteLanguage } from '@/Lib/quoteWizardTypes'

type CdlItemTranslation = { en: string; es: string }

const CDL_ITEM_I18N: Record<string, CdlItemTranslation> = {
  'Picanha Angus': { en: 'Angus picanha', es: 'Picaña Angus' },
  'Linguiça tradicional': { en: 'Traditional sausage', es: 'Salchicha tradicional' },
  'Linguiça': { en: 'Sausage', es: 'Salchicha' },
  'Frango sobrecoxa desossada': {
    en: 'Boneless chicken thigh',
    es: 'Muslo de pollo deshuesado',
  },
  'Pão de alho': { en: 'Garlic bread', es: 'Pan de ajo' },
  'Queijo coalho': { en: 'Grilled coalho cheese', es: 'Queso coalho a la parrilla' },
  'Queijo': { en: 'Cheese', es: 'Queso' },
  'Milho': { en: 'Corn', es: 'Maíz' },
  'Costela de porco ou boi': { en: 'Pork or beef ribs', es: 'Costilla de cerdo o res' },
  'Costela de boi ou costela de porco': {
    en: 'Beef or pork ribs',
    es: 'Costilla de res o de cerdo',
  },
  'Salmão ou camarão': { en: 'Salmon or shrimp', es: 'Salmón o camarón' },
  'Carré de cordeiro': { en: 'Rack of lamb', es: 'Costillar de cordero' },
  Chimichurri: { en: 'Chimichurri', es: 'Chimichurri' },
  Farofa: { en: 'Farofa', es: 'Farofa' },
  Mel: { en: 'Honey', es: 'Miel' },
  Goiabada: { en: 'Guava paste', es: 'Dulce de guayaba' },
  'Pimenta de bico': { en: "Bird's eye pepper", es: 'Ají de bico' },
  'Geleia de pimenta': { en: 'Pepper jelly', es: 'Jalea de pimiento' },
  'Arroz branco': { en: 'White rice', es: 'Arroz blanco' },
  'Feijão preto': { en: 'Black beans', es: 'Frijoles negros' },
  Vinagrete: { en: 'Vinaigrette salsa', es: 'Vinagreta' },
  Mandioca: { en: 'Cassava', es: 'Yuca' },
  Maionese: { en: 'Potato salad', es: 'Ensalada de papa' },
  'Churrasco tradicional CDL': {
    en: 'CDL traditional barbecue',
    es: 'Parrillada tradicional CDL',
  },
  'Melhor opção de entrada': { en: 'Best starter option', es: 'Mejor opción de entrada' },
  'Seleção clássica para eventos': {
    en: 'Classic selection for events',
    es: 'Selección clásica para eventos',
  },
  'Opção intermediária com upgrade de proteína': {
    en: 'Mid-tier option with protein upgrade',
    es: 'Opción intermedia con mejora de proteína',
  },
  'Opção premium sem carré de cordeiro': {
    en: 'Premium option without rack of lamb',
    es: 'Opción premium sin costillar de cordero',
  },
  'Experiência premium completa': {
    en: 'Full premium experience',
    es: 'Experiencia premium completa',
  },
  'Montado conforme necessidade do cliente': {
    en: "Built to the customer's needs",
    es: 'Armado según la necesidad del cliente',
  },
  'Itens definidos manualmente': {
    en: 'Items defined manually',
    es: 'Ítems definidos manualmente',
  },
  'Ideal para eventos customizados': {
    en: 'Ideal for custom events',
    es: 'Ideal para eventos personalizados',
  },
  'Itens definidos conforme necessidade do evento.': {
    en: 'Items defined according to the event.',
    es: 'Ítems definidos según la necesidad del evento.',
  },
}

function normalizeItemKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

const CDL_ITEM_I18N_BY_NORMALIZED = new Map(
  Object.entries(CDL_ITEM_I18N).map(([pt, translation]) => [
    normalizeItemKey(pt),
    translation,
  ]),
)

function lookupTranslation(label: string): CdlItemTranslation | null {
  const trimmed = label.trim()
  if (!trimmed) return null
  return (
    CDL_ITEM_I18N[trimmed] ??
    CDL_ITEM_I18N_BY_NORMALIZED.get(normalizeItemKey(trimmed)) ??
    null
  )
}

export function translateCdlItem(
  label: string | null | undefined,
  locale?: string | null,
): string {
  const raw = String(label ?? '').trim()
  if (!raw) return ''
  const loc = resolveUiLocale(locale)
  if (loc === 'pt') return raw
  const translation = lookupTranslation(raw)
  if (!translation) return raw
  return loc === 'es' ? translation.es : translation.en
}

export function translateCdlItemList(
  items: ReadonlyArray<string>,
  locale?: string | null,
): string[] {
  return items.map((item) => translateCdlItem(item, locale)).filter(Boolean)
}

/** Traduz listas já unidas por • , ou quebra de linha (fallback CDL). */
export function translateCdlJoinedList(
  text: string | null | undefined,
  locale?: string | null,
): string {
  const raw = String(text ?? '').trim()
  if (!raw) return ''
  const loc = resolveUiLocale(locale)
  if (loc === 'pt') return raw
  const separator = raw.includes(' • ') ? ' • ' : raw.includes(',') ? ', ' : null
  if (!separator) return translateCdlItem(raw, locale)
  return raw
    .split(separator)
    .map((part) => translateCdlItem(part.trim(), locale))
    .filter(Boolean)
    .join(separator.trim() === ',' ? ', ' : ' • ')
}

export function resolveCatalogItemDisplayLabel(
  values: {
    pt?: string | null
    en?: string | null
    es?: string | null
    fallback?: string | null
  },
  locale?: string | null,
): string {
  const loc = resolveUiLocale(locale) as QuoteLanguage
  const dedicated =
    loc === 'en'
      ? values.en?.trim()
      : loc === 'es'
        ? values.es?.trim()
        : values.pt?.trim()
  if (dedicated) return dedicated
  const source =
    values.pt?.trim() ||
    values.fallback?.trim() ||
    values.en?.trim() ||
    values.es?.trim() ||
    ''
  return translateCdlItem(source, loc) || source
}
