import {
  calculateBomRequiredQuantity,
  parseTierJson,
  type BomGuestBasis,
  type BomRoundingRule,
  type BomSourceType,
  type GuestCountsForBom,
  type OperationalMaterialRuleRow,
} from '@/Lib/orders/operationalMaterialBom'
import type { MaterialType } from '@/Lib/orders/orderMaterials'
import { writeOperationalAudit } from '@/Lib/orders/writeOperationalAudit'
import { getSupabaseServerClient } from '@/Lib/supabaseServer'

type SnapshotForBom = {
  package?: { id?: string | null; label?: string | null; name?: string | null }
  guest_counts?: GuestCountsForBom
  additional_items?: Array<{
    additional_item_id?: string
    quantity?: number
    selected?: boolean
    label_pt?: string | null
    item_name?: string | null
  }>
}

function asRule(row: Record<string, unknown>): OperationalMaterialRuleRow {
  return {
    id: String(row.id),
    company_id: String(row.company_id),
    source_type: row.source_type as BomSourceType,
    source_id: String(row.source_id),
    material_catalog_item_id: row.material_catalog_item_id
      ? String(row.material_catalog_item_id)
      : null,
    material_description_snapshot: String(row.material_description_snapshot),
    material_type: row.material_type as MaterialType,
    unit: String(row.unit),
    calculation_type: row.calculation_type as OperationalMaterialRuleRow['calculation_type'],
    fixed_quantity:
      row.fixed_quantity == null ? null : Number(row.fixed_quantity),
    quantity_per_guest:
      row.quantity_per_guest == null ? null : Number(row.quantity_per_guest),
    guest_basis: (row.guest_basis as BomGuestBasis | null) ?? null,
    min_guests: row.min_guests == null ? null : Number(row.min_guests),
    max_guests: row.max_guests == null ? null : Number(row.max_guests),
    tier_json: parseTierJson(row.tier_json),
    rounding_rule: (row.rounding_rule as BomRoundingRule) || 'none',
    enabled: Boolean(row.enabled),
    sort_order: Number(row.sort_order ?? 0),
    notes: row.notes == null ? null : String(row.notes),
  }
}

/**
 * Gera materiais operacionais a partir da BOM na conversão Quote→OS.
 * Idempotente por (service_order_id, bom_rule_id).
 * Estratégia: 1 linha por regra (sem consolidar quantidades entre origens).
 */
export async function generateOrderMaterialsFromBom(input: {
  companyId: string
  serviceOrderId: string
  snapshot: SnapshotForBom
  actorUserId: string | null
  sourceLabels?: {
    packageLabel?: string | null
    additionalLabels?: Record<string, string>
  }
}): Promise<{ inserted: number; skipped: number; error?: string }> {
  const db = getSupabaseServerClient()
  const packageId = input.snapshot.package?.id?.trim() || null
  const additionals = (input.snapshot.additional_items ?? []).filter(
    (a) => a.additional_item_id && a.selected !== false,
  )

  const sourceFilters: { type: BomSourceType; id: string }[] = []
  if (packageId) sourceFilters.push({ type: 'package', id: packageId })
  for (const a of additionals) {
    sourceFilters.push({ type: 'additional', id: String(a.additional_item_id) })
  }

  if (sourceFilters.length === 0) {
    return { inserted: 0, skipped: 0 }
  }

  const { data: existingRows } = await db
    .from('service_order_materials')
    .select('bom_rule_id')
    .eq('company_id', input.companyId)
    .eq('service_order_id', input.serviceOrderId)
    .not('bom_rule_id', 'is', null)

  const already = new Set(
    (existingRows ?? [])
      .map((r) => (r.bom_rule_id ? String(r.bom_rule_id) : ''))
      .filter(Boolean),
  )

  const { data: rulesRaw, error: rulesErr } = await db
    .from('operational_material_rules')
    .select('*')
    .eq('company_id', input.companyId)
    .eq('enabled', true)
    .order('sort_order', { ascending: true })

  if (rulesErr) {
    return { inserted: 0, skipped: 0, error: rulesErr.message }
  }

  const wanted = new Set(sourceFilters.map((s) => `${s.type}:${s.id}`))
  const rules = (rulesRaw ?? [])
    .map((r) => asRule(r as Record<string, unknown>))
    .filter((r) => wanted.has(`${r.source_type}:${r.source_id}`))

  if (rules.length === 0) {
    return { inserted: 0, skipped: 0 }
  }

  const guests = input.snapshot.guest_counts ?? {}
  const additionalQty = new Map<string, number>()
  for (const a of additionals) {
    const id = String(a.additional_item_id)
    additionalQty.set(id, Number(a.quantity ?? 1) || 1)
  }

  const toInsert: Record<string, unknown>[] = []
  let skipped = 0

  for (const rule of rules) {
    if (already.has(rule.id)) {
      skipped += 1
      continue
    }

    const multiplier =
      rule.source_type === 'additional'
        ? additionalQty.get(rule.source_id) ?? 1
        : 1

    const qty = calculateBomRequiredQuantity({
      rule,
      guests,
      sourceMultiplier: multiplier,
    })
    if (qty == null) {
      skipped += 1
      continue
    }

    const sourceLabel =
      rule.source_type === 'package'
        ? input.sourceLabels?.packageLabel ||
          input.snapshot.package?.label ||
          input.snapshot.package?.name ||
          'Pacote'
        : input.sourceLabels?.additionalLabels?.[rule.source_id] ||
          additionals.find((a) => a.additional_item_id === rule.source_id)
            ?.label_pt ||
          additionals.find((a) => a.additional_item_id === rule.source_id)
            ?.item_name ||
          'Adicional'

    toInsert.push({
      company_id: input.companyId,
      service_order_id: input.serviceOrderId,
      catalog_item_id: rule.material_catalog_item_id,
      bom_rule_id: rule.id,
      source_type: rule.source_type === 'rule' ? 'rule' : rule.source_type,
      source_id: rule.source_id,
      source_label_snapshot: String(sourceLabel),
      description_snapshot: rule.material_description_snapshot,
      material_type: rule.material_type,
      unit: rule.unit,
      required_quantity: qty,
      separated_quantity: 0,
      checked_quantity: 0,
      status: 'pending',
      notes: rule.notes,
      created_by: input.actorUserId,
      updated_by: input.actorUserId,
    })
  }

  if (toInsert.length === 0) {
    return { inserted: 0, skipped }
  }

  const { data: insertedRows, error: insErr } = await db
    .from('service_order_materials')
    .insert(toInsert)
    .select('id')

  if (insErr) {
    if (/duplicate|unique/i.test(insErr.message)) {
      return { inserted: 0, skipped: skipped + toInsert.length }
    }
    return { inserted: 0, skipped, error: insErr.message }
  }

  const inserted = insertedRows?.length ?? toInsert.length

  await writeOperationalAudit({
    companyId: input.companyId,
    actorUserId: input.actorUserId,
    entityType: 'service_order',
    entityId: input.serviceOrderId,
    action: 'order_materials_generated',
    newData: {
      service_order_id: input.serviceOrderId,
      lines: inserted,
      skipped,
      package_id: packageId,
      additional_count: additionals.length,
    },
  })

  return { inserted, skipped }
}
