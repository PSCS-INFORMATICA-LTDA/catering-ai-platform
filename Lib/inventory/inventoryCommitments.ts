import {
  createInventoryCommitment,
  releaseInventoryCommitment,
} from '@/Lib/inventory/postInventory'
import { getSupabaseServerClient } from '@/Lib/supabaseServer'
import type {
  InventoryCommitmentFilters,
  InventoryCommitmentStatus,
  InventoryRpcResult,
} from '@/Lib/inventory/types'

export type InventoryCommitmentDto = {
  id: string
  branch_id: string
  location_id: string
  catalog_item_id: string
  lot_id: string | null
  service_order_id: string
  service_order_material_id: string
  quantity: number
  unit: string
  status: InventoryCommitmentStatus
  committed_at: string
  released_at: string | null
  consumed_at: string | null
  item_name: string | null
  branch_name: string | null
  location_name: string | null
  order_number: string | null
  lot_number: string | null
}

export async function commitInventoryForMaterial(input: {
  companyId: string
  serviceOrderMaterialId: string
  quantity?: number | null
  locationId?: string | null
  lotId?: string | null
  actorUserId?: string | null
}): Promise<InventoryRpcResult> {
  return createInventoryCommitment(input)
}

export async function releaseInventoryCommitmentForMaterial(input: {
  companyId: string
  commitmentId: string
  newStatus?: Extract<
    InventoryCommitmentStatus,
    'released' | 'cancelled' | 'consumed'
  >
  actorUserId?: string | null
}): Promise<InventoryRpcResult> {
  return releaseInventoryCommitment(input)
}

export async function listInventoryCommitments(
  companyId: string,
  filters: InventoryCommitmentFilters = {},
): Promise<{ data: InventoryCommitmentDto[]; error?: string }> {
  const db = getSupabaseServerClient()
  const limit = Math.min(Math.max(filters.limit ?? 200, 1), 500)

  let query = db
    .from('inventory_commitments')
    .select(
      `
      id,
      branch_id,
      location_id,
      catalog_item_id,
      lot_id,
      service_order_id,
      service_order_material_id,
      quantity,
      unit,
      status,
      committed_at,
      released_at,
      consumed_at,
      catalog_items ( label_pt, item_name ),
      inventory_locations ( name ),
      branches ( name ),
      inventory_lots ( lot_number ),
      service_orders ( service_order_number )
    `,
    )
    .eq('company_id', companyId)
    .order('committed_at', { ascending: false })
    .limit(limit)

  if (filters.branchId) query = query.eq('branch_id', filters.branchId)
  if (filters.locationId) query = query.eq('location_id', filters.locationId)
  if (filters.catalogItemId) {
    query = query.eq('catalog_item_id', filters.catalogItemId)
  }
  if (filters.lotId) query = query.eq('lot_id', filters.lotId)
  if (filters.serviceOrderId) {
    query = query.eq('service_order_id', filters.serviceOrderId)
  }
  if (filters.status) query = query.eq('status', filters.status)

  const { data, error } = await query
  if (error) {
    return { data: [], error: error.message }
  }

  return {
    data: (data ?? []).map(mapCommitmentRow),
  }
}

/** Drill-down de Committed por item (OS → qty reservada). */
export async function getInventoryCommitmentDrillDown(
  companyId: string,
  catalogItemId: string,
  filters: Pick<
    InventoryCommitmentFilters,
    'branchId' | 'locationId' | 'lotId'
  > = {},
): Promise<{ data: InventoryCommitmentDto[]; error?: string }> {
  return listInventoryCommitments(companyId, {
    ...filters,
    catalogItemId,
    status: 'active',
    limit: 500,
  })
}

function mapCommitmentRow(row: Record<string, unknown>): InventoryCommitmentDto {
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
    id: String(row.id),
    branch_id: String(row.branch_id),
    location_id: String(row.location_id),
    catalog_item_id: String(row.catalog_item_id),
    lot_id: (row.lot_id as string | null) ?? null,
    service_order_id: String(row.service_order_id),
    service_order_material_id: String(row.service_order_material_id),
    quantity: Number(row.quantity),
    unit: String(row.unit),
    status: row.status as InventoryCommitmentStatus,
    committed_at: String(row.committed_at),
    released_at: (row.released_at as string | null) ?? null,
    consumed_at: (row.consumed_at as string | null) ?? null,
    item_name: item?.label_pt || item?.item_name || null,
    branch_name: branch?.name || null,
    location_name: loc?.name || null,
    order_number: order?.service_order_number || null,
    lot_number: lot?.lot_number || null,
  }
}
