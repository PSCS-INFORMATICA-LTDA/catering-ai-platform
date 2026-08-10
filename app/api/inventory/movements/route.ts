import {
  requireApiPermission,
  resolveAuthorizedCompanyId,
} from '@/Lib/auth/requireApi'
import { getSupabaseServerClient } from '@/Lib/supabaseServer'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/** GET /api/inventory/movements — ledger (sem custo/valuation). */
export async function GET(request: Request) {
  const auth = await requireApiPermission('inventory.view')
  if (!auth.ok) return auth.response

  const companyId = resolveAuthorizedCompanyId(auth.session)
  const url = new URL(request.url)
  const locationId = url.searchParams.get('location_id')
  const catalogItemId = url.searchParams.get('catalog_item_id')
  const movementType = url.searchParams.get('movement_type')
  const from = url.searchParams.get('from')
  const to = url.searchParams.get('to')
  const limit = Math.min(Number(url.searchParams.get('limit') || 100), 500)

  const db = getSupabaseServerClient()
  let query = db
    .from('inventory_movements')
    .select(
      `
      id,
      location_id,
      catalog_item_id,
      movement_type,
      quantity,
      unit,
      source_type,
      source_id,
      service_order_id,
      service_order_material_id,
      idempotency_key,
      occurred_at,
      notes,
      created_by,
      created_at,
      catalog_items ( label_pt, item_name ),
      inventory_locations ( name ),
      service_orders ( service_order_number )
    `,
    )
    .eq('company_id', companyId)
    .order('occurred_at', { ascending: false })
    .limit(limit)

  if (locationId) query = query.eq('location_id', locationId)
  if (catalogItemId) query = query.eq('catalog_item_id', catalogItemId)
  if (movementType) query = query.eq('movement_type', movementType)
  if (from) query = query.gte('occurred_at', from)
  if (to) query = query.lte('occurred_at', to)

  const { data, error } = await query
  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({
    data: (data ?? []).map((row) => {
      const item = row.catalog_items as unknown as {
        label_pt?: string | null
        item_name?: string | null
      } | null
      const loc = row.inventory_locations as unknown as {
        name?: string | null
      } | null
      const so = row.service_orders as unknown as {
        service_order_number?: string | null
      } | null
      return {
        id: row.id,
        location_id: row.location_id,
        location_name: loc?.name || null,
        catalog_item_id: row.catalog_item_id,
        item_name: item?.label_pt || item?.item_name || null,
        movement_type: row.movement_type,
        quantity: Number(row.quantity),
        unit: row.unit,
        source_type: row.source_type,
        service_order_id: row.service_order_id,
        order_number: so?.service_order_number || null,
        service_order_material_id: row.service_order_material_id,
        occurred_at: row.occurred_at,
        notes: row.notes,
        created_by: row.created_by,
      }
    }),
  })
}
