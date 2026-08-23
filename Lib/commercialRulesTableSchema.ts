/**
 * Colunas reais de `public.commercial_rules` (schema-safe).
 * `rule_value` é jsonb: { value, type, label_pt, unit? }
 */
export type CommercialRuleValue = {
  value: string | number | boolean
  type: string
  label_pt: string
  unit?: string
}

export const COMMERCIAL_RULES_TABLE_COLUMNS = [
  'id',
  'company_id',
  'rule_key',
  'rule_value',
  'active',
  'created_at',
  'updated_at',
] as const

export type CommercialRulesTableColumn =
  (typeof COMMERCIAL_RULES_TABLE_COLUMNS)[number]

export type CommercialRuleRow = {
  id: string
  company_id?: string | null
  rule_key: string
  rule_value: CommercialRuleValue | null
  active: boolean | null
  created_at?: string | null
  updated_at?: string | null
}

export const COMMERCIAL_RULES_INSERT_COLUMNS = [
  'company_id',
  'rule_key',
  'rule_value',
  'active',
] as const satisfies ReadonlyArray<CommercialRulesTableColumn>

export type CommercialRulesInsertPayload = Partial<
  Record<
    (typeof COMMERCIAL_RULES_INSERT_COLUMNS)[number],
    string | boolean | CommercialRuleValue | null
  >
>

export const COMMERCIAL_RULES_LIST_COLUMNS = [
  'id',
  'company_id',
  'rule_key',
  'rule_value',
  'active',
  'created_at',
  'updated_at',
] as const

export function buildCommercialRulesListSelect(): string {
  return COMMERCIAL_RULES_LIST_COLUMNS.join(', ')
}

export function parseCommercialRuleValue(
  raw: unknown,
): CommercialRuleValue | null {
  if (!raw || typeof raw !== 'object') return null
  const obj = raw as Record<string, unknown>
  if (obj.value === undefined) return null
  return {
    value: obj.value as string | number | boolean,
    type: String(obj.type ?? 'text'),
    label_pt: String(obj.label_pt ?? ''),
    ...(obj.unit != null && obj.unit !== ''
      ? { unit: String(obj.unit) }
      : {}),
  }
}

export function formatCommercialRuleDisplayValue(
  ruleValue: CommercialRuleValue | null | undefined,
): string {
  if (!ruleValue) return '—'
  const base = String(ruleValue.value ?? '')
  if (ruleValue.type === 'json' && base.length > 120) {
    return `${base.slice(0, 120)}…`
  }
  if (ruleValue.unit?.trim()) {
    return `${base} ${ruleValue.unit.trim()}`
  }
  return base || '—'
}

export function pickCommercialRulesInsertPayload(
  row: CommercialRulesInsertPayload,
): Record<string, string | boolean | CommercialRuleValue | null> {
  const payload: Record<string, string | boolean | CommercialRuleValue | null> =
    {}

  for (const key of COMMERCIAL_RULES_INSERT_COLUMNS) {
    if (!(key in row)) continue
    const value = row[key]
    if (value === undefined) continue
    if (key === 'rule_value' && value != null) {
      const parsed = parseCommercialRuleValue(value)
      if (parsed) payload[key] = parsed
      continue
    }
    if (typeof value === 'string' && value.trim() === '') continue
    payload[key] = value as string | boolean | CommercialRuleValue | null
  }

  return payload
}

export function pickCommercialRulesUpdatePayload(
  row: CommercialRulesInsertPayload,
): Record<string, string | boolean | CommercialRuleValue | null> {
  const payload = pickCommercialRulesInsertPayload(row)
  delete payload.company_id
  return payload
}
