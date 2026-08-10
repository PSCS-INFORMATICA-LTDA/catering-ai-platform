import {
  requireApiPermission,
  resolveAuthorizedCompanyId,
} from '@/Lib/auth/requireApi'
import {
  ensureDefaultInventoryLocation,
  postInventoryMovement,
} from '@/Lib/inventory/postInventory'
import { isInventoryMovementType } from '@/Lib/inventory/types'
import { writeOperationalAudit } from '@/Lib/orders/writeOperationalAudit'
import { getSupabaseServerClient } from '@/Lib/supabaseServer'
import { randomUUID } from 'crypto'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * POST /api/inventory/post
 * initial_balance | adjustment_in | adjustment_out
 * Nunca edita inventory_balances diretamente.
 */
export async function POST(request: Request) {
  let body: {
    movement_type?: string
    catalog_item_id?: string
    location_id?: string
    quantity?: number
    unit?: string
    notes?: string
    idempotency_key?: string
  }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Payload inválido.' }, { status: 400 })
  }

  const movementType = (body.movement_type || '').trim()
  if (
    movementType !== 'initial_balance' &&
    movementType !== 'adjustment_in' &&
    movementType !== 'adjustment_out'
  ) {
    return Response.json({ error: 'movement_type inválido.' }, { status: 400 })
  }
  if (!isInventoryMovementType(movementType)) {
    return Response.json({ error: 'movement_type inválido.' }, { status: 400 })
  }

  const permission =
    movementType === 'initial_balance' ? 'inventory.manage' : 'inventory.adjust'
  const auth = await requireApiPermission(permission)
  if (!auth.ok) return auth.response

  const companyId = resolveAuthorizedCompanyId(auth.session)
  const catalogItemId = (body.catalog_item_id || '').trim()
  if (!catalogItemId) {
    return Response.json({ error: 'catalog_item_id obrigatório.' }, { status: 400 })
  }

  const notes = (body.notes || '').trim()
  if (
    (movementType === 'adjustment_in' || movementType === 'adjustment_out') &&
    notes.length < 3
  ) {
    return Response.json({ error: 'Motivo obrigatório para ajuste.' }, { status: 400 })
  }

  const absQty = Math.abs(Number(body.quantity))
  if (!Number.isFinite(absQty) || absQty <= 0) {
    return Response.json({ error: 'Quantidade inválida.' }, { status: 400 })
  }

  const db = getSupabaseServerClient()
  const { data: item } = await db
    .from('catalog_items')
    .select('id, unit, stock_unit, inventory_enabled, company_id')
    .eq('id', catalogItemId)
    .eq('company_id', companyId)
    .maybeSingle()

  if (!item) {
    return Response.json({ error: 'Item não encontrado.' }, { status: 404 })
  }

  // Enable inventory on initial balance if admin is opening stock
  if (movementType === 'initial_balance' && item.inventory_enabled !== true) {
    await db
      .from('catalog_items')
      .update({ inventory_enabled: true })
      .eq('id', item.id)
      .eq('company_id', companyId)
  }

  const locationId =
    (body.location_id || '').trim() ||
    (await ensureDefaultInventoryLocation(companyId, auth.session.userId))

  const unit =
    (body.unit || item.unit || item.stock_unit || 'unit').toString().trim()
  const signedQty =
    movementType === 'adjustment_out' ? -absQty : absQty

  const idempotencyKey =
    (body.idempotency_key || '').trim() ||
    `${movementType}:${catalogItemId}:${randomUUID()}`

  const result = await postInventoryMovement({
    companyId,
    locationId,
    catalogItemId,
    movementType,
    quantity: signedQty,
    unit,
    idempotencyKey,
    sourceType: 'manual',
    sourceId: auth.session.userId,
    notes: notes || null,
    actorUserId: auth.session.userId,
  })

  if (!result.ok) {
    await writeOperationalAudit({
      companyId,
      actorUserId: auth.session.userId,
      entityType: 'inventory_movement',
      entityId: catalogItemId,
      action: 'inventory_posting_failed',
      newData: {
        movement_type: movementType,
        error: result.error,
        quantity: signedQty,
        unit,
      },
    })
    return Response.json({ error: result.error, ...result }, { status: 400 })
  }

  await writeOperationalAudit({
    companyId,
    actorUserId: auth.session.userId,
    entityType: 'inventory_movement',
    entityId: result.movement_id || catalogItemId,
    action:
      movementType === 'initial_balance'
        ? 'inventory_initial_balance_posted'
        : 'inventory_adjustment_posted',
    newData: {
      movement_type: movementType,
      quantity: signedQty,
      unit,
      location_id: locationId,
      catalog_item_id: catalogItemId,
      idempotent: result.idempotent ?? false,
    },
  })

  return Response.json({ data: result })
}
