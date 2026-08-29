/** Tabela mestre de itens no Supabase. */
export const CATALOG_ITEMS_TABLE = 'catalog_items' as const

/**
 * Colunas de `public.catalog_items` no Supabase.
 */
export const CATALOG_ITEMS_TABLE_COLUMNS = [
  'id',
  'company_id',
  'item_name',
  'price',
  'charge_type',
  'unit_label',
  'active',
  'created_at',
  'item_key',
  'label_pt',
  'label_en',
  'label_es',
  'category_key',
  'category_pt',
  'category_en',
  'category_es',
  'quantity',
  'unit',
  'quantity_2',
  'uom_2',
  'pricing_type',
  'image_url',
  'image_status',
  'image_notes',
  'currency_code',
  'display_order',
  'updated_at',
  'can_be_package_item',
  'can_be_side_item',
  'can_be_additional',
  'can_be_option_choice',
  'inventory_enabled',
  'cost_price',
  'sale_price',
  'customer_visible',
  'item_type',
  'operational_item',
] as const

export type CatalogItemsTableColumn =
  (typeof CATALOG_ITEMS_TABLE_COLUMNS)[number]

export const CATALOG_ITEMS_INSERT_COLUMNS = [
  'company_id',
  'item_name',
  'price',
  'charge_type',
  'unit_label',
  'active',
  'item_key',
  'label_pt',
  'label_en',
  'label_es',
  'category_key',
  'category_pt',
  'category_en',
  'category_es',
  'quantity',
  'unit',
  'quantity_2',
  'uom_2',
  'pricing_type',
  'image_url',
  'image_status',
  'image_notes',
  'currency_code',
  'display_order',
  'can_be_package_item',
  'can_be_side_item',
  'can_be_additional',
  'can_be_option_choice',
  'inventory_enabled',
  'cost_price',
  'sale_price',
  'customer_visible',
  'item_type',
  'operational_item',
] as const satisfies ReadonlyArray<CatalogItemsTableColumn>

export type CatalogItemsInsertColumn =
  (typeof CATALOG_ITEMS_INSERT_COLUMNS)[number]

export type CatalogItemsInsertPayload = Partial<
  Record<CatalogItemsInsertColumn, string | number | boolean | null>
>

export const CATALOG_ITEMS_LIST_COLUMNS = [
  'id',
  'item_key',
  'item_name',
  'label_pt',
  'label_en',
  'label_es',
  'category_key',
  'category_pt',
  'category_en',
  'category_es',
  'price',
  'charge_type',
  'pricing_type',
  'unit_label',
  'quantity',
  'unit',
  'quantity_2',
  'uom_2',
  'currency_code',
  'display_order',
  'image_url',
  'image_status',
  'image_notes',
  'active',
  'can_be_package_item',
  'can_be_side_item',
  'can_be_additional',
  'can_be_option_choice',
  'inventory_enabled',
  'cost_price',
  'sale_price',
  'customer_visible',
  'item_type',
  'operational_item',
] as const

export function buildCatalogItemsListSelect(): string {
  return CATALOG_ITEMS_LIST_COLUMNS.join(', ')
}

export function pickCatalogItemsInsertPayload(
  row: CatalogItemsInsertPayload,
): Record<string, string | number | boolean | null> {
  const payload: Record<string, string | number | boolean | null> = {}

  for (const key of CATALOG_ITEMS_INSERT_COLUMNS) {
    if (!(key in row)) continue
    const value = row[key]
    if (value === undefined) continue
    if (typeof value === 'string' && value.trim() === '') continue
    payload[key] = value
  }

  return payload
}

export function pickCatalogItemsUpdatePayload(
  row: CatalogItemsInsertPayload,
): Record<string, string | number | boolean | null> {
  const payload = pickCatalogItemsInsertPayload(row)
  delete payload.company_id
  return payload
}
