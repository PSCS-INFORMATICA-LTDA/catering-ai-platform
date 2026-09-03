import { getAdditionalItemCategoryKey } from '@/Lib/additionalItemFieldAccess'
import { getPublicAdditionalDisplayImageUrl } from '@/Lib/publicQuote/grillRentalDisplay'
import { getAdditionalItemPrice } from '@/Lib/additionalItemFieldAccess'
import { calcAdditionalLineTotal } from '@/Lib/calculateQuoteTotals'
import {
  compareCategoryKeys,
  getCategoryLabel,
} from '@/Lib/quoteTranslations'
import { resolveCatalogItemDisplayLabel } from '@/Lib/cdlPackageItemI18n'
import type { QuoteLanguage } from '@/Lib/quoteWizardTypes'

export type QuoteAdditionalItem = {
  id: string
  item_key?: string | null
  item_name?: string | null
  label_pt?: string | null
  label_en?: string | null
  label_es?: string | null
  category_key?: string | null
  category_pt?: string | null
  category_en?: string | null
  category_es?: string | null
  pricing_type?: string | null
  charge_type?: string | null
  quantity?: number | null
  unit_label?: string | null
  unit?: string | null
  quantity_2?: number | null
  uom_2?: string | null
  image_url?: string | null
  image_status?: string | null
  item_type?: string | null
}

export function getLocalizedAdditionalLabel(
  item: QuoteAdditionalItem,
  language: QuoteLanguage,
): string {
  return (
    resolveCatalogItemDisplayLabel(
      {
        pt: item.label_pt,
        en: item.label_en,
        es: item.label_es,
        fallback: item.item_name,
      },
      language,
    ) || '—'
  )
}

export function isPerPersonAdditional(item: QuoteAdditionalItem): boolean {
  return (
    item.pricing_type === 'PER_PERSON' || item.charge_type === 'PERSON'
  )
}

export {
  getAdditionalChargeUnit,
  getAdditionalChargeUnitLabel,
  type AdditionalChargeUnit,
} from '@/Lib/additionalChargeUnit'

export function hasAdditionalPrice(item: QuoteAdditionalItem): boolean {
  return getAdditionalUnitPrice(item) > 0
}

export function getAdditionalUnitPrice(item: QuoteAdditionalItem): number {
  return getAdditionalItemPrice(item)
}

export {
  formatAdditionalPrice,
  getAdditionalPriceLabel,
} from '@/Lib/additionalPriceDisplay'

export function normalizeAdditionalQuantity(
  item: QuoteAdditionalItem,
  quantity: number,
): number {
  if (isPerPersonAdditional(item)) {
    return quantity > 0 ? 1 : 0
  }
  return Math.max(0, quantity)
}

export function calcAdditionalLineTotalForItem(
  item: QuoteAdditionalItem,
  quantity: number,
  billableGuestCount: number,
): number {
  const normalizedQty = normalizeAdditionalQuantity(item, quantity)
  if (normalizedQty <= 0) return 0

  return calcAdditionalLineTotal(
    {
      quantity: normalizedQty,
      unitPrice: getAdditionalUnitPrice(item),
      perPerson: isPerPersonAdditional(item),
    },
    billableGuestCount,
  )
}

const WEIGHT_UOMS = new Set(['LB', 'LBS', 'POUND', 'POUNDS', 'KG', 'G', 'OZ'])

function formatWeightUom(uom: string) {
  if (uom === 'LB' || uom === 'LBS') return 'lb'
  return uom.toLowerCase()
}

export function hasCatalogWeight(
  item: Pick<QuoteAdditionalItem, 'quantity_2' | 'uom_2'> | null | undefined,
): boolean {
  const amount = Number(item?.quantity_2)
  const uom = String(item?.uom_2 ?? '').trim().toUpperCase()
  return Number.isFinite(amount) && amount > 0 && WEIGHT_UOMS.has(uom)
}

export function getAdditionalWeightPerUnit(
  item: QuoteAdditionalItem,
): { amount: number; uom: string; label: string } | null {
  if (!hasCatalogWeight(item)) return null
  const amount = Number(item.quantity_2)
  const uom = formatWeightUom(String(item.uom_2))
  return { amount, uom, label: `${amount} ${uom}` }
}

export function getAdditionalPackLabel(item: QuoteAdditionalItem): string {
  const packQty = item.quantity ?? 1
  const packUnit = item.unit_label ?? item.unit ?? 'UN'
  return `${packQty} ${packUnit}`
}

export function getAdditionalTotalWeight(
  item: QuoteAdditionalItem,
  quantity: number,
) {
  const normalizedQty = normalizeAdditionalQuantity(item, quantity)
  const perUnit = getAdditionalWeightPerUnit(item)
  if (normalizedQty <= 0 || !perUnit) {
    return null
  }
  return {
    amount: perUnit.amount * normalizedQty,
    uom: perUnit.uom,
  }
}

export function getAdditionalImage(item: QuoteAdditionalItem): string | null {
  return getPublicAdditionalDisplayImageUrl(item)
}

export type AdditionalCategoryGroup<T extends QuoteAdditionalItem> = {
  categoryKey: string
  categoryLabel: string
  items: T[]
}

/**
 * Names to headline in the suggested-extras teaser, taken from the catalog the
 * customer is about to browse.
 *
 * Reading the names off the live list is the point: the teaser can never
 * advertise an item that was deactivated, hidden or repriced, and it needs no
 * separate list to maintain. Premium beef leads, then one pork item, which is
 * the commercial preference for what to put in front of people first.
 */
export function pickSuggestedExtraNames<T extends QuoteAdditionalItem>(
  items: ReadonlyArray<T>,
  language: QuoteLanguage,
  limit = 4,
): string[] {
  const byPrice = (a: T, b: T) =>
    getAdditionalUnitPrice(b) - getAdditionalUnitPrice(a)
  const inCategory = (key: string) =>
    items
      .filter(
        (item) =>
          getAdditionalItemCategoryKey(item) === key &&
          hasAdditionalPrice(item) &&
          getLocalizedAdditionalLabel(item, language).trim(),
      )
      .sort(byPrice)

  const beef = inCategory('BOVINO_NOBRE')
  const pork = inCategory('PORCO')
  const picked = [...beef.slice(0, Math.max(1, limit - 1)), ...pork.slice(0, 1)]

  const names: string[] = []
  for (const item of picked) {
    const label = getLocalizedAdditionalLabel(item, language).trim()
    if (label && !names.includes(label)) names.push(label)
    if (names.length >= limit) break
  }
  return names
}

/**
 * Catalog labels are stored upper case for the cards, where that reads as a
 * heading. Dropped into a sentence they read as shouting, so they are cased
 * down for prose while staying the same words as the card below.
 */
function forProse(label: string, language: QuoteLanguage): string {
  if (label !== label.toUpperCase()) return label
  const locale = language === 'pt' ? 'pt-BR' : language
  return label.replace(
    /\p{Lu}[\p{Lu}\p{M}]*/gu,
    (word) => word[0] + word.slice(1).toLocaleLowerCase(locale),
  )
}

/** "a, b, c e d" in PT, "a, b, c, and d" in EN, "a, b, c y d" in ES. */
export function formatSuggestedExtraNames(
  names: ReadonlyArray<string>,
  language: QuoteLanguage,
): string {
  const locale = language === 'pt' ? 'pt-BR' : language
  const prose = names.map((name) => forProse(name, language))
  try {
    return new Intl.ListFormat(locale, {
      style: 'long',
      type: 'conjunction',
    }).format(prose)
  } catch {
    return prose.join(', ')
  }
}

export function groupAdditionalItemsByCategory<T extends QuoteAdditionalItem>(
  items: ReadonlyArray<T>,
  language: QuoteLanguage,
): AdditionalCategoryGroup<T>[] {
  const grouped = items.reduce(
    (acc, item) => {
      const key = getAdditionalItemCategoryKey(item)
      if (!acc[key]) acc[key] = []
      acc[key].push(item)
      return acc
    },
    {} as Record<string, T[]>,
  )

  return Object.entries(grouped)
    .sort(([a], [b]) => compareCategoryKeys(a, b))
    .map(([categoryKey, categoryItems]) => ({
      categoryKey,
      categoryLabel: getCategoryLabel(categoryKey, language, categoryItems[0]),
      items: [...categoryItems].sort((a, b) => {
        const priceDiff =
          getAdditionalUnitPrice(b) - getAdditionalUnitPrice(a)
        if (priceDiff !== 0) return priceDiff
        return getLocalizedAdditionalLabel(a, language).localeCompare(
          getLocalizedAdditionalLabel(b, language),
          language === 'pt' ? 'pt-BR' : language,
        )
      }),
    }))
}
