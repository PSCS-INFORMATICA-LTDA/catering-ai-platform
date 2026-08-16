import { getCdlCompanyId } from './cdlCompany'
import {
  attachCurrentCatalogPrices,
  fetchCurrentCatalogItemPrices,
} from './catalogItemPrices'
import {
  buildCatalogItemsListSelect,
  CATALOG_ITEMS_TABLE,
} from './catalogItemsTableSchema'
import {
  filterCatalogItems,
  type CatalogItemAudience,
  type CatalogItemListItem,
  type CatalogItemUsage,
} from './itemCatalog'
import { getActiveBranchIdFromEnv } from './tenant/resolveTenant'
import { getSupabaseServerClient } from './supabaseServer'

export type { CatalogItemListItem, CatalogItemUsage, CatalogItemAudience } from './itemCatalog'

export type FetchCatalogItemsOptions = {
  activeOnly?: boolean
  includeInactive?: boolean
  /** Filtra por contexto de uso (flags + item_type). */
  usage?: CatalogItemUsage
  /** Cliente: exige customer_visible. Admin: mostra itens internos. */
  audience?: CatalogItemAudience
  /** Anexa preço vigente de catalog_item_prices quando disponível. */
  withCurrentPrices?: boolean
  /** Filial para preço vigente (fallback: env). */
  branchId?: string | null
}

export async function fetchCatalogItems(
  options: FetchCatalogItemsOptions = {},
) {
  const companyId = getCdlCompanyId()
  const audience = options.audience ?? 'admin'
  const requireActive = options.activeOnly ?? audience === 'customer'

  const supabase = getSupabaseServerClient()
  let query = supabase
    .from(CATALOG_ITEMS_TABLE)
    .select(buildCatalogItemsListSelect())
    .order('category_pt', { ascending: true, nullsFirst: false })
    .order('item_name', { ascending: true })

  if (companyId?.trim()) {
    query = query.eq('company_id', companyId)
  }

  if (requireActive) {
    query = query.eq('active', true)
  }

  if (audience === 'customer') {
    query = query.eq('customer_visible', true)
  }

  if (options.usage) {
    switch (options.usage) {
      case 'package_item':
        query = query
          .eq('can_be_package_item', true)
          .in('item_type', ['PRODUCT', 'PACKAGE_ITEM'])
        break
      case 'side_item':
        query = query.eq('can_be_side_item', true).eq('item_type', 'SIDE')
        break
      case 'option_choice':
        query = query.eq('can_be_option_choice', true).eq('item_type', 'PRODUCT')
        break
      case 'additional':
        query = query
          .eq('can_be_additional', true)
          .in('item_type', ['PRODUCT', 'PACKAGE_ITEM', 'SIDE', 'EQUIPMENT'])
          .or('operational_item.is.null,operational_item.eq.false')
        break
      case 'inventory':
        query = query.or(
          'inventory_enabled.eq.true,operational_item.eq.true,item_type.eq.SUPPLY',
        )
        break
    }
  }

  const { data, error } = await query

  if (error) {
    return { data: null as CatalogItemListItem[] | null, error }
  }

  let rows = (data ?? []) as unknown as CatalogItemListItem[]

  if (!options.includeInactive && !requireActive) {
    rows = rows.filter((row) => row.active !== false)
  }

  if (options.usage) {
    rows = filterCatalogItems(rows, options.usage, audience)
  }

  const withPrices = options.withCurrentPrices !== false
  if (withPrices && rows.length > 0) {
    const branchId = options.branchId ?? getActiveBranchIdFromEnv()
    const priceMap = await fetchCurrentCatalogItemPrices(
      rows.map((r) => r.id),
      branchId,
    )
    rows = attachCurrentCatalogPrices(rows, priceMap)
  }

  return { data: rows, error: null }
}
