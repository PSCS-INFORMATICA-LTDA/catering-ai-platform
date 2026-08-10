import {
  requireApiPermission,
  resolveAuthorizedCompanyId,
} from '@/Lib/auth/requireApi'
import {
  deriveMaterialStatus,
  isMaterialType,
  parseNonNegativeQuantity,
  type MaterialStatus,
  type MaterialType,
} from '@/Lib/orders/orderMaterials'
import { writeOperationalAudit } from '@/Lib/orders/writeOperationalAudit'
import { getSupabaseServerClient } from '@/Lib/supabaseServer'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type Params = { params: Promise<{ id: string; materialId: string }> }

type MaterialRow = {
  id: string
  company_id: string
  service_order_id: string
  description_snapshot: string
  material_type: MaterialType
  unit: string
  required_quantity: number
  separated_quantity: number
  checked_quantity: number
  status: MaterialStatus
  notes: string | null
  separated_by_user_id: string | null
  separated_at: string | null
  checked_by_user_id: string | null
  checked_at: string | null
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
    notes?: string | null
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
    | 'material_divergence' = 'material_updated'

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
    })
    patch.status = next
    auditAction = next === 'divergence' ? 'material_divergence' : 'material_checked'
  } else {
    // update metadata / required
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

    const required = Number(patch.required_quantity ?? current.required_quantity)
    const separated = Number(current.separated_quantity)
    const checked = Number(current.checked_quantity)
    const hasChecked = Boolean(current.checked_at)
    if (current.status !== 'cancelled') {
      patch.status = deriveMaterialStatus({
        required,
        separated,
        checked,
        hasChecked,
        currentStatus: current.status,
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
    },
    newData: {
      service_order_id: orderId,
      status: data.status,
      required_quantity: data.required_quantity,
      separated_quantity: data.separated_quantity,
      checked_quantity: data.checked_quantity,
    },
  })

  return Response.json({ data })
}
