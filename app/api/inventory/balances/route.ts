import {
  requireApiPermission,
  resolveAuthorizedCompanyId,
} from '@/Lib/auth/requireApi'
import { computeQuantityAvailable } from '@/Lib/inventory/types'
import { getSupabaseServerClient } from '@/Lib/supabaseServer'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/** GET /api/inventory/balances — saldos materializados (sem custo). */
export async function GET(request: Request) {
  const auth = await requireApiPermission('inventory.view')
  if (!auth.ok) return auth.response

  const companyId = resolveAuthorizedCompanyId(auth.session)
  const url = new URL(request.url)
  const locationId = url.searchParams.get('location_id')
  const branchId = url.searchParams.get('branch_id')
  const catalogItemId = url.searchParams.get('catalog_item_id')
  const lotId = url.searchParams.get('lot_id')
  const q = (url.searchParams.get('q') || '').trim().toLowerCase()

  const db = getSupabaseServerClient()
  let query = db
    .from('inventory_balances')
    .select(
      `
      id,
      company_id,
      branch_id,
      location_id,
      catalog_item_id,
      lot_id,
      quantity_on_hand,
      quantity_committed,
      quantity_in_event,
      quantity_on_receipt,
      unit,
      last_movement_at,
      updated_at,
      catalog_items!inner (
        id,
        item_name,
        label_pt,
        category_pt,
        category_key,
        inventory_enabled
      ),
      inventory_locations!inner (
        id,
        name,
        code,
        is_default
      ),
      branches (
        id,
        name,
        branch_code
      ),
      inventory_lots (
        id,
        lot_number,
        status
      )
    `,
    )
    .eq('company_id', companyId)
    .order('updated_at', { ascending: false })

  if (locationId) query = query.eq('location_id', locationId)
  if (branchId) query = query.eq('branch_id', branchId)
  if (catalogItemId) query = query.eq('catalog_item_id', catalogItemId)
  if (lotId) query = query.eq('lot_id', lotId)

  const { data, error } = await query
  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
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

  return Response.json({
    data: rows.map((row) => {
      const item = row.catalog_items as unknown as {
        item_name?: string | null
        label_pt?: string | null
        category_pt?: string | null
        category_key?: string | null
      } | null
      const loc = row.inventory_locations as unknown as {
        name?: string | null
        code?: string | null
      } | null
      const branch = row.branches as unknown as {
        name?: string | null
        branch_code?: string | null
      } | null
      const lot = row.inventory_lots as unknown as {
        lot_number?: string | null
        status?: string | null
      } | null
      const onHand = Number(row.quantity_on_hand)
      const committed = Number(row.quantity_committed ?? 0)
      return {
        id: row.id,
        branch_id: row.branch_id,
        location_id: row.location_id,
        catalog_item_id: row.catalog_item_id,
        lot_id: row.lot_id,
        quantity_on_hand: onHand,
        quantity_committed: committed,
        quantity_available: computeQuantityAvailable(onHand, committed),
        quantity_in_event: Number(row.quantity_in_event ?? 0),
        quantity_on_receipt: Number(row.quantity_on_receipt ?? 0),
        unit: row.unit,
        last_movement_at: row.last_movement_at,
        updated_at: row.updated_at,
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
  })
}
