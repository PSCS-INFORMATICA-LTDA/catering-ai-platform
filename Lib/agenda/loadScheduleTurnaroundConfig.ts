import {
  configFromCommercialRuleValue,
  DEFAULT_SCHEDULE_TURNAROUND_CONFIG,
  SCHEDULE_TURNAROUND_RULE_KEY,
  type ScheduleTurnaroundConfig,
} from '@/Lib/agenda/scheduleTurnaround'
import { getSupabaseServerClient } from '@/Lib/supabaseServer'

/**
 * Carrega config de janela operacional da empresa.
 * Sem regra ativa → fallback seguro (gap 0), sem herdar CDL.
 */
export async function loadScheduleTurnaroundConfig(
  companyId: string,
): Promise<{
  config: ScheduleTurnaroundConfig
  source: 'company_rule' | 'safe_default'
}> {
  const { data, error } = await getSupabaseServerClient()
    .from('commercial_rules')
    .select('rule_value, active')
    .eq('company_id', companyId)
    .eq('rule_key', SCHEDULE_TURNAROUND_RULE_KEY)
    .eq('active', true)
    .maybeSingle()

  if (error || !data?.rule_value) {
    return {
      config: DEFAULT_SCHEDULE_TURNAROUND_CONFIG,
      source: 'safe_default',
    }
  }

  return {
    config: configFromCommercialRuleValue(data.rule_value),
    source: 'company_rule',
  }
}
