import { getSupabaseServerClient } from '@/Lib/supabaseServer'
import type { InventoryMovementFilters } from '@/Lib/inventory/types'

export type InventoryMovementDto = {
  id: string
  branch_id: string | null
  location_id: string
  catalog_item_id: string
  lot_id: string | null
  movement_type: string
  movement_code: string | null
  document_type: string | null
  document_number: string | null
  inventory_document_id: string | null
  line_number: number | null
  quantity: number
  unit: string
  source_type: string | null
  service_order_id: string | null
  order_number: string | null
  service_order_material_id: string | null
  event_id: string | null
  occurred_at: string
  notes: string | null
  created_by: string | null
  item_name: string | null
  location_name: string | null
  branch_name: string | null
  lot_number: string | null
}

/** Kardex — consulta centralizada (sem custo/valuation). */
export async function listInventoryMovements(
  companyId: string,
  filters: InventoryMovementFilters = {},
): Promise<{ data: InventoryMovementDto[]; error?: string }> {
  const db = getSupabaseServerClient()
  const limit = Math.min(Math.max(filters.limit ?? 100, 1), 500)

  let query = db
    .from('inventory_movements')
    .select(
      `
      id,
      branch_id,
      location_id,
      catalog_item_id,
      lot_id,
      movement_type,
      movement_code,
      document_type,
      document_number,
      inventory_document_id,
      line_number,
      quantity,
      unit,
      source_type,
      service_order_id,
      service_order_material_id,
      event_id,
      occurred_at,
      notes,
      created_by,
      catalog_items ( label_pt, item_name ),
      inventory_locations ( name ),
      branches ( name ),
      inventory_lots ( lot_number ),
      service_orders ( service_order_number )
    `,
    )
    .eq('company_id', companyId)
    .order('occurred_at', { ascending: false })
    .limit(limit)

  if (filters.branchId) query = query.eq('branch_id', filters.branchId)
  if (filters.locationId) query = query.eq('location_id', filters.locationId)
  if (filters.catalogItemId) query = query.eq('catalog_item_id', filters.catalogItemId)
  if (filters.lotId) query = query.eq('lot_id', filters.lotId)
  if (filters.movementType) query = query.eq('movement_type', filters.movementType)
  if (filters.movementCode) query = query.eq('movement_code', filters.movementCode)
  if (filters.documentId) {
    query = query.eq('inventory_document_id', filters.documentId)
  }
  if (filters.serviceOrderId) {
    query = query.eq('service_order_id', filters.serviceOrderId)
  }
  if (filters.from) query = query.gte('occurred_at', filters.from)
  if (filters.to) query = query.lte('occurred_at', filters.to)

  const { data, error } = await query
  if (error) {
    return { data: [], error: error.message }
  }

  return {
    data: (data ?? []).map((row) => {
      const item = row.catalog_items as {
        label_pt?: string | null
        item_name?: string | null
      } | null
      const loc = row.inventory_locations as { name?: string | null } | null
      const branch = row.branches as { name?: string | null } | null
      const lot = row.inventory_lots as { lot_number?: string | null } | null
      const order = row.service_orders as {
        service_order_number?: string | null
      } | null

      return {
        id: row.id,
        branch_id: row.branch_id,
        location_id: row.location_id,
        catalog_item_id: row.catalog_item_id,
        lot_id: row.lot_id,
        movement_type: row.movement_type,
        movement_code: row.movement_code,
        document_type: row.document_type,
        document_number: row.document_number,
        inventory_document_id: row.inventory_document_id,
        line_number: row.line_number,
        quantity: Number(row.quantity),
        unit: row.unit,
        source_type: row.source_type,
        service_order_id: row.service_order_id,
        order_number: order?.service_order_number || null,
        service_order_material_id: row.service_order_material_id,
        event_id: row.event_id,
        occurred_at: row.occurred_at,
        notes: row.notes,
        created_by: row.created_by,
        item_name: item?.label_pt || item?.item_name || null,
        location_name: loc?.name || null,
        branch_name: branch?.name || null,
        lot_number: lot?.lot_number || null,
      }
    }),
  }
}
