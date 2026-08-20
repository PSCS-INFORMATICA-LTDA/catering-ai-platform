import CommercialRulesDashboard from '@/components/CommercialRulesDashboard'
import { getCdlCompanyId } from '@/Lib/cdlCompany'
import {
  buildCommercialRulesListSelect,
  parseCommercialRuleValue,
  type CommercialRuleRow,
} from '@/Lib/commercialRulesTableSchema'
import {
  fetchSupabaseCommercialRules,
  getFallbackCommercialRules,
} from '@/Lib/supabaseCommercialRules'
import { getSupabaseServerClient } from '@/Lib/supabaseServer'

export const dynamic = 'force-dynamic'
export const revalidate = 0

async function fetchRuleRows(): Promise<CommercialRuleRow[]> {
  const companyId = getCdlCompanyId()
  const db = getSupabaseServerClient()
  const { data, error } = await db
    .from('commercial_rules')
    .select(buildCommercialRulesListSelect())
    .or(`company_id.eq.${companyId},company_id.is.null`)
    .order('rule_key', { ascending: true })

  if (error) {
    console.error('[commercial-rules] fetchRuleRows:', error.message)
    return []
  }
  return (data ?? []).map((row) => {
    const typed = row as unknown as Record<string, unknown>
    return {
      ...typed,
      rule_value: parseCommercialRuleValue(typed.rule_value),
    } as CommercialRuleRow
  })
}

async function tableExists() {
  const { error } = await getSupabaseServerClient()
    .from('commercial_rules')
    .select('id')
    .limit(1)
  return !error
}

export default async function CommercialRulesPage() {
  const [rules, exists, rows] = await Promise.all([
    fetchSupabaseCommercialRules(),
    tableExists(),
    fetchRuleRows(),
  ])

  return (
    <CommercialRulesDashboard
      initialData={{
        rules,
        rows,
        editable: exists,
        table: exists ? 'commercial_rules' : null,
        fallback: getFallbackCommercialRules(),
      }}
    />
  )
}
