import type { CatalogItemListItem, CatalogItemType } from '@/Lib/itemCatalog'

export type CatalogItemImageSource = {
  image_url?: string | null
  image_status?: string | null
  image_notes?: string | null
  item_type?: string | null
  category_pt?: string | null
}

export type CatalogItemPlaceholderType = CatalogItemType

/** URL da imagem em `catalog_items.image_url`. */
export function getCatalogItemImageUrl(
  item: CatalogItemImageSource | null | undefined,
): string | null {
  const url = item?.image_url?.trim()
  return url || null
}

/**
 * Prioriza `catalog_items.image_url`; fallback em `image_url` da linha vinculada
 * (ex.: package_items) só se o catálogo não tiver imagem.
 */
export function resolveLinkedCatalogItemImageUrl(
  catalogItem: CatalogItemImageSource | null | undefined,
  linkedRow?: { image_url?: string | null } | null,
): string | null {
  const fromCatalog = getCatalogItemImageUrl(catalogItem)
  if (fromCatalog) return fromCatalog
  const fallback = linkedRow?.image_url?.trim()
  return fallback || null
}

export function lookupCatalogItemById(
  catalogItems: ReadonlyArray<CatalogItemListItem>,
  catalogItemId: string | null | undefined,
): CatalogItemListItem | null {
  const id = catalogItemId?.trim()
  if (!id) return null
  return catalogItems.find((row) => row.id === id) ?? null
}

export function resolveCatalogItemImageForLink(
  catalogItems: ReadonlyArray<CatalogItemListItem>,
  link: {
    additional_item_id?: string | null
    image_url?: string | null
    item_type?: string | null
    category_pt?: string | null
  },
): {
  imageUrl: string | null
  imageStatus: string | null
  itemType: CatalogItemPlaceholderType | null
  categoryPt: string | null
} {
  const catalogItem = lookupCatalogItemById(
    catalogItems,
    link.additional_item_id,
  )
  return {
    imageUrl: resolveLinkedCatalogItemImageUrl(catalogItem, link),
    imageStatus: catalogItem?.image_status?.trim() || null,
    itemType:
      (catalogItem?.item_type?.trim().toUpperCase() as CatalogItemPlaceholderType) ||
      (link.item_type?.trim().toUpperCase() as CatalogItemPlaceholderType) ||
      null,
    categoryPt: catalogItem?.category_pt?.trim() || link.category_pt?.trim() || null,
  }
}

export function normalizeCatalogItemPlaceholderType(
  value: string | null | undefined,
): CatalogItemPlaceholderType {
  const raw = value?.trim().toUpperCase()
  if (
    raw === 'PRODUCT' ||
    raw === 'PACKAGE_ITEM' ||
    raw === 'SIDE' ||
    raw === 'SUPPLY' ||
    raw === 'EQUIPMENT'
  ) {
    return raw
  }
  return 'PRODUCT'
}

export function getCatalogItemPlaceholderLabel(
  itemType: CatalogItemPlaceholderType | null | undefined,
  categoryPt?: string | null,
): string {
  if (categoryPt?.trim()) return categoryPt.trim()
  switch (itemType) {
    case 'SIDE':
      return 'Guarnição'
    case 'PACKAGE_ITEM':
      return 'Item de pacote'
    case 'SUPPLY':
      return 'Insumo'
    case 'EQUIPMENT':
      return 'Equipamento'
    case 'PRODUCT':
    default:
      return 'Produto'
  }
}

export function enrichQuoteAdditionalsFromCatalog<
  T extends { item_id: string },
>(
  rows: ReadonlyArray<T>,
  catalogItems: ReadonlyArray<CatalogItemListItem>,
): Array<
  T & {
    image_url?: string | null
    image_status?: string | null
    image_notes?: string | null
    item_type?: string | null
    label_pt?: string | null
    label_en?: string | null
    label_es?: string | null
    category_pt?: string | null
    category_en?: string | null
    category_es?: string | null
    item_key?: string | null
    quantity_2?: number | null
    uom_2?: string | null
  }
> {
  if (rows.length === 0) return []
  return rows.map((row) => {
    const catalogItem = lookupCatalogItemById(catalogItems, row.item_id)
    if (!catalogItem) return row
    return {
      ...row,
      item_key: catalogItem.item_key ?? undefined,
      label_pt: catalogItem.label_pt ?? catalogItem.item_name ?? undefined,
      label_en: catalogItem.label_en ?? undefined,
      label_es: catalogItem.label_es ?? undefined,
      category_pt: catalogItem.category_pt ?? undefined,
      category_en: catalogItem.category_en ?? undefined,
      category_es: catalogItem.category_es ?? undefined,
      image_url: catalogItem.image_url ?? undefined,
      image_status: catalogItem.image_status ?? undefined,
      image_notes: catalogItem.image_notes ?? undefined,
      item_type: catalogItem.item_type ?? undefined,
      quantity_2: catalogItem.quantity_2 ?? undefined,
      uom_2: catalogItem.uom_2 ?? undefined,
    }
  })
}
