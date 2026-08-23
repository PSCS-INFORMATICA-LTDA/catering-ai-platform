/**
 * Colunas reais de `public.packages` no Supabase.
 */
export const PACKAGES_TABLE_COLUMNS = [
  'id',
  'company_id',
  'package_name',
  'price_per_person',
  'description',
  'active',
  'created_at',
  'package_key',
  'label_pt',
  'label_en',
  'label_es',
  'description_pt',
  'description_en',
  'description_es',
  'display_order',
  'image_url',
  'currency_code',
  'image_status',
  'image_notes',
  'package_highlights_pt',
  'package_highlights_en',
  'package_highlights_es',
  'card_theme_key',
  'updated_at',
] as const

export type PackagesTableColumn = (typeof PACKAGES_TABLE_COLUMNS)[number]

export const PACKAGES_INSERT_COLUMNS = [
  'company_id',
  'package_key',
  'package_name',
  'label_pt',
  'label_en',
  'label_es',
  'description',
  'description_pt',
  'description_en',
  'description_es',
  'price_per_person',
  'currency_code',
  'display_order',
  'image_url',
  'image_status',
  'image_notes',
  'package_highlights_pt',
  'package_highlights_en',
  'package_highlights_es',
  'card_theme_key',
  'active',
] as const satisfies ReadonlyArray<PackagesTableColumn>

export type PackagesInsertColumn = (typeof PACKAGES_INSERT_COLUMNS)[number]

export type PackagesInsertPayload = Partial<
  Record<PackagesInsertColumn, string | number | boolean | null>
>

export const PACKAGES_LIST_COLUMNS = [
  'id',
  'company_id',
  'package_name',
  'price_per_person',
  'description',
  'active',
  'package_key',
  'label_pt',
  'label_en',
  'label_es',
  'description_pt',
  'description_en',
  'description_es',
  'display_order',
  'image_url',
  'currency_code',
  'image_status',
  'image_notes',
  'package_highlights_pt',
  'package_highlights_en',
  'package_highlights_es',
  'card_theme_key',
  'updated_at',
] as const

const PACKAGES_TABLE_COLUMN_SET = new Set<string>(PACKAGES_TABLE_COLUMNS)

export function isPackagesTableColumn(key: string): key is PackagesTableColumn {
  return PACKAGES_TABLE_COLUMN_SET.has(key)
}

export function buildPackagesListSelect(): string {
  return PACKAGES_LIST_COLUMNS.join(', ')
}

export function pickPackagesInsertPayload(
  row: PackagesInsertPayload,
): Record<string, string | number | boolean | null> {
  const payload: Record<string, string | number | boolean | null> = {}

  for (const key of PACKAGES_INSERT_COLUMNS) {
    if (!(key in row)) continue
    const value = row[key]
    if (value === undefined) continue
    if (typeof value === 'string' && value.trim() === '') continue
    payload[key] = value
  }

  return payload
}

export function pickPackagesUpdatePayload(
  row: PackagesInsertPayload,
): Record<string, string | number | boolean | null> {
  const payload = pickPackagesInsertPayload(row)
  delete payload.company_id
  return payload
}
