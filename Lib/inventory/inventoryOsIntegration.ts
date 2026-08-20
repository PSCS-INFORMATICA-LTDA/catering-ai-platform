import {
  commitInventoryForMaterial,
  releaseInventoryCommitmentForMaterial,
} from '@/Lib/inventory/inventoryCommitments'
import { postEventReturnDocuments } from '@/Lib/inventory/postInventory'
import type { InventoryRpcResult } from '@/Lib/inventory/types'
import type {
  MaterialStatus,
  MaterialType,
  StockPostingStatus,
} from '@/Lib/orders/orderMaterials'
import { getSupabaseServerClient } from '@/Lib/supabaseServer'

export type InventoryOsHookResult = {
  skipped: boolean
  reason?: string
  commitment?: InventoryRpcResult
  release?: InventoryRpcResult
  returnPosting?: InventoryRpcResult
}

type MaterialSnapshot = {
  id: string
  catalog_item_id: string | null
  material_type: MaterialType
  checked_quantity: number
  status: MaterialStatus
  stock_posting_status?: StockPostingStatus | null
}

/** Gate D: reserva na conferência interna (`checked`), libera em cancel/divergência. */
export const INVENTORY_COMMITMENT_GATE: 'checked' = 'checked'

export async function loadCatalogInventoryFlags(
  companyId: string,
  catalogItemId: string,
): Promise<{ inventory_enabled: boolean } | null> {
  const db = getSupabaseServerClient()
  const { data } = await db
    .from('catalog_items')
    .select('inventory_enabled')
    .eq('id', catalogItemId)
    .eq('company_id', companyId)
    .maybeSingle()
  return data ? { inventory_enabled: data.inventory_enabled === true } : null
}

export function shouldReserveInventoryForMaterial(
  material: MaterialSnapshot,
  inventoryEnabled: boolean | null | undefined,
): boolean {
  if (!material.catalog_item_id) return false
  if (inventoryEnabled !== true) return false
  if (material.material_type === 'disposable') return false
  if (material.stock_posting_status === 'not_applicable') return false
  return true
}

/** Libera commitment active de uma linha de material (idempotente se ausente). */
export async function releaseActiveMaterialCommitment(input: {
  companyId: string
  materialId: string
  newStatus: 'released' | 'cancelled'
  actorUserId?: string | null
}): Promise<InventoryOsHookResult> {
  const db = getSupabaseServerClient()
  const { data: row } = await db
    .from('inventory_commitments')
    .select('id')
    .eq('company_id', input.companyId)
    .eq('service_order_material_id', input.materialId)
    .eq('status', 'active')
    .maybeSingle()

  if (!row?.id) {
    return { skipped: true, reason: 'no_active_commitment' }
  }

  const release = await releaseInventoryCommitmentForMaterial({
    companyId: input.companyId,
    commitmentId: row.id,
    newStatus: input.newStatus,
    actorUserId: input.actorUserId,
  })

  return {
    skipped: false,
    release,
  }
}

/**
 * Após conferência interna: cria/atualiza commitment com checked_quantity.
 * Divergência ou qty=0 → libera reserva existente.
 */
export async function syncInventoryCommitmentAfterMaterialCheck(input: {
  companyId: string
  material: MaterialSnapshot
  actorUserId?: string | null
}): Promise<InventoryOsHookResult> {
  const { companyId, material, actorUserId } = input

  if (!material.catalog_item_id) {
    return { skipped: true, reason: 'no_catalog_item' }
  }

  const flags = await loadCatalogInventoryFlags(companyId, material.catalog_item_id)
  if (!shouldReserveInventoryForMaterial(material, flags?.inventory_enabled)) {
    await releaseActiveMaterialCommitment({
      companyId,
      materialId: material.id,
      newStatus: 'released',
      actorUserId,
    })
    return { skipped: true, reason: 'inventory_not_tracked' }
  }

  if (material.status !== 'checked') {
    if (material.status === 'divergence') {
      const release = await releaseActiveMaterialCommitment({
        companyId,
        materialId: material.id,
        newStatus: 'released',
        actorUserId,
      })
      return {
        skipped: true,
        reason: 'divergence_no_reserve',
        release: release.release,
      }
    }
    return { skipped: true, reason: 'status_not_checked' }
  }

  const qty = Number(material.checked_quantity)
  if (!Number.isFinite(qty) || qty <= 0) {
    const release = await releaseActiveMaterialCommitment({
      companyId,
      materialId: material.id,
      newStatus: 'released',
      actorUserId,
    })
    return {
      skipped: true,
      reason: 'zero_checked_qty',
      release: release.release,
    }
  }

  const db = getSupabaseServerClient()
  const { data: existing } = await db
    .from('inventory_commitments')
    .select('id, quantity')
    .eq('company_id', companyId)
    .eq('service_order_material_id', material.id)
    .eq('status', 'active')
    .maybeSingle()

  if (existing && Number(existing.quantity) !== qty) {
    await releaseInventoryCommitmentForMaterial({
      companyId,
      commitmentId: existing.id,
      newStatus: 'released',
      actorUserId,
    })
  }

  const commitment = await commitInventoryForMaterial({
    companyId,
    serviceOrderMaterialId: material.id,
    quantity: qty,
    actorUserId,
  })

  return {
    skipped: false,
    commitment,
  }
}

/** Cancelamento de material → libera commitment. */
export async function syncInventoryCommitmentAfterMaterialCancel(input: {
  companyId: string
  materialId: string
  actorUserId?: string | null
}): Promise<InventoryOsHookResult> {
  const release = await releaseActiveMaterialCommitment({
    companyId: input.companyId,
    materialId: input.materialId,
    newStatus: 'cancelled',
    actorUserId: input.actorUserId,
  })
  return release.skipped
    ? { skipped: true, reason: release.reason }
    : { skipped: false, release: release.release }
}

/**
 * Retorno operacional → documentos EVENT_RETURN / LEFTOVER_RETURN (RPC JDE).
 * Dispatch permanece em confirm_public_material_dispatch → post_inventory_for_order_dispatch.
 */
export async function postInventoryReturnForMaterial(input: {
  companyId: string
  materialId: string
  actorUserId?: string | null
}): Promise<InventoryRpcResult> {
  return postEventReturnDocuments(input)
}

export async function resolveStockPostingStatusForCatalogItem(input: {
  companyId: string
  catalogItemId: string | null
  materialType: MaterialType
}): Promise<StockPostingStatus> {
  if (input.materialType === 'disposable') return 'not_applicable'
  if (!input.catalogItemId) return 'pending'

  const flags = await loadCatalogInventoryFlags(input.companyId, input.catalogItemId)
  if (flags?.inventory_enabled !== true) return 'not_applicable'
  return 'pending'
}
