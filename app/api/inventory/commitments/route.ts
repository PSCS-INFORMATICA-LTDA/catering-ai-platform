import {
  requireApiPermission,
  resolveAuthorizedCompanyId,
} from '@/Lib/auth/requireApi'
import {
  commitInventoryForMaterial,
  getInventoryCommitmentDrillDown,
  listInventoryCommitments,
  releaseInventoryCommitmentForMaterial,
} from '@/Lib/inventory/inventoryCommitments'
import type { InventoryCommitmentStatus } from '@/Lib/inventory/types'
import { writeOperationalAudit } from '@/Lib/orders/writeOperationalAudit'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/** GET /api/inventory/commitments — listagem ou drill-down por item. */
export async function GET(request: Request) {
  const auth = await requireApiPermission('inventory.view')
  if (!auth.ok) return auth.response

  const companyId = resolveAuthorizedCompanyId(auth.session)
  const url = new URL(request.url)
  const catalogItemId = url.searchParams.get('catalog_item_id')
  const drillDown = url.searchParams.get('drill_down') === '1'

  if (catalogItemId && drillDown) {
    const { data, error } = await getInventoryCommitmentDrillDown(
      companyId,
      catalogItemId,
      {
        branchId: url.searchParams.get('branch_id'),
        locationId: url.searchParams.get('location_id'),
        lotId: url.searchParams.get('lot_id'),
      },
    )
    if (error) return Response.json({ error }, { status: 500 })
    return Response.json({ data })
  }

  const status = url.searchParams.get('status') as InventoryCommitmentStatus | null
  const { data, error } = await listInventoryCommitments(companyId, {
    branchId: url.searchParams.get('branch_id'),
    locationId: url.searchParams.get('location_id'),
    catalogItemId,
    lotId: url.searchParams.get('lot_id'),
    serviceOrderId: url.searchParams.get('service_order_id'),
    status: status || undefined,
    limit: Number(url.searchParams.get('limit') || 200),
  })

  if (error) return Response.json({ error }, { status: 500 })
  return Response.json({ data })
}

/** POST /api/inventory/commitments — criar reserva ou liberar. */
export async function POST(request: Request) {
  let body: {
    action?: 'commit' | 'release'
    service_order_material_id?: string
    commitment_id?: string
    quantity?: number
    location_id?: string
    lot_id?: string
    new_status?: 'released' | 'cancelled' | 'consumed'
  }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Payload inválido.' }, { status: 400 })
  }

  const action = body.action || 'commit'
  const auth = await requireApiPermission(
    action === 'commit' ? 'inventory.manage' : 'inventory.manage',
  )
  if (!auth.ok) return auth.response

  const companyId = resolveAuthorizedCompanyId(auth.session)

  if (action === 'release') {
    const commitmentId = (body.commitment_id || '').trim()
    if (!commitmentId) {
      return Response.json({ error: 'commitment_id obrigatório.' }, { status: 400 })
    }

    const result = await releaseInventoryCommitmentForMaterial({
      companyId,
      commitmentId,
      newStatus: body.new_status ?? 'released',
      actorUserId: auth.session.userId,
    })

    if (!result.ok) {
      return Response.json({ error: result.error, ...result }, { status: 400 })
    }

    await writeOperationalAudit({
      companyId,
      actorUserId: auth.session.userId,
      entityType: 'inventory_commitment',
      entityId: commitmentId,
      action: 'inventory_commitment_released',
      newData: {
        new_status: body.new_status ?? 'released',
        idempotent: result.idempotent ?? false,
      },
    })

    return Response.json({ data: result })
  }

  const materialId = (body.service_order_material_id || '').trim()
  if (!materialId) {
    return Response.json(
      { error: 'service_order_material_id obrigatório.' },
      { status: 400 },
    )
  }

  const result = await commitInventoryForMaterial({
    companyId,
    serviceOrderMaterialId: materialId,
    quantity: body.quantity ?? null,
    locationId: body.location_id ?? null,
    lotId: body.lot_id ?? null,
    actorUserId: auth.session.userId,
  })

  if (!result.ok) {
    return Response.json({ error: result.error, ...result }, { status: 400 })
  }

  await writeOperationalAudit({
    companyId,
    actorUserId: auth.session.userId,
    entityType: 'inventory_commitment',
    entityId: String(result.commitment_id || materialId),
    action: 'inventory_commitment_created',
    newData: {
      service_order_material_id: materialId,
      quantity: body.quantity ?? null,
      idempotent: result.idempotent ?? false,
    },
  })

  return Response.json({ data: result })
}
