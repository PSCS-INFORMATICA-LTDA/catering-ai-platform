import {
  requireApiPermission,
  resolveAuthorizedCompanyId,
} from '@/Lib/auth/requireApi'
import {
  isBomCalculationType,
  isBomGuestBasis,
  isBomRoundingRule,
  parseTierJson,
} from '@/Lib/orders/operationalMaterialBom'
import { isMaterialType } from '@/Lib/orders/orderMaterials'
import { writeOperationalAudit } from '@/Lib/orders/writeOperationalAudit'
import { getSupabaseServerClient } from '@/Lib/supabaseServer'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type Params = { params: Promise<{ ruleId: string }> }

export async function PATCH(request: Request, { params }: Params) {
  const auth = await requireApiPermission('materials.rules.manage')
  if (!auth.ok) return auth.response

  const { ruleId } = await params
  const companyId = resolveAuthorizedCompanyId(auth.session)
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Payload inválido.' }, { status: 400 })
  }

  const db = getSupabaseServerClient()
  const { data: current } = await db
    .from('operational_material_rules')
    .select('*')
    .eq('id', ruleId)
    .eq('company_id', companyId)
    .maybeSingle()

  if (!current) {
    return Response.json({ error: 'Regra não encontrada.' }, { status: 404 })
  }

  const patch: Record<string, unknown> = {
    updated_by: auth.session.userId,
  }

  if (body.material_description_snapshot != null) {
    const d = String(body.material_description_snapshot).trim()
    if (!d) return Response.json({ error: 'Descrição obrigatória.' }, { status: 400 })
    patch.material_description_snapshot = d
  }
  if (body.unit != null) {
    const u = String(body.unit).trim()
    if (!u) return Response.json({ error: 'Unidade obrigatória.' }, { status: 400 })
    patch.unit = u
  }
  if (body.material_type != null) {
    if (!isMaterialType(String(body.material_type))) {
      return Response.json({ error: 'material_type inválido.' }, { status: 400 })
    }
    patch.material_type = body.material_type
  }
  if (body.calculation_type != null) {
    if (!isBomCalculationType(String(body.calculation_type))) {
      return Response.json({ error: 'calculation_type inválido.' }, { status: 400 })
    }
    patch.calculation_type = body.calculation_type
  }
  if (body.rounding_rule != null) {
    if (!isBomRoundingRule(String(body.rounding_rule))) {
      return Response.json({ error: 'rounding_rule inválido.' }, { status: 400 })
    }
    patch.rounding_rule = body.rounding_rule
  }
  if (body.guest_basis !== undefined) {
    if (body.guest_basis == null || body.guest_basis === '') {
      patch.guest_basis = null
    } else if (!isBomGuestBasis(String(body.guest_basis))) {
      return Response.json({ error: 'guest_basis inválido.' }, { status: 400 })
    } else {
      patch.guest_basis = body.guest_basis
    }
  }
  if (body.fixed_quantity !== undefined) {
    patch.fixed_quantity =
      body.fixed_quantity == null || body.fixed_quantity === ''
        ? null
        : Number(body.fixed_quantity)
  }
  if (body.quantity_per_guest !== undefined) {
    patch.quantity_per_guest =
      body.quantity_per_guest == null || body.quantity_per_guest === ''
        ? null
        : Number(body.quantity_per_guest)
  }
  if (body.min_guests !== undefined) {
    patch.min_guests =
      body.min_guests == null || body.min_guests === ''
        ? null
        : Number(body.min_guests)
  }
  if (body.max_guests !== undefined) {
    patch.max_guests =
      body.max_guests == null || body.max_guests === ''
        ? null
        : Number(body.max_guests)
  }
  if (body.tier_json !== undefined) {
    patch.tier_json = parseTierJson(body.tier_json)
  }
  if (body.sort_order !== undefined) {
    patch.sort_order = Number(body.sort_order) || 0
  }
  if (body.notes !== undefined) {
    patch.notes = body.notes == null || body.notes === '' ? null : String(body.notes)
  }
  if (body.material_catalog_item_id !== undefined) {
    patch.material_catalog_item_id =
      body.material_catalog_item_id == null || body.material_catalog_item_id === ''
        ? null
        : String(body.material_catalog_item_id)
  }

  let auditAction: 'bom_rule_updated' | 'bom_rule_disabled' = 'bom_rule_updated'
  if (body.enabled !== undefined) {
    patch.enabled = Boolean(body.enabled)
    if (patch.enabled === false) auditAction = 'bom_rule_disabled'
  }

  const { data, error } = await db
    .from('operational_material_rules')
    .update(patch)
    .eq('id', ruleId)
    .eq('company_id', companyId)
    .select('*')
    .single()

  if (error || !data) {
    return Response.json({ error: error?.message || 'Falha ao atualizar.' }, { status: 500 })
  }

  await writeOperationalAudit({
    companyId,
    actorUserId: auth.session.userId,
    entityType: 'operational_material_rule',
    entityId: ruleId,
    action: auditAction,
    oldData: {
      enabled: current.enabled,
      calculation_type: current.calculation_type,
    },
    newData: {
      source_type: data.source_type,
      source_id: data.source_id,
      enabled: data.enabled,
      calculation_type: data.calculation_type,
    },
  })

  return Response.json({ data })
}
