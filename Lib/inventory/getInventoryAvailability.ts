import { getSupabaseServerClient } from '@/Lib/supabaseServer'
import {
  computeQuantityAvailable,
  type InventoryAvailabilityFilters,
} from '@/Lib/inventory/types'

export type InventoryAvailabilityDto = {
  balance_id: string
  branch_id: string
  location_id: string
  catalog_item_id: string
  lot_id: string | null
  unit: string
  quantity_on_hand: number
  quantity_committed: number
  quantity_available: number
  quantity_in_event: number
  quantity_on_receipt: number
  last_movement_at: string | null
  item_name: string | null
  category: string | null
  branch_name: string | null
  branch_code: string | null
  location_name: string | null
  location_code: string | null
  lot_number: string | null
  lot_status: string | null
}

/**
 * Consulta centralizada de disponibilidade (view inventory_availability + joins).
 * Available = On Hand - Committed (nunca recalculado na UI).
 */
export async function getInventoryAvailability(
  companyId: string,
  filters: InventoryAvailabilityFilters = {},
): Promise<{ data: InventoryAvailabilityDto[]; error?: string }> {
  const db = getSupabaseServerClient()
  const limit = Math.min(Math.max(filters.limit ?? 500, 1), 1000)
  const q = (filters.query || '').trim().toLowerCase()

  let query = db
    .from('inventory_availability')
    .select(
      `
      balance_id,
      company_id,
      branch_id,
      location_id,
      catalog_item_id,
      lot_id,
      unit,
      quantity_on_hand,
      quantity_committed,
      quantity_available,
      quantity_in_event,
      quantity_on_receipt,
      last_movement_at,
      catalog_items!inner (
        item_name,
        label_pt,
        category_pt,
        category_key
      ),
      inventory_locations!inner (
        name,
        code
      ),
      branches (
        name,
        branch_code
      ),
      inventory_lots (
        lot_number,
        status
      )
    `,
    )
    .eq('company_id', companyId)
    .order('last_movement_at', { ascending: false, nullsFirst: false })
    .limit(limit)

  if (filters.branchId) query = query.eq('branch_id', filters.branchId)
  if (filters.locationId) query = query.eq('location_id', filters.locationId)
  if (filters.catalogItemId) {
    query = query.eq('catalog_item_id', filters.catalogItemId)
  }
  if (filters.lotId) query = query.eq('lot_id', filters.lotId)
  if (filters.onlyWithStock) query = query.gt('quantity_on_hand', 0)
  if (filters.onlyCommitted) query = query.gt('quantity_committed', 0)

  const { data, error } = await query
  if (error) {
    return { data: [], error: error.message }
  }

  const rows = (data ?? []).filter((row) => {
    if (!q) return true
    const item = row.catalog_items as {
      item_name?: string | null
      label_pt?: string | null
      category_pt?: string | null
    } | null
    const hay =
      `${item?.item_name || ''} ${item?.label_pt || ''} ${item?.category_pt || ''}`.toLowerCase()
    return hay.includes(q)
  })

  return {
    data: rows.map((row) => {
      const item = row.catalog_items as {
        item_name?: string | null
        label_pt?: string | null
        category_pt?: string | null
        category_key?: string | null
      } | null
      const loc = row.inventory_locations as {
        name?: string | null
        code?: string | null
      } | null
      const branch = row.branches as {
        name?: string | null
        branch_code?: string | null
      } | null
      const lot = row.inventory_lots as {
        lot_number?: string | null
        status?: string | null
      } | null
      const onHand = Number(row.quantity_on_hand)
      const committed = Number(row.quantity_committed ?? 0)

      return {
        balance_id: row.balance_id,
        branch_id: row.branch_id,
        location_id: row.location_id,
        catalog_item_id: row.catalog_item_id,
        lot_id: row.lot_id,
        unit: row.unit,
        quantity_on_hand: onHand,
        quantity_committed: committed,
        quantity_available: computeQuantityAvailable(onHand, committed),
        quantity_in_event: Number(row.quantity_in_event ?? 0),
        quantity_on_receipt: Number(row.quantity_on_receipt ?? 0),
        last_movement_at: row.last_movement_at,
        item_name: item?.label_pt || item?.item_name || null,
        category: item?.category_pt || item?.category_key || null,
        branch_name: branch?.name || null,
        branch_code: branch?.branch_code || null,
        location_name: loc?.name || null,
        location_code: loc?.code || null,
        lot_number: lot?.lot_number || null,
        lot_status: lot?.status || null,
      }
    }),
  }
}
