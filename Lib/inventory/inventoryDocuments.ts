import { getSupabaseServerClient } from '@/Lib/supabaseServer'
import type { InventoryDocumentFilters } from '@/Lib/inventory/types'

export type InventoryDocumentDto = {
  id: string
  branch_id: string
  document_number: string
  document_type: string
  movement_code: string
  document_date: string
  service_order_id: string | null
  event_id: string | null
  from_location_id: string | null
  to_location_id: string | null
  status: string
  notes: string | null
  created_by: string | null
  created_at: string
  posted_at: string | null
  branch_name: string | null
  from_location_name: string | null
  to_location_name: string | null
  order_number: string | null
  line_count: number
}

export type InventoryDocumentDetailDto = InventoryDocumentDto & {
  lines: Array<{
    id: string
    line_number: number
    catalog_item_id: string
    location_id: string
    lot_id: string | null
    quantity: number
    unit: string
    service_order_material_id: string | null
    item_name: string | null
    location_name: string | null
    lot_number: string | null
  }>
  movements: Array<{
    id: string
    movement_type: string
    movement_code: string | null
    quantity: number
    unit: string
    occurred_at: string
    line_number: number | null
  }>
}

export async function listInventoryDocuments(
  companyId: string,
  filters: InventoryDocumentFilters = {},
): Promise<{ data: InventoryDocumentDto[]; error?: string }> {
  const db = getSupabaseServerClient()
  const limit = Math.min(Math.max(filters.limit ?? 100, 1), 500)

  let query = db
    .from('inventory_documents')
    .select(
      `
      id,
      branch_id,
      document_number,
      document_type,
      movement_code,
      document_date,
      service_order_id,
      event_id,
      from_location_id,
      to_location_id,
      status,
      notes,
      created_by,
      created_at,
      posted_at,
      branches ( name ),
      from_loc:from_location_id ( name ),
      to_loc:to_location_id ( name ),
      service_orders ( service_order_number ),
      inventory_document_lines ( id )
    `,
    )
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (filters.branchId) query = query.eq('branch_id', filters.branchId)
  if (filters.documentType) query = query.eq('document_type', filters.documentType)
  if (filters.movementCode) query = query.eq('movement_code', filters.movementCode)
  if (filters.serviceOrderId) {
    query = query.eq('service_order_id', filters.serviceOrderId)
  }
  if (filters.status) query = query.eq('status', filters.status)
  if (filters.from) query = query.gte('document_date', filters.from)
  if (filters.to) query = query.lte('document_date', filters.to)

  const { data, error } = await query
  if (error) {
    return { data: [], error: error.message }
  }

  return {
    data: (data ?? []).map((row) => {
      const branch = row.branches as { name?: string | null } | null
      const fromLoc = row.from_loc as { name?: string | null } | null
      const toLoc = row.to_loc as { name?: string | null } | null
      const order = row.service_orders as {
        service_order_number?: string | null
      } | null
      const lines = row.inventory_document_lines as Array<{ id: string }> | null

      return {
        id: row.id,
        branch_id: row.branch_id,
        document_number: row.document_number,
        document_type: row.document_type,
        movement_code: row.movement_code,
        document_date: row.document_date,
        service_order_id: row.service_order_id,
        event_id: row.event_id,
        from_location_id: row.from_location_id,
        to_location_id: row.to_location_id,
        status: row.status,
        notes: row.notes,
        created_by: row.created_by,
        created_at: row.created_at,
        posted_at: row.posted_at,
        branch_name: branch?.name || null,
        from_location_name: fromLoc?.name || null,
        to_location_name: toLoc?.name || null,
        order_number: order?.service_order_number || null,
        line_count: lines?.length ?? 0,
      }
    }),
  }
}

export async function getInventoryDocumentDetail(
  companyId: string,
  documentId: string,
): Promise<{ data: InventoryDocumentDetailDto | null; error?: string }> {
  const db = getSupabaseServerClient()

  const { data: doc, error: docErr } = await db
    .from('inventory_documents')
    .select(
      `
      id,
      branch_id,
      document_number,
      document_type,
      movement_code,
      document_date,
      service_order_id,
      event_id,
      from_location_id,
      to_location_id,
      status,
      notes,
      created_by,
      created_at,
      posted_at,
      branches ( name ),
      from_loc:from_location_id ( name ),
      to_loc:to_location_id ( name ),
      service_orders ( service_order_number )
    `,
    )
    .eq('company_id', companyId)
    .eq('id', documentId)
    .maybeSingle()

  if (docErr) {
    return { data: null, error: docErr.message }
  }
  if (!doc) {
    return { data: null, error: 'document_not_found' }
  }

  const { data: lines, error: lineErr } = await db
    .from('inventory_document_lines')
    .select(
      `
      id,
      line_number,
      catalog_item_id,
      location_id,
      lot_id,
      quantity,
      unit,
      service_order_material_id,
      catalog_items ( label_pt, item_name ),
      inventory_locations ( name ),
      inventory_lots ( lot_number )
    `,
    )
    .eq('company_id', companyId)
    .eq('document_id', documentId)
    .order('line_number', { ascending: true })

  if (lineErr) {
    return { data: null, error: lineErr.message }
  }

  const { data: movements, error: movErr } = await db
    .from('inventory_movements')
    .select(
      'id, movement_type, movement_code, quantity, unit, occurred_at, line_number',
    )
    .eq('company_id', companyId)
    .eq('inventory_document_id', documentId)
    .order('line_number', { ascending: true })
    .order('occurred_at', { ascending: true })

  if (movErr) {
    return { data: null, error: movErr.message }
  }

  const branch = doc.branches as { name?: string | null } | null
  const fromLoc = doc.from_loc as { name?: string | null } | null
  const toLoc = doc.to_loc as { name?: string | null } | null
  const order = doc.service_orders as {
    service_order_number?: string | null
  } | null

  return {
    data: {
      id: doc.id,
      branch_id: doc.branch_id,
      document_number: doc.document_number,
      document_type: doc.document_type,
      movement_code: doc.movement_code,
      document_date: doc.document_date,
      service_order_id: doc.service_order_id,
      event_id: doc.event_id,
      from_location_id: doc.from_location_id,
      to_location_id: doc.to_location_id,
      status: doc.status,
      notes: doc.notes,
      created_by: doc.created_by,
      created_at: doc.created_at,
      posted_at: doc.posted_at,
      branch_name: branch?.name || null,
      from_location_name: fromLoc?.name || null,
      to_location_name: toLoc?.name || null,
      order_number: order?.service_order_number || null,
      line_count: lines?.length ?? 0,
      lines: (lines ?? []).map((line) => {
        const item = line.catalog_items as {
          label_pt?: string | null
          item_name?: string | null
        } | null
        const loc = line.inventory_locations as { name?: string | null } | null
        const lot = line.inventory_lots as { lot_number?: string | null } | null
        return {
          id: line.id,
          line_number: line.line_number,
          catalog_item_id: line.catalog_item_id,
          location_id: line.location_id,
          lot_id: line.lot_id,
          quantity: Number(line.quantity),
          unit: line.unit,
          service_order_material_id: line.service_order_material_id,
          item_name: item?.label_pt || item?.item_name || null,
          location_name: loc?.name || null,
          lot_number: lot?.lot_number || null,
        }
      }),
      movements: (movements ?? []).map((m) => ({
        id: m.id,
        movement_type: m.movement_type,
        movement_code: m.movement_code,
        quantity: Number(m.quantity),
        unit: m.unit,
        occurred_at: m.occurred_at,
        line_number: m.line_number,
      })),
    },
  }
}
