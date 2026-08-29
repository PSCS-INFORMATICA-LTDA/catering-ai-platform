import { isPublicCatalogFixtureItem } from './publicQuote/catalogVisibility.ts'

/** Item do catálogo mestre (`public.catalog_items`). */
export type CatalogItemType =
  | 'PRODUCT'
  | 'PACKAGE_ITEM'
  | 'SIDE'
  | 'EQUIPMENT'
  | 'SUPPLY'

export type CatalogItemListItem = {
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
  price?: number | null
  sale_price?: number | null
  cost_price?: number | null
  current_price?: number | null
  charge_type?: string | null
  pricing_type?: string | null
  unit_label?: string | null
  quantity?: number | null
  unit?: string | null
  quantity_2?: number | null
  uom_2?: string | null
  currency_code?: string | null
  display_order?: number | null
  image_url?: string | null
  image_status?: string | null
  image_notes?: string | null
  active?: boolean | null
  customer_visible?: boolean | null
  item_type?: string | null
  operational_item?: boolean | null
  can_be_package_item?: boolean | null
  can_be_side_item?: boolean | null
  can_be_additional?: boolean | null
  can_be_option_choice?: boolean | null
  inventory_enabled?: boolean | null
}

export type CatalogItemUsage =
  | 'package_item'
  | 'side_item'
  | 'option_choice'
  | 'additional'
  | 'inventory'

/** `customer` = fluxos do wizard/cliente; `admin` = backoffice (vê itens ocultos). */
export type CatalogItemAudience = 'admin' | 'customer'

/** @deprecated Use CatalogItemListItem */
export type AdditionalItemListItem = CatalogItemListItem

const PACKAGE_ITEM_TYPES: CatalogItemType[] = ['PRODUCT', 'PACKAGE_ITEM']
const ADDITIONAL_ITEM_TYPES: CatalogItemType[] = [
  'PRODUCT',
  'PACKAGE_ITEM',
  'SIDE',
  'EQUIPMENT',
]

export function normalizeCatalogItemType(
  item: { item_type?: string | null } | null | undefined,
): CatalogItemType | null {
  const raw = item?.item_type?.trim().toUpperCase()
  if (!raw) return null
  if (
    raw === 'PRODUCT' ||
    raw === 'PACKAGE_ITEM' ||
    raw === 'SIDE' ||
    raw === 'EQUIPMENT' ||
    raw === 'SUPPLY'
  ) {
    return raw
  }
  return null
}

function itemTypeMatches(
  item: CatalogItemListItem,
  allowed: readonly CatalogItemType[],
): boolean {
  const type = normalizeCatalogItemType(item)
  if (!type) return false
  return allowed.includes(type)
}

/** Condimentos de pacote — só composição interna, não guarnição nem adicional. */
export function isInternalPackageCondiment(
  item: { item_type?: string | null; category_key?: string | null } | null | undefined,
): boolean {
  return (
    normalizeCatalogItemType(item) === 'PACKAGE_ITEM' &&
    item?.category_key?.trim().toUpperCase() === 'CONDIMENTOS'
  )
}

export function isCatalogItemUsageAllowed(
  item: CatalogItemListItem | null | undefined,
  usage: CatalogItemUsage,
  audience: CatalogItemAudience = 'admin',
): boolean {
  if (!item) return false
  if (item.active === false) return false
  if (audience === 'customer' && item.customer_visible === false) return false
  if (audience === 'customer' && isPublicCatalogFixtureItem(item)) return false

  switch (usage) {
    case 'package_item':
      return (
        item.can_be_package_item === true &&
        itemTypeMatches(item, PACKAGE_ITEM_TYPES)
      )
    case 'side_item':
      if (isInternalPackageCondiment(item)) return false
      return item.can_be_side_item === true && itemTypeMatches(item, ['SIDE'])
    case 'option_choice':
      return (
        item.can_be_option_choice === true &&
        itemTypeMatches(item, ['PRODUCT'])
      )
    case 'additional':
      if (item.operational_item === true) return false
      if (normalizeCatalogItemType(item) === 'SUPPLY') return false
      if (isInternalPackageCondiment(item)) return false
      return (
        item.can_be_additional === true &&
        itemTypeMatches(item, ADDITIONAL_ITEM_TYPES)
      )
    case 'inventory':
      return (
        item.inventory_enabled === true ||
        item.operational_item === true ||
        normalizeCatalogItemType(item) === 'SUPPLY'
      )
    default:
      return false
  }
}

export function filterCatalogItems<T extends CatalogItemListItem>(
  items: ReadonlyArray<T>,
  usage: CatalogItemUsage,
  audience: CatalogItemAudience = 'admin',
): T[] {
  return items.filter((item) => isCatalogItemUsageAllowed(item, usage, audience))
}

function toNumber(value: unknown): number | null {
  if (value == null || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

/**
 * Preço de venda: current_price (catalog_item_prices) → sale_price → price.
 */
export function getCatalogItemSalePrice(
  item:
    | {
        current_price?: unknown
        sale_price?: unknown
        price?: unknown
      }
    | null
    | undefined,
): number {
  if (!item) return 0
  return (
    toNumber(item.current_price) ??
    toNumber(item.sale_price) ??
    toNumber(item.price) ??
    0
  )
}

export function getCatalogItemCostPrice(
  item: { cost_price?: unknown } | null | undefined,
): number {
  if (!item) return 0
  return toNumber(item.cost_price) ?? 0
}
