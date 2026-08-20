import { getSupabaseServerClient } from '@/Lib/supabaseServer'

export type InventoryLotDto = {
  id: string
  branch_id: string
  catalog_item_id: string
  lot_number: string
  status: string
  expiration_date: string | null
  active: boolean
  item_name: string | null
  branch_name: string | null
}

export async function listInventoryLots(
  companyId: string,
  filters: {
    branchId?: string | null
    catalogItemId?: string | null
    query?: string | null
    limit?: number
  } = {},
): Promise<{ data: InventoryLotDto[]; error?: string }> {
  const db = getSupabaseServerClient()
  const limit = Math.min(Math.max(filters.limit ?? 200, 1), 500)

  let query = db
    .from('inventory_lots')
    .select(
      `
      id,
      branch_id,
      catalog_item_id,
      lot_number,
      status,
      expiration_date,
      active,
      catalog_items ( label_pt, item_name ),
      branches ( name )
    `,
    )
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (filters.branchId) query = query.eq('branch_id', filters.branchId)
  if (filters.catalogItemId) {
    query = query.eq('catalog_item_id', filters.catalogItemId)
  }

  const { data, error } = await query
  if (error) return { data: [], error: error.message }

  const q = (filters.query || '').trim().toLowerCase()
  const rows = (data ?? []).filter((row) => {
    if (!q) return true
    const item = row.catalog_items as {
      label_pt?: string | null
      item_name?: string | null
    } | null
    const hay = `${row.lot_number} ${item?.label_pt || ''} ${item?.item_name || ''}`.toLowerCase()
    return hay.includes(q)
  })

  return {
    data: rows.map((row) => {
      const item = row.catalog_items as {
        label_pt?: string | null
        item_name?: string | null
      } | null
      const branch = row.branches as { name?: string | null } | null
      return {
        id: row.id,
        branch_id: row.branch_id,
        catalog_item_id: row.catalog_item_id,
        lot_number: row.lot_number,
        status: row.status,
        expiration_date: row.expiration_date,
        active: row.active === true,
        item_name: item?.label_pt || item?.item_name || null,
        branch_name: branch?.name || null,
      }
    }),
  }
}
