import { getCdlCompanyId } from '@/Lib/cdlCompany'
import {
  buildCommercialRulesListSelect,
  parseCommercialRuleValue,
} from '@/Lib/commercialRulesTableSchema'
import { DEFAULT_COMMERCIAL_RULE_SEEDS } from '@/Lib/defaultCommercialRulesSeed'
import { fetchSupabaseCommercialRules } from '@/Lib/supabaseCommercialRules'
import { getSupabaseServerClient } from '@/Lib/supabaseServer'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const RULE_TABLE = 'commercial_rules'

export async function POST() {
  const companyId = getCdlCompanyId()
  if (!companyId?.trim()) {
    return Response.json({ error: 'company_id não configurado.' }, { status: 500 })
  }

  const db = getSupabaseServerClient()
  const { error: probeError } = await db.from(RULE_TABLE).select('id').limit(1)

  if (probeError) {
    return Response.json(
      {
        error:
          'Tabela commercial_rules não encontrada. Execute scripts/sql/commercial-rules-key-value.sql.',
      },
      { status: 409 },
    )
  }

  const { data: existingRows, error: existingError } = await db
    .from(RULE_TABLE)
    .select('rule_key')
    .or(`company_id.eq.${companyId},company_id.is.null`)

  if (existingError) {
    return Response.json({ error: existingError.message }, { status: 500 })
  }

  const existingKeys = new Set(
    (existingRows ?? []).map((row) => String((row as { rule_key?: string }).rule_key ?? '')),
  )

  const rows = DEFAULT_COMMERCIAL_RULE_SEEDS.filter(
    (seed) => !existingKeys.has(seed.rule_key),
  ).map((seed) => ({
    company_id: companyId,
    rule_key: seed.rule_key,
    rule_value: seed.rule_value,
    active: seed.active !== false,
  }))

  if (rows.length > 0) {
    const { error } = await db.from(RULE_TABLE).insert(rows)

    if (error) {
      return Response.json({ error: error.message }, { status: 500 })
    }
  }

  const { data: inserted } = await db
    .from(RULE_TABLE)
    .select(buildCommercialRulesListSelect())
    .or(`company_id.eq.${companyId},company_id.is.null`)
    .order('rule_key', { ascending: true })

  const rules = await fetchSupabaseCommercialRules()

  return Response.json({
    data: (inserted ?? []).map((row) => {
      const typed = row as unknown as Record<string, unknown>
      return {
        ...typed,
        rule_value: parseCommercialRuleValue(typed.rule_value),
      }
    }),
    rules,
    seeded: rows.length,
  })
}
