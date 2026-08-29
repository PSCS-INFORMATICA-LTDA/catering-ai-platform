import { getAdditionalItemCategoryKey } from '@/Lib/additionalItemFieldAccess'
import { getCatalogItemImageUrl } from '@/Lib/catalogItemVisual'
import { getAdditionalItemPrice } from '@/Lib/additionalItemFieldAccess'
import { calcAdditionalLineTotal } from '@/Lib/calculateQuoteTotals'
import {
  compareCategoryKeys,
  getCategoryLabel,
} from '@/Lib/quoteTranslations'
import { resolveCatalogItemDisplayLabel } from '@/Lib/cdlPackageItemI18n'
import { resolveSausageDisplayLabel } from '@/Lib/publicQuote/sausageOptions'
import { hasCatalogWeight } from '@/Lib/publicQuote/structuralExtras'
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
  const sausageLabel = resolveSausageDisplayLabel(item, language)
  if (sausageLabel) return sausageLabel
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

function formatWeightUom(uom: string) {
  if (uom === 'LB') return 'lb'
  return uom.toLowerCase()
}

export function getAdditionalWeightPerUnit(
  item: QuoteAdditionalItem,
): { amount: number; uom: string; label: string } | null {
  if (!hasCatalogWeight(item)) return null
  const amount = Number(item.quantity_2)
  const uom = formatWeightUom(String(item.uom_2))
  return {
    amount,
    uom,
    label: `${amount} ${uom}`,
  }
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
  return getCatalogItemImageUrl(item)
}

export type AdditionalCategoryGroup<T extends QuoteAdditionalItem> = {
  categoryKey: string
  categoryLabel: string
  items: T[]
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
