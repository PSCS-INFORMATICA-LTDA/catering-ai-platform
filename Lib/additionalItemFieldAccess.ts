import type { AdditionalItemsInsertPayload } from '@/Lib/additionalItemsTableSchema'
import { pickAdditionalItemsInsertPayload } from '@/Lib/additionalItemsTableSchema'
import { getCatalogItemImageUrl as resolveCatalogImageUrl } from '@/Lib/catalogItemVisual'
import { getCatalogItemSalePrice } from '@/Lib/itemCatalog'
import { pickLocalizedText } from '@/Lib/i18n/locales'
import { resolveCatalogItemDisplayLabel } from '@/Lib/cdlPackageItemI18n'

export type AdditionalItemFieldSource = {
  item_key?: string | null
  item_name?: string | null
  label_pt?: string | null
  label_en?: string | null
  label_es?: string | null
  category_key?: string | null
  category_pt?: string | null
  category_en?: string | null
  category_es?: string | null
  price?: number | null
  sale_price?: number | null
  current_price?: number | null
  charge_type?: string | null
  pricing_type?: string | null
  unit_label?: string | null
  currency_code?: string | null
  display_order?: number | null
  image_url?: string | null
  active?: boolean | null
}

export function getAdditionalItemCategoryKey(
  item: AdditionalItemFieldSource | null | undefined,
): string {
  return item?.category_key?.trim() || 'OUTROS'
}

export function getAdditionalItemCategoryLabel(
  item: AdditionalItemFieldSource | null | undefined,
  locale?: string | null,
): string {
  return (
    pickLocalizedText(
      {
        pt: item?.category_pt,
        en: item?.category_en,
        es: item?.category_es,
      },
      locale,
    ).trim() ||
    item?.category_key?.trim() ||
    'Outros'
  )
}

export function getAdditionalItemLabel(
  item: AdditionalItemFieldSource | null | undefined,
  locale?: string | null,
): string {
  return (
    resolveCatalogItemDisplayLabel(
      {
        pt: item?.label_pt,
        en: item?.label_en,
        es: item?.label_es,
        fallback: item?.item_name,
      },
      locale,
    ) ||
    item?.item_key?.trim() ||
    'Item do catálogo'
  )
}

export function getAdditionalItemPrice(
  item: AdditionalItemFieldSource | null | undefined,
): number {
  return getCatalogItemSalePrice(item)
}
export function getAdditionalItemImageUrl(
  item: AdditionalItemFieldSource | null | undefined,
): string | null {
  return resolveCatalogImageUrl(item)
}

export function getAdditionalItemCurrencyCode(
  item: AdditionalItemFieldSource | null | undefined,
): string {
  return item?.currency_code?.trim() || 'USD'
}

export function getAdditionalItemDisplayOrder(
  item: AdditionalItemFieldSource | null | undefined,
): number {
  return Number(item?.display_order ?? 999)
}

export function mapAdditionalItemDraftToDeployed(
  draft: AdditionalItemsInsertPayload,
): AdditionalItemsInsertPayload {
  return pickAdditionalItemsInsertPayload(draft)
}
