import {
  getAdditionalItemCategoryKey,
  getAdditionalItemCategoryLabel,
  getAdditionalItemLabel,
  type AdditionalItemFieldSource,
} from '@/Lib/additionalItemFieldAccess'
import type { AdditionalItemsInsertPayload } from '@/Lib/additionalItemsTableSchema'

export const ADDITIONAL_ITEM_CATEGORY_ORDER = [
  'Frutos do mar',
  'Bovino',
  'Suíno',
  'Aves',
  'Acompanhamentos',
  'Bebidas',
  'Serviços',
  'Estrutura',
  'Sobremesas',
  'Outros',
] as const

export function normalizeAdditionalItemDraft(
  draft: AdditionalItemsInsertPayload,
): AdditionalItemsInsertPayload {
  return {
    ...draft,
    charge_type:
      draft.pricing_type === 'PER_PERSON' ? 'PERSON' : draft.charge_type ?? 'UNIT',
  }
}

function categoryRank(label: string): number {
  const index = ADDITIONAL_ITEM_CATEGORY_ORDER.indexOf(
    label as (typeof ADDITIONAL_ITEM_CATEGORY_ORDER)[number],
  )
  return index === -1 ? 999 : index
}

export type AdditionalItemCategoryGroup<T> = {
  categoryKey: string
  categoryLabel: string
  items: T[]
}

export function groupAdditionalItemsByCategory<T extends AdditionalItemFieldSource>(
  items: T[],
  locale?: string | null,
): AdditionalItemCategoryGroup<T>[] {
  const groups = new Map<string, AdditionalItemCategoryGroup<T>>()

  for (const item of items) {
    const categoryKey = getAdditionalItemCategoryKey(item)
    const categoryLabel = getAdditionalItemCategoryLabel(item, locale)
    const existing = groups.get(categoryKey)
    if (existing) {
      existing.items.push(item)
    } else {
      groups.set(categoryKey, { categoryKey, categoryLabel, items: [item] })
    }
  }

  return [...groups.values()]
    .sort((a, b) => {
      const rankDiff = categoryRank(a.categoryLabel) - categoryRank(b.categoryLabel)
      if (rankDiff !== 0) return rankDiff
      return a.categoryLabel.localeCompare(
        b.categoryLabel,
        locale === 'en' ? 'en' : locale === 'es' ? 'es' : 'pt-BR',
      )
    })
    .map((group) => ({
      ...group,
      items: [...group.items].sort((a, b) =>
        getAdditionalItemLabel(a, locale).localeCompare(
          getAdditionalItemLabel(b, locale),
          locale === 'en' ? 'en' : locale === 'es' ? 'es' : 'pt-BR',
        ),
      ),
    }))
}
