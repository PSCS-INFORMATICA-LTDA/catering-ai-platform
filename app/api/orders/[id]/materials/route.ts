import {
  requireApiPermission,
  resolveAuthorizedCompanyId,
} from '@/Lib/auth/requireApi'
import {
  deriveMaterialStatus,
  inferMaterialTypeFromCatalog,
  isMaterialSourceType,
  isMaterialType,
  parseNonNegativeQuantity,
  type MaterialSourceType,
  type MaterialType,
} from '@/Lib/orders/orderMaterials'
import { writeOperationalAudit } from '@/Lib/orders/writeOperationalAudit'
import { getSupabaseServerClient } from '@/Lib/supabaseServer'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type Params = { params: Promise<{ id: string }> }

async function assertOrderInCompany(companyId: string, serviceOrderId: string) {
  const db = getSupabaseServerClient()
  const { data } = await db
    .from('service_orders')
    .select('id')
    .eq('id', serviceOrderId)
    .eq('company_id', companyId)
    .maybeSingle()
  return Boolean(data)
}

export async function GET(_request: Request, { params }: Params) {
  const auth = await requireApiPermission('orders.materials.view')
  if (!auth.ok) return auth.response

  const { id } = await params
  const companyId = resolveAuthorizedCompanyId(auth.session)
  if (!(await assertOrderInCompany(companyId, id))) {
    return Response.json({ error: 'Ordem de Serviço não encontrada.' }, { status: 404 })
  }

  const db = getSupabaseServerClient()
  const { data, error } = await db
    .from('service_order_materials')
    .select('*')
    .eq('company_id', companyId)
    .eq('service_order_id', id)
    .order('created_at', { ascending: true })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ data: data ?? [] })
}

export async function POST(request: Request, { params }: Params) {
  const auth = await requireApiPermission('orders.materials.prepare')
  if (!auth.ok) return auth.response

  const { id } = await params
  const companyId = resolveAuthorizedCompanyId(auth.session)
  if (!(await assertOrderInCompany(companyId, id))) {
    return Response.json({ error: 'Ordem de Serviço não encontrada.' }, { status: 404 })
  }

  let body: {
    catalog_item_id?: string | null
    source_type?: string
    source_id?: string | null
    description_snapshot?: string
    material_type?: string
    unit?: string
    required_quantity?: number
    notes?: string | null
  }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Payload inválido.' }, { status: 400 })
  }

  const db = getSupabaseServerClient()
  let description = body.description_snapshot?.trim() || ''
  let unit = body.unit?.trim() || 'unit'
  let materialType: MaterialType = isMaterialType(body.material_type ?? '')
    ? (body.material_type as MaterialType)
    : 'consumable'
  let catalogItemId: string | null = body.catalog_item_id?.trim() || null

  if (catalogItemId) {
    const { data: item, error: itemErr } = await db
      .from('catalog_items')
      .select('id, item_name, label_pt, unit, unit_label, item_type, operational_item, company_id')
      .eq('id', catalogItemId)
      .eq('company_id', companyId)
      .maybeSingle()
    if (itemErr || !item) {
      return Response.json({ error: 'Item de catálogo inválido.' }, { status: 400 })
    }
    if (!description) {
      description =
        item.label_pt?.trim() ||
        item.item_name?.trim() ||
        'Material'
    }
    if (!body.unit?.trim()) {
      unit = item.unit_label?.trim() || item.unit?.trim() || 'unit'
    }
    if (!body.material_type) {
      materialType = inferMaterialTypeFromCatalog(item)
    }
  }

  if (!description) {
    return Response.json({ error: 'Descrição é obrigatória.' }, { status: 400 })
  }

  const qty = parseNonNegativeQuantity(body.required_quantity ?? 0)
  if (!qty.ok) return Response.json({ error: qty.error }, { status: 400 })

  const sourceType: MaterialSourceType = isMaterialSourceType(body.source_type ?? '')
    ? (body.source_type as MaterialSourceType)
    : catalogItemId
      ? 'rule'
      : 'manual'

  const status = deriveMaterialStatus({
    required: qty.value,
    separated: 0,
    checked: 0,
    hasChecked: false,
  })

  const { data, error } = await db
    .from('service_order_materials')
    .insert({
      company_id: companyId,
      service_order_id: id,
      catalog_item_id: catalogItemId,
      source_type: sourceType,
      source_id: body.source_id?.trim() || null,
      description_snapshot: description,
      material_type: materialType,
      unit,
      required_quantity: qty.value,
      separated_quantity: 0,
      checked_quantity: 0,
      status,
      notes: body.notes?.trim() || null,
      created_by: auth.session.userId,
      updated_by: auth.session.userId,
    })
    .select('*')
    .single()

  if (error || !data) {
    return Response.json({ error: error?.message || 'Falha ao criar material.' }, { status: 500 })
  }

  await writeOperationalAudit({
    companyId,
    actorUserId: auth.session.userId,
    entityType: 'service_order_material',
    entityId: data.id,
    action: 'material_created',
    newData: {
      service_order_id: id,
      description_snapshot: data.description_snapshot,
      required_quantity: data.required_quantity,
      status: data.status,
      source_type: data.source_type,
    },
  })

  return Response.json({ data }, { status: 201 })
}
