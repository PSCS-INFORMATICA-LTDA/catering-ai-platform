import {
  requireApiPermission,
  resolveAuthorizedCompanyId,
} from '@/Lib/auth/requireApi'
import {
  canCloseMaterial,
  deriveMaterialStatus,
  isMaterialType,
  parseNonNegativeQuantity,
  type MaterialStatus,
  type MaterialType,
} from '@/Lib/orders/orderMaterials'
import {
  postInventoryReturnForMaterial,
  syncInventoryCommitmentAfterMaterialCancel,
  syncInventoryCommitmentAfterMaterialCheck,
} from '@/Lib/inventory/inventoryOsIntegration'
import { writeOperationalAudit } from '@/Lib/orders/writeOperationalAudit'
import { getSupabaseServerClient } from '@/Lib/supabaseServer'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type Params = { params: Promise<{ id: string; materialId: string }> }

type MaterialRow = {
  id: string
  company_id: string
  service_order_id: string
  catalog_item_id: string | null
  description_snapshot: string
  material_type: MaterialType
  unit: string
  required_quantity: number
  separated_quantity: number
  checked_quantity: number
  dispatched_quantity: number
  returned_quantity: number
  leftover_quantity: number
  status: MaterialStatus
  notes: string | null
  return_notes: string | null
  separated_by_user_id: string | null
  separated_at: string | null
  checked_by_user_id: string | null
  checked_at: string | null
  dispatched_at: string | null
  returned_at: string | null
  stock_posting_status?: string | null
}

async function loadMaterial(
  companyId: string,
  orderId: string,
  materialId: string,
): Promise<MaterialRow | null> {
  const db = getSupabaseServerClient()
  const { data } = await db
    .from('service_order_materials')
    .select('*')
    .eq('id', materialId)
    .eq('company_id', companyId)
    .eq('service_order_id', orderId)
    .maybeSingle()
  return (data as MaterialRow | null) ?? null
}

export async function PATCH(request: Request, { params }: Params) {
  const { id: orderId, materialId } = await params

  let body: {
    action?: string
    description_snapshot?: string
    material_type?: string
    unit?: string
    required_quantity?: number
    separated_quantity?: number
    checked_quantity?: number
    returned_quantity?: number
    leftover_quantity?: number
    notes?: string | null
    return_notes?: string | null
    justification?: string | null
  }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Payload inválido.' }, { status: 400 })
  }

  const action = (body.action || 'update').trim()

  const permission =
    action === 'separate'
      ? 'orders.materials.prepare'
      : action === 'check'
        ? 'orders.materials.check'
        : action === 'return' || action === 'close'
          ? 'orders.materials.return'
          : action === 'cancel'
            ? 'orders.materials.prepare'
            : 'orders.materials.prepare'

  const auth = await requireApiPermission(permission)
  if (!auth.ok) return auth.response

  const companyId = resolveAuthorizedCompanyId(auth.session)
  const current = await loadMaterial(companyId, orderId, materialId)
  if (!current) {
    return Response.json({ error: 'Material não encontrado.' }, { status: 404 })
  }

  if (current.status === 'cancelled' && action !== 'update') {
    return Response.json(
      { error: 'Material cancelado não pode ser operado.' },
      { status: 400 },
    )
  }

  const db = getSupabaseServerClient()
  const patch: Record<string, unknown> = {
    updated_by: auth.session.userId,
  }
  let auditAction:
    | 'material_updated'
    | 'material_cancelled'
    | 'material_separated'
    | 'material_checked'
    | 'material_divergence'
    | 'material_returned'
    | 'material_return_divergence'
    | 'material_leftover_recorded'
    | 'materials_closed' = 'material_updated'

  if (action === 'cancel') {
    patch.status = 'cancelled'
    auditAction = 'material_cancelled'
  } else if (action === 'separate') {
    const qty = parseNonNegativeQuantity(body.separated_quantity)
    if (!qty.ok) return Response.json({ error: qty.error }, { status: 400 })
    const required = Number(current.required_quantity)
    const checked = Number(current.checked_quantity)
    const hasChecked = Boolean(current.checked_at)
    patch.separated_quantity = qty.value
    patch.separated_by_user_id = auth.session.userId
    patch.separated_at = new Date().toISOString()
    patch.status = deriveMaterialStatus({
      required,
      separated: qty.value,
      checked,
      hasChecked,
      currentStatus: current.status,
      materialType: current.material_type,
    })
    auditAction = 'material_separated'
  } else if (action === 'check') {
    const qty = parseNonNegativeQuantity(body.checked_quantity)
    if (!qty.ok) return Response.json({ error: qty.error }, { status: 400 })
    const required = Number(current.required_quantity)
    const separated = Number(current.separated_quantity)
    patch.checked_quantity = qty.value
    patch.checked_by_user_id = auth.session.userId
    patch.checked_at = new Date().toISOString()
    const next = deriveMaterialStatus({
      required,
      separated,
      checked: qty.value,
      hasChecked: true,
      currentStatus: current.status,
      materialType: current.material_type,
    })
    patch.status = next
    auditAction = next === 'divergence' ? 'material_divergence' : 'material_checked'
  } else if (action === 'return') {
    if (!current.dispatched_at && Number(current.dispatched_quantity) <= 0) {
      return Response.json(
        { error: 'Material ainda não saiu — registre a saída antes do retorno.' },
        { status: 400 },
      )
    }
    const returned = parseNonNegativeQuantity(body.returned_quantity)
    if (!returned.ok) {
      return Response.json({ error: returned.error }, { status: 400 })
    }
    const leftover =
      body.leftover_quantity === undefined
        ? { ok: true as const, value: Number(current.leftover_quantity || 0) }
        : parseNonNegativeQuantity(body.leftover_quantity)
    if (!leftover.ok) {
      return Response.json({ error: leftover.error }, { status: 400 })
    }

    // Retornável/equipamento/descartável: sobra não se aplica — forçar 0.
    const leftoverValue =
      current.material_type === 'consumable' ? leftover.value : 0

    const dispatched = Number(current.dispatched_quantity)
    if (returned.value > dispatched) {
      return Response.json(
        {
          error:
            'Retorno maior que a saída não é permitido. Ajuste a quantidade.',
        },
        { status: 400 },
      )
    }

    patch.returned_quantity = returned.value
    patch.leftover_quantity = leftoverValue
    patch.returned_by_user_id = auth.session.userId
    patch.returned_at = new Date().toISOString()
    if (body.return_notes !== undefined) {
      patch.return_notes = body.return_notes?.trim() || null
    }

    const next = deriveMaterialStatus({
      required: Number(current.required_quantity),
      separated: Number(current.separated_quantity),
      checked: Number(current.checked_quantity),
      hasChecked: Boolean(current.checked_at),
      dispatched,
      hasDispatched: true,
      returned: returned.value,
      hasReturned: true,
      leftover: leftoverValue,
      materialType: current.material_type,
      currentStatus: current.status,
    })
    patch.status = next

    if (leftoverValue > 0) {
      auditAction = 'material_leftover_recorded'
    } else if (next === 'divergence') {
      auditAction = 'material_return_divergence'
    } else {
      auditAction = 'material_returned'
    }
  } else if (action === 'close') {
    if (
      !canCloseMaterial({
        status: current.status,
        material_type: current.material_type,
        dispatched_quantity: Number(current.dispatched_quantity),
        returned_quantity: Number(current.returned_quantity),
        returned_at: current.returned_at,
      })
    ) {
      return Response.json(
        {
          error:
            'Material com divergência ou retorno pendente não pode ser fechado.',
        },
        { status: 400 },
      )
    }
    patch.status = 'closed'
    auditAction = 'materials_closed'
  } else {
    if (body.description_snapshot != null) {
      const d = body.description_snapshot.trim()
      if (!d) {
        return Response.json({ error: 'Descrição é obrigatória.' }, { status: 400 })
      }
      patch.description_snapshot = d
    }
    if (body.unit != null) {
      const u = body.unit.trim()
      if (!u) return Response.json({ error: 'Unidade é obrigatória.' }, { status: 400 })
      patch.unit = u
    }
    if (body.material_type != null) {
      if (!isMaterialType(body.material_type)) {
        return Response.json({ error: 'Tipo de material inválido.' }, { status: 400 })
      }
      patch.material_type = body.material_type
    }
    if (body.required_quantity != null) {
      const qty = parseNonNegativeQuantity(body.required_quantity)
      if (!qty.ok) return Response.json({ error: qty.error }, { status: 400 })
      patch.required_quantity = qty.value
    }
    if (body.notes !== undefined) {
      patch.notes = body.notes?.trim() || null
    }

    if (
      current.status !== 'cancelled' &&
      current.status !== 'closed' &&
      current.status !== 'dispatched' &&
      current.status !== 'returned'
    ) {
      const required = Number(patch.required_quantity ?? current.required_quantity)
      const separated = Number(current.separated_quantity)
      const checked = Number(current.checked_quantity)
      const hasChecked = Boolean(current.checked_at)
      patch.status = deriveMaterialStatus({
        required,
        separated,
        checked,
        hasChecked,
        currentStatus: current.status,
        materialType: current.material_type,
      })
    }
    auditAction = 'material_updated'
  }

  const { data, error } = await db
    .from('service_order_materials')
    .update(patch)
    .eq('id', materialId)
    .eq('company_id', companyId)
    .eq('service_order_id', orderId)
    .select('*')
    .single()

  if (error || !data) {
    return Response.json({ error: error?.message || 'Falha ao atualizar.' }, { status: 500 })
  }

  await writeOperationalAudit({
    companyId,
    actorUserId: auth.session.userId,
    entityType: 'service_order_material',
    entityId: materialId,
    action: auditAction,
    oldData: {
      status: current.status,
      required_quantity: current.required_quantity,
      separated_quantity: current.separated_quantity,
      checked_quantity: current.checked_quantity,
      dispatched_quantity: current.dispatched_quantity,
      returned_quantity: current.returned_quantity,
      leftover_quantity: current.leftover_quantity,
    },
    newData: {
      service_order_id: orderId,
      status: data.status,
      required_quantity: data.required_quantity,
      separated_quantity: data.separated_quantity,
      checked_quantity: data.checked_quantity,
      dispatched_quantity: data.dispatched_quantity,
      returned_quantity: data.returned_quantity,
      leftover_quantity: data.leftover_quantity,
    },
  })

  let inventoryHook: Record<string, unknown> | null = null

  if (action === 'check') {
    const hook = await syncInventoryCommitmentAfterMaterialCheck({
      companyId,
      material: {
        id: materialId,
        catalog_item_id: data.catalog_item_id,
        material_type: data.material_type,
        checked_quantity: Number(data.checked_quantity),
        status: data.status,
        stock_posting_status: data.stock_posting_status,
      },
      actorUserId: auth.session.userId,
    })
    inventoryHook = hook
    if (hook.commitment?.ok === true && !hook.skipped) {
      await writeOperationalAudit({
        companyId,
        actorUserId: auth.session.userId,
        entityType: 'inventory_commitment',
        entityId: String(hook.commitment.commitment_id || materialId),
        action: 'inventory_commitment_created',
        newData: {
          service_order_material_id: materialId,
          gate: 'checked',
          quantity: data.checked_quantity,
          idempotent: hook.commitment.idempotent ?? false,
        },
      })
    }
    if (hook.release?.ok === true && hook.reason === 'divergence_no_reserve') {
      await writeOperationalAudit({
        companyId,
        actorUserId: auth.session.userId,
        entityType: 'inventory_commitment',
        entityId: materialId,
        action: 'inventory_commitment_released',
        newData: { reason: 'divergence', service_order_material_id: materialId },
      })
    }
  }

  if (action === 'cancel') {
    const hook = await syncInventoryCommitmentAfterMaterialCancel({
      companyId,
      materialId,
      actorUserId: auth.session.userId,
    })
    inventoryHook = hook
    if (hook.release?.ok === true && !hook.skipped) {
      await writeOperationalAudit({
        companyId,
        actorUserId: auth.session.userId,
        entityType: 'inventory_commitment',
        entityId: materialId,
        action: 'inventory_commitment_released',
        newData: { reason: 'material_cancelled', service_order_material_id: materialId },
      })
    }
  }

  if (action === 'return') {
    const inv = await postInventoryReturnForMaterial({
      companyId,
      materialId,
      actorUserId: auth.session.userId,
    })
    inventoryHook = { returnPosting: inv }
    if (inv.ok === false) {
      await writeOperationalAudit({
        companyId,
        actorUserId: auth.session.userId,
        entityType: 'inventory_movement',
        entityId: materialId,
        action: 'inventory_posting_failed',
        newData: {
          service_order_id: orderId,
          error: inv.error ?? 'unknown',
          phase: 'return',
        },
      })
      return Response.json(
        {
          data,
          inventory: inv,
          warning: 'Retorno salvo, mas posting de estoque falhou.',
        },
        { status: 200 },
      )
    }
    await writeOperationalAudit({
      companyId,
      actorUserId: auth.session.userId,
      entityType: 'inventory_document',
      entityId: materialId,
      action: 'inventory_document_posted',
      newData: {
        service_order_id: orderId,
        phase: 'return',
        results: inv.results ?? inv,
      },
    })
    return Response.json({ data, inventory: inv, inventory_hook: inventoryHook })
  }

  return Response.json({
    data,
    ...(inventoryHook ? { inventory_hook: inventoryHook } : {}),
  })
}
