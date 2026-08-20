import {
  requireApiPermission,
  resolveAuthorizedCompanyId,
} from '@/Lib/auth/requireApi'
import {
  isBomCalculationType,
  isBomGuestBasis,
  isBomRoundingRule,
  isBomSourceType,
  parseTierJson,
} from '@/Lib/orders/operationalMaterialBom'
import { isMaterialType } from '@/Lib/orders/orderMaterials'
import { writeOperationalAudit } from '@/Lib/orders/writeOperationalAudit'
import { getSupabaseServerClient } from '@/Lib/supabaseServer'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: Request) {
  const auth = await requireApiPermission('materials.rules.view')
  if (!auth.ok) return auth.response

  const companyId = resolveAuthorizedCompanyId(auth.session)
  const url = new URL(request.url)
  const sourceType = url.searchParams.get('source_type')?.trim() || ''
  const sourceId = url.searchParams.get('source_id')?.trim() || ''

  const db = getSupabaseServerClient()
  let query = db
    .from('operational_material_rules')
    .select('*')
    .eq('company_id', companyId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (sourceType && isBomSourceType(sourceType)) {
    query = query.eq('source_type', sourceType)
  }
  if (sourceId) {
    query = query.eq('source_id', sourceId)
  }

  const { data, error } = await query
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ data: data ?? [] })
}

export async function POST(request: Request) {
  const auth = await requireApiPermission('materials.rules.manage')
  if (!auth.ok) return auth.response

  const companyId = resolveAuthorizedCompanyId(auth.session)
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Payload inválido.' }, { status: 400 })
  }

  const sourceType = String(body.source_type ?? '')
  const sourceId = String(body.source_id ?? '').trim()
  const description = String(body.material_description_snapshot ?? '').trim()
  const unit = String(body.unit ?? 'unit').trim()
  const calculationType = String(body.calculation_type ?? '')
  const materialType = String(body.material_type ?? 'consumable')
  const rounding = String(body.rounding_rule ?? 'none')

  if (!isBomSourceType(sourceType)) {
    return Response.json({ error: 'source_type inválido.' }, { status: 400 })
  }
  if (!sourceId) {
    return Response.json({ error: 'source_id obrigatório.' }, { status: 400 })
  }
  if (!description) {
    return Response.json({ error: 'Descrição obrigatória.' }, { status: 400 })
  }
  if (!unit) {
    return Response.json({ error: 'Unidade obrigatória.' }, { status: 400 })
  }
  if (!isBomCalculationType(calculationType)) {
    return Response.json({ error: 'calculation_type inválido.' }, { status: 400 })
  }
  if (!isMaterialType(materialType)) {
    return Response.json({ error: 'material_type inválido.' }, { status: 400 })
  }
  if (!isBomRoundingRule(rounding)) {
    return Response.json({ error: 'rounding_rule inválido.' }, { status: 400 })
  }

  const guestBasisRaw = body.guest_basis == null || body.guest_basis === ''
    ? null
    : String(body.guest_basis)
  if (guestBasisRaw && !isBomGuestBasis(guestBasisRaw)) {
    return Response.json({ error: 'guest_basis inválido.' }, { status: 400 })
  }

  const db = getSupabaseServerClient()

  // Validar source pertence à empresa
  if (sourceType === 'package') {
    const { data: pkg } = await db
      .from('packages')
      .select('id')
      .eq('id', sourceId)
      .eq('company_id', companyId)
      .maybeSingle()
    if (!pkg) {
      return Response.json({ error: 'Pacote inválido.' }, { status: 400 })
    }
  } else if (sourceType === 'additional') {
    const { data: item } = await db
      .from('catalog_items')
      .select('id')
      .eq('id', sourceId)
      .eq('company_id', companyId)
      .maybeSingle()
    if (!item) {
      return Response.json({ error: 'Adicional inválido.' }, { status: 400 })
    }
  }

  let catalogId =
    body.material_catalog_item_id == null || body.material_catalog_item_id === ''
      ? null
      : String(body.material_catalog_item_id)
  if (catalogId) {
    const { data: cat } = await db
      .from('catalog_items')
      .select('id')
      .eq('id', catalogId)
      .eq('company_id', companyId)
      .maybeSingle()
    if (!cat) {
      return Response.json({ error: 'Item de catálogo inválido.' }, { status: 400 })
    }
  }

  const { data, error } = await db
    .from('operational_material_rules')
    .insert({
      company_id: companyId,
      source_type: sourceType,
      source_id: sourceId,
      material_catalog_item_id: catalogId,
      material_description_snapshot: description,
      material_type: materialType,
      unit,
      calculation_type: calculationType,
      fixed_quantity:
        body.fixed_quantity == null || body.fixed_quantity === ''
          ? null
          : Number(body.fixed_quantity),
      quantity_per_guest:
        body.quantity_per_guest == null || body.quantity_per_guest === ''
          ? null
          : Number(body.quantity_per_guest),
      guest_basis: guestBasisRaw,
      min_guests:
        body.min_guests == null || body.min_guests === ''
          ? null
          : Number(body.min_guests),
      max_guests:
        body.max_guests == null || body.max_guests === ''
          ? null
          : Number(body.max_guests),
      tier_json: parseTierJson(body.tier_json),
      rounding_rule: rounding,
      enabled: body.enabled === false ? false : true,
      sort_order: Number(body.sort_order ?? 0) || 0,
      notes: body.notes == null || body.notes === '' ? null : String(body.notes),
      created_by: auth.session.userId,
      updated_by: auth.session.userId,
    })
    .select('*')
    .single()

  if (error || !data) {
    return Response.json({ error: error?.message || 'Falha ao criar regra.' }, { status: 500 })
  }

  await writeOperationalAudit({
    companyId,
    actorUserId: auth.session.userId,
    entityType: 'operational_material_rule',
    entityId: data.id,
    action: 'bom_rule_created',
    newData: {
      source_type: data.source_type,
      source_id: data.source_id,
      calculation_type: data.calculation_type,
      description: data.material_description_snapshot,
    },
  })

  return Response.json({ data }, { status: 201 })
}
