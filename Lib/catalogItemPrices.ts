import { getCdlCompanyId } from './cdlCompany'
import { getActiveBranchIdFromEnv } from './tenant/resolveTenant'
import { getCatalogItemSalePrice } from './itemCatalog'
import { getSupabaseServerClient } from './supabaseServer'

export const CATALOG_ITEM_PRICES_TABLE = 'catalog_item_prices' as const

export type CatalogItemPriceRow = {
  catalog_item_id: string
  branch_id?: string | null
  price?: number | null
  sale_price?: number | null
  valid_from?: string | null
}

export type CatalogItemPriceSource = {
  current_price?: unknown
  sale_price?: unknown
  price?: unknown
}

function toNumber(value: unknown): number | null {
  if (value == null || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function pickPriceFromRow(row: CatalogItemPriceRow): number | null {
  return toNumber(row.sale_price) ?? toNumber(row.price)
}

function resolvePriceForItem(
  rows: CatalogItemPriceRow[],
  catalogItemId: string,
  branchId?: string | null,
): number | null {
  const itemRows = rows.filter((row) => row.catalog_item_id === catalogItemId)
  if (itemRows.length === 0) return null

  const branchKey = branchId?.trim() || null
  const branchRows = branchKey
    ? itemRows.filter((row) => row.branch_id?.trim() === branchKey)
    : []
  const globalRows = itemRows.filter((row) => !row.branch_id?.trim())
  const pool = branchRows.length > 0 ? branchRows : globalRows

  for (const row of pool) {
    const price = pickPriceFromRow(row)
    if (price != null) return price
  }

  return null
}

/**
 * Preço vigente: `current_price` (catalog_item_prices) → sale_price → price.
 */
export function resolveCatalogItemSalePrice(
  item: CatalogItemPriceSource | null | undefined,
): number {
  return getCatalogItemSalePrice(item)
}

/**
 * Preços vigentes em `catalog_item_prices`.
 * Prioriza preço da filial (`branch_id`); senão preço global da company.
 */
export async function fetchCurrentCatalogItemPrices(
  catalogItemIds: string[],
  branchId?: string | null,
  companyIdOverride?: string | null,
): Promise<Map<string, number>> {
  const ids = [...new Set(catalogItemIds.map((id) => id.trim()).filter(Boolean))]
  const result = new Map<string, number>()
  if (ids.length === 0) return result

  const now = new Date().toISOString()
  const companyId = companyIdOverride?.trim() || getCdlCompanyId()
  const activeBranchId = branchId?.trim() || getActiveBranchIdFromEnv()
  const supabase = getSupabaseServerClient()

  let query = supabase
    .from(CATALOG_ITEM_PRICES_TABLE)
    .select('catalog_item_id, branch_id, price, sale_price, valid_from')
    .in('catalog_item_id', ids)
    .eq('active', true)
    .lte('valid_from', now)
    .or(`valid_until.is.null,valid_until.gt.${now}`)
    .order('valid_from', { ascending: false })

  if (companyId?.trim()) {
    query = query.eq('company_id', companyId)
  }

  const { data, error } = await query

  if (error) {
    if (/relation|does not exist|schema cache/i.test(error.message)) {
      return result
    }
    console.warn('[catalog_item_prices]', error.message)
    return result
  }

  const rows = (data ?? []) as CatalogItemPriceRow[]
  for (const id of ids) {
    const price = resolvePriceForItem(rows, id, activeBranchId)
    if (price != null) result.set(id, price)
  }

  return result
}

export function attachCurrentCatalogPrices<
  T extends { id: string; current_price?: number | null },
>(items: T[], priceMap: Map<string, number>): T[] {
  if (priceMap.size === 0) return items
  return items.map((item) => {
    const current = priceMap.get(item.id)
    if (current == null) return item
    return { ...item, current_price: current }
  })
}
