import {
  requireApiPermission,
  resolveAuthorizedCompanyId,
} from '@/Lib/auth/requireApi'
import {
  postEventDispatchDocument,
  postEventReturnDocuments,
} from '@/Lib/inventory/postInventory'
import { writeOperationalAudit } from '@/Lib/orders/writeOperationalAudit'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * POST /api/inventory/posting
 * dispatch | return — wrappers sobre RPCs com documento (Fase C).
 */
export async function POST(request: Request) {
  let body: {
    action?: 'dispatch' | 'return'
    service_order_id?: string
    material_id?: string
  }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Payload inválido.' }, { status: 400 })
  }

  const auth = await requireApiPermission('inventory.adjust')
  if (!auth.ok) return auth.response

  const companyId = resolveAuthorizedCompanyId(auth.session)
  const action = body.action

  if (action === 'dispatch') {
    const serviceOrderId = (body.service_order_id || '').trim()
    if (!serviceOrderId) {
      return Response.json({ error: 'service_order_id obrigatório.' }, { status: 400 })
    }

    const result = await postEventDispatchDocument({
      companyId,
      serviceOrderId,
      actorUserId: auth.session.userId,
    })

    if (!result.ok) {
      await writeOperationalAudit({
        companyId,
        actorUserId: auth.session.userId,
        entityType: 'inventory_document',
        entityId: serviceOrderId,
        action: 'inventory_posting_failed',
        newData: { action: 'dispatch', error: result.error },
      })
      return Response.json({ error: result.error, ...result }, { status: 400 })
    }

    await writeOperationalAudit({
      companyId,
      actorUserId: auth.session.userId,
      entityType: 'inventory_document',
      entityId: String(result.document_id || serviceOrderId),
      action: 'inventory_document_posted',
      newData: {
        action: 'dispatch',
        document_number: result.document_number,
        posted: result.posted,
        skipped: result.skipped,
      },
    })

    return Response.json({ data: result })
  }

  if (action === 'return') {
    const materialId = (body.material_id || '').trim()
    if (!materialId) {
      return Response.json({ error: 'material_id obrigatório.' }, { status: 400 })
    }

    const result = await postEventReturnDocuments({
      companyId,
      materialId,
      actorUserId: auth.session.userId,
    })

    if (!result.ok) {
      await writeOperationalAudit({
        companyId,
        actorUserId: auth.session.userId,
        entityType: 'inventory_document',
        entityId: materialId,
        action: 'inventory_posting_failed',
        newData: { action: 'return', error: result.error },
      })
      return Response.json({ error: result.error, ...result }, { status: 400 })
    }

    await writeOperationalAudit({
      companyId,
      actorUserId: auth.session.userId,
      entityType: 'inventory_document',
      entityId: materialId,
      action: 'inventory_document_posted',
      newData: { action: 'return', result },
    })

    return Response.json({ data: result })
  }

  return Response.json({ error: 'action inválida.' }, { status: 400 })
}
