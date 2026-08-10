import { getSupabaseServerClient } from '@/Lib/supabaseServer'
import type { PostInventoryResult } from '@/Lib/inventory/types'
import { normalizeInventoryUnit } from '@/Lib/inventory/types'

export async function ensureDefaultInventoryLocation(
  companyId: string,
  actorUserId?: string | null,
  name = 'Main Stock',
): Promise<string> {
  const db = getSupabaseServerClient()
  const { data, error } = await db.rpc('ensure_default_inventory_location', {
    p_company_id: companyId,
    p_actor: actorUserId ?? null,
    p_name: name,
  })
  if (error || !data) {
    throw new Error(error?.message || 'Falha ao garantir localização padrão.')
  }
  return String(data)
}

export async function postInventoryMovement(input: {
  companyId: string
  locationId: string
  catalogItemId: string
  movementType: string
  quantity: number
  unit: string
  idempotencyKey: string
  sourceType?: string | null
  sourceId?: string | null
  serviceOrderId?: string | null
  serviceOrderMaterialId?: string | null
  notes?: string | null
  actorUserId?: string | null
  occurredAt?: string | null
  allowNegative?: boolean
}): Promise<PostInventoryResult> {
  const db = getSupabaseServerClient()
  const { data, error } = await db.rpc('post_inventory_movement', {
    p_company_id: input.companyId,
    p_location_id: input.locationId,
    p_catalog_item_id: input.catalogItemId,
    p_movement_type: input.movementType,
    p_quantity: input.quantity,
    p_unit: normalizeInventoryUnit(input.unit),
    p_idempotency_key: input.idempotencyKey,
    p_source_type: input.sourceType ?? null,
    p_source_id: input.sourceId ?? null,
    p_service_order_id: input.serviceOrderId ?? null,
    p_service_order_material_id: input.serviceOrderMaterialId ?? null,
    p_notes: input.notes ?? null,
    p_actor: input.actorUserId ?? null,
    p_occurred_at: input.occurredAt ?? null,
    p_allow_negative: input.allowNegative ?? false,
  })
  if (error) {
    return { ok: false, error: error.message }
  }
  return (data ?? { ok: false, error: 'empty_response' }) as PostInventoryResult
}

export async function postInventoryForOrderDispatch(input: {
  companyId: string
  serviceOrderId: string
  actorUserId?: string | null
}): Promise<Record<string, unknown>> {
  const db = getSupabaseServerClient()
  const { data, error } = await db.rpc('post_inventory_for_order_dispatch', {
    p_company_id: input.companyId,
    p_service_order_id: input.serviceOrderId,
    p_actor: input.actorUserId ?? null,
  })
  if (error) {
    return { ok: false, error: error.message }
  }
  return (data ?? { ok: false }) as Record<string, unknown>
}

export async function postInventoryForMaterialReturn(input: {
  companyId: string
  materialId: string
  actorUserId?: string | null
}): Promise<Record<string, unknown>> {
  const db = getSupabaseServerClient()
  const { data, error } = await db.rpc('post_inventory_for_material_return', {
    p_company_id: input.companyId,
    p_material_id: input.materialId,
    p_actor: input.actorUserId ?? null,
  })
  if (error) {
    return { ok: false, error: error.message }
  }
  return (data ?? { ok: false }) as Record<string, unknown>
}

export async function rebuildInventoryBalances(
  companyId?: string | null,
): Promise<Record<string, unknown>> {
  const db = getSupabaseServerClient()
  const { data, error } = await db.rpc('rebuild_inventory_balances', {
    p_company_id: companyId ?? null,
  })
  if (error) {
    return { ok: false, error: error.message }
  }
  return (data ?? { ok: false }) as Record<string, unknown>
}
