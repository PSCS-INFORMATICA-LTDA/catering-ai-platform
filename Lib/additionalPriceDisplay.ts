import { getCatalogItemSalePrice } from './itemCatalog.ts'
import { tw } from './quoteTranslations.ts'
import type { QuoteLanguage } from './quoteWizardTypes.ts'

/** Registered price fields — same resolver used by getAdditionalItemPrice. */
export type AdditionalPriceSource = {
  id?: string
  item_key?: string | null
  current_price?: number | string | null
  sale_price?: number | string | null
  price?: number | string | null
}

export function getAdditionalPriceValue(
  item: AdditionalPriceSource | null | undefined,
): number {
  return getCatalogItemSalePrice(item)
}

export function formatAdditionalPrice(value: number): string {
  return `$${value.toFixed(2)}`
}

/**
 * One price string for the collapsed summary and for the expanded card, so
 * both always read the same registered value.
 */
export function getAdditionalPriceLabel(
  item: AdditionalPriceSource | null | undefined,
  language: QuoteLanguage,
): string {
  const price = getAdditionalPriceValue(item)
  return price > 0
    ? formatAdditionalPrice(price)
    : tw(language, 'priceUnavailable')
}
