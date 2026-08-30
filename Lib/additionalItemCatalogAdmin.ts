import {
  getAdditionalItemCategoryKey,
  getAdditionalItemCategoryLabel,
  getAdditionalItemLabel,
  type AdditionalItemFieldSource,
} from '@/Lib/additionalItemFieldAccess'
import type { AdditionalItemsInsertPayload } from '@/Lib/additionalItemsTableSchema'
import { normalizeCatalogItemLabelFields } from '@/Lib/publicQuote/catalogDisplayName'

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
  const labels = normalizeCatalogItemLabelFields({
    item_name: draft.item_name == null ? draft.item_name : String(draft.item_name),
    label_pt: draft.label_pt == null ? draft.label_pt : String(draft.label_pt),
    label_en: draft.label_en == null ? draft.label_en : String(draft.label_en),
    label_es: draft.label_es == null ? draft.label_es : String(draft.label_es),
  })
  return {
    ...draft,
    ...labels,
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
