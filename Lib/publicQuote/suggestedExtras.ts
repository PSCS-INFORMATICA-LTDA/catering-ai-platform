import { getAdditionalItemCategoryKey } from '@/Lib/additionalItemFieldAccess'
import {
  getAdditionalUnitPrice,
  groupAdditionalItemsByCategory,
  type AdditionalCategoryGroup,
  type QuoteAdditionalItem,
} from '@/Lib/quoteAdditionalDisplay'
import { getCategoryLabel, getQuoteStrings } from '@/Lib/quoteTranslations'
import type { QuoteLanguage } from '@/Lib/quoteWizardTypes'
import {
  SUGGESTED_EXTRAS_DISPLAY_KEY,
  partitionSuggestedExtraItems,
} from '@/Lib/publicQuote/suggestedExtrasResolve'

export {
  SUGGESTED_EXTRAS_DISPLAY_KEY,
  SUGGESTED_EXTRA_ITEM_IDS,
  SUGGESTED_EXTRA_ITEM_KEYS,
  displayGroupsHaveDuplicateItemIds,
  isSuggestedExtraItem,
  partitionSuggestedExtraItems,
  pickSuggestedExtraItems,
} from '@/Lib/publicQuote/suggestedExtrasResolve'

export function getReviewAdditionalCategoryLabel(
  item: QuoteAdditionalItem,
  language: QuoteLanguage,
): string {
  return getCategoryLabel(getAdditionalItemCategoryKey(item), language, item)
}

/**
 * Presentation groups for the public extras accordion.
 * Does not mutate catalog items or groupAdditionalItemsByCategory data.
 */
export function buildPublicAdditionalDisplayGroups<T extends QuoteAdditionalItem>(
  visibleItems: ReadonlyArray<T>,
  language: QuoteLanguage,
): AdditionalCategoryGroup<T>[] {
  const { suggestedItems, remainingItems } =
    partitionSuggestedExtraItems(visibleItems)
  const sortedSuggested = [...suggestedItems].sort(
    (a, b) => getAdditionalUnitPrice(b) - getAdditionalUnitPrice(a),
  )
  const canonical = groupAdditionalItemsByCategory(remainingItems, language)
  if (sortedSuggested.length === 0) return canonical

  return [
    {
      categoryKey: SUGGESTED_EXTRAS_DISPLAY_KEY,
      categoryLabel: getQuoteStrings(language).wizard.suggestedExtrasTitle,
      items: sortedSuggested,
    },
    ...canonical,
  ]
}

export function appendServiceSupplyGroup<T extends QuoteAdditionalItem>(
  groups: ReadonlyArray<AdditionalCategoryGroup<T>>,
  items: ReadonlyArray<T>,
  language: QuoteLanguage,
  categoryKey = 'SERVICOS_E_SUPRIMENTOS',
): AdditionalCategoryGroup<T>[] {
  if (items.length === 0) return [...groups]
  return [
    ...groups,
    {
      categoryKey,
      categoryLabel: getCategoryLabel(categoryKey, language, items[0]),
      items: [...items],
    },
  ]
}
